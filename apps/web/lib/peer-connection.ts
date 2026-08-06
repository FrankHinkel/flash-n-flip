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
  let afterSequence = 0;
  let pollTimer: number | undefined;
  const pendingCandidates: RTCIceCandidateInit[] = [];

  const send = async (type: CreatePairingSignal["type"], payload: unknown) => {
    if (closed) return;
    await client.sendPairingSignal(input.session.id, {
      senderDeviceId: input.localDeviceId,
      recipientDeviceId: remoteDeviceId,
      type,
      payload: JSON.stringify(payload),
    });
  };

  const attachChannel = (channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = 512 * 1024;
    channel.addEventListener("open", () => {
      input.onDataChannel(channel);
      input.onStatus("DIRECT");
    });
    channel.addEventListener("close", () => input.onStatus("CLOSED"));
    channel.addEventListener("error", () => input.onStatus("FAILED"));
  };

  connection.addEventListener("datachannel", (event) =>
    attachChannel(event.channel),
  );
  connection.addEventListener("connectionstatechange", () => {
    if (connection.connectionState === "failed") input.onStatus("FAILED");
    if (connection.connectionState === "closed") input.onStatus("CLOSED");
  });
  connection.addEventListener("icecandidate", (event) => {
    void send(
      event.candidate ? "ICE_CANDIDATE" : "ICE_COMPLETE",
      event.candidate ? { candidate: event.candidate.toJSON() } : {},
    ).catch(() => input.onStatus("FAILED"));
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
    if (closed) return;
    try {
      await consumeSignals();
      if (!closed)
        pollTimer = window.setTimeout(() => void poll(), pollingIntervalMs);
    } catch {
      input.onStatus("FAILED");
      if (!closed) pollTimer = window.setTimeout(() => void poll(), 2_000);
    }
  };

  input.onStatus("CONNECTING");
  if (input.role === "INITIATOR") {
    const channel = connection.createDataChannel("flash-n-flip-v1", {
      ordered: true,
    });
    attachChannel(channel);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await sendDescription(connection.localDescription ?? offer);
  }
  void poll();

  return {
    close() {
      if (closed) return;
      closed = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      connection.close();
    },
  };
}
