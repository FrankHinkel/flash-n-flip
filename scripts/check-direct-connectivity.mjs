import { readFile } from "node:fs/promises";

const [compose, peerConnection, deployment, productionDockerfile] =
  await Promise.all([
    readFile(
      new URL("../deploy/production/compose.yaml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../apps/web/lib/peer-connection.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../flashnflipDeployVPS.sh", import.meta.url), "utf8"),
    readFile(
      new URL("../deploy/production/Dockerfile", import.meta.url),
      "utf8",
    ),
  ]);

const requireText = (source, expected, message) => {
  if (!source.includes(expected)) throw new Error(message);
};

requireText(
  compose,
  "--stun-only",
  "Production connectivity service must be restricted to STUN-only mode",
);
requireText(
  compose,
  '"3478:3478/udp"',
  "Production must expose only the standard UDP STUN listener",
);
requireText(
  peerConnection,
  "stun:${stunHost(normalized)}:${stunPort}",
  "WebRTC must gather a server-reflexive candidate from the same-origin STUN service",
);
requireText(
  deployment,
  "probe-stun-only.mjs",
  "Deployment must verify STUN Binding and rejected TURN allocation",
);
requireText(
  productionDockerfile,
  "/app/scripts/probe-stun-only.mjs",
  "Production API image must contain the STUN-only deployment probe",
);
requireText(
  peerConnection,
  "isRelayIceCandidate",
  "WebRTC must enforce the direct-only candidate policy",
);

if (/[`"']turns?:/i.test(peerConnection)) {
  throw new Error("WebRTC client must not configure a TURN relay URL");
}

if (/\b(?:49152|65535)\b/.test(compose)) {
  throw new Error("Production must not expose a TURN relay port range");
}

console.log("Direct connectivity policy passed: STUN-only, no TURN relay.");
