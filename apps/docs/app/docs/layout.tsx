import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';
import { VersionSelector } from '@/components/version-selector';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions()}
      sidebar={{
        defaultOpenLevel: 1,
        collapsible: true,
        banner: (
          <div className="p-3 border-b border-fd-border">
            <label className="text-xs text-fd-muted-foreground mb-1.5 block">
              API Version
            </label>
            <VersionSelector />
          </div>
        ),
        footer: (
          <div className="p-4 text-xs text-muted-foreground border-t">
            <p>Need help?</p>
            <a
              href="https://github.com/glapi/glapi/discussions"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask in Discussions
            </a>
          </div>
        ),
      }}
      containerProps={{
        className: 'max-w-6xl',
      }}
    >
      {children}
    </DocsLayout>
  );
}
