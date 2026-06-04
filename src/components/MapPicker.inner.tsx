"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ASUNCION: [number, number] = [-25.2637, -57.5759];

// Fix de iconos default — Leaflet con bundlers no resuelve las imágenes por default.
const DEFAULT_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type MapPickerValue = { lat: number | null; lng: number | null };

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPickerInner({
  value,
  onChange,
  height = 320,
  readOnly = false,
}: {
  value: MapPickerValue;
  onChange?: (next: MapPickerValue) => void;
  height?: number;
  readOnly?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (typeof value.lat === "number" && typeof value.lng === "number") return [value.lat, value.lng];
    return ASUNCION;
  }, [value.lat, value.lng]);

  if (!mounted) {
    return (
      <div
        style={{ height }}
        className="grid w-full place-items-center rounded-xl bg-slate-100 text-xs text-slate-500"
      >
        Cargando mapa…
      </div>
    );
  }

  const hasPoint = typeof value.lat === "number" && typeof value.lng === "number";
  const setPoint = (lat: number, lng: number) =>
    onChange?.({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
        <MapContainer center={center} zoom={hasPoint ? 16 : 12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && onChange ? <ClickCatcher onPick={setPoint} /> : null}
          {hasPoint ? (
            <Marker
              position={[value.lat as number, value.lng as number]}
              icon={DEFAULT_ICON}
              draggable={!readOnly && !!onChange}
              ref={(ref) => {
                markerRef.current = ref;
              }}
              eventHandlers={
                !readOnly && onChange
                  ? {
                      dragend: () => {
                        const m = markerRef.current;
                        if (!m) return;
                        const ll = m.getLatLng();
                        setPoint(ll.lat, ll.lng);
                      },
                    }
                  : undefined
              }
            />
          ) : null}
        </MapContainer>
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{hasPoint ? `Lat: ${value.lat}  ·  Lng: ${value.lng}` : "Clic en el mapa para marcar la ubicación"}</span>
          {hasPoint && onChange ? (
            <button
              type="button"
              onClick={() => onChange({ lat: null, lng: null })}
              className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              Quitar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
