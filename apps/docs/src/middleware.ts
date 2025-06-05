// Disable middleware entirely for the docs app
// This ensures no request interception occurs
export default function middleware() {
  // Middleware is disabled
}

export const config = {
  matcher: [],
}