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

type AbcAudioEvent = {
  cmd: string;
  start?: number;
  duration?: number;
  gap?: number;
  [key: string]: unknown;
};

type AbcAudioSequence = {
  tempo?: number;
  instrument?: number;
  tracks: AbcAudioEvent[][];
  totalDuration: number;
};

type AbcAudioTune = TuneObject & {
  setUpAudio(options: Record<string, unknown>): AbcAudioSequence;
  millisecondsPerMeasure(tempo?: number): number;
  getMeterFraction(): { num: number; den: number };
};

type MusicPlaybackSegment = {
  startSeconds: number;
  durationSeconds: number;
  sequence: AbcAudioSequence;
};

type AbcJsApi = {
  synth: { CreateSynth: new () => unknown };
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
const applePlaybackSegmentSeconds = 20;

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

export const segmentMusicSequence = (
  visual: AbcAudioTune,
  segmentSeconds = applePlaybackSegmentSeconds,
): { durationSeconds: number; segments: MusicPlaybackSegment[] } => {
  const flattened = visual.setUpAudio({ chordsOff: true, program: 0 });
  const meter = visual.getMeterFraction();
  const meterSize = meter.den ? meter.num / meter.den : 1;
  const secondsPerUnit =
    visual.millisecondsPerMeasure(flattened.tempo) / 1_000 / meterSize;
  const durationSeconds = flattened.totalDuration * secondsPerUnit;
  if (!isMusicPlaybackDurationSupported(durationSeconds)) {
    throw new Error("Music playback is limited to 15 minutes");
  }
  const segments: MusicPlaybackSegment[] = [];
  for (
    let segmentStart = 0;
    segmentStart < durationSeconds;
    segmentStart += segmentSeconds
  ) {
    const duration = Math.min(segmentSeconds, durationSeconds - segmentStart);
    const segmentEnd = segmentStart + duration;
    const tracks = flattened.tracks.map((track) =>
      track.flatMap((event): AbcAudioEvent[] => {
        if (event.cmd !== "note") return [{ ...event }];
        const noteStart = (event.start ?? 0) * secondsPerUnit;
        const noteEnd = noteStart + (event.duration ?? 0) * secondsPerUnit;
        if (noteEnd <= segmentStart || noteStart >= segmentEnd) return [];
        const clippedStart = Math.max(segmentStart, noteStart);
        const clippedEnd = Math.min(segmentEnd, noteEnd);
        return [
          {
            ...event,
            start: clippedStart - segmentStart,
            duration: clippedEnd - clippedStart,
            gap: 0,
          },
        ];
      }),
    );
    segments.push({
      startSeconds: segmentStart,
      durationSeconds: duration,
      sequence: {
        tempo: flattened.tempo,
        instrument: flattened.instrument,
        tracks,
        totalDuration: duration,
      },
    });
  }
  return { durationSeconds, segments };
};

const createSegmentedAppleSession = async (
  abcjs: AbcJsApi,
  visual: TuneObject,
  context: AudioContext,
  soundFontUrl: URL,
  onEnded: () => void,
): Promise<MusicPlaybackSession> => {
  const { durationSeconds, segments } = segmentMusicSequence(
    visual as AbcAudioTune,
  );
  let destroyed = false;
  let playing = false;
  let desiredPosition = 0;
  let generation = 0;
  let currentIndex = -1;
  let currentSynth: AbcSynth | null = null;
  const prepared = new Map<number, Promise<AbcSynth>>();

  const prepare = (index: number): Promise<AbcSynth> => {
    const cached = prepared.get(index);
    if (cached) return cached;
    const segment = segments[index];
    if (!segment) return Promise.reject(new Error("Invalid music segment"));
    const promise = (async () => {
      const synth = new abcjs.synth.CreateSynth() as AbcSynth;
      await synth.init({
        audioContext: context,
        sequence: segment.sequence,
        millisecondsPerMeasure: 1_000,
        onEnded: () => {
          if (destroyed || !playing || currentIndex !== index) return;
          const nextIndex = index + 1;
          if (nextIndex >= segments.length) {
            playing = false;
            desiredPosition = 0;
            onEnded();
            return;
          }
          desiredPosition = segments[nextIndex]!.startSeconds;
          const token = ++generation;
          void startAt(desiredPosition, token);
        },
        options: {
          soundFontUrl: soundFontUrl.href,
          program: 0,
          chordsOff: true,
          fadeLength: 0,
          soundFontVolumeMultiplier: 0.65,
        },
      });
      await synth.prime();
      return synth;
    })();
    prepared.set(index, promise);
    return promise;
  };

  const releaseDistantSegments = async (keepIndex: number) => {
    for (const [index, promise] of prepared) {
      if (index === keepIndex || index === keepIndex + 1) continue;
      prepared.delete(index);
      void promise.then((synth) => synth.stop()).catch(() => undefined);
    }
  };

  async function startAt(seconds: number, token: number): Promise<void> {
    const index = Math.min(
      segments.length - 1,
      Math.max(0, Math.floor(seconds / applePlaybackSegmentSeconds)),
    );
    const segment = segments[index]!;
    const synth = await prepare(index);
    if (destroyed || !playing || token !== generation) {
      synth.stop();
      return;
    }
    const previousSynth = currentSynth;
    currentSynth = null;
    currentIndex = -1;
    previousSynth?.stop();
    currentSynth = synth;
    currentIndex = index;
    desiredPosition = seconds;
    synth.seek(Math.max(0, seconds - segment.startSeconds), "seconds");
    if (context.state === "suspended") await context.resume();
    if (destroyed || !playing || token !== generation) return;
    synth.start();
    if (index + 1 < segments.length) void prepare(index + 1);
    void releaseDistantSegments(index);
  }

  // Fail while the caller can still show a useful playback error instead of
  // waiting until after the UI has switched to the playing state.
  await prepare(0);

  const session: MusicPlaybackSession = {
    durationSeconds,
    start() {
      if (destroyed) return;
      playing = true;
      const token = ++generation;
      void startAt(desiredPosition, token);
    },
    pause() {
      if (destroyed) return;
      playing = false;
      generation++;
      if (currentSynth) {
        const segment = segments[currentIndex];
        desiredPosition =
          (segment?.startSeconds ?? 0) + Math.max(0, currentSynth.pause());
      }
    },
    resume() {
      if (destroyed) return;
      playing = true;
      const token = ++generation;
      void startAt(desiredPosition, token);
    },
    seek(seconds) {
      if (destroyed) return;
      desiredPosition = Math.min(durationSeconds, Math.max(0, seconds));
      if (!playing) return;
      const token = ++generation;
      void startAt(desiredPosition, token);
    },
    stop() {
      playing = false;
      generation++;
      currentSynth?.stop();
    },
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      playing = false;
      generation++;
      currentSynth?.stop();
      for (const promise of prepared.values()) {
        void promise.then((synth) => synth.stop()).catch(() => undefined);
      }
      prepared.clear();
      if (activeSession === session) activeSession = null;
      if (context.state !== "closed")
        await context.close().catch(() => undefined);
    },
  };
  activeSession = session;
  return session;
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
  if (preferredSampleRate) {
    return createSegmentedAppleSession(
      abcjs,
      visual,
      context,
      soundFontUrl,
      onEnded,
    );
  }
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
      void (async () => {
        if (context.state === "suspended") await context.resume();
        if (!destroyed) synth.start();
      })();
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
