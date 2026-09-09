import type { CloudInventoryAvailability } from "./cloud-inventory";

export type CloudDeckOperation =
  | "open"
  | "sync"
  | "download"
  | "delete-local"
  | "remove-local"
  | "delete-cloud"
  | "delete-everywhere";

export function cloudDeckOperations(
  availability: CloudInventoryAvailability,
  synchronized: boolean,
): CloudDeckOperation[] {
  if (availability === "local") return ["open", "sync", "delete-local"];
  if (availability === "cloud") return ["download", "delete-cloud"];
  return [
    "open",
    ...(synchronized ? [] : (["sync"] as CloudDeckOperation[])),
    "remove-local",
    "delete-everywhere",
  ];
}
