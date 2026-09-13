import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RateLimiter } from '../client/RegruApiClient.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows acquiring up to maxTokens without waiting', async () => {
    const limiter = new RateLimiter(3, 18);

    await expect(limiter.acquire()).resolves.toBeUndefined();
    await expect(limiter.acquire()).resolves.toBeUndefined();
    await expect(limiter.acquire()).resolves.toBeUndefined();
    expect(limiter.availableTokens).toBeLessThan(1);
  });

  it('waits when tokens are exhausted', async () => {
    const limiter = new RateLimiter(1, 60); // ~1 token/sec refill

    await limiter.acquire();
    expect(limiter.availableTokens).toBeLessThan(1);

    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    await jest.advanceTimersByTimeAsync(1100);
    await pending;
    expect(resolved).toBe(true);
  });
});
