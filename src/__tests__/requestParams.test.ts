import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import {
  buildAuthParams,
  collectSigValues,
  makeTextForSig,
  signRequestParams,
} from '../client/auth.js';
import {
  buildFormData,
  finalizeRequestParams,
  mergeRequestParams,
} from '../client/requestParams.js';

describe('form/auth param placement', () => {
  it('keeps username/password at top level, outside input_data JSON', () => {
    const auth = buildAuthParams({ username: 'test', password: 'test' });
    const merged = mergeRequestParams(auth, {
      input_data: {
        domains: [{ dname: 'example.ru' }],
        username: 'should-not-override-auth-in-json',
      },
    });

    expect(merged.username).toBe('test');
    expect(merged.password).toBe('test');
    expect(merged.input_format).toBe('json');
    expect(merged.output_format).toBe('json');
    expect(typeof merged.input_data).toBe('string');

    const parsed = JSON.parse(String(merged.input_data));
    expect(parsed.domains[0].dname).toBe('example.ru');
    expect(merged.username).toBe('test');
  });

  it('serializes form body with auth outside nested JSON', () => {
    const auth = buildAuthParams({ username: 'apiuser', password: 'secret' });
    const merged = mergeRequestParams(auth, {
      currency: 'RUR',
      input_data: { word: 'дом' },
    });
    const body = buildFormData(merged);

    expect(body).toContain('username=apiuser');
    expect(body).toContain('password=secret');
    expect(body).toContain('currency=RUR');
    expect(body).toContain('input_format=json');
    expect(decodeURIComponent(body)).toContain('"word":"дом"');
    const inputDataPart = body.split('input_data=')[1]?.split('&')[0] ?? '';
    expect(decodeURIComponent(inputDataPart)).not.toContain('password');
  });

  it('requires password or privateKey', () => {
    expect(() => buildAuthParams({ username: 'x' })).toThrow(/password or privateKey/i);
  });

  it('does not put sig into buildAuthParams when using privateKey', () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const auth = buildAuthParams({
      username: 'test',
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    });
    expect(auth).toEqual({ username: 'test' });
    expect(auth).not.toHaveProperty('sig');
    expect(auth).not.toHaveProperty('password');
  });
});

describe('RSA-SHA512 signature text (official Perl _make_text_for_sig)', () => {
  it('matches official fixture: 1;1;2;3;plain;qqq.ru;test', () => {
    // Docs example (signature auth, no password):
    // username=test, output_content_type=plain, show_input_params=1,
    // domain_name=qqq.ru, leftdata=[1,2,3]
    const params = {
      username: 'test',
      output_content_type: 'plain',
      show_input_params: 1,
      domain_name: 'qqq.ru',
      leftdata: [1, 2, 3],
    };
    expect(makeTextForSig(params)).toBe('1;1;2;3;plain;qqq.ru;test');
  });

  it('skips empty, zero, null, undefined and key sig', () => {
    const values = collectSigValues({
      username: 'u',
      empty: '',
      zero: 0,
      nada: null,
      missing: undefined,
      sig: 'MUST-SKIP',
      nested: { a: 'x', sig: 'also-skip', z: 0 },
      list: ['a', '', 0, 'b'],
    });
    expect(values.sort()).toEqual(['a', 'b', 'u', 'x']);
  });

  it('flattens nested input_data object before stringify (Perl domain/create pattern)', () => {
    const structured = mergeRequestParams(
      { username: 'pppp' },
      {
        input_format: 'json',
        input_data: {
          domain_name: 'example.ru',
          enduser_ip: '10.11.12.13',
          nss: {},
        },
        show_input_params: '1',
      },
      { stringifyInputData: false }
    );

    expect(typeof structured.input_data).toBe('object');
    const text = makeTextForSig(structured);
    // Nested scalars participate individually; empty hash contributes nothing
    // input_format=json and output_format=json each contribute "json"
    expect(text.split(';').sort()).toEqual(
      ['1', '10.11.12.13', 'example.ru', 'json', 'json', 'pppp'].sort()
    );

    const withSig = { ...structured, sig: 'PLACEHOLDER' };
    // sig value itself must not affect collection when key is sig
    expect(makeTextForSig(withSig)).toBe(text);

    const finalized = finalizeRequestParams(withSig);
    expect(typeof finalized.input_data).toBe('string');
    expect(JSON.parse(String(finalized.input_data)).domain_name).toBe('example.ru');
  });

  it('signs full outbound params, not only username', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const params = {
      username: 'test',
      output_content_type: 'plain',
      show_input_params: 1,
      domain_name: 'qqq.ru',
      leftdata: [1, 2, 3],
    };

    const sig = signRequestParams(params, pem);
    const expectedText = '1;1;2;3;plain;qqq.ru;test';

    const verify = crypto.createVerify('RSA-SHA512');
    verify.update(expectedText, 'utf8');
    verify.end();
    expect(verify.verify(pubPem, sig, 'base64')).toBe(true);

    // Signing only username must NOT verify against the full text
    const wrong = crypto.createSign('RSA-SHA512');
    wrong.update('test', 'utf8');
    wrong.end();
    const usernameOnlySig = wrong.sign(pem, 'base64');
    const verifyWrong = crypto.createVerify('RSA-SHA512');
    verifyWrong.update(expectedText, 'utf8');
    verifyWrong.end();
    expect(verifyWrong.verify(pubPem, usernameOnlySig, 'base64')).toBe(false);
  });
});
