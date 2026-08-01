#!/usr/bin/env node

import { networkInterfaces } from "node:os";
import { pathToFileURL } from "node:url";

const preferredInterfaces = ["en0", "en1", "wlan0", "wifi0", "eth0"];

export function resolveLanIpv4(interfaces) {
  const names = [
    ...preferredInterfaces,
    ...Object.keys(interfaces).filter(
      (name) => !preferredInterfaces.includes(name),
    ),
  ];

  for (const name of names) {
    for (const address of interfaces[name] ?? []) {
      if (
        address.family === "IPv4" &&
        !address.internal &&
        !address.address.startsWith("169.254.")
      ) {
        return address.address;
      }
    }
  }
  return null;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.stdout.write(
    `${resolveLanIpv4(networkInterfaces()) ?? "127.0.0.1"}\n`,
  );
}
