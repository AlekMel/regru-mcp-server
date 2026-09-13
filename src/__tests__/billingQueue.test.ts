import { describe, it, expect } from '@jest/globals';
import { BillingQueue } from '../client/RegruApiClient.js';

describe('BillingQueue', () => {
  it('runs tasks sequentially', async () => {
    const queue = new BillingQueue();
    const order: number[] = [];

    const task = (id: number, delayMs: number) =>
      queue.enqueue(async () => {
        order.push(id * 10);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        order.push(id);
        return id;
      });

    const results = await Promise.all([task(1, 30), task(2, 10), task(3, 5)]);

    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([10, 1, 20, 2, 30, 3]);
  });

  it('propagates errors without blocking later tasks', async () => {
    const queue = new BillingQueue();

    const failing = queue.enqueue(async () => {
      throw new Error('boom');
    });
    const succeeding = queue.enqueue(async () => 'ok');

    await expect(failing).rejects.toThrow('boom');
    await expect(succeeding).resolves.toBe('ok');
  });
});
