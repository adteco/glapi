#!/usr/bin/env tsx
import { resolve } from 'node:path';
import { createAuditService } from '../services/audit-service';

interface CliArgs {
  packageId?: string;
  organizationId?: string;
  userId?: string;
  outputDir?: string;
  persistToDisk?: boolean;
  includeRawLogs?: boolean;
  includeApprovals?: boolean;
  includeCodeReferences?: boolean;
  fileName?: string;
  changeRequestId?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    persistToDisk: true,
    includeRawLogs: true,
    includeApprovals: true,
    includeCodeReferences: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    switch (value) {
      case '--package':
      case '-p':
        args.packageId = argv[++i];
        break;
      case '--org':
      case '-o':
        args.organizationId = argv[++i];
        break;
      case '--user':
      case '-u':
        args.userId = argv[++i];
        break;
      case '--output':
      case '-d':
        args.outputDir = argv[++i];
        break;
      case '--file':
      case '-f':
        args.fileName = argv[++i];
        break;
      case '--change-request':
      case '-c':
        args.changeRequestId = argv[++i];
        break;
      case '--inline':
        args.persistToDisk = false;
        break;
      case '--omit-logs':
        args.includeRawLogs = false;
        break;
      case '--omit-approvals':
        args.includeApprovals = false;
        break;
      case '--omit-code':
        args.includeCodeReferences = false;
        break;
      default:
        // Allow positional arguments for package/organization/user as a convenience.
        if (!args.packageId) {
          args.packageId = value;
        } else if (!args.organizationId) {
          args.organizationId = value;
        } else if (!args.userId) {
          args.userId = value;
        } else {
          console.warn(`Unrecognized argument "${value}" ignored`);
        }
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.packageId || !args.organizationId || !args.userId) {
    console.error(
      'Usage: pnpm --filter @glapi/api-service evidence:bundle -- --package <id> --org <orgId> --user <userId> [--output ./evidence-bundles] [--inline]'
    );
    process.exit(1);
  }

  const service = createAuditService({
    organizationId: args.organizationId,
    userId: args.userId,
  });

  const result = await service.generateEvidenceBundle(args.packageId, {
    outputDir: args.outputDir ? resolve(args.outputDir) : undefined,
    persistToDisk: args.persistToDisk,
    includeRawLogs: args.includeRawLogs,
    includeApprovals: args.includeApprovals,
    includeCodeReferences: args.includeCodeReferences,
    fileName: args.fileName,
    changeRequestId: args.changeRequestId,
  });

  console.log(`Evidence bundle ready: package=${args.packageId}`);
  console.log(`Manifest hash: ${result.contentHash}`);
  console.log(`Bundle size: ${(result.size / 1024).toFixed(2)} KiB (compressed)`);

  if (result.filePath) {
    console.log(`Saved to: ${result.filePath}`);
  } else {
    console.log('Bundle generated inline (persistToDisk disabled).');
  }
}

void main().catch((error) => {
  console.error('Failed to generate evidence bundle:', error);
  process.exit(1);
});
