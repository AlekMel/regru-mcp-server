import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  createAuthMiddleware,
  parseAllowedIps,
} from './auth.js';

function log(...args: unknown[]): void {
  console.error('[regru-mcp]', ...args);
}

export type HttpServerOptions = {
  createServer: () => McpServer;
  host: string;
  port: number;
  authToken: string;
  allowedIpsEnv?: string;
};

/**
 * Start Streamable HTTP MCP on /mcp with mandatory Bearer auth.
 * /healthz is unauthenticated (liveness only).
 */
export async function startHttpServer(options: HttpServerOptions): Promise<void> {
  const { createServer, host, port, authToken, allowedIpsEnv } = options;
  const allowedIps = parseAllowedIps(allowedIpsEnv);

  const app = createMcpExpressApp({ host });
  // Coolify / reverse proxies set X-Forwarded-For; trust first proxy hop.
  app.set('trust proxy', 1);

  app.get('/healthz', (_req, res) => {
    res.status(200).type('text/plain').send('ok');
  });

  const auth = createAuthMiddleware({
    token: authToken,
    allowedIps,
  });

  // Session-scoped transports (Streamable HTTP stateful mode)
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.all('/mcp', auth, async (req, res) => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId =
        typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId]!;
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            log(`HTTP session initialized: ${sid}`);
            transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
            log(`HTTP session closed: ${sid}`);
          }
        };

        const server = createServer();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      log('Error handling MCP HTTP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, host, (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
    server.on('error', reject);
  });

  log(`REG.RU MCP server started (http) on http://${host}:${port}/mcp`);
  if (allowedIps.length > 0) {
    log(`IP allowlist enabled (${allowedIps.length} rule(s))`);
  } else {
    log('IP allowlist disabled (set MCP_ALLOWED_IPS to restrict)');
  }
}
