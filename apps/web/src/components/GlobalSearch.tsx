'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import {
  Search,
  Users,
  Briefcase,
  FileText,
  Package,
  Building,
  UserCircle,
  Contact,
  Loader2,
  Command as CommandIcon,
  ArrowRight,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { filterPages, CATEGORY_CONFIG } from '@/lib/page-registry';

// Entity type configuration - single source of truth
// Prefixes are first 4 letters of entity type + ":"
const ENTITY_TYPES = [
  { type: 'customer', prefix: 'cust:', label: 'Customers', icon: Users, color: 'bg-blue-500/10 text-blue-500', description: 'Search customers by name or ID' },
  { type: 'project', prefix: 'proj:', label: 'Projects', icon: Briefcase, color: 'bg-purple-500/10 text-purple-500', description: 'Search projects by name or code' },
  { type: 'invoice', prefix: 'invo:', label: 'Invoices', icon: FileText, color: 'bg-green-500/10 text-green-500', description: 'Search invoices by number' },
  { type: 'item', prefix: 'item:', label: 'Items', icon: Package, color: 'bg-orange-500/10 text-orange-500', description: 'Search items by name or code' },
  { type: 'vendor', prefix: 'vend:', label: 'Vendors', icon: Building, color: 'bg-yellow-500/10 text-yellow-500', description: 'Search vendors by name' },
  { type: 'employee', prefix: 'empl:', label: 'Employees', icon: UserCircle, color: 'bg-pink-500/10 text-pink-500', description: 'Search employees by name' },
  { type: 'contact', prefix: 'cont:', label: 'Contacts', icon: Contact, color: 'bg-cyan-500/10 text-cyan-500', description: 'Search contacts by name' },
] as const;

// Get prefix for a type (first 4 chars + ":")
const getPrefix = (type: string) => ENTITY_TYPES.find(e => e.type === type)?.prefix ?? `${type.slice(0, 4)}:`;

// Derived mappings
const TYPE_ICONS: Record<string, React.ElementType> = Object.fromEntries(
  ENTITY_TYPES.map((e) => [e.type, e.icon])
);

const TYPE_COLORS: Record<string, string> = Object.fromEntries(
  ENTITY_TYPES.map((e) => [e.type, e.color])
);

// Derived search hints using explicit prefixes
const SEARCH_HINTS = ENTITY_TYPES.map((e) => ({
  prefix: e.prefix,
  label: e.label,
  description: e.description,
  color: e.color,
}));

interface GlobalSearchProps {
  className?: string;
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const debouncedQuery = useDebounce(query, 300);
  const router = useRouter();
  const { orgId } = useAuth();

  // Search query
  const { data: searchResults, isLoading } = trpc.globalSearch.search.useQuery(
    { query: debouncedQuery, limit: 15 },
    {
      enabled: !!orgId && debouncedQuery.length > 0,
      staleTime: 1000 * 60, // 1 minute
    }
  );

  // Keyboard shortcut to open search
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Handle selection
  const handleSelect = React.useCallback(
    (url: string) => {
      setOpen(false);
      setQuery('');
      router.push(url);
    },
    [router]
  );

  // Handle prefix click
  const handlePrefixClick = React.useCallback((prefix: string) => {
    setQuery(prefix + ' ');
  }, []);

  // Filter pages (instant, no debounce)
  const filteredPages = React.useMemo(() => filterPages(query), [query]);

  // Group results by type
  const groupedResults = React.useMemo(() => {
    if (!searchResults?.results) return {};

    return searchResults.results.reduce(
      (acc, result) => {
        if (!acc[result.type]) {
          acc[result.type] = [];
        }
        acc[result.type].push(result);
        return acc;
      },
      {} as Record<string, typeof searchResults.results>
    );
  }, [searchResults]);

  const hasResults = searchResults?.results && searchResults.results.length > 0;
  const hasPageResults = filteredPages.length > 0;
  const showHints = query.length === 0;

  return (
    <>
      {/* Search trigger button */}
      <Button
        variant="outline"
        className={cn(
          'relative h-9 w-full justify-start rounded-md bg-gray-800/50 border-gray-700 text-sm font-normal text-gray-400 shadow-none hover:bg-gray-800 hover:text-gray-300 sm:pr-12 md:w-64 lg:w-80',
          className
        )}
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search everything...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border border-gray-600 bg-gray-700 px-1.5 font-mono text-[10px] font-medium text-gray-400 opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Search dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false} className="rounded-lg border border-gray-700 bg-gray-900">
          <CommandInput
            placeholder="Search pages, customers, projects... (try 'proj:')"
            value={query}
            onValueChange={setQuery}
            className="border-none focus:ring-0"
          />
          <CommandList className="max-h-[400px]">
            {/* Loading state */}
            {isLoading && debouncedQuery.length > 0 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}

            {/* Empty state - only show if no pages AND no entity results */}
            {!isLoading && debouncedQuery.length > 0 && !hasResults && !hasPageResults && (
              <CommandEmpty>
                <div className="text-center py-6">
                  <Search className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">No results found for "{debouncedQuery}"</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Try using a prefix like "cust:" or "proj:" to filter by type
                  </p>
                </div>
              </CommandEmpty>
            )}

            {/* Search hints when empty */}
            {showHints && (
              <CommandGroup heading="Quick Search">
                {SEARCH_HINTS.map((hint) => (
                  <CommandItem
                    key={hint.prefix}
                    onSelect={() => handlePrefixClick(hint.prefix)}
                    className="flex items-center gap-3 py-2"
                  >
                    <div className={cn('p-1.5 rounded', hint.color)}>
                      <CommandIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-200">
                        <code className="text-xs bg-gray-800 px-1 py-0.5 rounded mr-2">{hint.prefix}</code>
                        {hint.label}
                      </div>
                      <div className="text-xs text-gray-500">{hint.description}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Page navigation results (instant) */}
            {hasPageResults && (
              <>
                <CommandGroup heading="Go to Page">
                  {filteredPages.map((page) => {
                    const Icon = page.icon;
                    const categoryConfig = CATEGORY_CONFIG[page.category];
                    return (
                      <CommandItem
                        key={page.path}
                        value={`page-${page.path}`}
                        onSelect={() => handleSelect(page.path)}
                        className="flex items-center gap-3 py-2 cursor-pointer"
                      >
                        <div className={cn('p-1.5 rounded', categoryConfig.color)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-200">{page.name}</div>
                          <div className="text-xs text-gray-500 truncate">{page.path}</div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {(hasResults || isLoading) && <CommandSeparator className="bg-gray-800" />}
              </>
            )}

            {/* Search results grouped by type */}
            {!isLoading && hasResults && (
              <>
                {Object.entries(groupedResults).map(([type, results], index) => {
                  const Icon = TYPE_ICONS[type] || Search;
                  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + 's';

                  return (
                    <React.Fragment key={type}>
                      {index > 0 && <CommandSeparator className="bg-gray-800" />}
                      <CommandGroup heading={typeLabel}>
                        {results.map((result) => (
                          <CommandItem
                            key={result.id}
                            value={`${result.type}-${result.id}`}
                            onSelect={() => handleSelect(result.url)}
                            className="flex items-center gap-3 py-2 cursor-pointer"
                          >
                            <div className={cn('p-1.5 rounded', TYPE_COLORS[result.type] || 'bg-gray-700')}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-200 truncate">{result.title}</div>
                              {result.subtitle && (
                                <div className="text-xs text-gray-500 truncate">{result.subtitle}</div>
                              )}
                            </div>
                            {result.metadata?.status && (
                              <span
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded-full',
                                  result.metadata.status === 'active'
                                    ? 'bg-green-500/10 text-green-400'
                                    : result.metadata.status === 'draft'
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : 'bg-gray-700 text-gray-400'
                                )}
                              >
                                {result.metadata.status}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </CommandList>

          {/* Footer with keyboard hints */}
          <div className="border-t border-gray-800 p-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">esc</kbd>
                close
              </span>
            </div>
            <div>
              Type <code className="px-1 bg-gray-800 rounded">proj:</code> to filter by type
            </div>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}

export default GlobalSearch;
