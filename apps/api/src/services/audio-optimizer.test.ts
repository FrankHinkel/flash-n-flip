import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  AudioProcessError,
  optimizeImportedAudio,
  optimizeImportedAudioMedia,
  savesAtLeastTenPercent,
  type AudioProcessRunner,
} from "./audio-optimizer.js";
import { mediaSha256 } from "./media-file.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const pcm16Wave = (
  amplitude: number,
  channels = 1,
  sampleRate = 48_000,
  seconds = 3,
): Buffer => {
  const frames = sampleRate * seconds;
  const data = Buffer.alloc(frames * channels * 2);
  for (let frame = 0; frame < frames; frame += 1) {
    const sample = Math.round(
      Math.sin((frame * 2 * Math.PI * 440) / sampleRate) * amplitude * 0x7fff,
    );
    for (let channel = 0; channel < channels; channel += 1) {
      data.writeInt16LE(sample, (frame * channels + channel) * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

const encodeFixture = async (
  source: Buffer,
  extension: "mp3" | "m4a" | "ogg",
): Promise<Buffer> => {
  const directory = await mkdtemp(join(tmpdir(), "flashcards-audio-fixture-"));
  temporaryDirectories.push(directory);
  const input = join(directory, "input.wav");
  const output = join(directory, `output.${extension}`);
  await writeFile(input, source);
  const codecArgs =
    extension === "mp3"
      ? ["-c:a", "libmp3lame", "-b:a", "128k"]
      : extension === "ogg"
        ? ["-c:a", "libopus", "-b:a", "96k"]
        : ["-c:a", "aac", "-b:a", "40k"];
  await execFileAsync(
    "ffmpeg",
    [
      "-nostdin",
      "-hide_banner",
      "-v",
      "error",
      "-i",
      input,
      ...codecArgs,
      "-y",
      output,
    ],
    { timeout: 15_000, maxBuffer: 1024 * 1024 },
  );
  return readFile(output);
};

const probeOptimized = async (data: Buffer) => {
  const directory = await mkdtemp(join(tmpdir(), "flashcards-audio-probe-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "audio.m4a");
  await writeFile(path, data);
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name,profile,sample_rate,channels",
      "-of",
      "json",
      path,
    ],
    { timeout: 10_000, maxBuffer: 1024 * 1024 },
  );
  return JSON.parse(stdout).streams[0] as Record<string, unknown>;
};

describe("optimizeImportedAudio", () => {
  it("applies the ten-percent storage threshold exactly", () => {
    expect(savesAtLeastTenPercent(1_000, 901)).toBe(false);
    expect(savesAtLeastTenPercent(1_000, 900)).toBe(true);
    expect(savesAtLeastTenPercent(1_001, 900)).toBe(true);
  });

  it("rejects inputs above the hard byte limit before starting FFmpeg", async () => {
    let processStarted = false;
    const result = await optimizeImportedAudio(
      Buffer.alloc(16 * 1024 * 1024 + 1),
      {
        runProcess: async () => {
          processStarted = true;
          throw new Error("must not run");
        },
      },
    );

    expect(result.status).toBe("invalid");
    expect(processStarted).toBe(false);
  });

  it.each([
    ["WAV", async () => pcm16Wave(0.01)],
    ["MP3", async () => encodeFixture(pcm16Wave(0.01), "mp3")],
    ["M4A", async () => encodeFixture(pcm16Wave(0.01), "m4a")],
    ["OGG", async () => encodeFixture(pcm16Wave(0.01), "ogg")],
  ])(
    "normalizes quiet %s speech to AAC-LC mono at 24 kHz",
    async (_format, fixture) => {
      const result = await optimizeImportedAudio(await fixture());

      expect(result.status).toBe("optimized");
      expect(result.normalized).toBe(true);
      expect(result.mimeType).toBe("audio/mp4");
      expect(result.extension).toBe("m4a");
      const stream = await probeOptimized(result.data);
      expect(stream).toMatchObject({
        codec_name: "aac",
        profile: "LC",
        sample_rate: "24000",
        channels: 1,
      });
    },
    30_000,
  );

  it("normalizes an overly loud stereo recording and downmixes it", async () => {
    const result = await optimizeImportedAudio(pcm16Wave(0.9, 2));

    expect(result.status).toBe("optimized");
    expect(result.normalized).toBe(true);
    expect(await probeOptimized(result.data)).toMatchObject({
      sample_rate: "24000",
      channels: 1,
    });
  });

  it("transcodes fitting uncompressed audio only when it saves at least ten percent", async () => {
    const source = pcm16Wave(0.18);
    const result = await optimizeImportedAudio(source);

    expect(result.status).toBe("optimized");
    expect(result.normalized).toBe(false);
    expect(result.data.length).toBeLessThanOrEqual(
      Math.floor(source.length * 0.9),
    );
  });

  it("keeps an already fitting compact M4A when recoding cannot save ten percent", async () => {
    const source = await encodeFixture(pcm16Wave(0.18, 1, 24_000), "m4a");
    const result = await optimizeImportedAudio(source);

    expect(result.status).toBe("unchanged");
    expect(result.data).toBe(source);
  });

  it("uses a safe original fallback for FFmpeg errors and timeouts", async () => {
    const source = pcm16Wave(0.18);
    const failingRunner: AudioProcessRunner = async (command) => {
      if (command === "ffprobe") {
        return {
          stdout: Buffer.from(
            JSON.stringify({
              streams: [
                {
                  codec_type: "audio",
                  codec_name: "pcm_s16le",
                  sample_rate: "48000",
                  channels: 1,
                },
              ],
              format: { duration: "3" },
            }),
          ),
          stderr: Buffer.alloc(0),
        };
      }
      throw new AudioProcessError("simulated timeout", "timeout");
    };

    const result = await optimizeImportedAudio(source, {
      runProcess: failingRunner,
    });
    expect(result.status).toBe("fallback");
    expect(result.data).toBe(source);
  });

  it("rejects damaged signature-only audio instead of treating it as a tool failure", async () => {
    const damaged = Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0]);
    const result = await optimizeImportedAudio(damaged);

    expect(result.status).toBe("invalid");
  });
});

describe("optimizeImportedAudioMedia", () => {
  it("preserves SourceName references and deduplicates optimization by stored bytes", async () => {
    const source = pcm16Wave(0.01);
    const batch = await optimizeImportedAudioMedia([
      {
        sourceName: "front.wav",
        data: source,
        mimeType: "audio/wav",
        extension: "wav",
        kind: "audio",
      },
      {
        sourceName: "back.wav",
        data: source,
        mimeType: "audio/wav",
        extension: "wav",
        kind: "audio",
      },
    ]);

    expect(batch.media.map((item) => item.sourceName)).toEqual([
      "front.wav",
      "back.wav",
    ]);
    expect(batch.stats).toMatchObject({ normalized: 2, transcoded: 2 });
    expect(batch.stats.bytesSaved).toBe(
      source.length - batch.media[0]!.data.length,
    );
    expect(mediaSha256(batch.media[0]!.data)).toBe(
      mediaSha256(batch.media[1]!.data),
    );
  });

  it("aggregates fallback and invalid-media warnings", async () => {
    const source = pcm16Wave(0.18);
    const timeoutRunner: AudioProcessRunner = async () => {
      throw new AudioProcessError("simulated timeout", "timeout");
    };
    const batch = await optimizeImportedAudioMedia(
      [
        {
          sourceName: "valid.wav",
          data: source,
          mimeType: "audio/wav",
          extension: "wav",
          kind: "audio",
        },
      ],
      { runProcess: timeoutRunner },
    );

    expect(batch.stats.originalFallbacks).toBe(1);
    expect(batch.warnings).toHaveLength(1);
    expect(batch.warnings[0]).toContain("1 gültige Audiodatei");
  });
});
