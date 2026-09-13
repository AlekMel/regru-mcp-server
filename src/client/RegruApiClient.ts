import { RegruConfig, RegruApiResponse } from './types.js';
import { buildAuthParams, signRequestParams, validateConfig } from './auth.js';
import { normalizeDomain } from './domain.js';
import { buildFormData, finalizeRequestParams, mergeRequestParams } from './requestParams.js';

const DEFAULT_BASE_URL = 'https://api.reg.ru/api/regru2';

export { normalizeDomain } from './domain.js';
export { buildFormData, finalizeRequestParams, mergeRequestParams } from './requestParams.js';
export { collectSigValues, makeTextForSig, signRequestParams } from './auth.js';

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens = 18, refillRate = 18) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /** Visible for tests */
  get availableTokens(): number {
    return this.tokens;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + timePassed * (this.refillRate / 60));
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / (this.refillRate / 60)) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 1;
    }

    this.tokens -= 1;
  }
}

export class BillingQueue {
  private queue: Array<() => Promise<unknown>> = [];
  private processing = false;

  /** Visible for tests */
  get pending(): number {
    return this.queue.length;
  }

  get isProcessing(): boolean {
    return this.processing;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      void this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (task) {
          await task();
        }
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        void this.process();
      }
    }
  }
}

export class RegruApiClient {
  private config: RegruConfig;
  private baseUrl: string;
  private rateLimiter: RateLimiter;
  private billingQueue: BillingQueue;

  constructor(config: RegruConfig) {
    validateConfig(config);
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.rateLimiter = new RateLimiter();
    this.billingQueue = new BillingQueue();
  }

  async request<T>(
    category: string,
    method: string,
    params: Record<string, unknown> = {},
    options: { isBillingOperation?: boolean } = {}
  ): Promise<RegruApiResponse<T>> {
    const execute = async (): Promise<RegruApiResponse<T>> => {
      await this.rateLimiter.acquire();

      const authParams = buildAuthParams(this.config);
      const url = `${this.baseUrl}/${category}/${method}`;

      // Keep input_data structured until after signature (official Perl pattern)
      let allParams = mergeRequestParams(authParams, params, {
        stringifyInputData: false,
      });

      if (this.config.privateKey) {
        const sig = signRequestParams(allParams, this.config.privateKey);
        allParams = { ...allParams, sig };
      }

      allParams = finalizeRequestParams(allParams);
      const body = buildFormData(allParams);

      let lastError: Error | null = null;
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
            },
            body,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json() as RegruApiResponse<T>;

          if (data.result === 'error') {
            if (
              data.error_code === 'BILLING_LOCK' ||
              data.error_code === 'ACCESS_DENIED' ||
              data.error_code === 'INVALID_AUTH'
            ) {
              throw new Error(`${data.error_code}: ${data.error_text}`);
            }
          }

          return data;
        } catch (error) {
          lastError = error as Error;

          if (
            error instanceof Error &&
            (error.message.includes('BILLING_LOCK') ||
              error.message.includes('ACCESS_DENIED') ||
              error.message.includes('INVALID_AUTH'))
          ) {
            throw error;
          }

          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error('Request failed after retries');
    };

    if (options.isBillingOperation) {
      return this.billingQueue.enqueue(execute);
    }

    return execute();
  }

  async checkDomains(domains: string[], currency = 'RUR'): Promise<RegruApiResponse> {
    const normalizedDomains = domains.map(d => normalizeDomain(d));
    return this.request('domain', 'check', {
      input_data: {
        domains: normalizedDomains.map(dname => ({ dname })),
        currency,
      },
    });
  }

  /**
   * Prices for registration/renewal across TLD zones (domain/get_prices).
   */
  async getDomainPrices(
    currency = 'RUR',
    options: { showRenewData?: boolean; showUpdateData?: boolean } = {}
  ): Promise<RegruApiResponse> {
    return this.request('domain', 'get_prices', {
      currency,
      show_renew_data: options.showRenewData === false ? 0 : 1,
      show_update_data: options.showUpdateData ? 1 : 0,
    });
  }

  /** Alias used by pricing resource */
  async getTldPrices(currency = 'RUR'): Promise<RegruApiResponse> {
    return this.getDomainPrices(currency, { showRenewData: true });
  }

  async suggestDomains(word: string): Promise<RegruApiResponse> {
    return this.request('domain', 'get_suggest', {
      input_data: { word },
    });
  }

  async getDomainNss(domainName: string): Promise<RegruApiResponse> {
    return this.request('domain', 'get_nss', {
      input_data: { domains: [{ dname: normalizeDomain(domainName) }] },
    });
  }

  async updateDomainNss(domainName: string, nss: string[]): Promise<RegruApiResponse> {
    return this.request('domain', 'update_nss', {
      input_data: {
        domains: [{
          dname: normalizeDomain(domainName),
          nss,
        }],
      },
    });
  }

  async getZoneRecords(domainName: string): Promise<RegruApiResponse> {
    return this.request('zone', 'get_resource_records', {
      input_data: { domains: [{ dname: normalizeDomain(domainName) }] },
    });
  }

  async addZoneRecord(
    domainName: string,
    recordType: string,
    subdomain: string,
    content: string,
    options: { priority?: number; ttl?: number } = {}
  ): Promise<RegruApiResponse> {
    const methodMap: Record<string, string> = {
      A: 'add_alias',
      AAAA: 'add_aaaa',
      CNAME: 'add_cname',
      MX: 'add_mx',
      TXT: 'add_txt',
      NS: 'add_ns',
      SRV: 'add_srv',
      CAA: 'add_caa',
    };

    const method = methodMap[recordType] || 'add_alias';
    const record: Record<string, unknown> = {
      subdomain,
    };

    if (recordType === 'A' || recordType === 'AAAA') {
      record.ipaddr = content;
    } else if (recordType === 'MX') {
      record.mail_server = content;
    } else if (recordType === 'CNAME') {
      record.canonical_name = content;
    } else {
      record.content = content;
      record.text = content;
    }

    if (options.priority !== undefined) {
      record.priority = options.priority;
    }
    if (options.ttl !== undefined) {
      record.ttl = options.ttl;
    }

    return this.request('zone', method, {
      input_data: {
        domains: [{
          dname: normalizeDomain(domainName),
        }],
        ...record,
      },
    });
  }

  async removeZoneRecord(
    domainName: string,
    subdomain: string,
    recordType: string,
    content?: string
  ): Promise<RegruApiResponse> {
    const record: Record<string, unknown> = {
      subdomain,
      record_type: recordType,
    };

    if (content) {
      record.content = content;
    }

    return this.request('zone', 'remove_record', {
      input_data: {
        domains: [{
          dname: normalizeDomain(domainName),
        }],
        ...record,
      },
    });
  }

  async updateZoneRecords(
    domainName: string,
    actions: Array<{
      action: 'add' | 'delete';
      record_type: string;
      subdomain: string;
      content: string;
      priority?: number;
      ttl?: number;
    }>
  ): Promise<RegruApiResponse> {
    return this.request('zone', 'update_records', {
      input_data: {
        domains: [{
          dname: normalizeDomain(domainName),
        }],
        records: actions,
      },
    });
  }

  async getServiceList(servtype?: string): Promise<RegruApiResponse> {
    const params: Record<string, unknown> = {};
    if (servtype) {
      params.input_data = { servtype };
    }
    return this.request('service', 'get_list', params);
  }

  async getServiceInfo(serviceId?: number, domainName?: string): Promise<RegruApiResponse> {
    const params: Record<string, unknown> = {};
    if (serviceId) {
      params.service_id = serviceId;
    } else if (domainName) {
      params.dname = normalizeDomain(domainName);
    }
    return this.request('service', 'get_info', params);
  }

  async renewService(
    serviceId: number,
    period?: number,
    okIfNoMoney = false
  ): Promise<RegruApiResponse> {
    return this.request(
      'service',
      'renew',
      {
        service_id: serviceId,
        period,
        ok_if_no_money: okIfNoMoney ? 1 : 0,
      },
      { isBillingOperation: true }
    );
  }

  async setAutoRenew(serviceId: number, flag: boolean): Promise<RegruApiResponse> {
    return this.request('service', 'set_autorenew_flag', {
      service_id: serviceId,
      flag: flag ? 1 : 0,
    });
  }

  async getBalance(currency = 'RUR'): Promise<RegruApiResponse> {
    return this.request('user', 'get_balance', { currency });
  }

  async getUnpaidBills(): Promise<RegruApiResponse> {
    return this.request('bill', 'get_not_payed', {});
  }

  async getDnssecStatus(domainName: string): Promise<RegruApiResponse> {
    return this.request('dnssec', 'get_status', {
      input_data: { domains: [{ dname: normalizeDomain(domainName) }] },
    });
  }

  async enableDnssec(domainName: string): Promise<RegruApiResponse> {
    return this.request('dnssec', 'enable', {
      input_data: { domains: [{ dname: normalizeDomain(domainName) }] },
    });
  }

  async disableDnssec(domainName: string): Promise<RegruApiResponse> {
    return this.request('dnssec', 'disable', {
      input_data: { domains: [{ dname: normalizeDomain(domainName) }] },
    });
  }

  /**
   * List services in a folder (folder/get_services).
   * Official API has no folder/get_list.
   */
  async getFolderServices(options: {
    folder_id?: number;
    folder_name?: string;
  }): Promise<RegruApiResponse> {
    const params: Record<string, unknown> = {};
    if (options.folder_id !== undefined) {
      params.folder_id = options.folder_id;
    }
    if (options.folder_name !== undefined) {
      params.folder_name = options.folder_name;
    }
    return this.request('folder', 'get_services', params);
  }

  /**
   * Folders that contain a service (service/get_folders).
   */
  async getServiceFolders(options: {
    service_id?: number;
    domain_name?: string;
  }): Promise<RegruApiResponse> {
    const params: Record<string, unknown> = {};
    if (options.service_id !== undefined) {
      params.service_id = options.service_id;
    } else if (options.domain_name) {
      params.domain_name = normalizeDomain(options.domain_name);
    }
    return this.request('service', 'get_folders', params);
  }

  /**
   * Add service(s) to a folder (folder/add_services).
   * Prefer moveServicesBetweenFolders when relocating between existing folders.
   */
  async addServicesToFolder(
    folderId: number,
    serviceIds: number[],
    returnFolderContents = true
  ): Promise<RegruApiResponse> {
    return this.request('folder', 'add_services', {
      folder_id: folderId,
      services: serviceIds.map(service_id => ({ service_id })),
      return_folder_contents: returnFolderContents ? 1 : 0,
    });
  }

  /**
   * Move services from one folder to another (folder/move_services).
   */
  async moveServicesBetweenFolders(options: {
    service_ids: number[];
    from_folder_id: number;
    to_folder_id: number;
    return_folder_contents?: boolean;
  }): Promise<RegruApiResponse> {
    return this.request('folder', 'move_services', {
      folder_id: options.from_folder_id,
      new_folder_id: options.to_folder_id,
      services: options.service_ids.map(service_id => ({ service_id })),
      return_folder_contents: options.return_folder_contents === false ? 0 : 1,
    });
  }

  /** @deprecated Prefer addServicesToFolder or moveServicesBetweenFolders */
  async moveServiceToFolder(serviceId: number, folderId: number): Promise<RegruApiResponse> {
    return this.addServicesToFolder(folderId, [serviceId]);
  }

  async createFolder(folderName: string): Promise<RegruApiResponse> {
    return this.request('folder', 'create', {
      folder_name: folderName,
    });
  }
}
