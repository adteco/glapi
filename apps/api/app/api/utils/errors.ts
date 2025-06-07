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