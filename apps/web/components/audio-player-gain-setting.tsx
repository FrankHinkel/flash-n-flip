"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  audioPlayerGainPreferenceChangedEvent,
  getAudioPlayerGainPreference,
  setAudioPlayerGainPreference,
} from "../lib/audio-player-gain";
import { useI18n } from "./i18n-provider";

const gainOptions = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;

const gainLabel = (gain: number): string => `${Math.round(gain * 100)} %`;

export function AudioPlayerGainSetting() {
  const { text } = useI18n();
  const [gain, setGain] = useState(1);

  useEffect(() => {
    const refresh = () => setGain(getAudioPlayerGainPreference());
    refresh();
    window.addEventListener(audioPlayerGainPreferenceChangedEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(
        audioPlayerGainPreferenceChangedEvent,
        refresh,
      );
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div className="setting-row">
      <div>
        <Volume2 aria-hidden="true" />
        <span>
          <strong>{text("Audio base volume", "Audio-Grundverstärkung")}</strong>
          <small>
            {text(
              "Adjusts card audio on this device. Optimized audio remains normalized to one common target volume.",
              "Gleicht Kartenaudios auf diesem Gerät an. Optimierte Audios bleiben auf eine gemeinsame Ziellautstärke normalisiert.",
            )}
          </small>
        </span>
      </div>
      <select
        value={String(gain)}
        aria-label={text("Audio base volume", "Audio-Grundverstärkung")}
        onChange={(event) => {
          const selected = Number(event.target.value);
          setGain(selected);
          setAudioPlayerGainPreference(selected);
        }}
      >
        {gainOptions.map((option) => (
          <option key={option} value={option}>
            {gainLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
