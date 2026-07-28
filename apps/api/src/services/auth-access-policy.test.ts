import { describe, expect, it } from "vitest";

import { tunnelAdminEmail } from "./auth-access-policy.js";

describe("private authentication access policy", () => {
  it("uses a non-routable identity for the tunnel administrator", () => {
    expect(tunnelAdminEmail).toBe("tunnel-admin@flash-n-flip.invalid");
  });
});
