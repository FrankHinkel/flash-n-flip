import { openDB, type DBSchema } from "idb";
import {
  cloudLibraryBindingSchema,
  type CloudLibraryBinding,
} from "@flashcards/domain/cloud-library";
import {
  confirmCloudLibraryBinding,
  reserveCloudLibraryBinding,
  type CloudLibraryBindingRepository,
} from "@flashcards/sync/cloud-library-bootstrap";

interface BindingDatabase extends DBSchema {
  bindings: { key: string; value: CloudLibraryBinding };
}

export function createBrowserCloudLibraryBindings(
  databaseName = "flash-n-flip-cloud-library-binding-v1",
): CloudLibraryBindingRepository {
  const open = () => openDB<BindingDatabase>(databaseName, 1, {
    upgrade(db) { db.createObjectStore("bindings"); },
  });
  return {
    async read(environment) {
      const db = await open();
      try {
        const value = await db.get("bindings", environment);
        if (value === undefined) return null;
        const binding = cloudLibraryBindingSchema.parse(value);
        if (binding.environment !== environment) throw new Error("Invalid binding environment");
        return binding;
      } finally { db.close(); }
    },
    async reserve(candidate) {
      const db = await open();
      try {
        const tx = db.transaction("bindings", "readwrite");
        try {
          const existing = await tx.store.get(candidate.environment);
          const binding = reserveCloudLibraryBinding(existing ?? null, candidate);
          await tx.store.put(binding, binding.environment);
          await tx.done;
          return binding;
        } catch (error) {
          try { tx.abort(); } catch { /* May already be aborted by IndexedDB. */ }
          await tx.done.catch(() => undefined);
          throw error;
        }
      } finally { db.close(); }
    },
    async confirm(expected, root) {
      const db = await open();
      try {
        const tx = db.transaction("bindings", "readwrite");
        try {
          const existing = await tx.store.get(expected.environment);
          const binding = confirmCloudLibraryBinding(existing ?? null, expected, root);
          await tx.store.put(binding, binding.environment);
          await tx.done;
        } catch (error) {
          try { tx.abort(); } catch { /* Preserve the original transaction error. */ }
          await tx.done.catch(() => undefined);
          throw error;
        }
      } finally { db.close(); }
    },
  };
}
