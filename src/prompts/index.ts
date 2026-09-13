import { RegruApiClient } from '../client/RegruApiClient.js';

export interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  handler: (client: RegruApiClient, args?: Record<string, string>) => Promise<string>;
}

export const prompts: Record<string, Prompt> = {
  audit_expiring_services: {
    name: 'Audit Expiring Services',
    description: 'Check services expiring in the next 30 days and verify account balance',
    handler: async (client: RegruApiClient) => {
      const servicesResult = await client.getServiceList();
      const balanceResult = await client.getBalance();

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const services = (servicesResult.answer as any)?.services || [];
      const expiringServices = services.filter((service: any) => {
        if (!service.expiration_date) return false;
        const expirationDate = new Date(service.expiration_date);
        return expirationDate <= thirtyDaysFromNow && expirationDate > now;
      });

      return `# Audit: Expiring Services

## Account Balance
${JSON.stringify(balanceResult.answer, null, 2)}

## Services Expiring in Next 30 Days
Found ${expiringServices.length} service(s) expiring soon:

${expiringServices.map((s: any) => `- Service ID: ${s.service_id}, Type: ${s.servtype}, Domain: ${s.dname || 'N/A'}, Expires: ${s.expiration_date}`).join('\n')}

## Recommendations
${expiringServices.length > 0 ? '- Review and renew critical services before expiration\n- Ensure sufficient balance for renewals' : '- No immediate action required'}
`;
    },
  },

  configure_domain_for_vps: {
    name: 'Configure Domain for VPS',
    description: 'Set up basic DNS records for a domain pointing to a VPS (A, www CNAME, MX, SPF, DKIM placeholder)',
    arguments: [
      {
        name: 'domain',
        description: 'Domain name to configure',
        required: true,
      },
      {
        name: 'vps_ip',
        description: 'VPS IP address',
        required: true,
      },
      {
        name: 'mail_server',
        description: 'Mail server hostname (optional)',
        required: false,
      },
    ],
    handler: async (client: RegruApiClient, args?: Record<string, string>) => {
      if (!args?.domain || !args?.vps_ip) {
        return 'Error: domain and vps_ip are required';
      }

      const domain = args.domain;
      const vpsIp = args.vps_ip;
      const mailServer = args.mail_server || `mail.${domain}`;

      const actions = [
        {
          action: 'add' as const,
          record_type: 'A',
          subdomain: '@',
          content: vpsIp,
          ttl: 3600,
        },
        {
          action: 'add' as const,
          record_type: 'A',
          subdomain: 'www',
          content: vpsIp,
          ttl: 3600,
        },
        {
          action: 'add' as const,
          record_type: 'MX',
          subdomain: '@',
          content: mailServer,
          priority: 10,
          ttl: 3600,
        },
        {
          action: 'add' as const,
          record_type: 'TXT',
          subdomain: '@',
          content: `v=spf1 ip4:${vpsIp} -all`,
          ttl: 3600,
        },
      ];

      try {
        await client.updateZoneRecords(domain, actions);
        return `# Domain VPS Configuration Complete

Domain: ${domain}
VPS IP: ${vpsIp}

## Records Created:
- A @ → ${vpsIp}
- A www → ${vpsIp}
- MX @ → ${mailServer} (priority 10)
- TXT @ → SPF record

## Next Steps:
1. Configure DKIM selector and add DKIM TXT record
2. Add DMARC policy: _dmarc TXT record
3. Configure mail server on VPS
4. Test DNS propagation (may take up to 48 hours)
`;
      } catch (error) {
        return `Error configuring domain: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },

  domain_migration_check: {
    name: 'Domain Migration Check',
    description: 'Check domain status before migration: delegation, DNSSEC, and service details',
    arguments: [
      {
        name: 'domain',
        description: 'Domain name to check',
        required: true,
      },
    ],
    handler: async (client: RegruApiClient, args?: Record<string, string>) => {
      if (!args?.domain) {
        return 'Error: domain is required';
      }

      const domain = args.domain;

      try {
        const [nssResult, dnssecResult, serviceResult] = await Promise.all([
          client.getDomainNss(domain),
          client.getDnssecStatus(domain),
          client.getServiceInfo(undefined, domain),
        ]);

        return `# Domain Migration Checklist: ${domain}

## Current Name Servers
${JSON.stringify(nssResult.answer, null, 2)}

## DNSSEC Status
${JSON.stringify(dnssecResult.answer, null, 2)}

## Service Information
${JSON.stringify(serviceResult.answer, null, 2)}

## Migration Checklist:
- [ ] Backup current DNS zone records
- [ ] Verify no DNSSEC conflicts (disable if needed)
- [ ] Check domain lock status
- [ ] Obtain transfer authorization code if applicable
- [ ] Verify no pending operations on domain
- [ ] Document all subdomains and services
- [ ] Plan DNS propagation downtime

## Important Notes:
- DNSSEC must be disabled before transfer to some registrars
- Domain must be unlocked for transfer
- Transfer typically takes 5-7 days
- Services may be interrupted during transfer
`;
      } catch (error) {
        return `Error checking domain: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
};
