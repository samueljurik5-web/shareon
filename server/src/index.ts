import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.info(`ShareOn API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
