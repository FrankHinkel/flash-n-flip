"use client";

import { Check, Copy, Share2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AccountShareSession,
  AccountShareQrPayload,
} from "@flashcards/domain";
import { createId, formatByteSize } from "@flashcards/domain";
import type {
  DeckSummary,
  PairingSessionDetails,
} from "@flashcards/api-client";

import { api } from "../lib/api";
import { encodeAccountShareLink, sha256Hex } from "../lib/account-share-link";
import {
  createEphemeralPairingKey,
  createPairingSecret,
  deviceCapabilities,
  getOrCreateLocalDeviceIdentity,
  pairingProof,
} from "../lib/device-identity";
import {
  establishPairingPeerConnection,
  type PairingPeerConnection,
} from "../lib/peer-connection";
import {
  PeerDeckTransferManager,
  type DeckTransferProgress,
  type IncomingDeckTransfer,
} from "../lib/peer-deck-transfer";
import { QrCode } from "./qr-code";
import { useI18n } from "./i18n-provider";

type Props =
  | { sourceDeck: DeckSummary; invitation?: never; onClose(): void }
  | {
      sourceDeck?: never;
      invitation: AccountShareQrPayload;
      onClose(): void;
    };

const asPairingSession = (
  session: AccountShareSession,
): PairingSessionDetails => ({
  id: session.id,
  initiatorDeviceId: session.senderDeviceId,
  joiningDeviceId: session.recipientDeviceId,
  state: session.state === "CONFIRMED" ? "CONFIRMED" : "CREATED",
  mode: "MANUAL",
  initiatorEphemeralPublicKey: session.senderEphemeralPublicKey,
  initiatorFingerprintProof: session.senderFingerprintProof,
  joiningEphemeralPublicKey: session.recipientEphemeralPublicKey,
  joiningFingerprintProof: session.recipientFingerprintProof,
  initiatorConfirmed: session.state === "CONFIRMED",
  joiningConfirmed: session.state === "CONFIRMED",
  expiresAt: session.expiresAt,
  createdAt: session.createdAt,
  consumedAt: session.consumedAt,
});

export function AccountShareDialog(props: Props) {
  const { text } = useI18n();
  const sender = Boolean(props.sourceDeck);
  const [session, setSession] = useState<AccountShareSession | null>(null);
  const [secret, setSecret] = useState(props.invitation?.secret ?? "");
  const [shareLink, setShareLink] = useState("");
  const [incoming, setIncoming] = useState<IncomingDeckTransfer | null>(null);
  const [progress, setProgress] = useState<DeckTransferProgress | null>(null);
  const [status, setStatus] = useState(text("legacy.2b4ec4594e67"));
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reconnectTick, setReconnectTick] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const identityIdRef = useRef("");
  const connectionRef = useRef<PairingPeerConnection | null>(null);
  const connectedRef = useRef(false);
  const directRef = useRef(false);
  const completedRef = useRef(false);
  const autoAcceptedTransferRef = useRef("");
  const onCloseRef = useRef(props.onClose);
  const sessionRef = useRef<AccountShareSession | null>(null);
  onCloseRef.current = props.onClose;
  const manager = useMemo(
    () =>
      new PeerDeckTransferManager(
        {
          onIncoming: setIncoming,
          onProgress(next) {
            setProgress(next);
            if (next?.state === "COMPLETED" && !completedRef.current) {
              completedRef.current = true;
              window.dispatchEvent(new Event("flash-n-flip:decks-changed"));
              if (!sender && sessionRef.current) {
                void api
                  .completeAccountShare(
                    sessionRef.current.id,
                    identityIdRef.current,
                  )
                  .catch(() => undefined);
              }
              window.setTimeout(() => onCloseRef.current(), 0);
            }
          },
          onError: setError,
        },
        false,
      ),
    [sender],
  );

  const connect = async (
    activeSession: AccountShareSession,
    activeSecret: string,
    localDeviceId: string,
  ) => {
    if (connectedRef.current || !activeSession.recipientDeviceId) return;
    connectedRef.current = true;
    setError("");
    const remoteDeviceId =
      localDeviceId === activeSession.senderDeviceId
        ? activeSession.recipientDeviceId
        : activeSession.senderDeviceId;
    const signalClient = {
      sendPairingSignal: (
        sessionId: string,
        input: Parameters<typeof api.sendAccountShareSignal>[1],
      ) => api.sendAccountShareSignal(sessionId, input),
      listPairingSignals: (
        sessionId: string,
        deviceId: string,
        afterSequence: number,
      ) => api.listAccountShareSignals(sessionId, deviceId, afterSequence),
    };
    let connection: PairingPeerConnection = { close() {} };
    try {
      connection = await establishPairingPeerConnection({
        session: asPairingSession(activeSession),
        localDeviceId,
        secret: activeSecret,
        role: sender ? "INITIATOR" : "JOINER",
        signalClient,
        onStatus(next) {
          if (next === "CONNECTING") setStatus(text("legacy.694c3d53b291"));
          if (next === "DIRECT") {
            directRef.current = true;
            setStatus(text("legacy.f235c75b2f28"));
          }
          if (next === "FAILED" || next === "CLOSED") {
            directRef.current = false;
            connectedRef.current = false;
            manager.detach();
            connectionRef.current = null;
            if (!completedRef.current) {
              setStatus(text("legacy.316cc2e98a8e"));
              setReconnectTick((value) => value + 1);
            }
          }
        },
        onDataChannel(channel) {
          manager.attach(channel, localDeviceId, remoteDeviceId);
          if (sender && props.sourceDeck) {
            void manager
              .sendDeck(props.sourceDeck.id)
              .catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : text("legacy.51640653390d"),
                ),
              );
          }
        },
      });
      connectionRef.current = connection;
    } catch (cause) {
      connectedRef.current = false;
      directRef.current = false;
      throw cause;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const run = async () => {
      try {
        const identity = await getOrCreateLocalDeviceIdentity();
        identityIdRef.current = identity.id;
        await api.registerDevice({
          id: identity.id,
          displayName: identity.displayName,
          platform: identity.platform,
          publicKey: identity.publicKey,
          capabilities: deviceCapabilities(identity.platform),
        });
        if (sender) {
          const [ephemeral, newSecret] = await Promise.all([
            createEphemeralPairingKey(),
            Promise.resolve(createPairingSecret()),
          ]);
          const sessionId = createId();
          const created = await api.createAccountShare({
            id: sessionId,
            senderDeviceId: identity.id,
            secretHash: await sha256Hex(newSecret),
            senderEphemeralPublicKey: ephemeral.publicKey,
            senderFingerprintProof: await pairingProof(
              newSecret,
              `${identity.id}:${ephemeral.publicKey}`,
            ),
          });
          if (cancelled) return;
          setSecret(newSecret);
          setSession(created);
          sessionRef.current = created;
          setShareLink(
            encodeAccountShareLink({
              version: 1,
              serverOrigin: window.location.origin,
              sessionId,
              secret: newSecret,
              senderDeviceId: identity.id,
              senderEphemeralPublicKey: ephemeral.publicKey,
            }),
          );
          setStatus(text("legacy.75a9fc6e973f"));
        } else if (props.invitation) {
          if (
            new URL(props.invitation.serverOrigin).origin !==
            window.location.origin
          ) {
            throw new Error(text("legacy.aadae1ee6ac5"));
          }
          const expectedSenderProof = await pairingProof(
            props.invitation.secret,
            `${props.invitation.senderDeviceId}:${props.invitation.senderEphemeralPublicKey}`,
          );
          const ephemeral = await createEphemeralPairingKey();
          const joined = await api.joinAccountShare(
            props.invitation.sessionId,
            {
              recipientDeviceId: identity.id,
              secret: props.invitation.secret,
              recipientEphemeralPublicKey: ephemeral.publicKey,
              recipientFingerprintProof: await pairingProof(
                props.invitation.secret,
                `${identity.id}:${ephemeral.publicKey}`,
              ),
            },
          );
          if (
            joined.senderDeviceId !== props.invitation.senderDeviceId ||
            joined.senderEphemeralPublicKey !==
              props.invitation.senderEphemeralPublicKey ||
            joined.senderFingerprintProof !== expectedSenderProof
          )
            throw new Error(text("legacy.14bbcc3eb2cd"));
          if (cancelled) return;
          setSession(joined);
          sessionRef.current = joined;
          setStatus(text("legacy.694c3d53b291"));
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : text("legacy.d8b83187dfb7"),
          );
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!session || completedRef.current) return;
    let cancelled = false;
    let retryDelayMs = 1_500;
    const poll = async () => {
      if (cancelled || directRef.current || completedRef.current) return;
      try {
        const next = await api.getAccountShare(
          session.id,
          identityIdRef.current,
        );
        if (cancelled) return;
        setSession(next);
        sessionRef.current = next;
        if (sender && next.state === "CLAIMED") {
          if (
            !next.recipientDeviceId ||
            !next.recipientEphemeralPublicKey ||
            !next.recipientFingerprintProof
          ) {
            throw new Error("Recipient identity is incomplete");
          }
          const expected = await pairingProof(
            secret,
            `${next.recipientDeviceId}:${next.recipientEphemeralPublicKey}`,
          );
          if (expected !== next.recipientFingerprintProof) {
            throw new Error(text("legacy.546085728dd6"));
          }
          const confirmed = await api.confirmAccountShare(
            next.id,
            identityIdRef.current,
          );
          setSession(confirmed);
          sessionRef.current = confirmed;
          await connect(confirmed, secret, identityIdRef.current);
        } else if (next.state === "CONFIRMED") {
          await connect(next, secret, identityIdRef.current);
        }
        if (next.state === "CANCELLED" || next.state === "COMPLETED") return;
        retryDelayMs = 1_500;
      } catch (cause) {
        const status =
          cause && typeof cause === "object" && "status" in cause
            ? Number(cause.status)
            : 0;
        if (status === 429 || status === 0 || status >= 500) {
          retryDelayMs = Math.min(retryDelayMs * 2, 8_000);
        } else if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : text("legacy.f622f2afa6e9"),
          );
          return;
        }
      }
      if (!cancelled && !directRef.current)
        window.setTimeout(() => void poll(), retryDelayMs);
    };
    const timer = window.setTimeout(() => void poll(), retryDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session?.id, sender, secret, reconnectTick]);

  useEffect(() => {
    if (
      sender ||
      !incoming ||
      autoAcceptedTransferRef.current === incoming.transferId
    ) {
      return;
    }
    autoAcceptedTransferRef.current = incoming.transferId;
    setStatus(text("legacy.69835d1cc020"));
    void manager.acceptIncoming().catch((cause) => {
      autoAcceptedTransferRef.current = "";
      setError(
        cause instanceof Error ? cause.message : text("legacy.51640653390d"),
      );
    });
  }, [incoming, manager, sender, text]);

  useEffect(() => {
    closeRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
      if (event.key !== "Tab") return;
      const buttons = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href]",
        ) ?? []),
      ];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      manager.detach();
      connectionRef.current?.close();
      const active = sessionRef.current;
      if (active && !completedRef.current && identityIdRef.current) {
        void api
          .cancelAccountShare(active.id, identityIdRef.current)
          .catch(() => undefined);
      }
    };
  }, []);

  const percent = progress?.totalBytes
    ? Math.min(
        100,
        Math.round((progress.verifiedBytes / progress.totalBytes) * 100),
      )
    : 0;

  return (
    <div
      className="account-share-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && props.onClose()
      }
    >
      <section
        ref={dialogRef}
        className="account-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-share-title"
      >
        <header>
          <Share2 aria-hidden="true" />
          <h2 id="account-share-title">
            {sender
              ? text("legacy.36c079aee92a", [props.sourceDeck?.title ?? ""])
              : text("legacy.7f5602274d2b")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label={text("legacy.8901917b6cd6")}
            onClick={props.onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        {shareLink && session?.state === "CREATED" ? (
          <>
            <QrCode
              value={shareLink}
              label={text("legacy.744ce3b50a37")}
              size={240}
            />
            <button
              type="button"
              className="button button-quiet"
              onClick={() =>
                void navigator.clipboard
                  .writeText(shareLink)
                  .then(() => setCopied(true))
              }
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copied
                ? text("legacy.2061a1b24de8")
                : text("legacy.e693f96a4995")}
            </button>
          </>
        ) : null}
        {progress ? (
          <div className="account-share-progress">
            <strong>
              {progress.state === "COMPLETED"
                ? text("legacy.fdebb2e97673")
                : status}
            </strong>
            <progress max={100} value={percent}>
              {percent} %
            </progress>
            <span>
              {percent} % · {formatByteSize(progress.verifiedBytes)} /{" "}
              {formatByteSize(progress.totalBytes)}
            </span>
          </div>
        ) : !error ? (
          <p className="account-share-status" role="status">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
