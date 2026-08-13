import { Capacitor, CapacitorHttp } from "@capacitor/core";

import type {
  DirectSyncInvitation,
  EncryptedRendezvousMessage,
  RendezvousSession,
  RendezvousSignal,
} from "@flashcards/domain/rendezvous";
import {
  createRendezvousSecrets,
  decryptRendezvousSignal,
  encryptRendezvousMessage,
  rendezvousCapabilityHash,
} from "@flashcards/sync/rendezvous";

import {
  createNativePeerConnection,
  nativeDirectWebRtcAvailable,
  refreshNativeLocalDescription,
} from "./native-peer";
import type { TrustedPeer } from "./identity";

type ConnectionRole = "INITIATOR" | "JOINER";

export type DirectConnection = {
  channel: RTCDataChannel;
  reconnectSecret?: string;
  apiOrigin?: string;
  close(): Promise<void>;
};

export type CreatedInvitation = {
  invitation: DirectSyncInvitation;
  connect(): Promise<DirectConnection>;
};

export const directWebRtcAvailable = (): boolean =>
  typeof globalThis.RTCPeerConnection === "function" ||
  nativeDirectWebRtcAvailable();

const createPeerConnection = (
  configuration: RTCConfiguration,
): RTCPeerConnection => {
  if (!directWebRtcAvailable()) {
    throw new Error(
      "Direktverbindungen sind in dieser iPad-App auf dem Mac nicht verfügbar. Bitte Flash-n-Flip im Mac-Browser öffnen.",
    );
  }
  return typeof globalThis.RTCPeerConnection === "function"
    ? new globalThis.RTCPeerConnection(configuration)
    : createNativePeerConnection(configuration);
};

type SessionSecrets = {
  sessionId: string;
  apiOrigin: string;
  encryptionKey: string;
  capability: string;
  role: ConnectionRole;
};

type JsonRequest = {
  method: "GET" | "POST" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  data?: unknown;
  signal?: AbortSignal;
};

class RendezvousRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const requestJson = async <T>(request: JsonRequest): Promise<T> => {
  request.signal?.throwIfAborted();
  const headers = {
    ...(request.data === undefined
      ? {}
      : { "content-type": "application/json" }),
    ...request.headers,
  };
  if (Capacitor.isNativePlatform()) {
    const nativeRequest = CapacitorHttp.request({
      method: request.method,
      url: request.url,
      headers,
      data: request.data,
      connectTimeout: 10_000,
      readTimeout: 15_000,
    });
    const response = request.signal
      ? await abortable(nativeRequest, request.signal)
      : await nativeRequest;
    request.signal?.throwIfAborted();
    if (response.status < 200 || response.status >= 300) {
      throw new RendezvousRequestError(
        response.status,
        typeof response.data?.message === "string"
          ? response.data.message
          : `Rendezvous request failed (${response.status})`,
      );
    }
    return response.data as T;
  }
  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: request.data === undefined ? undefined : JSON.stringify(request.data),
    cache: "no-store",
    signal: request.signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    throw new RendezvousRequestError(
      response.status,
      typeof body?.message === "string"
        ? body.message
        : `Rendezvous request failed (${response.status})`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

const abortable = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();
    let settled = false;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", aborted);
      settle();
    };
    const aborted = () => finish(() => reject(signal.reason));
    signal.addEventListener("abort", aborted, { once: true });
    void promise.then(
      (value) => finish(() => resolve(value)),
      (cause) => finish(() => reject(cause)),
    );
  });

const sessionUrl = (secrets: SessionSecrets): string =>
  `${secrets.apiOrigin.replace(/\/$/, "")}/rendezvous/v1/sessions/${secrets.sessionId}`;

const authorization = (capability: string): Record<string, string> => ({
  authorization: `Rendezvous ${capability}`,
});

const sendSignal = async (
  secrets: SessionSecrets,
  kind: EncryptedRendezvousMessage["kind"],
  payload: unknown,
  signal?: AbortSignal,
): Promise<void> => {
  const message: EncryptedRendezvousMessage = {
    version: 1,
    messageId: crypto.randomUUID(),
    kind,
    payload,
    sentAt: new Date().toISOString(),
  };
  await requestJson({
    method: "POST",
    url: `${sessionUrl(secrets)}/signals`,
    headers: authorization(secrets.capability),
    data: {
      messageId: message.messageId,
      encryptedPayload: await encryptRendezvousMessage({
        sessionId: secrets.sessionId,
        encryptionKey: secrets.encryptionKey,
        message,
      }),
    },
    signal,
  });
};

const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const timeout = window.setTimeout(finish, milliseconds);
    const aborted = () => finish(signal!.reason);
    function finish(cause?: unknown) {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", aborted);
      if (cause !== undefined) reject(cause);
      else resolve();
    }
    signal?.addEventListener("abort", aborted, { once: true });
  });

const waitForIceGathering = async (
  connection: RTCPeerConnection,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  if (connection.iceGatheringState !== "complete") {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(finish, 15_000);
      const aborted = () => finish(signal!.reason);
      function finish(cause?: unknown) {
        window.clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", changed);
        signal?.removeEventListener("abort", aborted);
        if (cause !== undefined) reject(cause);
        else resolve();
      }
      function changed() {
        if (connection.iceGatheringState === "complete") finish();
      }
      connection.addEventListener("icegatheringstatechange", changed);
      signal?.addEventListener("abort", aborted, { once: true });
    });
  }
  signal?.throwIfAborted();
  await refreshNativeLocalDescription(connection);
};

export const assertDirectDescription = (
  description: RTCSessionDescriptionInit,
): RTCSessionDescriptionInit => {
  if (
    description.sdp?.split(/\r?\n/).some((line) => line.includes(" typ relay "))
  ) {
    throw new Error("TURN relay candidates are forbidden");
  }
  return description;
};

export const directRtcConfiguration = (apiOrigin: string): RTCConfiguration => {
  const hostname = new URL(apiOrigin).hostname;
  return {
    iceServers:
      hostname === "localhost" || hostname === "127.0.0.1"
        ? []
        : [{ urls: `stun:${hostname}:3478` }],
    iceTransportPolicy: "all",
  };
};

const pollForMessage = async (
  secrets: SessionSecrets,
  expectedKind: EncryptedRendezvousMessage["kind"],
  deadline: number,
  signal?: AbortSignal,
): Promise<EncryptedRendezvousMessage> => {
  let afterSequence = 0;
  const seen = new Set<string>();
  while (Date.now() < deadline) {
    const page = await requestJson<{ signals: RendezvousSignal[] }>({
      method: "GET",
      url: `${sessionUrl(secrets)}/signals?afterSequence=${afterSequence}`,
      headers: authorization(secrets.capability),
      signal,
    });
    for (const signal of page.signals) {
      afterSequence = Math.max(afterSequence, signal.sequence);
      if (seen.has(signal.messageId)) continue;
      seen.add(signal.messageId);
      const message = await decryptRendezvousSignal({
        sessionId: secrets.sessionId,
        encryptionKey: secrets.encryptionKey,
        signal,
      });
      if (message.kind === "ABORT") throw new Error("Peer cancelled pairing");
      if (message.kind === expectedKind) return message;
    }
    await wait(700, signal);
  }
  throw new Error("Direct connection timed out");
};

const waitForJoinedSession = async (
  secrets: SessionSecrets,
  deadline: number,
  signal?: AbortSignal,
): Promise<void> => {
  while (Date.now() < deadline) {
    const session = await requestJson<RendezvousSession>({
      method: "GET",
      url: sessionUrl(secrets),
      headers: authorization(secrets.capability),
      signal,
    });
    if (session.state === "JOINED") return;
    await wait(700, signal);
  }
  throw new Error("Invitation was not joined in time");
};

const awaitOpenChannel = async (
  connection: RTCPeerConnection,
  channelPromise: Promise<RTCDataChannel>,
  signal?: AbortSignal,
): Promise<RTCDataChannel> => {
  signal?.throwIfAborted();
  const channel = signal
    ? await abortable(channelPromise, signal)
    : await channelPromise;
  if (channel.readyState === "open") return channel;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => failed(new Error("DataChannel did not open")),
      30_000,
    );
    const aborted = () => failed(signal!.reason);
    const opened = () => {
      cleanup();
      resolve(channel);
    };
    const stateChanged = () => {
      if (connection.connectionState === "failed") {
        failed(new Error("Direct connection failed"));
      }
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", aborted);
      channel.removeEventListener("open", opened);
      connection.removeEventListener("connectionstatechange", stateChanged);
    };
    const failed = (cause: unknown) => {
      cleanup();
      reject(cause);
    };
    signal?.addEventListener("abort", aborted, { once: true });
    channel.addEventListener("open", opened, { once: true });
    connection.addEventListener("connectionstatechange", stateChanged);
  });
};

const connectPeer = async (
  secrets: SessionSecrets,
  timeoutMs = 90_000,
  signal?: AbortSignal,
): Promise<DirectConnection> => {
  const connection = createPeerConnection(
    directRtcConfiguration(secrets.apiOrigin),
  );
  const abortConnection = () => connection.close();
  signal?.addEventListener("abort", abortConnection, { once: true });
  const deadline = Date.now() + timeoutMs;
  let channelPromise: Promise<RTCDataChannel>;
  if (secrets.role === "INITIATOR") {
    await waitForJoinedSession(secrets, deadline, signal);
    const channel = connection.createDataChannel("flash-n-flip-direct-v1", {
      ordered: true,
    });
    channelPromise = Promise.resolve(channel);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await waitForIceGathering(connection, signal);
    await sendSignal(
      secrets,
      "OFFER",
      assertDirectDescription(connection.localDescription ?? offer),
      signal,
    );
    const answer = await pollForMessage(secrets, "ANSWER", deadline, signal);
    await connection.setRemoteDescription(
      assertDirectDescription(answer.payload as RTCSessionDescriptionInit),
    );
  } else {
    channelPromise = new Promise((resolve) =>
      connection.addEventListener(
        "datachannel",
        (event) => resolve(event.channel),
        {
          once: true,
        },
      ),
    );
    const offer = await pollForMessage(secrets, "OFFER", deadline, signal);
    await connection.setRemoteDescription(
      assertDirectDescription(offer.payload as RTCSessionDescriptionInit),
    );
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await waitForIceGathering(connection, signal);
    await sendSignal(
      secrets,
      "ANSWER",
      assertDirectDescription(connection.localDescription ?? answer),
      signal,
    );
  }
  const channel = await awaitOpenChannel(connection, channelPromise, signal);
  signal?.removeEventListener("abort", abortConnection);
  channel.binaryType = "arraybuffer";
  let disconnectedTimer = 0;
  let transportClosed = false;
  const closeTransport = () => {
    if (transportClosed) return;
    transportClosed = true;
    window.clearTimeout(disconnectedTimer);
    channel.close();
    connection.close();
  };
  const watchConnectionState = () => {
    window.clearTimeout(disconnectedTimer);
    disconnectedTimer = 0;
    if (connection.connectionState === "disconnected") {
      disconnectedTimer = window.setTimeout(() => {
        if (connection.connectionState === "disconnected") closeTransport();
      }, 5_000);
    } else if (
      connection.connectionState === "failed" ||
      connection.connectionState === "closed"
    ) {
      closeTransport();
    }
  };
  connection.addEventListener("connectionstatechange", watchConnectionState);
  return {
    channel,
    reconnectSecret: secrets.encryptionKey,
    apiOrigin: secrets.apiOrigin,
    async close() {
      connection.removeEventListener(
        "connectionstatechange",
        watchConnectionState,
      );
      closeTransport();
      await requestJson<void>({
        method: "DELETE",
        url: sessionUrl(secrets),
        headers: authorization(secrets.capability),
      }).catch(() => undefined);
    },
  };
};

export async function createDirectSyncInvitation(
  apiOrigin: string,
): Promise<CreatedInvitation> {
  const normalizedOrigin = apiOrigin.replace(/\/$/, "");
  const sessionId = crypto.randomUUID();
  const secrets = createRendezvousSecrets();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const session = await requestJson<RendezvousSession>({
    method: "POST",
    url: `${normalizedOrigin}/rendezvous/v1/sessions`,
    data: {
      id: sessionId,
      supportedProtocolVersions: [1],
      initiatorCapabilityHash: await rendezvousCapabilityHash(
        secrets.initiatorCapability,
      ),
      joinerCapabilityHash: await rendezvousCapabilityHash(
        secrets.joinerCapability,
      ),
    },
  });
  const invitation: DirectSyncInvitation = {
    version: session.protocolVersion,
    apiOrigin: normalizedOrigin,
    sessionId,
    joinerCapability: secrets.joinerCapability,
    encryptionKey: secrets.encryptionKey,
    expiresAt,
  };
  return {
    invitation,
    connect: () =>
      connectPeer({
        sessionId,
        apiOrigin: normalizedOrigin,
        encryptionKey: secrets.encryptionKey,
        capability: secrets.initiatorCapability,
        role: "INITIATOR",
      }),
  };
}

export async function joinDirectSyncInvitation(
  invitation: DirectSyncInvitation,
): Promise<DirectConnection> {
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    throw new Error("Invitation has expired");
  }
  await requestJson({
    method: "POST",
    url: `${invitation.apiOrigin.replace(/\/$/, "")}/rendezvous/v1/sessions/${invitation.sessionId}/join`,
    headers: authorization(invitation.joinerCapability),
    data: {},
  });
  return connectPeer({
    sessionId: invitation.sessionId,
    apiOrigin: invitation.apiOrigin,
    encryptionKey: invitation.encryptionKey,
    capability: invitation.joinerCapability,
    role: "JOINER",
  });
}

const reconnectSlotMilliseconds = 60_000;
const textEncoder = new TextEncoder();

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

const decodeBase64Url = (value: string): Uint8Array => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(
    `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`,
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const hmac = async (secret: string, label: string): Promise<Uint8Array> => {
  const secretBytes = decodeBase64Url(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer.slice(
      secretBytes.byteOffset,
      secretBytes.byteOffset + secretBytes.byteLength,
    ) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(label)),
  );
};

const bytesToUuid = (input: Uint8Array): string => {
  const bytes = input.slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

export type ReconnectSessionSecrets = {
  slot: number;
  sessionId: string;
  encryptionKey: string;
  initiatorCapability: string;
  joinerCapability: string;
};

export const deriveReconnectSessionSecrets = async (
  reconnectSecret: string,
  slot: number,
): Promise<ReconnectSessionSecrets> => {
  const context = `flash-n-flip:reconnect:v1:${slot}`;
  const [session, encryption, initiator, joiner] = await Promise.all([
    hmac(reconnectSecret, `${context}:session`),
    hmac(reconnectSecret, `${context}:encryption`),
    hmac(reconnectSecret, `${context}:initiator`),
    hmac(reconnectSecret, `${context}:joiner`),
  ]);
  return {
    slot,
    sessionId: bytesToUuid(session),
    encryptionKey: base64Url(encryption),
    initiatorCapability: base64Url(initiator),
    joinerCapability: base64Url(joiner),
  };
};

const reconnectSecretsFor = async (
  peer: TrustedPeer,
  slot: number,
  role: ConnectionRole,
): Promise<SessionSecrets> => {
  const derived = await deriveReconnectSessionSecrets(
    peer.reconnectSecret,
    slot,
  );
  return {
    sessionId: derived.sessionId,
    apiOrigin: peer.apiOrigin,
    encryptionKey: derived.encryptionKey,
    capability:
      role === "INITIATOR"
        ? derived.initiatorCapability
        : derived.joinerCapability,
    role,
  };
};

export async function reconnectTrustedPeer(
  localDeviceId: string,
  peer: TrustedPeer,
  options: { now?: number; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<DirectConnection> {
  const role: ConnectionRole =
    localDeviceId.localeCompare(peer.deviceId) < 0 ? "INITIATOR" : "JOINER";
  const currentSlot = Math.floor(
    (options.now ?? Date.now()) / reconnectSlotMilliseconds,
  );
  const timeoutMs = options.timeoutMs ?? 20_000;
  if (role === "INITIATOR") {
    const secrets = await reconnectSecretsFor(peer, currentSlot, role);
    const derived = await deriveReconnectSessionSecrets(
      peer.reconnectSecret,
      currentSlot,
    );
    await requestJson<RendezvousSession>({
      method: "POST",
      url: `${peer.apiOrigin.replace(/\/$/, "")}/rendezvous/v1/sessions`,
      data: {
        id: secrets.sessionId,
        supportedProtocolVersions: [1],
        initiatorCapabilityHash: await rendezvousCapabilityHash(
          derived.initiatorCapability,
        ),
        joinerCapabilityHash: await rendezvousCapabilityHash(
          derived.joinerCapability,
        ),
      },
      signal: options.signal,
    }).catch((cause) => {
      if (!(cause instanceof RendezvousRequestError) || cause.status !== 409)
        throw cause;
    });
    return connectPeer(secrets, timeoutMs, options.signal);
  }

  let lastCause: unknown = new Error(
    "Kein aktives vertrauenswürdiges Gerät gefunden.",
  );
  for (const slot of [currentSlot, currentSlot - 1]) {
    const secrets = await reconnectSecretsFor(peer, slot, role);
    try {
      await requestJson({
        method: "POST",
        url: `${peer.apiOrigin.replace(/\/$/, "")}/rendezvous/v1/sessions/${secrets.sessionId}/join`,
        headers: authorization(secrets.capability),
        data: {},
        signal: options.signal,
      });
      return await connectPeer(secrets, timeoutMs, options.signal);
    } catch (cause) {
      lastCause = cause;
      if (
        !(cause instanceof RendezvousRequestError) ||
        ![404, 409].includes(cause.status)
      ) {
        throw cause;
      }
    }
  }
  throw lastCause;
}
