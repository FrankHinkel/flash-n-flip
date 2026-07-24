import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeDatabase, db } from "../db/client.js";

await migrate(db, { migrationsFolder: "./drizzle" });
await closeDatabase();
