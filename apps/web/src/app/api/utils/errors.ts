import { NextResponse } from 'next/server';
import { AuthenticationError } from './auth';

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

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  // Handle authentication errors
  if (isAuthenticationError(error)) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        message: error.message,
        code: 'AUTHENTICATION_REQUIRED'
      },
      { status: 401 }
    );
  }
  
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
      { 
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { message: 'Internal server error' },
    { status: 500 }
  );
}