import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RegruApiClient } from '../client/RegruApiClient.js';

export const folderTools = {
  regru_list_folders: {
    description: 'List all folders in the account used to organize services.',
    inputSchema: z.object({}),
    handler: async (client: RegruApiClient) => {
      try {
        const result = await client.listFolders();
        
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
          `Failed to list folders: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_create_folder: {
    description: 'Create a new folder to organize services.',
    inputSchema: z.object({
      folder_name: z.string().describe('Name of the folder to create'),
    }),
    handler: async (client: RegruApiClient, args: { folder_name: string }) => {
      try {
        const result = await client.createFolder(args.folder_name);
        
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
          `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_move_service_to_folder: {
    description: 'Move a service to a specific folder for organization.',
    inputSchema: z.object({
      service_id: z.number().describe('Service ID to move'),
      folder_id: z.number().describe('Target folder ID'),
    }),
    handler: async (client: RegruApiClient, args: { service_id: number; folder_id: number }) => {
      try {
        const result = await client.moveServiceToFolder(args.service_id, args.folder_id);
        
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
          `Failed to move service to folder: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },
};
