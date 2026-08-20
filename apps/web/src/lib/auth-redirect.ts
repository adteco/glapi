export function safeAuthRedirectPath(search: string): string {
  const redirectPath = new URLSearchParams(search).get('redirect_url');

  return redirectPath?.startsWith('/') && !redirectPath.startsWith('//')
    ? redirectPath
    : '/dashboard';
}
