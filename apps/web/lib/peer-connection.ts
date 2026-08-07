"use client";

import type { PairingSessionDetails } from "@flashcards/api-client";
import type { CreatePairingSignal, PairingSignal } from "@flashcards/domain";

import { api } from "./api";
import { pairingProof } from "./device-identity";

type PairingSignalClient = {
  sendPairingSignal(
    sessionId: string,
    input: CreatePairingSignal,
  ): Promise<PairingSignal>;
  listPairingSignals(
    sessionId: string,
    deviceId: string,
    afterSequence: number,
  ): Promise<{ afterSequence: number; signals: PairingSignal[] }>;
};

type DescriptionPayload = {
  description: RTCSessionDescriptionInit;
  fingerprint: string;
  fingerprintProof: string;
};

type CandidatePayload = {
  candidate: RTCIceCandidateInit;
};

export type PairingConnectionStatus =
  "CONNECTING" | "DIRECT" | "CLOSED" | "FAILED";

export type PairingPeerConnection = {
  close(): void;
};

const pollingIntervalMs = 800;
const connectionTimeoutMs = 30_000;
const maximumConsecutivePollFailures = 4;

const errorStatus = (cause: unknown): number =>
  cause && typeof cause === "object" && "status" in cause
    ? Number(cause.status)
    : 0;

const retryableSignalingError = (cause: unknown): boolean => {
  const status = errorStatus(cause);
  return status === 0 || status === 429 || status >= 500;
};

export function sdpSha256Fingerprint(sdp: string): string {
  const match = sdp.match(/^a=fingerprint:sha-256\s+([^\r\n]+)$/im);
  if (!match?.[1]) throw new Error("WebRTC SHA-256 fingerprint is missing");
  return match[1].trim().toUpperCase();
}

const parseDescriptionPayload = (value: string): DescriptionPayload => {
  const parsed = JSON.parse(value) as Partial<DescriptionPayload>;
  if (
    !parsed.description ||
    (parsed.description.type !== "offer" &&
      parsed.description.type !== "answer") ||
    typeof parsed.description.sdp !== "string" ||
    typeof parsed.fingerprint !== "string" ||
    typeof parsed.fingerprintProof !== "string"
  ) {
    throw new Error("Invalid WebRTC description signal");
  }
  if (sdpSha256Fingerprint(parsed.description.sdp) !== parsed.fingerprint) {
    throw new Error("WebRTC fingerprint does not match its description");
  }
  return parsed as DescriptionPayload;
};

const parseCandidatePayload = (value: string): CandidatePayload => {
  const parsed = JSON.parse(value) as Partial<CandidatePayload>;
  if (!parsed.candidate || typeof parsed.candidate.candidate !== "string") {
    throw new Error("Invalid WebRTC candidate signal");
  }
  return parsed as CandidatePayload;
};

export async function establishPairingPeerConnection(input: {
  session: PairingSessionDetails;
  localDeviceId: string;
  secret: string;
  role: "INITIATOR" | "JOINER";
  onStatus(status: PairingConnectionStatus): void;
  onDataChannel(channel: RTCDataChannel): void;
  signalClient?: PairingSignalClient;
  createPeerConnection?: () => RTCPeerConnection;
}): Promise<PairingPeerConnection> {
  if (!input.session.joiningDeviceId) {
    throw new Error("Pairing session has no second device");
  }
  if (typeof RTCPeerConnection === "undefined" && !input.createPeerConnection) {
    throw new Error("Direct device connections are unavailable here");
  }
  const remoteDeviceId =
    input.localDeviceId === input.session.initiatorDeviceId
      ? input.session.joiningDeviceId
      : input.session.initiatorDeviceId;
  const client = input.signalClient ?? api;
  const connection =
    input.createPeerConnection?.() ?? new RTCPeerConnection({ iceServers: [] });
  let closed = false;
  let direct = false;
  let afterSequence = 0;
  let pollTimer: number | undefined;
  let connectionTimer: number | undefined;
  let consecutivePollFailures = 0;
  const pendingCandidates: RTCIceCandidateInit[] = [];

  const clearTimers = () => {
    if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    if (connectionTimer !== undefined) window.clearTimeout(connectionTimer);
    pollTimer = undefined;
    connectionTimer = undefined;
  };

  const finish = (status: "CLOSED" | "FAILED") => {
    if (closed) return;
    closed = true;
    clearTimers();
    input.onStatus(status);
    connection.close();
  };

  const wait = (delayMs: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));

  const send = async (type: CreatePairingSignal["type"], payload: unknown) => {
    if (closed) return;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await client.sendPairingSignal(input.session.id, {
          senderDeviceId: input.localDeviceId,
          recipientDeviceId: remoteDeviceId,
          type,
          payload: JSON.stringify(payload),
        });
        return;
      } catch (cause) {
        lastError = cause;
        if (!retryableSignalingError(cause) || attempt === 2) throw cause;
        await wait(400 * 2 ** attempt);
        if (closed || direct) return;
      }
    }
    throw lastError;
  };

  const attachChannel = (channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = 512 * 1024;
    channel.addEventListener("open", () => {
      if (closed) return;
      direct = true;
      clearTimers();
      input.onDataChannel(channel);
      input.onStatus("DIRECT");
    });
    channel.addEventListener("close", () => finish("CLOSED"));
    channel.addEventListener("error", () => finish("FAILED"));
  };

  connection.addEventListener("datachannel", (event) =>
    attachChannel(event.channel),
  );
  connection.addEventListener("connectionstatechange", () => {
    if (connection.connectionState === "failed") finish("FAILED");
    if (connection.connectionState === "closed") finish("CLOSED");
  });
  connection.addEventListener("icecandidate", (event) => {
    void send(
      event.candidate ? "ICE_CANDIDATE" : "ICE_COMPLETE",
      event.candidate ? { candidate: event.candidate.toJSON() } : {},
    ).catch(() => {
      if (!direct) finish("FAILED");
    });
  });

  const acceptDescription = async (
    signal: PairingSignal,
    expectedType: "offer" | "answer",
  ) => {
    const payload = parseDescriptionPayload(signal.payload);
    if (payload.description.type !== expectedType) {
      throw new Error("Unexpected WebRTC description type");
    }
    const expectedProof = await pairingProof(
      input.secret,
      `dtls:${remoteDeviceId}:${payload.fingerprint}`,
    );
    if (expectedProof !== payload.fingerprintProof) {
      throw new Error("WebRTC fingerprint proof does not match");
    }
    await connection.setRemoteDescription(payload.description);
    for (const candidate of pendingCandidates.splice(0)) {
      await connection.addIceCandidate(candidate);
    }
  };

  const sendDescription = async (description: RTCSessionDescriptionInit) => {
    if (!description.sdp) throw new Error("WebRTC description is empty");
    const fingerprint = sdpSha256Fingerprint(description.sdp);
    await send(description.type === "offer" ? "OFFER" : "ANSWER", {
      description,
      fingerprint,
      fingerprintProof: await pairingProof(
        input.secret,
        `dtls:${input.localDeviceId}:${fingerprint}`,
      ),
    } satisfies DescriptionPayload);
  };

  const consumeSignals = async () => {
    const page = await client.listPairingSignals(
      input.session.id,
      input.localDeviceId,
      afterSequence,
    );
    afterSequence = page.afterSequence;
    for (const signal of page.signals) {
      if (signal.type === "ABORT") {
        throw new Error("The other device cancelled the connection");
      }
      if (signal.type === "OFFER" && input.role === "JOINER") {
        await acceptDescription(signal, "offer");
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        await sendDescription(connection.localDescription ?? answer);
      } else if (signal.type === "ANSWER" && input.role === "INITIATOR") {
        await acceptDescription(signal, "answer");
      } else if (signal.type === "ICE_CANDIDATE") {
        const candidate = parseCandidatePayload(signal.payload).candidate;
        if (connection.remoteDescription) {
          await connection.addIceCandidate(candidate);
        } else {
          pendingCandidates.push(candidate);
        }
      }
    }
  };

  const poll = async () => {
    if (closed || direct) return;
    try {
      await consumeSignals();
      consecutivePollFailures = 0;
      if (!closed && !direct)
        pollTimer = window.setTimeout(() => void poll(), pollingIntervalMs);
    } catch (cause) {
      if (closed || direct) return;
      consecutivePollFailures += 1;
      if (
        !retryableSignalingError(cause) ||
        consecutivePollFailures >= maximumConsecutivePollFailures
      ) {
        finish("FAILED");
        return;
      }
      pollTimer = window.setTimeout(
        () => void poll(),
        Math.min(1_000 * 2 ** (consecutivePollFailures - 1), 8_000),
      );
    }
  };

  input.onStatus("CONNECTING");
  connectionTimer = window.setTimeout(
    () => finish("FAILED"),
    connectionTimeoutMs,
  );
  try {
    if (input.role === "INITIATOR") {
      const channel = connection.createDataChannel("flash-n-flip-v1", {
        ordered: true,
      });
      attachChannel(channel);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await sendDescription(connection.localDescription ?? offer);
    }
  } catch (cause) {
    finish("FAILED");
    throw cause;
  }
  void poll();

  return {
    close() {
      if (closed) return;
      closed = true;
      clearTimers();
      connection.close();
    },
  };
}
