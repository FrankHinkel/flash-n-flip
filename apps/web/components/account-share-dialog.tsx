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
  const [status, setStatus] = useState(
    text("Preparing …", "Wird vorbereitet …"),
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const identityIdRef = useRef("");
  const connectionRef = useRef<PairingPeerConnection | null>(null);
  const connectedRef = useRef(false);
  const directRef = useRef(false);
  const completedRef = useRef(false);
  const sessionRef = useRef<AccountShareSession | null>(null);
  const manager = useMemo(
    () =>
      new PeerDeckTransferManager(
        {
          onIncoming: setIncoming,
          onProgress(next) {
            setProgress(next);
            if (next?.state === "COMPLETED") {
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
    connection = await establishPairingPeerConnection({
      session: asPairingSession(activeSession),
      localDeviceId,
      secret: activeSecret,
      role: sender ? "INITIATOR" : "JOINER",
      signalClient,
      onStatus(next) {
        if (next === "CONNECTING")
          setStatus(text("Connecting directly …", "Direkte Verbindung …"));
        if (next === "DIRECT") {
          directRef.current = true;
          setStatus(text("Direct connection", "Direkt verbunden"));
        }
        if (next === "FAILED")
          setError(
            text(
              "Direct connection failed. Make sure both devices are on the same network.",
              "Direkte Verbindung fehlgeschlagen. Beide Geräte müssen im selben Netzwerk sein.",
            ),
          );
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
                  : text("Transfer failed.", "Übertragung fehlgeschlagen."),
              ),
            );
        }
      },
    });
    connectionRef.current = connection;
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
          setStatus(text("Waiting for recipient", "Warte auf Empfänger"));
        } else if (props.invitation) {
          if (
            new URL(props.invitation.serverOrigin).origin !==
            window.location.origin
          ) {
            throw new Error(
              text(
                "This invitation belongs to another server.",
                "Diese Einladung gehört zu einem anderen Server.",
              ),
            );
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
            throw new Error(
              text(
                "Sender verification failed.",
                "Absenderprüfung fehlgeschlagen.",
              ),
            );
          if (cancelled) return;
          setSession(joined);
          sessionRef.current = joined;
          setStatus(
            text("Waiting for sender confirmation", "Warte auf Bestätigung"),
          );
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : text(
                  "Sharing could not be started.",
                  "Teilen konnte nicht gestartet werden.",
                ),
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
        if (!sender && next.state === "CONFIRMED") {
          await connect(next, secret, identityIdRef.current);
          return;
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
              : text(
                  "Share session expired.",
                  "Teilen-Sitzung ist abgelaufen.",
                ),
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
  }, [session?.id, sender, secret]);

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

  const confirmRecipient = async () => {
    if (
      !session?.recipientDeviceId ||
      !session.recipientEphemeralPublicKey ||
      !session.recipientFingerprintProof
    )
      return;
    setConfirming(true);
    setError("");
    try {
      const expected = await pairingProof(
        secret,
        `${session.recipientDeviceId}:${session.recipientEphemeralPublicKey}`,
      );
      if (expected !== session.recipientFingerprintProof)
        throw new Error(
          text(
            "Recipient verification failed.",
            "Empfängerprüfung fehlgeschlagen.",
          ),
        );
      const confirmed = await api.confirmAccountShare(
        session.id,
        identityIdRef.current,
      );
      setSession(confirmed);
      sessionRef.current = confirmed;
      await connect(confirmed, secret, identityIdRef.current);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text("Confirmation failed.", "Bestätigung fehlgeschlagen."),
      );
    } finally {
      setConfirming(false);
    }
  };

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
              ? text(
                  `Share “${props.sourceDeck?.title}”`,
                  `„${props.sourceDeck?.title}“ teilen`,
                )
              : text("Receive deck", "Lernset empfangen")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label={text("Close", "Schließen")}
            onClick={props.onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        {shareLink && session?.state === "CREATED" ? (
          <>
            <QrCode
              value={shareLink}
              label={text(
                "Deck share QR code",
                "QR-Code zum Teilen des Lernsets",
              )}
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
                ? text("Copied", "Kopiert")
                : text("Copy link", "Link kopieren")}
            </button>
          </>
        ) : null}
        {sender && session?.state === "CLAIMED" ? (
          <div className="account-share-confirm">
            <p>{text("Recipient", "Empfänger")}</p>
            <strong>
              {session.recipientDisplayName} ({session.recipientDeviceName})
            </strong>
            <button
              type="button"
              className="button button-primary"
              disabled={confirming}
              onClick={() => void confirmRecipient()}
            >
              {text("Confirm and send", "Bestätigen und senden")}
            </button>
          </div>
        ) : null}
        {incoming ? (
          <div className="account-share-confirm">
            <strong>{incoming.deckTitle}</strong>
            <p>
              {incoming.newDeckCount} {text("new", "neu")} ·{" "}
              {incoming.updatedDeckCount} {text("updates", "Updates")} ·{" "}
              {incoming.ignoredDeckCount} {text("ignored", "ignoriert")} ·{" "}
              {formatByteSize(incoming.totalBytes)}
            </p>
            <div className="account-share-actions">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => manager.rejectIncoming()}
              >
                {text("Decline", "Ablehnen")}
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => void manager.acceptIncoming()}
              >
                {text("Receive", "Empfangen")}
              </button>
            </div>
          </div>
        ) : null}
        {progress ? (
          <div className="account-share-progress">
            <strong>
              {progress.state === "COMPLETED"
                ? text("Transfer complete", "Übertragung abgeschlossen")
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
