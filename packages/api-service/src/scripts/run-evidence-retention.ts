#!/usr/bin/env tsx
import { createAuditService } from '../services/audit-service';

interface CliArgs {
  organizationId?: string;
  userId?: string;
  retentionDays?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    switch (value) {
      case '--org':
      case '-o':
        args.organizationId = argv[++i];
        break;
      case '--user':
      case '-u':
        args.userId = argv[++i];
        break;
      case '--retention':
      case '-r':
        args.retentionDays = Number(argv[++i]);
        break;
      default:
        if (!args.organizationId) {
          args.organizationId = value;
        } else if (!args.userId) {
          args.userId = value;
        } else {
          console.warn(`Ignoring argument "${value}"`);
        }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.organizationId || !args.userId) {
    console.error('Usage: evidence:retention --org <id> --user <id> [--retention 90]');
    process.exit(1);
  }

  const service = createAuditService({
    organizationId: args.organizationId,
    userId: args.userId,
  });

  const result = await service.runEvidenceRetention(args.retentionDays);
  console.log(
    `Evidence retention run complete: expired=${result.expired} regenerated=${result.regenerated}`
  );
}

void main().catch((error) => {
  console.error('Retention run failed:', error);
  process.exit(1);
});
