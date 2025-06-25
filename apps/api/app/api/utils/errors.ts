import { NextResponse } from 'next/server';

export interface ServiceError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
}

export function isServiceError(error: unknown): error is ServiceError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    'code' in error &&
    'message' in error
  );
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  // Check if it's a ServiceError
  if (isServiceError(error)) {
    return NextResponse.json(
      {
        message: error.message,
        code: error.code,
        details: error.details
      },
      { status: error.statusCode }
    );
  }
  
  // Generic error handling
  if (error instanceof Error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { message: 'Internal server error' },
    { status: 500 }
  );
}