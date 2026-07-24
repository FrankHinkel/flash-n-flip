import { buildApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const app = await buildApp(config);

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: config.API_HOST, port: config.API_PORT });
