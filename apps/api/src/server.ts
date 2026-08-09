import { readConfig } from "./config.js";
import { buildRendezvousApp } from "./rendezvous-runtime.js";

const config = readConfig();
const app = await buildRendezvousApp(config);

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: config.API_HOST, port: config.API_PORT });
