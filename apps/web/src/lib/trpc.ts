import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@glapi/trpc';

export const trpc = createTRPCReact<AppRouter>();