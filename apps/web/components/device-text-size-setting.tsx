"use client";
import { Type } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { useDeviceTypography } from "./device-typography-provider";
import {
  parseTextSize,
  textSizeFactors,
  type TextSizeLevel,
} from "../lib/device-typography";

export function DeviceTextSizeSetting() {
  const { text } = useI18n();
  const state = useDeviceTypography();
  if (!state) return null;
  return (
    <div className="device-text-size-setting">
      <div className="setting-row">
        <div>
          <Type aria-hidden="true" />
          <span>
            <strong>{text("typography.title")}</strong>
            <small>{text("typography.local")}</small>
          </span>
        </div>
        <select
          aria-label={text("typography.title")}
          value={state.level}
          disabled={state.busy}
          onChange={(event) =>
            void state.save(parseTextSize(event.target.value))
          }
        >
          {(Object.keys(textSizeFactors) as TextSizeLevel[]).map((level) => (
            <option key={level} value={level}>
              {text(`typography.${level}`)}
            </option>
          ))}
        </select>
      </div>
      <p className="device-text-size-preview">{text("typography.preview")}</p>
      {state.error && <p role="alert">{text("settings.saveFailed")}</p>}
    </div>
  );
}
