import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RegruApiClient } from '../client/RegruApiClient.js';

export const dnssecTools = {
  regru_manage_dnssec: {
    description: 'Manage DNSSEC for a domain: check status, enable, or disable DNSSEC.',
    inputSchema: z.object({
      domain_name: z.string().describe('Domain name'),
      action: z.enum(['status', 'enable', 'disable']).describe('Action to perform: status (check), enable, or disable'),
    }),
    handler: async (
      client: RegruApiClient,
      args: { domain_name: string; action: 'status' | 'enable' | 'disable' }
    ) => {
      try {
        let result;
        
        switch (args.action) {
          case 'status':
            result = await client.getDnssecStatus(args.domain_name);
            break;
          case 'enable':
            result = await client.enableDnssec(args.domain_name);
            break;
          case 'disable':
            result = await client.disableDnssec(args.domain_name);
            break;
        }
        
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
          `Failed to manage DNSSEC: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },
};
