#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { RegruApiClient } from './client/RegruApiClient.js';
import type { RegruConfig } from './client/types.js';
import { domainTools } from './tools/domains.js';
import { dnsTools } from './tools/dns.js';
import { serviceTools } from './tools/services.js';
import { billingTools } from './tools/billing.js';
import { dnssecTools } from './tools/dnssec.js';
import { folderTools } from './tools/folders.js';
import { resources, dynamicResources } from './resources/index.js';
import { prompts } from './prompts/index.js';

function log(...args: unknown[]): void {
  console.error('[regru-mcp]', ...args);
}

function loadPrivateKey(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.includes('BEGIN') || trimmed.startsWith('-----')) {
    return trimmed;
  }
  try {
    return readFileSync(trimmed, 'utf8');
  } catch {
    return trimmed;
  }
}

function loadConfig(): RegruConfig {
  const username = process.env.REGRU_USERNAME;
  const password = process.env.REGRU_PASSWORD;
  const privateKey = loadPrivateKey(process.env.REGRU_PRIVATE_KEY);
  const baseUrl = process.env.REGRU_BASE_URL || process.env.REGRU_API_BASE_URL;

  if (!username) {
    throw new Error('REGRU_USERNAME environment variable is required');
  }
  if (!password && !privateKey) {
    throw new Error('Either REGRU_PASSWORD or REGRU_PRIVATE_KEY must be set');
  }

  return {
    username,
    password,
    privateKey,
    baseUrl,
  };
}

type ToolHandler = (
  client: RegruApiClient,
  args: Record<string, unknown>
) => Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}>;

type ToolDef = {
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: ToolHandler;
};

function registerTools(server: McpServer, client: RegruApiClient): void {
  const allTools = {
    ...domainTools,
    ...dnsTools,
    ...serviceTools,
    ...billingTools,
    ...dnssecTools,
    ...folderTools,
  } as unknown as Record<string, ToolDef>;

  for (const [name, tool] of Object.entries(allTools)) {
    server.registerTool(
      name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args) => {
        try {
          return await tool.handler(client, (args ?? {}) as Record<string, unknown>);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log(`Tool ${name} failed:`, message);
          return {
            content: [{ type: 'text' as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }

  log(`Registered ${Object.keys(allTools).length} tools`);
}

function registerResources(server: McpServer, client: RegruApiClient): void {
  for (const [uri, resource] of Object.entries(resources)) {
    server.registerResource(
      resource.name,
      uri,
      {
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: resource.mimeType,
            text: await resource.handler(client),
          },
        ],
      })
    );
  }

  for (const [template, resource] of Object.entries(dynamicResources)) {
    server.registerResource(
      resource.name,
      new ResourceTemplate(template, { list: undefined }),
      {
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri, variables) => {
        const domain = String(variables.domain ?? '');
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: resource.mimeType,
              text: await resource.handler(client, domain),
            },
          ],
        };
      }
    );
  }

  log(`Registered ${Object.keys(resources).length} static + ${Object.keys(dynamicResources).length} dynamic resources`);
}

function registerPrompts(server: McpServer, client: RegruApiClient): void {
  for (const [key, prompt] of Object.entries(prompts)) {
    const argsSchema: Record<string, z.ZodTypeAny> = {};
    for (const arg of prompt.arguments ?? []) {
      argsSchema[arg.name] = arg.required
        ? z.string().describe(arg.description)
        : z.string().optional().describe(arg.description);
    }

    server.registerPrompt(
      key,
      {
        title: prompt.name,
        description: prompt.description,
        ...(Object.keys(argsSchema).length > 0 ? { argsSchema } : {}),
      },
      async (args) => {
        const text = await prompt.handler(
          client,
          args as Record<string, string> | undefined
        );
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text,
              },
            },
          ],
        };
      }
    );
  }

  log(`Registered ${Object.keys(prompts).length} prompts`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new RegruApiClient(config);

  const server = new McpServer({
    name: 'regru-mcp-server',
    version: '1.0.0',
  });

  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('REG.RU MCP server started (stdio)');
}

main().catch((error) => {
  console.error('[regru-mcp] Fatal:', error);
  process.exit(1);
});
