import type { TuneObject } from "abcjs";

export const exclusiveAudioRequestEvent =
  "flash-n-flip:exclusive-audio-request";
export const localPianoSoundfontPath = "/soundfonts/fnf-upright-piano/";
export const maximumMusicPlaybackSeconds = 15 * 60;

export const isMusicPlaybackDurationSupported = (seconds: number): boolean =>
  Number.isFinite(seconds) &&
  seconds > 0 &&
  seconds <= maximumMusicPlaybackSeconds;

type AbcSynth = {
  init(options: Record<string, unknown>): Promise<unknown>;
  prime(): Promise<{ duration: number; status: string }>;
  start(): void;
  pause(): number;
  resume(): void;
  seek(position: number, units?: "percent" | "seconds" | "beats"): void;
  stop(): number;
};

type AudioContextConstructor = new (
  contextOptions?: AudioContextOptions,
) => AudioContext;

export type MusicPlaybackSession = {
  durationSeconds: number;
  start(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  stop(): void;
  destroy(): Promise<void>;
};

let activeSession: MusicPlaybackSession | null = null;

export const musicAudioSampleRateForDevice = (
  userAgent: string,
  maxTouchPoints: number,
): number | undefined =>
  /iPad|iPhone|iPod/u.test(userAgent) ||
  (/Macintosh/u.test(userAgent) && maxTouchPoints > 1)
    ? 24_000
    : undefined;

const audioContextConstructor = (): AudioContextConstructor | undefined =>
  window.AudioContext ??
  (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
    .webkitAudioContext;

const unlockAudioContext = async (context: AudioContext): Promise<void> => {
  if (context.state === "suspended") await context.resume();
  // Mobile Safari only unlocks audio reliably when actual audio work is
  // started during the original touch event. A one-frame silent source keeps
  // that gesture valid while abcjs and the local samples load asynchronously.
  const buffer = context.createBuffer(1, 1, context.sampleRate);
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = 0;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(0);
};

export async function createMusicPlaybackSession(
  visual: TuneObject,
  onEnded: () => void,
): Promise<MusicPlaybackSession> {
  if (activeSession) await activeSession.destroy();
  window.dispatchEvent(
    new CustomEvent(exclusiveAudioRequestEvent, { detail: "music" }),
  );

  const Context = audioContextConstructor();
  if (!Context) throw new Error("Web Audio is unavailable");
  const preferredSampleRate = musicAudioSampleRateForDevice(
    navigator.userAgent,
    navigator.maxTouchPoints,
  );
  let context: AudioContext;
  try {
    context = preferredSampleRate
      ? new Context({ sampleRate: preferredSampleRate })
      : new Context();
  } catch {
    context = new Context();
  }
  // Safari requires the AudioContext to be unlocked by the original tap.
  // Doing this after soundfont loading can lose the transient user gesture.
  await unlockAudioContext(context);
  const soundFontUrl = new URL(localPianoSoundfontPath, window.location.href);
  if (soundFontUrl.origin !== window.location.origin) {
    await context.close();
    throw new Error("The piano soundfont must be same-origin");
  }

  const { default: abcjs } = await import("abcjs");
  const synth = new abcjs.synth.CreateSynth() as AbcSynth;
  let destroyed = false;
  let running = false;
  let ignoredEndedCallbacks = 0;
  await synth.init({
    audioContext: context,
    visualObj: visual,
    onEnded: () => {
      if (ignoredEndedCallbacks > 0) {
        ignoredEndedCallbacks -= 1;
        return;
      }
      if (!destroyed) {
        running = false;
        onEnded();
      }
    },
    options: {
      soundFontUrl: soundFontUrl.href,
      program: 0,
      chordsOff: true,
      soundFontVolumeMultiplier: 0.65,
    },
  });
  const prepared = await synth.prime();
  if (!isMusicPlaybackDurationSupported(prepared.duration)) {
    synth.stop();
    await context.close();
    throw new Error("Music playback is limited to 15 minutes");
  }

  const session: MusicPlaybackSession = {
    durationSeconds: prepared.duration,
    start() {
      if (destroyed) return;
      window.dispatchEvent(
        new CustomEvent(exclusiveAudioRequestEvent, { detail: "music" }),
      );
      void (async () => {
        if (context.state === "suspended") await context.resume();
        if (!destroyed) {
          running = true;
          synth.start();
        }
      })();
    },
    pause() {
      if (!destroyed && running) {
        ignoredEndedCallbacks += 1;
        running = false;
        synth.pause();
      }
    },
    resume() {
      if (!destroyed) {
        window.dispatchEvent(
          new CustomEvent(exclusiveAudioRequestEvent, { detail: "music" }),
        );
        running = true;
        synth.resume();
      }
    },
    seek(seconds) {
      if (destroyed) return;
      if (running) ignoredEndedCallbacks += 1;
      synth.seek(Math.min(prepared.duration, Math.max(0, seconds)), "seconds");
    },
    stop() {
      if (!destroyed && running) {
        ignoredEndedCallbacks += 1;
        running = false;
        synth.stop();
      }
    },
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      if (running) {
        ignoredEndedCallbacks += 1;
        running = false;
        synth.stop();
      }
      if (activeSession === session) activeSession = null;
      if (context.state !== "closed")
        await context.close().catch(() => undefined);
    },
  };
  activeSession = session;
  return session;
}

export async function stopActiveMusicPlayback(): Promise<void> {
  await activeSession?.destroy();
}
