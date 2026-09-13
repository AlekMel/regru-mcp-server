import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Constant-time string comparison. Length mismatch never calls timingSafeEqual
 * with unequal buffers (which throws); we still do a dummy compare to reduce
 * trivial timing oracles, then return false.
 */
export function safeEqualToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    // Dummy compare so path isn't free; result discarded.
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/** Normalize IPv4-mapped IPv6 (:ffff:x.x.x.x) to IPv4. */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim().replace(/^\[|\]$/g, '');
  if (trimmed.toLowerCase().startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

/**
 * Client IP for allowlisting.
 * Prefer Express `req.ip` when trust proxy is enabled; otherwise first hop of
 * X-Forwarded-For (left-most = original client when proxy appends correctly).
 */
export function getClientIp(req: Request): string {
  const fromExpress = req.ip ? normalizeIp(req.ip) : '';
  if (fromExpress) {
    return fromExpress;
  }
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const first = xff.split(',')[0]?.trim();
    if (first) {
      return normalizeIp(first);
    }
  }
  const fallback = req.socket.remoteAddress ?? '';
  return normalizeIp(fallback);
}

function ipv4ToInt(ip: string): number | null {
  if (isIP(ip) !== 4) {
    return null;
  }
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function ipv6ToBigInt(ip: string): bigint | null {
  if (isIP(ip) !== 6) {
    return null;
  }
  // Expand :: and split into 8 hextets
  const lower = ip.toLowerCase();
  const sides = lower.split('::');
  let hextets: string[];
  if (sides.length === 1) {
    hextets = lower.split(':');
  } else if (sides.length === 2) {
    const left = sides[0] === '' ? [] : sides[0]!.split(':');
    const right = sides[1] === '' ? [] : sides[1]!.split(':');
    const fill = 8 - left.length - right.length;
    if (fill < 0) {
      return null;
    }
    hextets = [...left, ...Array(fill).fill('0'), ...right];
  } else {
    return null;
  }
  if (hextets.length !== 8) {
    return null;
  }
  let value = 0n;
  for (const h of hextets) {
    const n = parseInt(h || '0', 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) {
      return null;
    }
    value = (value << 16n) + BigInt(n);
  }
  return value;
}

export function ipMatchesCidr(ip: string, rule: string): boolean {
  const normalizedIp = normalizeIp(ip);
  const normalizedRule = normalizeIp(rule.trim());
  if (!normalizedRule) {
    return false;
  }

  if (!normalizedRule.includes('/')) {
    // Exact IP
    if (normalizedIp === normalizedRule) {
      return true;
    }
    // Compare normalized forms via family-specific ints when possible
    const a4 = ipv4ToInt(normalizedIp);
    const b4 = ipv4ToInt(normalizedRule);
    if (a4 !== null && b4 !== null) {
      return a4 === b4;
    }
    const a6 = ipv6ToBigInt(normalizedIp);
    const b6 = ipv6ToBigInt(normalizedRule);
    if (a6 !== null && b6 !== null) {
      return a6 === b6;
    }
    return false;
  }

  const [baseRaw, prefixRaw] = normalizedRule.split('/');
  const base = normalizeIp(baseRaw ?? '');
  const prefix = Number(prefixRaw);
  if (!base || !Number.isInteger(prefix) || prefix < 0) {
    return false;
  }

  const ip4 = ipv4ToInt(normalizedIp);
  const base4 = ipv4ToInt(base);
  if (ip4 !== null && base4 !== null) {
    if (prefix > 32) {
      return false;
    }
    if (prefix === 0) {
      return true;
    }
    const mask = prefix === 32 ? 0xffffffff : (~((1 << (32 - prefix)) - 1)) >>> 0;
    return (ip4 & mask) === (base4 & mask);
  }

  const ip6 = ipv6ToBigInt(normalizedIp);
  const base6 = ipv6ToBigInt(base);
  if (ip6 !== null && base6 !== null) {
    if (prefix > 128) {
      return false;
    }
    if (prefix === 0) {
      return true;
    }
    const shift = BigInt(128 - prefix);
    const mask = ((1n << BigInt(prefix)) - 1n) << shift;
    return (ip6 & mask) === (base6 & mask);
  }

  return false;
}

export function parseAllowedIps(value: string | undefined): string[] {
  if (!value || !value.trim()) {
    return [];
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isIpAllowed(ip: string, allowedRules: string[]): boolean {
  if (allowedRules.length === 0) {
    return true;
  }
  return allowedRules.some((rule) => ipMatchesCidr(ip, rule));
}

export type AuthMiddlewareOptions = {
  token: string;
  allowedIps?: string[];
};

/**
 * Middleware for /mcp: Bearer token (required) + optional IP allowlist.
 * Failures: 401 (auth) or 403 (IP). Does not reveal whether a token is configured.
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions): RequestHandler {
  const { token, allowedIps = [] } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedIps.length > 0) {
      const clientIp = getClientIp(req);
      if (!isIpAllowed(clientIp, allowedIps)) {
        res.status(403).json({
          error: 'forbidden',
          message: 'Access denied',
        });
        return;
      }
    }

    const provided = parseBearerToken(
      typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined
    );
    if (!provided || !safeEqualToken(provided, token)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    next();
  };
}
