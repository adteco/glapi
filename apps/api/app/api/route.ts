import { NextRequest, NextResponse } from 'next/server';

// GET / - Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'UP',
    message: 'API is healthy'
  });
}