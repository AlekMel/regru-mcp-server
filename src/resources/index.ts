import { RegruApiClient } from '../client/RegruApiClient.js';

export const resources = {
  'regru://account/balance': {
    name: 'Account Balance',
    description: 'Current account balance information',
    mimeType: 'application/json',
    handler: async (client: RegruApiClient) => {
      const result = await client.getBalance();
      return JSON.stringify(result.answer, null, 2);
    },
  },

  'regru://services/active': {
    name: 'Active Services',
    description: 'List of all active services in the account',
    mimeType: 'application/json',
    handler: async (client: RegruApiClient) => {
      const result = await client.getServiceList();
      return JSON.stringify(result.answer, null, 2);
    },
  },

  'regru://pricing/tlds': {
    name: 'TLD Pricing',
    description: 'Registration and renewal prices for available TLD zones',
    mimeType: 'application/json',
    handler: async (client: RegruApiClient) => {
      const result = await client.getTldPrices('RUR');
      return JSON.stringify(result.answer ?? result, null, 2);
    },
  },
};

export const dynamicResources = {
  'regru://domains/{domain}/dns': {
    name: 'Domain DNS Records',
    description: 'DNS resource records for a specific domain',
    mimeType: 'application/json',
    handler: async (client: RegruApiClient, domain: string) => {
      const result = await client.getZoneRecords(domain);
      return JSON.stringify(result.answer, null, 2);
    },
  },
};
