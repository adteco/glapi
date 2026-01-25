import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center py-20 px-4 text-center bg-gradient-to-b from-fd-background to-fd-muted/30">
        <div className="mb-6">
          <svg
            width="64"
            height="64"
            viewBox="0 0 28 28"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="GLAPI Logo"
            className="mx-auto"
          >
            <rect x="4" y="3" width="20" height="22" rx="2" fill="currentColor" opacity="0.9" />
            <rect x="6" y="6" width="10" height="2" rx="1" fill="white" opacity="0.8" />
            <rect x="6" y="10" width="14" height="1" rx="0.5" fill="white" opacity="0.5" />
            <rect x="6" y="13" width="14" height="1" rx="0.5" fill="white" opacity="0.5" />
            <rect x="6" y="16" width="14" height="1" rx="0.5" fill="white" opacity="0.5" />
            <rect x="6" y="19" width="8" height="1" rx="0.5" fill="white" opacity="0.5" />
            <circle cx="21" cy="21" r="5" fill="#10B981" />
            <path d="M19 21h4M21 19v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          GLAPI Documentation
        </h1>
        <p className="max-w-2xl mb-8 text-lg text-fd-muted-foreground">
          API-first General Ledger with revenue recognition, multi-entity support,
          and real-time financial reporting. Everything you need to integrate
          GLAPI into your applications.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-fd-primary rounded-lg hover:bg-fd-primary/90 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/docs/api"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium border border-fd-border rounded-lg hover:bg-fd-muted transition-colors"
          >
            API Reference
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            What you can build with GLAPI
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="$"
              title="Double-Entry Accounting"
              description="Full journal entry support with automatic balancing and audit trails"
            />
            <FeatureCard
              icon="*"
              title="Revenue Recognition"
              description="ASC 606 compliant revenue tracking with performance obligations"
            />
            <FeatureCard
              icon="#"
              title="Multi-Entity Support"
              description="Manage multiple subsidiaries, departments, and locations"
            />
            <FeatureCard
              icon=">"
              title="Real-time Reporting"
              description="Generate balance sheets, income statements, and custom reports"
            />
            <FeatureCard
              icon="{"
              title="API-First Design"
              description="RESTful API with OpenAPI spec and interactive documentation"
            />
            <FeatureCard
              icon="+"
              title="Extensible"
              description="Webhooks, custom fields, and integration-ready architecture"
            />
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-16 px-4 bg-fd-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            Popular Resources
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <QuickLink
              href="/docs/quickstart"
              title="Quickstart Guide"
              description="Get up and running with GLAPI in under 5 minutes"
            />
            <QuickLink
              href="/docs/api/authentication"
              title="Authentication"
              description="Learn how to authenticate API requests"
            />
            <QuickLink
              href="/docs/api/endpoints"
              title="API Endpoints"
              description="Browse all available API endpoints and operations"
            />
            <QuickLink
              href="/docs/api/objects"
              title="Data Objects"
              description="Understand the data structures used by GLAPI"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-lg border border-fd-border bg-fd-card hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-fd-primary/10 flex items-center justify-center mb-4 text-fd-primary font-bold">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-fd-muted-foreground">{description}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start p-4 rounded-lg border border-fd-border hover:border-fd-primary/50 hover:bg-fd-card transition-colors group"
    >
      <div className="flex-1">
        <h3 className="font-semibold mb-1 group-hover:text-fd-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-fd-muted-foreground">{description}</p>
      </div>
      <span className="text-fd-muted-foreground group-hover:text-fd-primary transition-colors">
        &rarr;
      </span>
    </Link>
  );
}
