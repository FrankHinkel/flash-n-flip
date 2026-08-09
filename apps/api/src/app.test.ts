import { afterAll, describe, expect, it } from "vitest";
import Fastify from "fastify";

import { trustProxyForEnvironment } from "./app.js";
import { buildRendezvousApp } from "./rendezvous-runtime.js";

const app = await buildRendezvousApp({
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
});

afterAll(async () => app.close());

describe("API", () => {
  it("uses the client address behind the two production reverse proxies", async () => {
    const proxyApp = Fastify({
      trustProxy: trustProxyForEnvironment("production"),
    });
    proxyApp.get("/client-ip", async (request) => ({ ip: request.ip }));

    const response = await proxyApp.inject({
      method: "GET",
      url: "/client-ip",
      remoteAddress: "172.18.0.5",
      headers: {
        "x-forwarded-for": "203.0.113.42, 172.18.0.4",
      },
    });

    expect(response.json()).toEqual({ ip: "203.0.113.42" });
    await proxyApp.close();
  });

  it("does not trust forwarded client addresses outside production", () => {
    expect(trustProxyForEnvironment("development")).toBe(false);
    expect(trustProxyForEnvironment("test")).toBe(false);
  });

  it("reports health without leaking internals", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      role: "rendezvous-only",
    });
  });

  it.each(["/auth/register", "/auth/login", "/community/decks", "/decks"])(
    "does not expose the retired private endpoint %s",
    async (url) => {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(404);
    },
  );

  it("does not initialize a database connection for health checks", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
  });

  it.each(["POST", "DELETE"])(
    "allows browser preflight for %s mutations",
    async (method) => {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/decks/00000000-0000-4000-8000-000000000000",
        headers: {
          origin: "http://127.0.0.1:3000",
          "access-control-request-method": method,
          "access-control-request-headers": "authorization,content-type",
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:3000",
      );
      expect(response.headers["access-control-allow-methods"]).toContain(
        method,
      );
    },
  );
});
