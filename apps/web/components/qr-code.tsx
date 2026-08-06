"use client";

import { useMemo } from "react";
import { toQR } from "toqr";

export function QrCode({
  value,
  label,
  size = 216,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const { path, viewBoxSize } = useMemo(() => {
    const modules = toQR(value);
    const side = Math.sqrt(modules.length);
    if (!Number.isInteger(side)) throw new Error("Invalid QR matrix");
    const quietZone = 4;
    const commands: string[] = [];
    for (let index = 0; index < modules.length; index += 1) {
      if (modules[index] !== 1) continue;
      const x = (index % side) + quietZone;
      const y = Math.floor(index / side) + quietZone;
      commands.push(`M${x} ${y}h1v1h-1z`);
    }
    return {
      path: commands.join(""),
      viewBoxSize: side + quietZone * 2,
    };
  }, [value]);

  return (
    <svg
      className="pairing-qr"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#fff" />
      <path d={path} fill="#111827" />
    </svg>
  );
}
