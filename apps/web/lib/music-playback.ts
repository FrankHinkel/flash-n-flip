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

type AudioContextConstructor = new () => AudioContext;

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

const audioContextConstructor = (): AudioContextConstructor | undefined =>
  window.AudioContext ??
  (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
    .webkitAudioContext;

export async function createMusicPlaybackSession(
  visual: TuneObject,
  onEnded: () => void,
): Promise<MusicPlaybackSession> {
  await activeSession?.destroy();
  window.dispatchEvent(
    new CustomEvent(exclusiveAudioRequestEvent, { detail: "music" }),
  );

  const Context = audioContextConstructor();
  if (!Context) throw new Error("Web Audio is unavailable");
  const context = new Context();
  const soundFontUrl = new URL(localPianoSoundfontPath, window.location.href);
  if (soundFontUrl.origin !== window.location.origin) {
    await context.close();
    throw new Error("The piano soundfont must be same-origin");
  }

  const { default: abcjs } = await import("abcjs");
  const synth = new abcjs.synth.CreateSynth() as AbcSynth;
  await synth.init({
    audioContext: context,
    visualObj: visual,
    onEnded,
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

  let destroyed = false;
  const session: MusicPlaybackSession = {
    durationSeconds: prepared.duration,
    start() {
      if (destroyed) return;
      window.dispatchEvent(
        new CustomEvent(exclusiveAudioRequestEvent, { detail: "music" }),
      );
      synth.start();
    },
    pause() {
      if (!destroyed) synth.pause();
    },
    resume() {
      if (!destroyed) {
        window.dispatchEvent(
          new CustomEvent(exclusiveAudioRequestEvent, { detail: "music" }),
        );
        synth.resume();
      }
    },
    seek(seconds) {
      if (destroyed) return;
      synth.seek(Math.min(prepared.duration, Math.max(0, seconds)), "seconds");
    },
    stop() {
      if (!destroyed) synth.stop();
    },
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      synth.stop();
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
