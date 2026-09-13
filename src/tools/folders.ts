import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RegruApiClient } from '../client/RegruApiClient.js';

export const folderTools = {
  regru_get_folder_services: {
    description:
      'Get services inside a folder via folder/get_services. Identify the folder by folder_id (preferred) or folder_name. Note: REG.API has no folder/get_list — there is no list-all-folders method.',
    inputSchema: z
      .object({
        folder_id: z.number().optional().describe('Folder ID (recommended)'),
        folder_name: z.string().optional().describe('Folder name'),
      })
      .refine(data => data.folder_id !== undefined || !!data.folder_name, {
        message: 'Provide folder_id or folder_name',
      }),
    handler: async (
      client: RegruApiClient,
      args: { folder_id?: number; folder_name?: string }
    ) => {
      try {
        const result = await client.getFolderServices(args);

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
          `Failed to get folder services: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_get_service_folders: {
    description:
      'Get folders that contain a service via service/get_folders. Identify the service by service_id or domain_name.',
    inputSchema: z
      .object({
        service_id: z.number().optional().describe('Service ID'),
        domain_name: z.string().optional().describe('Domain name'),
      })
      .refine(data => data.service_id !== undefined || !!data.domain_name, {
        message: 'Provide service_id or domain_name',
      }),
    handler: async (
      client: RegruApiClient,
      args: { service_id?: number; domain_name?: string }
    ) => {
      try {
        const result = await client.getServiceFolders(args);

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
          `Failed to get service folders: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_create_folder: {
    description: 'Create a new folder (folder/create) to organize services.',
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

  regru_add_services_to_folder: {
    description:
      'Add one or more services to a folder (folder/add_services). Does not invent a list-all-folders API. To relocate between existing folders, prefer regru_move_services_between_folders (folder/move_services).',
    inputSchema: z.object({
      folder_id: z.number().describe('Target folder ID'),
      service_ids: z.array(z.number()).min(1).describe('Service IDs to add to the folder'),
    }),
    handler: async (
      client: RegruApiClient,
      args: { folder_id: number; service_ids: number[] }
    ) => {
      try {
        const result = await client.addServicesToFolder(args.folder_id, args.service_ids);

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
          `Failed to add services to folder: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },

  regru_move_services_between_folders: {
    description:
      'Move services from one folder to another (folder/move_services). Requires source folder_id and destination new_folder_id.',
    inputSchema: z.object({
      service_ids: z.array(z.number()).min(1).describe('Service IDs to move'),
      from_folder_id: z.number().describe('Source folder ID'),
      to_folder_id: z.number().describe('Destination folder ID'),
    }),
    handler: async (
      client: RegruApiClient,
      args: { service_ids: number[]; from_folder_id: number; to_folder_id: number }
    ) => {
      try {
        const result = await client.moveServicesBetweenFolders({
          service_ids: args.service_ids,
          from_folder_id: args.from_folder_id,
          to_folder_id: args.to_folder_id,
        });

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
          `Failed to move services between folders: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  },
};
