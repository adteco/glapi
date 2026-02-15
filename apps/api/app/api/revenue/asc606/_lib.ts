import { NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';
import { appRouter, createCallerFactory, createContext } from '@glapi/trpc';
import { getServiceContext } from '../../utils/auth';
import { handleApiError } from '../../utils/errors';

const createCaller = createCallerFactory(appRouter);

const TRPC_STATUS_MAP: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

export async function getAsc606Caller() {
  const serviceContext = await getServiceContext();
  const trpcContext = await createContext({
    user: {
      clerkId: serviceContext.clerkUserId,
      entityId: serviceContext.entityId,
      organizationId: serviceContext.organizationId,
      email: null,
      role: 'user',
      id: serviceContext.userId,
    },
    organizationName: serviceContext.organizationName ?? null,
  });

  return createCaller(trpcContext);
}

export function handleAsc606ApiError(error: unknown) {
  if (error instanceof TRPCError) {
    return NextResponse.json(
      {
        message: error.message,
        code: error.code,
        details: error.cause,
      },
      { status: TRPC_STATUS_MAP[error.code] ?? 500 }
    );
  }

  return handleApiError(error);
}

