import crypto from 'crypto';
import { RegruConfig } from './types.js';

export function buildAuthParams(config: RegruConfig): Record<string, string> {
  const authParams: Record<string, string> = {
    username: config.username,
  };

  if (config.privateKey) {
    const sign = crypto.createSign('RSA-SHA512');
    sign.update(config.username);
    sign.end();
    const signature = sign.sign(config.privateKey, 'base64');
    authParams.sig = signature;
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
