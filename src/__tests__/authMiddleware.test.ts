import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import {
  safeEqualToken,
  parseBearerToken,
  normalizeIp,
  ipMatchesCidr,
  isIpAllowed,
  parseAllowedIps,
  getClientIp,
  createAuthMiddleware,
} from '../http/auth.js';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

describe('safeEqualToken', () => {
  it('accepts equal tokens', () => {
    expect(safeEqualToken('secret-token-abc', 'secret-token-abc')).toBe(true);
  });

  it('rejects different tokens of same length', () => {
    expect(safeEqualToken('secret-token-abc', 'secret-token-xyz')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    expect(safeEqualToken('short', 'much-longer-token')).toBe(false);
    expect(safeEqualToken('much-longer-token', 'short')).toBe(false);
  });
});

describe('parseBearerToken', () => {
  it('parses Bearer scheme', () => {
    expect(parseBearerToken('Bearer my-token')).toBe('my-token');
    expect(parseBearerToken('bearer my-token')).toBe('my-token');
  });

  it('returns null for missing or invalid', () => {
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken('')).toBeNull();
    expect(parseBearerToken('Basic abc')).toBeNull();
    expect(parseBearerToken('Bearer')).toBeNull();
  });
});

describe('IP helpers', () => {
  it('normalizes IPv4-mapped IPv6', () => {
    expect(normalizeIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
  });

  it('matches exact IP and CIDR', () => {
    expect(ipMatchesCidr('203.0.113.10', '203.0.113.10')).toBe(true);
    expect(ipMatchesCidr('203.0.113.10', '203.0.113.0/24')).toBe(true);
    expect(ipMatchesCidr('203.0.113.10', '198.51.100.0/24')).toBe(false);
    expect(ipMatchesCidr('2001:db8::1', '2001:db8::/32')).toBe(true);
    expect(ipMatchesCidr('2001:db8::1', '2001:db9::/32')).toBe(false);
  });

  it('parseAllowedIps splits comma list', () => {
    expect(parseAllowedIps(' 1.2.3.4, 10.0.0.0/8 ')).toEqual(['1.2.3.4', '10.0.0.0/8']);
    expect(parseAllowedIps(undefined)).toEqual([]);
    expect(parseAllowedIps('')).toEqual([]);
  });

  it('isIpAllowed allows all when rules empty', () => {
    expect(isIpAllowed('1.2.3.4', [])).toBe(true);
    expect(isIpAllowed('1.2.3.4', ['10.0.0.0/8'])).toBe(false);
    expect(isIpAllowed('10.1.2.3', ['10.0.0.0/8'])).toBe(true);
  });

  it('getClientIp prefers req.ip', () => {
    const req = {
      ip: '203.0.113.5',
      headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('getClientIp falls back to first X-Forwarded-For hop', () => {
    const req = {
      ip: undefined,
      headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    expect(getClientIp(req)).toBe('198.51.100.9');
  });
});

describe('createAuthMiddleware', () => {
  const token = 'test-secret-token-0123456789abcdef';

  it('calls next when Bearer token matches', () => {
    const mw = createAuthMiddleware({ token });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 + WWW-Authenticate when token missing', () => {
    const mw = createAuthMiddleware({ token });
    const req = {
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body).toEqual({
      error: 'unauthorized',
      message: 'Authentication required',
    });
  });

  it('returns 401 when token wrong (same response shape)', () => {
    const mw = createAuthMiddleware({ token });
    const req = {
      headers: { authorization: 'Bearer wrong-token-xxxxxxxxxxxx' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('returns 403 when IP not allowlisted', () => {
    const mw = createAuthMiddleware({
      token,
      allowedIps: ['10.0.0.0/8'],
    });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'forbidden',
      message: 'Access denied',
    });
  });

  it('accepts when IP and token both ok', () => {
    const mw = createAuthMiddleware({
      token,
      allowedIps: ['203.0.113.0/24'],
    });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      ip: '203.0.113.44',
      socket: { remoteAddress: '203.0.113.44' },
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
