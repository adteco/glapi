'use client';

import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Pre, CodeBlock } from 'fumadocs-ui/components/codeblock';
import type { ReactNode } from 'react';

/**
 * API Reference component - Shows code samples in multiple languages
 * with consistent styling and groupId for synced language selection.
 */
export interface APIReferenceProps {
  /** Endpoint path (e.g., "/api/customers") */
  endpoint: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** cURL example */
  curl?: string;
  /** TypeScript/JavaScript example */
  typescript?: string;
  /** Python example */
  python?: string;
  /** Additional children */
  children?: ReactNode;
}

export function APIReference({
  endpoint,
  method,
  curl,
  typescript,
  python,
  children,
}: APIReferenceProps) {
  const methodColors: Record<string, string> = {
    GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const availableLanguages: string[] = [];
  if (curl) availableLanguages.push('cURL');
  if (typescript) availableLanguages.push('TypeScript');
  if (python) availableLanguages.push('Python');

  return (
    <div className="my-6 rounded-lg border border-fd-border overflow-hidden">
      {/* Endpoint header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-fd-muted/50 border-b border-fd-border">
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${methodColors[method]}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-fd-foreground">{endpoint}</code>
      </div>

      {/* Code tabs */}
      {availableLanguages.length > 0 && (
        <Tabs items={availableLanguages} groupId="api-language" persist>
          {curl && (
            <Tab value="cURL">
              <CodeBlock lang="bash">
                <Pre>{curl}</Pre>
              </CodeBlock>
            </Tab>
          )}
          {typescript && (
            <Tab value="TypeScript">
              <CodeBlock lang="typescript">
                <Pre>{typescript}</Pre>
              </CodeBlock>
            </Tab>
          )}
          {python && (
            <Tab value="Python">
              <CodeBlock lang="python">
                <Pre>{python}</Pre>
              </CodeBlock>
            </Tab>
          )}
        </Tabs>
      )}

      {children && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

/**
 * Code Sample component - Simple multi-language code display
 */
export interface CodeSampleProps {
  /** Tab labels */
  languages: string[];
  /** Corresponding code for each language */
  code: Record<string, string>;
  /** Title for the code sample */
  title?: string;
  /** Persist language selection */
  persist?: boolean;
}

export function CodeSample({
  languages,
  code,
  title,
  persist = true,
}: CodeSampleProps) {
  return (
    <div className="my-4">
      {title && (
        <p className="text-sm font-medium text-fd-muted-foreground mb-2">
          {title}
        </p>
      )}
      <Tabs items={languages} groupId="code-language" persist={persist}>
        {languages.map((lang) => (
          <Tab key={lang} value={lang}>
            <CodeBlock lang={getLanguageForHighlighting(lang)}>
              <Pre>{code[lang]}</Pre>
            </CodeBlock>
          </Tab>
        ))}
      </Tabs>
    </div>
  );
}

/**
 * SDK Install component - Shows installation instructions for different package managers
 */
export interface SDKInstallProps {
  /** npm package name */
  packageName: string;
  /** Optional peer dependencies */
  peerDeps?: string[];
  /** Show dev dependency flag */
  dev?: boolean;
}

export function SDKInstall({ packageName, peerDeps = [], dev = false }: SDKInstallProps) {
  const packages = [packageName, ...peerDeps].join(' ');
  const devFlag = dev ? ' -D' : '';

  const commands: Record<string, string> = {
    npm: `npm install${devFlag} ${packages}`,
    pnpm: `pnpm add${dev ? ' -D' : ''} ${packages}`,
    yarn: `yarn add${dev ? ' -D' : ''} ${packages}`,
    bun: `bun add${dev ? ' -d' : ''} ${packages}`,
  };

  return (
    <Tabs items={['npm', 'pnpm', 'yarn', 'bun']} groupId="pkg-manager" persist>
      {Object.entries(commands).map(([manager, cmd]) => (
        <Tab key={manager} value={manager}>
          <CodeBlock lang="bash">
            <Pre>{cmd}</Pre>
          </CodeBlock>
        </Tab>
      ))}
    </Tabs>
  );
}

/**
 * Map display language to syntax highlighting language
 */
function getLanguageForHighlighting(language: string): string {
  const mapping: Record<string, string> = {
    TypeScript: 'typescript',
    JavaScript: 'javascript',
    Python: 'python',
    cURL: 'bash',
    Shell: 'bash',
    Bash: 'bash',
    JSON: 'json',
    Go: 'go',
    Ruby: 'ruby',
    Java: 'java',
    'C#': 'csharp',
    PHP: 'php',
  };
  return mapping[language] || language.toLowerCase();
}

/**
 * API Response component - Shows expected API response
 */
export interface APIResponseProps {
  /** Status code */
  status: number;
  /** Response body (JSON) */
  body: string;
  /** Optional description */
  description?: string;
}

export function APIResponse({ status, body, description }: APIResponseProps) {
  const statusColors: Record<number, string> = {
    200: 'text-green-600 dark:text-green-400',
    201: 'text-green-600 dark:text-green-400',
    204: 'text-green-600 dark:text-green-400',
    400: 'text-amber-600 dark:text-amber-400',
    401: 'text-red-600 dark:text-red-400',
    403: 'text-red-600 dark:text-red-400',
    404: 'text-amber-600 dark:text-amber-400',
    500: 'text-red-600 dark:text-red-400',
  };

  const statusText: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
  };

  return (
    <div className="my-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`font-mono font-bold ${statusColors[status] || ''}`}>
          {status} {statusText[status]}
        </span>
        {description && (
          <span className="text-sm text-fd-muted-foreground">
            — {description}
          </span>
        )}
      </div>
      <CodeBlock lang="json">
        <Pre>{body}</Pre>
      </CodeBlock>
    </div>
  );
}
