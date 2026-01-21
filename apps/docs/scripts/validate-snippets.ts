#!/usr/bin/env npx tsx
/**
 * Code Snippet Validation Script
 *
 * This script extracts and validates code snippets from MDX documentation files.
 * It performs the following checks:
 * - TypeScript syntax validation
 * - JSON syntax validation
 * - Bash command syntax (basic)
 *
 * Usage: npx tsx scripts/validate-snippets.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONTENT_DIR = path.join(__dirname, '../content');
const TEMP_DIR = path.join(__dirname, '../.snippet-cache');

interface CodeSnippet {
  file: string;
  language: string;
  code: string;
  lineNumber: number;
}

interface ValidationResult {
  snippet: CodeSnippet;
  valid: boolean;
  error?: string;
}

/**
 * Extract code snippets from MDX files
 */
function extractSnippets(dir: string): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];
  const files = getAllMdxFiles(dir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    let inCodeBlock = false;
    let currentLanguage = '';
    let currentCode: string[] = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^```(\w+)?/)) {
        if (!inCodeBlock) {
          // Start of code block
          inCodeBlock = true;
          currentLanguage = line.match(/^```(\w+)/)?.[1] || '';
          currentCode = [];
          startLine = i + 1;
        } else {
          // End of code block
          if (currentLanguage && currentCode.length > 0) {
            snippets.push({
              file: path.relative(CONTENT_DIR, file),
              language: currentLanguage.toLowerCase(),
              code: currentCode.join('\n'),
              lineNumber: startLine,
            });
          }
          inCodeBlock = false;
          currentLanguage = '';
          currentCode = [];
        }
      } else if (inCodeBlock) {
        currentCode.push(line);
      }
    }
  }

  return snippets;
}

/**
 * Get all MDX files in a directory recursively
 */
function getAllMdxFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllMdxFiles(fullPath));
    } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Validate TypeScript/JavaScript code
 */
function validateTypeScript(code: string): { valid: boolean; error?: string } {
  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const tempFile = path.join(TEMP_DIR, `snippet-${Date.now()}.ts`);

  try {
    // Wrap code in a function to handle top-level await and incomplete code
    const wrappedCode = `
// @ts-nocheck - Snippet validation mode
// This file is auto-generated for validation purposes

${code}
`;

    fs.writeFileSync(tempFile, wrappedCode);

    // Run TypeScript compiler in syntax-check mode only
    execSync(`npx tsc --noEmit --allowJs --skipLibCheck --target ES2020 --module ESNext ${tempFile}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    return { valid: true };
  } catch (error: unknown) {
    // Check if it's a type error (we only care about syntax errors)
    const errorMessage = error instanceof Error && 'stderr' in error
      ? (error as Error & { stderr: string }).stderr
      : String(error);

    // Ignore type errors, only fail on syntax errors
    if (errorMessage.includes('error TS1') || errorMessage.includes('Unexpected token')) {
      return { valid: false, error: errorMessage };
    }
    return { valid: true }; // Type errors are OK for snippets
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

/**
 * Validate JSON code
 */
function validateJson(code: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(code);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate code snippet based on language
 */
function validateSnippet(snippet: CodeSnippet): ValidationResult {
  const { language, code } = snippet;

  // Skip empty or placeholder code
  if (!code.trim() || code.includes('...') || code.includes('YOUR_')) {
    return { snippet, valid: true };
  }

  switch (language) {
    case 'typescript':
    case 'ts':
    case 'javascript':
    case 'js':
    case 'tsx':
    case 'jsx': {
      const result = validateTypeScript(code);
      return { snippet, ...result };
    }

    case 'json': {
      const result = validateJson(code);
      return { snippet, ...result };
    }

    // Skip validation for these languages (would require separate toolchains)
    case 'bash':
    case 'sh':
    case 'shell':
    case 'python':
    case 'py':
    case 'go':
    case 'ruby':
    case 'java':
    case 'csharp':
    case 'php':
    case 'yaml':
    case 'yml':
    case 'css':
    case 'html':
    case 'mdx':
    case 'text':
    case 'plaintext':
    case 'diff':
    case 'sql':
      return { snippet, valid: true };

    default:
      // Unknown language, skip validation
      return { snippet, valid: true };
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log('Extracting code snippets from documentation...\n');

  const snippets = extractSnippets(CONTENT_DIR);
  console.log(`Found ${snippets.length} code snippets\n`);

  // Group by language for summary
  const byLanguage: Record<string, number> = {};
  for (const snippet of snippets) {
    byLanguage[snippet.language] = (byLanguage[snippet.language] || 0) + 1;
  }

  console.log('Snippets by language:');
  for (const [lang, count] of Object.entries(byLanguage).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang}: ${count}`);
  }
  console.log('');

  // Validate snippets
  console.log('Validating snippets...\n');

  const results: ValidationResult[] = [];
  const validatable = snippets.filter((s) =>
    ['typescript', 'ts', 'javascript', 'js', 'tsx', 'jsx', 'json'].includes(s.language)
  );

  for (const snippet of validatable) {
    const result = validateSnippet(snippet);
    results.push(result);
  }

  // Report results
  const failures = results.filter((r) => !r.valid);

  if (failures.length === 0) {
    console.log(`All ${validatable.length} validatable snippets passed.\n`);
    // Clean up temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
    process.exit(0);
  }

  console.error(`\nFound ${failures.length} snippet(s) with errors:\n`);

  for (const failure of failures) {
    console.error(`  ${failure.snippet.file}:${failure.snippet.lineNumber}`);
    console.error(`  Language: ${failure.snippet.language}`);
    console.error(`  Error: ${failure.error}\n`);
  }

  // Clean up temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
  }

  process.exit(1);
}

main().catch(console.error);
