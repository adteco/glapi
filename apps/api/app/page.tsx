export default function Home() {
  return null;
}

// API health check endpoint
export async function GET() {
  return Response.json({
    status: 'UP',
    message: 'API is healthy'
  });
}