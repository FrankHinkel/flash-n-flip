import assert from "node:assert/strict";
import test from "node:test";

import { resolveLanIpv4 } from "./resolve-lan-host.mjs";

test("prefers the Wi-Fi address over virtual interfaces", () => {
  assert.equal(
    resolveLanIpv4({
      bridge0: [{ address: "172.17.0.1", family: "IPv4", internal: false }],
      en0: [{ address: "192.168.178.184", family: "IPv4", internal: false }],
    }),
    "192.168.178.184",
  );
});

test("ignores loopback and link-local addresses", () => {
  assert.equal(
    resolveLanIpv4({
      lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      en0: [{ address: "169.254.1.2", family: "IPv4", internal: false }],
    }),
    null,
  );
});
