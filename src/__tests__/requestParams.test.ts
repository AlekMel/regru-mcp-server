import { describe, it, expect } from '@jest/globals';
import { buildAuthParams } from '../client/auth.js';
import { buildFormData, mergeRequestParams } from '../client/requestParams.js';

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
      input_data: { word: '\u0434\u043e\u043c' },
    });
    const body = buildFormData(merged);

    expect(body).toContain('username=apiuser');
    expect(body).toContain('password=secret');
    expect(body).toContain('currency=RUR');
    expect(body).toContain('input_format=json');
    expect(decodeURIComponent(body)).toContain('"word":"\u0434\u043e\u043c"');
    const inputDataPart = body.split('input_data=')[1]?.split('&')[0] ?? '';
    expect(decodeURIComponent(inputDataPart)).not.toContain('password');
  });

  it('requires password or privateKey', () => {
    expect(() => buildAuthParams({ username: 'x' })).toThrow(/password or privateKey/i);
  });
});
