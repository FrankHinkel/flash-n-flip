import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { readConfig } from "../config.js";
import * as schema from "./schema.js";

const config = readConfig();
const queryClient = postgres(config.DATABASE_URL, {
  max: config.NODE_ENV === "test" ? 1 : 10,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export const closeDatabase = async (): Promise<void> => queryClient.end();
