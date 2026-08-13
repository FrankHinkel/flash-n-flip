"use client";

import type { AudioQualityMeasurement } from "@flashcards/domain/audio-optimization";
import { speechAudioPipeline } from "@flashcards/domain/audio-optimization";

export type LocalAudioEngineResult = {
  optimized: boolean;
  mimeType: "audio/mp4";
  originalBytes: number;
  optimizedBytes: number;
  bytes: Uint8Array;
  engine: string;
  engineVersion: string;
  inputMeasurement: AudioQualityMeasurement;
  outputMeasurement: AudioQualityMeasurement;
};

type FfmpegLog = { type: string; message: string };

type LoudnormAnalysis = {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
};

type Probe = {
  streams?: Array<{
    sample_rate?: string;
    channels?: number;
    duration?: string;
  }>;
  format?: { duration?: string };
};

const portableBuild =
  process.env.NEXT_PUBLIC_FNF_PORTABLE_AUDIO_WORKER === "1";

const parseLoudnorm = (logs: readonly FfmpegLog[]): LoudnormAnalysis => {
  const joined = logs.map((entry) => entry.message).join("\n");
  const matches = [...joined.matchAll(/\{[\s\S]*?"target_offset"\s*:\s*"[^"]+"[\s\S]*?\}/g)];
  const value = matches.at(-1)?.[0];
  if (!value) throw new Error("Die Lautheitsanalyse lieferte kein Ergebnis.");
  return JSON.parse(value) as LoudnormAnalysis;
};

const finite = (value: string | undefined, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} ist ungültig.`);
  return parsed;
};

const measurement = (
  analysis: LoudnormAnalysis,
  probe: Probe,
): AudioQualityMeasurement => {
  const stream = probe.streams?.[0];
  return {
    durationSeconds: finite(
      stream?.duration ?? probe.format?.duration,
      "Audiodauer",
    ),
    integratedLufs: finite(analysis.input_i, "Lautheit"),
    truePeakDb: finite(analysis.input_tp, "Spitzenpegel"),
    sampleRate: Math.trunc(finite(stream?.sample_rate, "Abtastrate")),
    channels: Math.trunc(stream?.channels ?? 1),
  };
};

export const browserAudioOptimizationAvailable = (): boolean =>
  portableBuild && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";

let ffmpegPromise: Promise<InstanceType<
  typeof import("@ffmpeg/ffmpeg")["FFmpeg"]
>> | null = null;

const loadFfmpeg = async () => {
  ffmpegPromise ??= (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      classWorkerURL: "/ffmpeg/worker.js",
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
    });
    return ffmpeg;
  })();
  return ffmpegPromise;
};

const probe = async (
  ffmpeg: Awaited<ReturnType<typeof loadFfmpeg>>,
  path: string,
  output: string,
): Promise<Probe> => {
  const code = await ffmpeg.ffprobe([
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=sample_rate,channels,duration:format=duration",
    "-of",
    "json",
    path,
    "-o",
    output,
  ]);
  if (code !== 0) throw new Error("Das Audio konnte nicht geprüft werden.");
  const bytes = await ffmpeg.readFile(output);
  return JSON.parse(new TextDecoder().decode(bytes as Uint8Array)) as Probe;
};

const analyze = async (
  ffmpeg: Awaited<ReturnType<typeof loadFfmpeg>>,
  path: string,
): Promise<LoudnormAnalysis> => {
  const logs: FfmpegLog[] = [];
  const listener = (entry: FfmpegLog) => logs.push(entry);
  ffmpeg.on("log", listener);
  try {
    const code = await ffmpeg.exec([
      "-i",
      path,
      "-af",
      `loudnorm=I=${speechAudioPipeline.targetLufs}:TP=${speechAudioPipeline.maximumTruePeakDb}:LRA=7:print_format=json`,
      "-f",
      "null",
      "-",
    ]);
    if (code !== 0) throw new Error("Die Lautheitsanalyse ist fehlgeschlagen.");
    return parseLoudnorm(logs);
  } finally {
    ffmpeg.off("log", listener);
  }
};

export async function optimizeAudioInBrowser(
  original: Blob,
): Promise<LocalAudioEngineResult> {
  if (!browserAudioOptimizationAvailable()) {
    throw new Error("Der lokale Browser-Audioworker ist hier nicht verfügbar.");
  }
  if (original.size > speechAudioPipeline.maximumInputBytes) {
    throw new Error("UNSUPPORTED: Audio ist größer als 16 MiB.");
  }
  const ffmpeg = await loadFfmpeg();
  const token = crypto.randomUUID();
  const inputPath = `input-${token}`;
  const outputPath = `output-${token}.m4a`;
  const inputProbePath = `input-${token}.json`;
  const outputProbePath = `output-${token}.json`;
  const cleanup = [inputPath, outputPath, inputProbePath, outputProbePath];
  try {
    await ffmpeg.writeFile(
      inputPath,
      new Uint8Array(await original.arrayBuffer()),
    );
    const inputProbe = await probe(ffmpeg, inputPath, inputProbePath);
    const duration = finite(
      inputProbe.streams?.[0]?.duration ?? inputProbe.format?.duration,
      "Audiodauer",
    );
    if (duration > speechAudioPipeline.maximumDurationSeconds) {
      throw new Error("UNSUPPORTED: Audio ist länger als 30 Minuten.");
    }
    const inputAnalysis = await analyze(ffmpeg, inputPath);
    const filters = [
      "highpass=f=80",
      "afftdn=nr=12:nf=-45:tn=1",
      "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-45dB:start_silence=0.15:stop_periods=1:stop_duration=0.1:stop_threshold=-45dB:stop_silence=0.15",
      `loudnorm=I=${speechAudioPipeline.targetLufs}:TP=${speechAudioPipeline.maximumTruePeakDb}:LRA=7:measured_I=${inputAnalysis.input_i}:measured_TP=${inputAnalysis.input_tp}:measured_LRA=${inputAnalysis.input_lra}:measured_thresh=${inputAnalysis.input_thresh}:offset=${inputAnalysis.target_offset}:linear=true`,
      `aresample=${speechAudioPipeline.sampleRate}`,
    ].join(",");
    const code = await ffmpeg.exec([
      "-i",
      inputPath,
      "-vn",
      "-af",
      filters,
      "-ac",
      String(speechAudioPipeline.channels),
      "-ar",
      String(speechAudioPipeline.sampleRate),
      "-c:a",
      "aac",
      "-b:a",
      String(speechAudioPipeline.targetBitRate),
      outputPath,
    ]);
    if (code !== 0) throw new Error("Die lokale Audiokodierung ist fehlgeschlagen.");
    const outputProbe = await probe(ffmpeg, outputPath, outputProbePath);
    const outputAnalysis = await analyze(ffmpeg, outputPath);
    const bytes = (await ffmpeg.readFile(outputPath)) as Uint8Array;
    const inputMeasurement = measurement(inputAnalysis, inputProbe);
    const outputMeasurement = measurement(outputAnalysis, outputProbe);
    const verified =
      bytes.byteLength > 0 &&
      bytes.byteLength < original.size &&
      Math.abs(outputMeasurement.integratedLufs - speechAudioPipeline.targetLufs) <=
        speechAudioPipeline.lufsTolerance &&
      outputMeasurement.truePeakDb <= speechAudioPipeline.maximumTruePeakDb;
    return {
      optimized: verified,
      mimeType: "audio/mp4",
      originalBytes: original.size,
      optimizedBytes: verified ? bytes.byteLength : original.size,
      bytes: verified ? bytes.slice() : new Uint8Array(),
      engine: "ffmpeg.wasm",
      engineVersion: "0.12.10-v4",
      inputMeasurement,
      outputMeasurement,
    };
  } finally {
    await Promise.all(
      cleanup.map((path) => ffmpeg.deleteFile(path).catch(() => undefined)),
    );
  }
}
