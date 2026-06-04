"use client";

import dynamic from "next/dynamic";
import type { MapPickerValue } from "./MapPicker.inner";

export type { MapPickerValue };

// react-leaflet 5 is client-only. We wrap the implementation in a dynamically loaded
// component to avoid SSR errors and Leaflet's `window` references during build.
const Inner = dynamic(() => import("./MapPicker.inner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[320px] w-full place-items-center rounded-xl bg-slate-100 text-xs text-slate-500">
      Cargando mapa…
    </div>
  ),
});

export default function MapPicker(props: {
  value: MapPickerValue;
  onChange?: (next: MapPickerValue) => void;
  height?: number;
  readOnly?: boolean;
}) {
  return <Inner {...props} />;
}
