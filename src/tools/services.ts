import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RegruApiClient } from '../client/RegruApiClient.js';

export const serviceTools = {
  regru_list_services: {
    description: 'List all services in the account. Optionally filter by service type (domain, hosting, etc.).',
    inputSchema: z.object({
      servtype: z.string().optional().describe('Service type filter (e.g., "domain", "hosting")'),
    }),
    handler: async (client: RegruApiClient, args: { servtype?: string }) => {
      try {
        const result = await client.getServiceList(args.servtype);
        
        if (result.result === 'error') {
          throw new McpError(
            ErrorCode.InternalError,
            `${result.error_code}: ${result.error_text}`
          );
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result.answer, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list services: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_get_service_info: {
    description: 'Get detailed information about a service by service ID or domain name.',
    inputSchema: z.object({
      service_id: z.number().optional().describe('Service ID'),
      domain_name: z.string().optional().describe('Domain name (alternative to service_id)'),
    }),
    handler: async (
      client: RegruApiClient,
      args: { service_id?: number; domain_name?: string }
    ) => {
      try {
        if (!args.service_id && !args.domain_name) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Either service_id or domain_name must be provided'
          );
        }

        const result = await client.getServiceInfo(args.service_id, args.domain_name);
        
        if (result.result === 'error') {
          throw new McpError(
            ErrorCode.InternalError,
            `${result.error_code}: ${result.error_text}`
          );
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result.answer, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get service info: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_renew_service: {
    description: 'Renew a service (domain, hosting, etc.) for a specified period. This is a billing operation.',
    inputSchema: z.object({
      service_id: z.number().describe('Service ID to renew'),
      period: z.number().optional().describe('Renewal period in months'),
      ok_if_no_money: z.boolean().optional().default(false).describe('Allow renewal even if insufficient funds'),
    }),
    handler: async (
      client: RegruApiClient,
      args: { service_id: number; period?: number; ok_if_no_money?: boolean }
    ) => {
      try {
        const result = await client.renewService(
          args.service_id,
          args.period,
          args.ok_if_no_money || false
        );
        
        if (result.result === 'error') {
          throw new McpError(
            ErrorCode.InternalError,
            `${result.error_code}: ${result.error_text}`
          );
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result.answer, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to renew service: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_set_autorenew: {
    description: 'Enable or disable automatic renewal for a service.',
    inputSchema: z.object({
      service_id: z.number().describe('Service ID'),
      flag: z.boolean().describe('Enable (true) or disable (false) auto-renewal'),
    }),
    handler: async (client: RegruApiClient, args: { service_id: number; flag: boolean }) => {
      try {
        const result = await client.setAutoRenew(args.service_id, args.flag);
        
        if (result.result === 'error') {
          throw new McpError(
            ErrorCode.InternalError,
            `${result.error_code}: ${result.error_text}`
          );
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result.answer, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to set auto-renewal: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },
};
