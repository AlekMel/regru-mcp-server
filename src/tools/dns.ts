import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RegruApiClient } from '../client/RegruApiClient.js';

export const dnsTools = {
  regru_get_dns_records: {
    description: 'Get all DNS resource records for a domain zone.',
    inputSchema: z.object({
      domain_name: z.string().describe('Domain name'),
    }),
    handler: async (client: RegruApiClient, args: { domain_name: string }) => {
      try {
        const result = await client.getZoneRecords(args.domain_name);
        
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
          `Failed to get DNS records: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_add_dns_record: {
    description: 'Add a DNS resource record to a domain zone. Supports A, AAAA, CNAME, MX, TXT, NS, SRV, CAA record types.',
    inputSchema: z.object({
      domain_name: z.string().describe('Domain name'),
      record_type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']).describe('DNS record type'),
      subdomain: z.string().describe('Subdomain (use "@" for root)'),
      content: z.string().describe('Record content (IP address, hostname, text, etc.)'),
      priority: z.number().optional().describe('Priority for MX and SRV records'),
      ttl: z.number().optional().describe('Time to live in seconds'),
    }),
    handler: async (
      client: RegruApiClient,
      args: {
        domain_name: string;
        record_type: string;
        subdomain: string;
        content: string;
        priority?: number;
        ttl?: number;
      }
    ) => {
      try {
        const result = await client.addZoneRecord(
          args.domain_name,
          args.record_type,
          args.subdomain,
          args.content,
          { priority: args.priority, ttl: args.ttl }
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
          `Failed to add DNS record: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_delete_dns_record: {
    description: 'Delete a DNS resource record from a domain zone.',
    inputSchema: z.object({
      domain_name: z.string().describe('Domain name'),
      subdomain: z.string().describe('Subdomain (use "@" for root)'),
      record_type: z.string().describe('DNS record type'),
      content: z.string().optional().describe('Record content to delete (optional, for precision)'),
    }),
    handler: async (
      client: RegruApiClient,
      args: {
        domain_name: string;
        subdomain: string;
        record_type: string;
        content?: string;
      }
    ) => {
      try {
        const result = await client.removeZoneRecord(
          args.domain_name,
          args.subdomain,
          args.record_type,
          args.content
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
          `Failed to delete DNS record: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_batch_update_dns: {
    description: 'Batch add/delete DNS records via zone/update_records. Partner-only — ordinary clients may get RESELLER_AUTH_FAILED. Prefer regru_add_dns_record / regru_delete_dns_record for client accounts.',
    inputSchema: z.object({
      domain_name: z.string().describe('Domain name'),
      actions: z.array(
        z.object({
          action: z.enum(['add', 'delete']).describe('Action to perform'),
          record_type: z.string().describe('DNS record type'),
          subdomain: z.string().describe('Subdomain'),
          content: z.string().describe('Record content'),
          priority: z.number().optional().describe('Priority (for MX/SRV)'),
          ttl: z.number().optional().describe('TTL in seconds'),
        })
      ).describe('Array of DNS record actions to perform'),
    }),
    handler: async (
      client: RegruApiClient,
      args: {
        domain_name: string;
        actions: Array<{
          action: 'add' | 'delete';
          record_type: string;
          subdomain: string;
          content: string;
          priority?: number;
          ttl?: number;
        }>;
      }
    ) => {
      try {
        const result = await client.updateZoneRecords(args.domain_name, args.actions);
        
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
          `Failed to batch update DNS: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },
};
