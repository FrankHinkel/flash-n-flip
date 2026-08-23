import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoadNote = (
  baseUrl: string,
  instrument: string,
  note: string,
  audioContext: {
    decodeAudioData: (
      input: unknown,
      success: (buffer: { duration: number }) => void,
      failure?: (error?: unknown) => void,
    ) => void;
  },
) => Promise<{ status: string }>;

const require = createRequire(import.meta.url);
const loadNote = require("abcjs/src/synth/load-note.js") as LoadNote;

class StatusZeroXhr {
  status = 0;
  response = new ArrayBuffer(8);
  responseType = "";
  onload?: () => void;
  onerror?: () => void;
  open(_method: string, _url: string) {}
  send() {
    this.onload?.();
  }
}

const audioContext = {
  decodeAudioData: (
    _input: unknown,
    success: (buffer: { duration: number }) => void,
  ) => success({ duration: 1 }),
};

describe("abcjs Capacitor soundfont compatibility", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts status zero for the current Capacitor app origin", async () => {
    vi.stubGlobal("window", {
      location: { href: "capacitor://localhost/app/learn" },
    });
    vi.stubGlobal("XMLHttpRequest", StatusZeroXhr);

    await expect(
      loadNote(
        "capacitor://localhost/soundfonts/fnf-upright-piano/",
        "acoustic_grand_piano",
        "C4",
        audioContext,
      ),
    ).resolves.toMatchObject({ status: "loaded" });
  });

  it("continues to reject status zero for non-native URLs", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("window", {
      location: { href: "capacitor://localhost/app/learn" },
    });
    vi.stubGlobal("XMLHttpRequest", StatusZeroXhr);

    await expect(
      loadNote(
        "https://example.test/soundfont/",
        "acoustic_grand_piano",
        "D4",
        audioContext,
      ),
    ).rejects.toThrow("status=0");
  });
});
