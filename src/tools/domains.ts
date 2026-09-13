import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RegruApiClient } from '../client/RegruApiClient.js';

export const domainTools = {
  regru_check_domains: {
    description: 'Check domain availability and get prices for one or more domains. Returns availability status and pricing information for each domain.',
    inputSchema: z.object({
      domains: z.array(z.string()).describe('Array of domain names to check'),
      currency: z.string().optional().default('RUR').describe('Currency code (RUR, USD, EUR)'),
    }),
    handler: async (client: RegruApiClient, args: { domains: string[]; currency?: string }) => {
      try {
        const currency = args.currency || 'RUR';
        const checkResult = await client.checkDomains(args.domains, currency);

        if (checkResult.result === 'error') {
          throw new McpError(
            ErrorCode.InternalError,
            `${checkResult.error_code}: ${checkResult.error_text}`
          );
        }

        const pricesResult = await client.getDomainPrices(currency, { showRenewData: true });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                check: checkResult.answer,
                prices: pricesResult.answer,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to check domains: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_suggest_domains: {
    description: 'Get domain name suggestions based on a keyword. Returns a list of available similar domains.',
    inputSchema: z.object({
      word: z.string().describe('Keyword to generate domain suggestions'),
    }),
    handler: async (client: RegruApiClient, args: { word: string }) => {
      try {
        const result = await client.suggestDomains(args.word);
        
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
          `Failed to suggest domains: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_get_domain_dns: {
    description: 'Get current DNS name servers (NSS) for a domain.',
    inputSchema: z.object({
      domain_name: z.string().describe('Domain name'),
    }),
    handler: async (client: RegruApiClient, args: { domain_name: string }) => {
      try {
        const result = await client.getDomainNss(args.domain_name);
        
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
          `Failed to get domain DNS: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_update_domain_dns: {
    description: 'Update DNS name servers (NSS) for a domain. Changes the authoritative name servers.',
    inputSchema: z.object({
      domain_name: z.string().describe('Domain name'),
      nss: z.array(z.string()).describe('Array of name server hostnames (e.g., ["ns1.reg.ru", "ns2.reg.ru"])'),
    }),
    handler: async (client: RegruApiClient, args: { domain_name: string; nss: string[] }) => {
      try {
        const result = await client.updateDomainNss(args.domain_name, args.nss);
        
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
          `Failed to update domain DNS: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },
};
