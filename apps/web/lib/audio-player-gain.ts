export const audioPlayerGainPreferenceKey = "flash-n-flip.audio-player-gain.v1";
export const audioPlayerGainPreferenceChangedEvent =
  "flash-n-flip:audio-player-gain-preference";

export const defaultAudioPlayerGain = 1;
export const minimumAudioPlayerGain = 0.5;
export const maximumAudioPlayerGain = 3;

type AudioContextConstructor = new () => AudioContext;

type AudioGainChain = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  limiter: DynamicsCompressorNode;
  connected: boolean;
};

const chains = new WeakMap<HTMLAudioElement, AudioGainChain>();
const activeChains = new Set<AudioGainChain>();
let sharedContext: AudioContext | undefined;

const audioContextConstructor = (): AudioContextConstructor | undefined => {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: AudioContextConstructor;
      }
    ).webkitAudioContext
  );
};

export function parseAudioPlayerGain(storedValue: string | null): number {
  if (storedValue === null || storedValue.trim() === "") {
    return defaultAudioPlayerGain;
  }
  const parsed = Number(storedValue);
  if (!Number.isFinite(parsed)) return defaultAudioPlayerGain;
  return Math.min(
    maximumAudioPlayerGain,
    Math.max(minimumAudioPlayerGain, parsed),
  );
}

export function getAudioPlayerGainPreference(): number {
  if (typeof window === "undefined") return defaultAudioPlayerGain;
  try {
    return parseAudioPlayerGain(
      window.localStorage.getItem(audioPlayerGainPreferenceKey),
    );
  } catch {
    return defaultAudioPlayerGain;
  }
}

const applyGain = (chain: AudioGainChain, value: number): void => {
  chain.gain.gain.setValueAtTime(value, chain.context.currentTime);
};

export function setAudioPlayerGainPreference(value: number): void {
  if (typeof window === "undefined") return;
  const gain = parseAudioPlayerGain(String(value));
  try {
    window.localStorage.setItem(audioPlayerGainPreferenceKey, String(gain));
  } catch {
    return;
  }
  for (const chain of activeChains) applyGain(chain, gain);
  window.dispatchEvent(
    new CustomEvent(audioPlayerGainPreferenceChangedEvent, { detail: gain }),
  );
}

const createGainChain = (
  element: HTMLAudioElement,
): AudioGainChain | undefined => {
  const Context = audioContextConstructor();
  if (!Context) return undefined;
  try {
    const context = sharedContext ?? new Context();
    sharedContext = context;
    const source = context.createMediaElementSource(element);
    const gain = context.createGain();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-1, context.currentTime);
    limiter.knee.setValueAtTime(0, context.currentTime);
    limiter.ratio.setValueAtTime(20, context.currentTime);
    limiter.attack.setValueAtTime(0.003, context.currentTime);
    limiter.release.setValueAtTime(0.1, context.currentTime);
    return { context, source, gain, limiter, connected: false };
  } catch {
    return undefined;
  }
};

export async function activateAudioPlayerGain(
  element: HTMLAudioElement,
): Promise<void> {
  const value = getAudioPlayerGainPreference();
  let chain = chains.get(element);
  if (!chain) {
    chain = createGainChain(element);
    if (chain) chains.set(element, chain);
  }
  if (!chain) {
    element.volume = Math.min(1, value);
    return;
  }
  if (!chain.connected) {
    chain.source.connect(chain.gain);
    chain.gain.connect(chain.limiter);
    chain.limiter.connect(chain.context.destination);
    chain.connected = true;
  }
  activeChains.add(chain);
  applyGain(chain, value);
  if (chain.context.state === "suspended") {
    await chain.context.resume().catch(() => undefined);
  }
}

export function deactivateAudioPlayerGain(element: HTMLAudioElement): void {
  const chain = chains.get(element);
  if (!chain || !chain.connected) return;
  chain.source.disconnect();
  chain.gain.disconnect();
  chain.limiter.disconnect();
  chain.connected = false;
  activeChains.delete(chain);
  if (activeChains.size === 0 && chain.context.state === "running") {
    void chain.context.suspend().catch(() => undefined);
  }
}
