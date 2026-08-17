import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateAudioPlayerGain,
  audioPlayerGainPreferenceChangedEvent,
  audioPlayerGainPreferenceKey,
  deactivateAudioPlayerGain,
  getAudioPlayerGainPreference,
  parseAudioPlayerGain,
  setAudioPlayerGainPreference,
} from "./audio-player-gain";

describe("audio player gain preference", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal(
      "CustomEvent",
      class TestCustomEvent extends Event {
        constructor(
          type: string,
          readonly init: CustomEventInit,
        ) {
          super(type);
        }
      },
    );
  });

  it("defaults to unity gain and clamps corrupted values", () => {
    expect(parseAudioPlayerGain(null)).toBe(1);
    expect(parseAudioPlayerGain("invalid")).toBe(1);
    expect(parseAudioPlayerGain("0.1")).toBe(0.5);
    expect(parseAudioPlayerGain("9")).toBe(3);
  });

  it("stores the device-local gain and announces the live change", () => {
    setAudioPlayerGainPreference(1.5);

    expect(values.get(audioPlayerGainPreferenceKey)).toBe("1.5");
    expect(getAudioPlayerGainPreference()).toBe(1.5);
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: audioPlayerGainPreferenceChangedEvent }),
    );
  });

  it("routes card audio through gain and peak limiting", async () => {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const gain = {
      gain: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const parameter = () => ({ setValueAtTime: vi.fn() });
    const limiter = {
      threshold: parameter(),
      knee: parameter(),
      ratio: parameter(),
      attack: parameter(),
      release: parameter(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    let contextState: AudioContextState = "suspended";
    const context = {
      currentTime: 4,
      get state() {
        return contextState;
      },
      destination: {},
      createMediaElementSource: vi.fn(() => source),
      createGain: vi.fn(() => gain),
      createDynamicsCompressor: vi.fn(() => limiter),
      resume: vi.fn().mockImplementation(async () => {
        contextState = "running";
      }),
      suspend: vi.fn().mockImplementation(async () => {
        contextState = "suspended";
      }),
    };
    Object.assign(window, {
      AudioContext: vi.fn(function AudioContextMock() {
        return context;
      }),
    });
    const audio = { volume: 1 } as HTMLAudioElement;
    setAudioPlayerGainPreference(2);

    await activateAudioPlayerGain(audio);

    expect(context.createMediaElementSource).toHaveBeenCalledWith(audio);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(limiter);
    expect(limiter.connect).toHaveBeenCalledWith(context.destination);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(2, 4);
    expect(context.resume).toHaveBeenCalledOnce();

    deactivateAudioPlayerGain(audio);
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
    expect(limiter.disconnect).toHaveBeenCalledOnce();
    expect(context.suspend).toHaveBeenCalledOnce();
  });
});
