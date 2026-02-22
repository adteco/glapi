export default function CustomerPortalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-12">
      {children}
    </main>
  );
}
