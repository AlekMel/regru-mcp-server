import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RegruApiClient } from '../client/RegruApiClient.js';

export const billingTools = {
  regru_get_balance: {
    description: 'Get current account balance in the specified currency.',
    inputSchema: z.object({
      currency: z.string().optional().default('RUR').describe('Currency code (RUR, USD, EUR)'),
    }),
    handler: async (client: RegruApiClient, args: { currency?: string }) => {
      try {
        const result = await client.getBalance(args.currency || 'RUR');
        
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
          `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_get_unpaid_bills: {
    description: 'Get a list of all unpaid bills in the account.',
    inputSchema: z.object({}),
    handler: async (client: RegruApiClient) => {
      try {
        const result = await client.getUnpaidBills();
        
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
          `Failed to get unpaid bills: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },
};
