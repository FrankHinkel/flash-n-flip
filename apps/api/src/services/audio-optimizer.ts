import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectSupportedMedia } from "./media-file.js";

const TARGET_LUFS = -18;
const LOUDNESS_TOLERANCE_LU = 2;
const LOUDNESS_ENCODING_MARGIN_LU = 0.25;
const MAX_TRUE_PEAK_DBTP = -1.5;
const NORMALIZATION_TRUE_PEAK_DBTP = -1.8;
const TARGET_SAMPLE_RATE = 24_000;
const NOISE_REDUCTION_DB = 12;
const NOISE_FLOOR_DB = -50;
const NOISE_SMOOTHING_RADIUS = 5;
const SILENCE_THRESHOLD_DB = -40;
const SILENCE_MIN_SECONDS = 0.3;
const EDGE_SILENCE_GUARD_SECONDS = 0.15;
const INTERNAL_SILENCE_GUARD_SECONDS = 0.1;
const SILENCE_EDGE_EPSILON_SECONDS = 0.05;
const MINIMUM_REMAINING_AUDIO_SECONDS = 0.2;
const MAX_SILENCE_INTERVALS = 512;
const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_DURATION_SECONDS = 30 * 60;
const MAX_PROCESS_OUTPUT_BYTES = 1024 * 1024;
const MAX_FFMPEG_ALLOCATION_BYTES = 64 * 1024 * 1024;
const PROBE_TIMEOUT_MS = 10_000;
const FFMPEG_TIMEOUT_MS = 45_000;

type ProcessFailureReason = "exit" | "spawn" | "timeout" | "output-limit";

export class AudioProcessError extends Error {
  constructor(
    message: string,
    readonly reason: ProcessFailureReason,
  ) {
    super(message);
    this.name = "AudioProcessError";
  }
}

type ProcessLimits = {
  timeoutMs: number;
  maximumOutputBytes: number;
};

type ProcessResult = {
  stdout: Buffer;
  stderr: Buffer;
};

export type AudioProcessRunner = (
  command: string,
  args: readonly string[],
  limits: ProcessLimits,
) => Promise<ProcessResult>;

const runBoundedProcess: AudioProcessRunner = (command, args, limits) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, MALLOC_ARENA_MAX: "2" },
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let failure: AudioProcessError | null = null;
    let settled = false;
    const fail = (error: AudioProcessError) => {
      if (failure || settled) return;
      failure = error;
      child.kill("SIGKILL");
    };
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      const copy = Buffer.from(chunk);
      outputBytes += copy.length;
      if (outputBytes > limits.maximumOutputBytes) {
        fail(
          new AudioProcessError(
            "FFmpeg hat die Ausgabegrenze überschritten.",
            "output-limit",
          ),
        );
        return;
      }
      target.push(copy);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", (cause) => {
      fail(
        new AudioProcessError(
          `FFmpeg konnte nicht gestartet werden: ${cause.message}`,
          "spawn",
        ),
      );
    });
    const timer = setTimeout(
      () =>
        fail(
          new AudioProcessError(
            "FFmpeg hat das Zeitlimit überschritten.",
            "timeout",
          ),
        ),
      limits.timeoutMs,
    );
    timer.unref();
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (failure) {
        reject(failure);
        return;
      }
      if (code !== 0) {
        reject(
          new AudioProcessError(
            `FFmpeg wurde mit Status ${code ?? "unbekannt"} beendet.`,
            "exit",
          ),
        );
        return;
      }
      resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });

type ProbeResult = {
  duration: number;
  codecName: string;
  profile?: string;
  sampleRate: number;
  channels: number;
};

type LoudnessAnalysis = {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
  threshold: number;
  targetOffset: number;
};

type SilenceInterval = {
  start: number;
  end: number;
};

export type ImportedAudio = {
  sourceName: string;
  data: Buffer;
  mimeType: string;
  extension: string;
  kind: "audio";
};

export type AudioOptimizationStats = {
  normalized: number;
  transcoded: number;
  originalFallbacks: number;
  invalidSkipped: number;
  bytesSaved: number;
};

export type AudioOptimizationBatch = {
  media: ImportedAudio[];
  stats: AudioOptimizationStats;
  warnings: string[];
};

type OptimizedAudio = {
  status: "optimized" | "unchanged" | "fallback" | "invalid";
  data: Buffer;
  mimeType: string;
  extension: string;
  normalized: boolean;
  bytesSaved: number;
};

type OptimizerDependencies = {
  runProcess?: AudioProcessRunner;
  ffmpegPath?: string;
  ffprobePath?: string;
};

const processLimits = (timeoutMs: number): ProcessLimits => ({
  timeoutMs,
  maximumOutputBytes: MAX_PROCESS_OUTPUT_BYTES,
});

const finiteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const probeAudio = async (
  path: string,
  dependencies: Required<OptimizerDependencies>,
  expectedOutput = false,
): Promise<ProbeResult> => {
  const result = await dependencies.runProcess(
    dependencies.ffprobePath,
    [
      "-v",
      "error",
      "-max_alloc",
      String(MAX_FFMPEG_ALLOCATION_BYTES),
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,profile,sample_rate,channels,duration:stream_disposition=attached_pic",
      "-of",
      "json",
      path,
    ],
    processLimits(PROBE_TIMEOUT_MS),
  );
  const parsed = JSON.parse(result.stdout.toString("utf8")) as {
    streams?: Array<Record<string, unknown>>;
    format?: Record<string, unknown>;
  };
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const audioStreams = streams.filter(
    (stream) => stream.codec_type === "audio",
  );
  const isAttachedPicture = (stream: Record<string, unknown>): boolean => {
    if (stream.codec_type !== "video") return false;
    const disposition =
      typeof stream.disposition === "object" && stream.disposition !== null
        ? (stream.disposition as Record<string, unknown>)
        : {};
    return finiteNumber(disposition.attached_pic) === 1;
  };
  if (
    audioStreams.length !== 1 ||
    streams.some(
      (stream) => stream.codec_type !== "audio" && !isAttachedPicture(stream),
    )
  ) {
    throw new AudioProcessError(
      "Die Datei enthält keine eindeutige reine Audiospur.",
      "exit",
    );
  }
  const stream = audioStreams[0]!;
  const duration =
    finiteNumber(parsed.format?.duration) ?? finiteNumber(stream.duration);
  const sampleRate = finiteNumber(stream.sample_rate);
  const channels = finiteNumber(stream.channels);
  const codecName =
    typeof stream.codec_name === "string" ? stream.codec_name : "";
  const profile =
    typeof stream.profile === "string" ? stream.profile : undefined;
  if (
    duration === null ||
    duration <= 0 ||
    duration > MAX_DURATION_SECONDS ||
    sampleRate === null ||
    sampleRate <= 0 ||
    channels === null ||
    channels < 1 ||
    channels > 8 ||
    !codecName
  ) {
    throw new AudioProcessError(
      "Die Audiodatei überschreitet die Inhaltsgrenzen oder ist beschädigt.",
      "exit",
    );
  }
  if (
    expectedOutput &&
    (codecName !== "aac" ||
      (profile && profile !== "LC") ||
      sampleRate !== TARGET_SAMPLE_RATE ||
      channels !== 1)
  ) {
    throw new AudioProcessError(
      "Die erzeugte Audiodatei entspricht nicht dem sicheren Zielformat.",
      "exit",
    );
  }
  return { duration, codecName, profile, sampleRate, channels };
};

const loudnessJson = (stderr: Buffer): Record<string, unknown> => {
  const text = stderr.toString("utf8");
  const matches = text.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/g);
  if (!matches?.length) {
    throw new AudioProcessError(
      "FFmpeg hat keine verwertbare Lautheitsanalyse geliefert.",
      "exit",
    );
  }
  return JSON.parse(matches.at(-1)!) as Record<string, unknown>;
};

const DENOISE_FILTER = `afftdn=nr=${NOISE_REDUCTION_DB}:nf=${NOISE_FLOOR_DB}:tn=1:gs=${NOISE_SMOOTHING_RADIUS}`;

const filterTimestamp = (seconds: number): string =>
  Math.max(0, seconds)
    .toFixed(6)
    .replace(/\.?0+$/, "");

const detectSilenceAfterDenoising = async (
  path: string,
  duration: number,
  dependencies: Required<OptimizerDependencies>,
): Promise<SilenceInterval[]> => {
  const result = await dependencies.runProcess(
    dependencies.ffmpegPath,
    [
      "-nostdin",
      "-hide_banner",
      "-v",
      "info",
      "-max_alloc",
      String(MAX_FFMPEG_ALLOCATION_BYTES),
      "-threads",
      "1",
      "-filter_threads",
      "1",
      "-i",
      path,
      "-map",
      "0:a:0",
      "-t",
      String(MAX_DURATION_SECONDS),
      "-af",
      `${DENOISE_FILTER},silencedetect=noise=${SILENCE_THRESHOLD_DB}dB:d=${SILENCE_MIN_SECONDS}`,
      "-f",
      "null",
      "-",
    ],
    processLimits(FFMPEG_TIMEOUT_MS),
  );
  const intervals: SilenceInterval[] = [];
  const events = result.stderr
    .toString("utf8")
    .matchAll(/silence_(start|end):\s*(-?\d+(?:\.\d+)?)/g);
  let start: number | null = null;
  for (const event of events) {
    const value = finiteNumber(event[2]);
    if (value === null) continue;
    if (event[1] === "start") {
      start = Math.min(duration, Math.max(0, value));
      continue;
    }
    if (start === null) continue;
    const end = Math.min(duration, Math.max(0, value));
    if (end > start) {
      if (intervals.length >= MAX_SILENCE_INTERVALS) {
        throw new AudioProcessError(
          "Die Audiodatei enthält zu viele wechselnde Stillebereiche.",
          "exit",
        );
      }
      intervals.push({ start, end });
    }
    start = null;
  }
  return intervals;
};

const audioPreprocessingFilters = (
  intervals: readonly SilenceInterval[],
  duration: number,
): string[] => {
  const filters = [DENOISE_FILTER];
  const leadingIndex = intervals.findIndex(
    (interval) => interval.start <= SILENCE_EDGE_EPSILON_SECONDS,
  );
  let trailingIndex = -1;
  for (let index = intervals.length - 1; index >= 0; index -= 1) {
    if (intervals[index]!.end >= duration - SILENCE_EDGE_EPSILON_SECONDS) {
      trailingIndex = index;
      break;
    }
  }

  for (const [index, interval] of intervals.entries()) {
    if (index === leadingIndex || index === trailingIndex) continue;
    const silenceStart = interval.start + INTERNAL_SILENCE_GUARD_SECONDS;
    const silenceEnd = interval.end - INTERNAL_SILENCE_GUARD_SECONDS;
    if (silenceEnd <= silenceStart) continue;
    filters.push(
      `volume=0:enable='between(t,${filterTimestamp(silenceStart)},${filterTimestamp(silenceEnd)})'`,
    );
  }

  const trimStart =
    leadingIndex >= 0
      ? Math.max(0, intervals[leadingIndex]!.end - EDGE_SILENCE_GUARD_SECONDS)
      : 0;
  const trimEnd =
    trailingIndex >= 0
      ? Math.min(
          duration,
          intervals[trailingIndex]!.start + EDGE_SILENCE_GUARD_SECONDS,
        )
      : duration;
  if (
    (trimStart > 0 || trimEnd < duration) &&
    trimEnd - trimStart >= MINIMUM_REMAINING_AUDIO_SECONDS
  ) {
    const trimOptions = [
      trimStart > 0 ? `start=${filterTimestamp(trimStart)}` : null,
      trimEnd < duration ? `end=${filterTimestamp(trimEnd)}` : null,
    ].filter((option): option is string => option !== null);
    filters.push(`atrim=${trimOptions.join(":")}`, "asetpts=PTS-STARTPTS");
  }
  return filters;
};

const analyzeLoudness = async (
  path: string,
  dependencies: Required<OptimizerDependencies>,
  preprocessingFilters: readonly string[] = [],
): Promise<LoudnessAnalysis> => {
  const result = await dependencies.runProcess(
    dependencies.ffmpegPath,
    [
      "-nostdin",
      "-hide_banner",
      "-v",
      "info",
      "-max_alloc",
      String(MAX_FFMPEG_ALLOCATION_BYTES),
      "-threads",
      "1",
      "-filter_threads",
      "1",
      "-i",
      path,
      "-map",
      "0:a:0",
      "-t",
      String(MAX_DURATION_SECONDS),
      "-af",
      [
        ...preprocessingFilters,
        `loudnorm=I=${TARGET_LUFS}:TP=${MAX_TRUE_PEAK_DBTP}:LRA=11:print_format=json`,
      ].join(","),
      "-f",
      "null",
      "-",
    ],
    processLimits(FFMPEG_TIMEOUT_MS),
  );
  const json = loudnessJson(result.stderr);
  const integratedLufs = finiteNumber(json.input_i);
  const truePeakDbtp = finiteNumber(json.input_tp);
  const loudnessRange = finiteNumber(json.input_lra);
  const threshold = finiteNumber(json.input_thresh);
  const targetOffset = finiteNumber(json.target_offset);
  if (
    integratedLufs === null ||
    truePeakDbtp === null ||
    loudnessRange === null ||
    threshold === null ||
    targetOffset === null
  ) {
    throw new AudioProcessError(
      "Die Lautheit der Audiodatei ist nicht zuverlässig messbar.",
      "exit",
    );
  }
  return {
    integratedLufs,
    truePeakDbtp,
    loudnessRange,
    threshold,
    targetOffset,
  };
};

const loudnormFilter = (analysis: LoudnessAnalysis): string =>
  [
    `loudnorm=I=${TARGET_LUFS}`,
    `TP=${NORMALIZATION_TRUE_PEAK_DBTP}`,
    "LRA=11",
    `measured_I=${analysis.integratedLufs}`,
    `measured_LRA=${analysis.loudnessRange}`,
    `measured_TP=${analysis.truePeakDbtp}`,
    `measured_thresh=${analysis.threshold}`,
    `offset=${analysis.targetOffset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");

const transcodeAudio = async (
  inputPath: string,
  outputPath: string,
  analysis: LoudnessAnalysis,
  normalize: boolean,
  preprocessingFilters: readonly string[],
  dependencies: Required<OptimizerDependencies>,
): Promise<void> => {
  const filters = [
    ...preprocessingFilters,
    normalize ? loudnormFilter(analysis) : `aresample=${TARGET_SAMPLE_RATE}`,
  ];
  await dependencies.runProcess(
    dependencies.ffmpegPath,
    [
      "-nostdin",
      "-hide_banner",
      "-v",
      "error",
      "-max_alloc",
      String(MAX_FFMPEG_ALLOCATION_BYTES),
      "-threads",
      "1",
      "-filter_threads",
      "1",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-t",
      String(MAX_DURATION_SECONDS),
      "-vn",
      "-sn",
      "-dn",
      "-af",
      filters.join(","),
      "-ac",
      "1",
      "-ar",
      String(TARGET_SAMPLE_RATE),
      "-c:a",
      "aac",
      "-profile:a",
      "aac_low",
      "-b:a",
      "40k",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-fflags",
      "+bitexact",
      "-flags:a",
      "+bitexact",
      "-movflags",
      "+faststart",
      "-fs",
      String(MAX_OUTPUT_BYTES),
      "-y",
      outputPath,
    ],
    processLimits(FFMPEG_TIMEOUT_MS),
  );
};

const isInfrastructureFailure = (cause: unknown): boolean =>
  cause instanceof AudioProcessError &&
  (cause.reason === "spawn" ||
    cause.reason === "timeout" ||
    cause.reason === "output-limit");

const safeDependencies = (
  dependencies: OptimizerDependencies,
): Required<OptimizerDependencies> => ({
  runProcess: dependencies.runProcess ?? runBoundedProcess,
  ffmpegPath: dependencies.ffmpegPath ?? "ffmpeg",
  ffprobePath: dependencies.ffprobePath ?? "ffprobe",
});

export const savesAtLeastTenPercent = (
  originalBytes: number,
  optimizedBytes: number,
): boolean =>
  optimizedBytes <= originalBytes &&
  originalBytes - optimizedBytes >= Math.ceil(originalBytes * 0.1);

export const optimizeImportedAudio = async (
  data: Buffer,
  dependencies: OptimizerDependencies = {},
): Promise<OptimizedAudio> => {
  const original = {
    data,
    mimeType: "",
    extension: "",
    normalized: false,
    bytesSaved: 0,
  };
  if (data.length === 0 || data.length > MAX_INPUT_BYTES) {
    return { ...original, status: "invalid" };
  }
  const tools = safeDependencies(dependencies);
  const directory = await mkdtemp(join(tmpdir(), "flashcards-audio-"));
  try {
    const inputPath = join(directory, "input.bin");
    const outputPath = join(directory, "optimized.m4a");
    await writeFile(inputPath, data, { flag: "wx", mode: 0o600 });
    let probe: ProbeResult;
    try {
      probe = await probeAudio(inputPath, tools);
    } catch (cause) {
      return {
        ...original,
        status: isInfrastructureFailure(cause) ? "fallback" : "invalid",
      };
    }

    let preprocessingFilters: string[];
    let analysis: LoudnessAnalysis;
    try {
      const silenceIntervals = await detectSilenceAfterDenoising(
        inputPath,
        probe.duration,
        tools,
      );
      preprocessingFilters = audioPreprocessingFilters(
        silenceIntervals,
        probe.duration,
      );
      analysis = await analyzeLoudness(inputPath, tools, preprocessingFilters);
    } catch {
      return { ...original, status: "fallback" };
    }
    const normalize =
      Math.abs(analysis.integratedLufs - TARGET_LUFS) > LOUDNESS_TOLERANCE_LU ||
      analysis.truePeakDbtp > MAX_TRUE_PEAK_DBTP;
    const applyLoudnessCorrection =
      normalize ||
      Math.abs(analysis.integratedLufs - TARGET_LUFS) >=
        LOUDNESS_TOLERANCE_LU - LOUDNESS_ENCODING_MARGIN_LU;
    try {
      await transcodeAudio(
        inputPath,
        outputPath,
        analysis,
        applyLoudnessCorrection,
        preprocessingFilters,
        tools,
      );
      const details = await stat(outputPath);
      if (
        !details.isFile() ||
        details.size === 0 ||
        details.size > MAX_OUTPUT_BYTES
      ) {
        return { ...original, status: "fallback" };
      }
      const optimized = await readFile(outputPath);
      const detected = detectSupportedMedia(optimized, "optimized.m4a");
      if (
        !detected ||
        detected.kind !== "audio" ||
        detected.mimeType !== "audio/mp4"
      ) {
        return { ...original, status: "fallback" };
      }
      await probeAudio(outputPath, tools, true);
      const outputLoudness = await analyzeLoudness(outputPath, tools);
      if (
        Math.abs(outputLoudness.integratedLufs - TARGET_LUFS) >
          LOUDNESS_TOLERANCE_LU ||
        outputLoudness.truePeakDbtp > MAX_TRUE_PEAK_DBTP
      ) {
        return { ...original, status: "fallback" };
      }
      const bytesSaved = Math.max(0, data.length - optimized.length);
      if (
        !normalize &&
        !savesAtLeastTenPercent(data.length, optimized.length)
      ) {
        return { ...original, status: "unchanged" };
      }
      return {
        status: "optimized",
        data: optimized,
        mimeType: "audio/mp4",
        extension: "m4a",
        normalized: normalize,
        bytesSaved,
      };
    } catch {
      return { ...original, status: "fallback" };
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

export const optimizeImportedAudioMedia = async (
  media: readonly ImportedAudio[],
  dependencies: OptimizerDependencies = {},
): Promise<AudioOptimizationBatch> => {
  const cache = new Map<string, Promise<OptimizedAudio>>();
  const accountedSavings = new Set<string>();
  const optimizedMedia: ImportedAudio[] = [];
  const stats: AudioOptimizationStats = {
    normalized: 0,
    transcoded: 0,
    originalFallbacks: 0,
    invalidSkipped: 0,
    bytesSaved: 0,
  };
  for (const item of media) {
    const inputHash = createHash("sha256").update(item.data).digest("hex");
    let pending = cache.get(inputHash);
    if (!pending) {
      pending = optimizeImportedAudio(item.data, dependencies);
      cache.set(inputHash, pending);
    }
    const result = await pending;
    if (result.status === "invalid") {
      stats.invalidSkipped += 1;
      continue;
    }
    if (result.status === "fallback") stats.originalFallbacks += 1;
    if (result.status === "optimized") {
      stats.transcoded += 1;
      if (result.normalized) stats.normalized += 1;
      if (!accountedSavings.has(inputHash)) {
        accountedSavings.add(inputHash);
        stats.bytesSaved += result.bytesSaved;
      }
    }
    optimizedMedia.push({
      ...item,
      data: result.status === "optimized" ? result.data : item.data,
      mimeType: result.status === "optimized" ? result.mimeType : item.mimeType,
      extension:
        result.status === "optimized" ? result.extension : item.extension,
    });
  }
  const warnings: string[] = [];
  if (stats.originalFallbacks > 0) {
    warnings.push(
      stats.originalFallbacks === 1
        ? "1 gültige Audiodatei konnte nicht optimiert werden und wurde sicher im Original übernommen."
        : `${stats.originalFallbacks} gültige Audiodateien konnten nicht optimiert werden und wurden sicher im Original übernommen.`,
    );
  }
  if (stats.invalidSkipped > 0) {
    warnings.push(
      stats.invalidSkipped === 1
        ? "1 beschädigte oder inkonsistente Audiodatei wurde ausgelassen."
        : `${stats.invalidSkipped} beschädigte oder inkonsistente Audiodateien wurden ausgelassen.`,
    );
  }
  return { media: optimizedMedia, stats, warnings };
};

export const audioOptimizationLimits = {
  targetLufs: TARGET_LUFS,
  loudnessToleranceLu: LOUDNESS_TOLERANCE_LU,
  maximumTruePeakDbtp: MAX_TRUE_PEAK_DBTP,
  sampleRate: TARGET_SAMPLE_RATE,
  maximumInputBytes: MAX_INPUT_BYTES,
  maximumOutputBytes: MAX_OUTPUT_BYTES,
  maximumDurationSeconds: MAX_DURATION_SECONDS,
  noiseReductionDb: NOISE_REDUCTION_DB,
  noiseFloorDb: NOISE_FLOOR_DB,
  silenceThresholdDb: SILENCE_THRESHOLD_DB,
  silenceMinimumSeconds: SILENCE_MIN_SECONDS,
  edgeSilenceGuardSeconds: EDGE_SILENCE_GUARD_SECONDS,
  internalSilenceGuardSeconds: INTERNAL_SILENCE_GUARD_SECONDS,
  maximumSilenceIntervals: MAX_SILENCE_INTERVALS,
} as const;
