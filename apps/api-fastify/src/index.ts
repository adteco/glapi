import 'dotenv/config';
import { getPort } from './config';
import { buildServer } from './server';

async function main() {
  const server = await buildServer();
  const port = getPort();

  await server.listen({
    port,
    host: '0.0.0.0',
  });
}

void main().catch((error) => {
  console.error('[api-fastify] Failed to start server', error);
  process.exit(1);
});
