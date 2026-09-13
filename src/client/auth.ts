import crypto from 'crypto';
import { RegruConfig } from './types.js';

/**
 * Recursively collect scalar string values for REG.API RSA-SHA512 signature,
 * matching official Perl `_make_text_for_sig`:
 * - arrays: flatten element values
 * - hashes: recurse into values (skip key `sig`); do not include keys
 * - skip empty / zero / null / undefined (Perl-falsy scalars)
 */
export function collectSigValues(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectSigValues);
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'sig')
      .flatMap(([, nested]) => collectSigValues(nested));
  }

  // Perl: `not ref $d and $d` — skip 0, '', false
  if (value === 0 || value === '' || value === false) {
    return [];
  }

  return [String(value)];
}

/**
 * Build the UTF-8 text that is signed: sorted scalar values joined with `;`.
 * Prefer calling this on the structured params tree BEFORE JSON.stringify(input_data).
 */
export function makeTextForSig(params: unknown): string {
  return collectSigValues(params).sort().join(';');
}

/**
 * Sign full outbound request params with RSA-SHA512, return Base64 `sig`.
 */
export function signRequestParams(
  params: Record<string, unknown>,
  privateKey: string
): string {
  const text = makeTextForSig(params);
  const sign = crypto.createSign('RSA-SHA512');
  sign.update(text, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * Top-level auth fields only (username + password).
 * Signature (`sig`) is computed later on the full merged params tree.
 */
export function buildAuthParams(config: RegruConfig): Record<string, string> {
  const authParams: Record<string, string> = {
    username: config.username,
  };

  if (config.privateKey) {
    // Signature auth: username only here; `sig` appended after merge+sign
  } else if (config.password) {
    authParams.password = config.password;
  } else {
    throw new Error('Either password or privateKey must be provided');
  }

  return authParams;
}

export function validateConfig(config: RegruConfig): void {
  if (!config.username) {
    throw new Error('Username is required');
  }

  if (!config.password && !config.privateKey) {
    throw new Error('Either password or privateKey must be provided');
  }
}
