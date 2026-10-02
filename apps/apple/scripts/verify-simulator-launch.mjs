import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Integration check: creates and removes only its own disposable simulator.
// A launch acknowledgement alone is insufficient: require the App process to
// survive, then repeat after termination. This is not rendered UI acceptance.
const app =
  process.argv[2] ??
  fileURLToPath(
    new URL(
      "../ios/DerivedData/Build/Products/Release-iphonesimulator/App.app",
      import.meta.url,
    ),
  );
if (!existsSync(app)) throw new Error("Build the Release simulator App first");
const run = (...args) =>
  execFileSync("xcrun", ["simctl", ...args], {
    encoding: "utf8",
    timeout: 120000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const available = JSON.parse(run("list", "--json"));
const runtime = available.runtimes
  .filter((r) => r.isAvailable && r.identifier.includes(".iOS-"))
  .sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  )[0];
const deviceType = available.devicetypes.find(
  (d) =>
    d.name.startsWith("iPhone") &&
    runtime?.version &&
    (!d.minRuntimeVersionString ||
      Number(d.minRuntimeVersionString.split(".")[0]) <=
        Number(runtime.version.split(".")[0])),
);
if (!runtime || !deviceType)
  throw new Error("An available iPhone simulator runtime is required");
const device = run(
  "create",
  `Flash-n-Flip launch check ${crypto.randomUUID()}`,
  deviceType.identifier,
  runtime.identifier,
);
const bundleId = execFileSync(
  "/usr/libexec/PlistBuddy",
  ["-c", "Print :CFBundleIdentifier", `${app}/Info.plist`],
  { encoding: "utf8" },
).trim();
const starts = [];
try {
  run("boot", device);
  run("bootstatus", device, "-b");
  run("install", device, app);
  for (let attempt = 0; attempt < 2; attempt++) {
    const launch = run("launch", device, bundleId);
    const pid = Number(launch.match(/: (\d+)$/)?.[1]);
    if (!Number.isSafeInteger(pid) || pid <= 0)
      throw new Error("Simulator did not return an App PID");
    for (let tick = 0; tick < 5; tick++) {
      await delay(1000);
      let command;
      try {
        command = execFileSync("ps", ["-p", String(pid), "-o", "comm="], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        throw new Error(`App exited during launch check ${attempt + 1}`);
      }
      if (!command.endsWith("/App.app/App"))
        throw new Error("App process identity changed during launch check");
    }
    starts.push({ attempt: attempt + 1, pid, survivedSeconds: 5 });
    run("terminate", device, bundleId);
  }
  process.stdout.write(
    JSON.stringify({
      result: "passed",
      starts,
      boundary:
        "Native process survival and restart only; no rendered UI, SQLite learning or CloudKit acceptance claim",
    }) + "\n",
  );
} finally {
  try {
    run("shutdown", device);
  } finally {
    run("delete", device);
  }
}
