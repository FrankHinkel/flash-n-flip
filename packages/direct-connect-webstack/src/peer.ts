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

type ConnectionRole = "INITIATOR" | "JOINER";

export type DirectConnection = {
  channel: RTCDataChannel;
  close(): Promise<void>;
};

export type CreatedInvitation = {
  invitation: DirectSyncInvitation;
  connect(): Promise<DirectConnection>;
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
};

const requestJson = async <T>(request: JsonRequest): Promise<T> => {
  const headers = {
    ...(request.data === undefined
      ? {}
      : { "content-type": "application/json" }),
    ...request.headers,
  };
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      ...request,
      headers,
      connectTimeout: 10_000,
      readTimeout: 15_000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
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
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : `Rendezvous request failed (${response.status})`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

const sessionUrl = (secrets: SessionSecrets): string =>
  `${secrets.apiOrigin.replace(/\/$/, "")}/rendezvous/v1/sessions/${secrets.sessionId}`;

const authorization = (capability: string): Record<string, string> => ({
  authorization: `Rendezvous ${capability}`,
});

const sendSignal = async (
  secrets: SessionSecrets,
  kind: EncryptedRendezvousMessage["kind"],
  payload: unknown,
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
  });
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const waitForIceGathering = async (
  connection: RTCPeerConnection,
): Promise<void> => {
  if (connection.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(finish, 15_000);
    function finish() {
      window.clearTimeout(timeout);
      connection.removeEventListener("icegatheringstatechange", changed);
      resolve();
    }
    function changed() {
      if (connection.iceGatheringState === "complete") finish();
    }
    connection.addEventListener("icegatheringstatechange", changed);
  });
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
): Promise<EncryptedRendezvousMessage> => {
  let afterSequence = 0;
  const seen = new Set<string>();
  while (Date.now() < deadline) {
    const page = await requestJson<{ signals: RendezvousSignal[] }>({
      method: "GET",
      url: `${sessionUrl(secrets)}/signals?afterSequence=${afterSequence}`,
      headers: authorization(secrets.capability),
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
    await wait(700);
  }
  throw new Error("Direct connection timed out");
};

const waitForJoinedSession = async (
  secrets: SessionSecrets,
  deadline: number,
): Promise<void> => {
  while (Date.now() < deadline) {
    const session = await requestJson<RendezvousSession>({
      method: "GET",
      url: sessionUrl(secrets),
      headers: authorization(secrets.capability),
    });
    if (session.state === "JOINED") return;
    await wait(700);
  }
  throw new Error("Invitation was not joined in time");
};

const awaitOpenChannel = async (
  connection: RTCPeerConnection,
  channelPromise: Promise<RTCDataChannel>,
): Promise<RTCDataChannel> => {
  const channel = await channelPromise;
  if (channel.readyState === "open") return channel;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("DataChannel did not open")),
      30_000,
    );
    channel.addEventListener(
      "open",
      () => {
        window.clearTimeout(timeout);
        resolve(channel);
      },
      { once: true },
    );
    connection.addEventListener(
      "connectionstatechange",
      () => {
        if (connection.connectionState === "failed") {
          window.clearTimeout(timeout);
          reject(new Error("Direct connection failed"));
        }
      },
      { once: true },
    );
  });
};

const connectPeer = async (
  secrets: SessionSecrets,
): Promise<DirectConnection> => {
  const connection = new RTCPeerConnection(
    directRtcConfiguration(secrets.apiOrigin),
  );
  const deadline = Date.now() + 90_000;
  let channelPromise: Promise<RTCDataChannel>;
  if (secrets.role === "INITIATOR") {
    await waitForJoinedSession(secrets, deadline);
    const channel = connection.createDataChannel("flash-n-flip-direct-v1", {
      ordered: true,
    });
    channelPromise = Promise.resolve(channel);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await waitForIceGathering(connection);
    await sendSignal(
      secrets,
      "OFFER",
      assertDirectDescription(connection.localDescription ?? offer),
    );
    const answer = await pollForMessage(secrets, "ANSWER", deadline);
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
    const offer = await pollForMessage(secrets, "OFFER", deadline);
    await connection.setRemoteDescription(
      assertDirectDescription(offer.payload as RTCSessionDescriptionInit),
    );
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await waitForIceGathering(connection);
    await sendSignal(
      secrets,
      "ANSWER",
      assertDirectDescription(connection.localDescription ?? answer),
    );
  }
  const channel = await awaitOpenChannel(connection, channelPromise);
  channel.binaryType = "arraybuffer";
  return {
    channel,
    async close() {
      channel.close();
      connection.close();
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
