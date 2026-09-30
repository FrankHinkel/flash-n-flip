import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorAudioCapture } from "./editor-audio-capture";

afterEach(() => vi.unstubAllGlobals());

function devices() {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] };
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  return { stopTrack, stream, getUserMedia };
}

describe("editor microphone lifecycle", () => {
  it("releases a late permission result after the editor closes", async () => {
    const { stopTrack, stream, getUserMedia } = devices();
    let grant!: (value: unknown) => void;
    getUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }) as never,
    );
    const controller = new AbortController();
    const capture = createEditorAudioCapture(controller.signal);
    controller.abort();
    grant(stream);
    await expect(capture).rejects.toMatchObject({ name: "AbortError" });
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it("releases microphone tracks when recorder creation fails", async () => {
    const { stopTrack } = devices();
    class BrokenRecorder {
      static isTypeSupported() {
        return true;
      }
      constructor() {
        throw new Error("unsupported recorder");
      }
    }
    vi.stubGlobal("MediaRecorder", BrokenRecorder);
    await expect(
      createEditorAudioCapture(new AbortController().signal),
    ).rejects.toThrow("unsupported recorder");
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it("stops capture without publishing partial audio on cancellation", async () => {
    const { stopTrack } = devices();
    const stop = vi.fn();
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = "recording";
      onstop = vi.fn();
      ondataavailable = vi.fn();
      stop = stop;
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    const controller = new AbortController();
    const { recorder } = await createEditorAudioCapture(controller.signal);
    controller.abort();
    expect(stop).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(recorder.onstop).toBeNull();
    expect(recorder.ondataavailable).toBeNull();
  });
});
