export interface RegruConfig {
  username: string;
  password?: string;
  privateKey?: string;
  baseUrl?: string;
}

export interface RegruApiResponse<T = unknown> {
  result: 'success' | 'error';
  error_code?: string;
  error_text?: string;
  error_params?: Record<string, string>;
  answer?: T;
}

export interface DomainCheckResult {
  domains: Array<{
    dname: string;
    result: 'success' | 'error';
    available: boolean;
    error_code?: string;
    error_text?: string;
  }>;
}

export interface DomainPricesResult {
  prices: Array<{
    dname: string;
    price: number;
    currency: string;
  }>;
}

export interface DomainSuggestResult {
  suggestions: string[];
}

export interface DnsRecordsResult {
  records: DnsRecord[];
}

export interface DnsRecord {
  rectype: string;
  recname: string;
  content: string;
  priority?: number;
  ttl?: number;
}

export interface ServiceInfo {
  service_id: number;
  dname?: string;
  servtype: string;
  expiration_date: string;
  autorenewal_flag: boolean;
  status: string;
}

export interface BalanceInfo {
  currency: string;
  amount: number;
}

export interface BillInfo {
  bill_id: number;
  amount: number;
  currency: string;
  date: string;
  status: string;
}

export interface FolderInfo {
  folder_id: number;
  folder_name: string;
}

export interface DnssecStatus {
  enabled: boolean;
  ds_records?: Array<{
    key_tag: number;
    algorithm: number;
    digest_type: number;
    digest: string;
  }>;
}

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA';

export interface DnsRecordAction {
  action: 'add' | 'delete';
  record_type: DnsRecordType;
  subdomain: string;
  content: string;
  priority?: number;
  ttl?: number;
}
