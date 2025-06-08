# Changelog

## 2025-01-08

### GL Accounts Service Layer Implementation

- **Service Architecture**: Implemented complete service layer for GL accounts following the established pattern
  - Created `AccountService` class in `packages/api-service/src/services/account-service.ts`
  - Added account type definitions in `packages/api-service/src/types/account.types.ts`
  - Updated GL accounts API routes to use service layer instead of direct database access

- **API Path Standardization**: Fixed incorrect API paths across the application
  - Changed from `/api/v1/gl/accounts` to `/api/gl/accounts` in web app
  - Updated all GL-related endpoints to follow consistent path structure

- **TypeScript Module Resolution**: Resolved caching issues preventing code updates
  - Identified and removed stale `.d.ts` declaration files causing webpack module caching problems
  - Added TypeScript declaration files to `.gitignore` to prevent future issues
  - Temporarily bypassed `findByAccountNumber` calls to work around persistent caching

- **CORS Configuration**: Updated middleware to support production domains
  - Added `https://web.glapi.net`, `https://www.glapi.net`, `https://glapi.net`, and `https://docs.glapi.net` to allowed origins
  - Ensured proper cross-origin communication between frontend and API

- **Authentication**: Fixed Clerk satellite domain configuration issues
  - Resolved localhost redirecting to adteco.com by adjusting satellite settings
  - Maintained proper authentication flow for both local and production environments

- **Pagination Support**: Fixed accounts page to handle paginated API responses
  - Updated `setAccounts(data)` to `setAccounts(data.data || [])` to properly handle response structure
  - Ensured chart of accounts displays correctly with hierarchical structure

- **Health Check System**: Created comprehensive health monitoring
  - Added `/api/health` endpoint to verify API → Service → Database communication
  - Implemented health check methods in AccountService and AccountRepository
  - Enabled layer-by-layer debugging of connectivity issues

- **Production Deployment**: Resolved build and runtime errors
  - Fixed ESLint errors by properly handling unused variables in health check route
  - Ensured successful Vercel deployment with all services operational

## 2025-01-23

- Update template to Tailwind CSS v4.0

## 2024-11-01

- Fix code block rendering when no snippet language is specified ([#1643](https://github.com/tailwindlabs/tailwindui-issues/issues/1643))

## 2024-08-08

- Configure experimental `outputFileTracingIncludes` for hosting on Vercel

## 2024-06-21

- Bump Headless UI dependency to v2.1
- Update to new data-attribute-based transition API

## 2024-06-18

- Update `prettier` and `prettier-plugin-tailwindcss` dependencies

## 2024-05-31

- Fix `npm audit` warnings

## 2024-05-07

- Bump Headless UI dependency to v2.0

## 2024-01-17

- Fix `sharp` dependency issues ([#1549](https://github.com/tailwindlabs/tailwindui-issues/issues/1549))

## 2024-01-16

- Replace Twitter with X

## 2024-01-10

- Update Tailwind CSS, Next.js, Prettier, TypeScript, ESLint, and other dependencies
- Update Tailwind `darkMode` setting to new `selector` option
- Fix `not-prose` typography alignment issues
- Add name to MDX search function
- Sort classes

## 2023-10-03

- Add missing `@types/mdx` dependency ([#1512](https://github.com/tailwindlabs/tailwindui-issues/issues/1512))

## 2023-09-07

- Added TypeScript version of template

## 2023-08-15

- Bump Next.js dependency

## 2023-07-31

- Port template to Next.js app router

## 2023-07-24

- Fix search rendering bug in Safari ([#1470](https://github.com/tailwindlabs/tailwindui-issues/issues/1470))

## 2023-07-18

- Add 404 page
- Sort imports and other formatting

## 2023-05-16

- Bump Next.js dependency

## 2023-05-15

- Replace Algolia DocSearch with basic built-in search ([#1395](https://github.com/tailwindlabs/tailwindui-issues/issues/1395))

## 2023-04-11

- Bump Next.js dependency

## 2023-03-29

- Bump Tailwind CSS and Prettier dependencies
- Sort classes

## 2023-03-22

- Bump Headless UI dependency

## 2023-02-15

- Fix scroll restoration bug ([#1387](https://github.com/tailwindlabs/tailwindui-issues/issues/1387))

## 2023-02-02

- Bump Headless UI dependency

## 2023-01-16

- Fixes yarn compatibility ([#1403](https://github.com/tailwindlabs/tailwindui-issues/issues/1403))
- Bump `zustand` dependency

## 2023-01-07

- Enable markdown table support in using `remark-gfm` plugin ([#1398](https://github.com/tailwindlabs/tailwindui-issues/issues/1398))
- Fix SVG attribute casing ([#1402](https://github.com/tailwindlabs/tailwindui-issues/issues/1402))

## 2023-01-03

- Fix header disappearing in Safari ([#1392](https://github.com/tailwindlabs/tailwindui-issues/issues/1392))

## 2022-12-17

- Bump `mdx-annotations` dependency

## 2022-12-16

- Fix scroll jumping issue with Dialog in Safari ([#1387](https://github.com/tailwindlabs/tailwindui-issues/issues/1387))
- Update "API" item in header navigation link to home page
- Bump Headless UI dependency

## 2022-12-15

- Initial release
