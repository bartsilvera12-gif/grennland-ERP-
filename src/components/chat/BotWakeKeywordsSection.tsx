"use client";

import { useState } from "react";
import {
  BOT_WAKE_KEYWORDS_MAX_COUNT,
  BOT_WAKE_KEYWORDS_MAX_LENGTH,
  normalizeWakeKeywordText,
  type BotWakeKeywordsFormState,
  type BotWakeKeywordsMatchMode,
} from "@/lib/chat/bot-wake-keywords";

type Props = {
  value: BotWakeKeywordsFormState;
  onChange: (v: BotWakeKeywordsFormState) => void;
};

export function BotWakeKeywordsSection({ value, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function setMatchMode(m: BotWakeKeywordsMatchMode) {
    onChange({ ...value, matchMode: m });
  }

  function addKeyword() {
    const t = draft.trim();
    if (!t) return;
    if (t.length > BOT_WAKE_KEYWORDS_MAX_LENGTH) {
      setError(`Máximo ${BOT_WAKE_KEYWORDS_MAX_LENGTH} caracteres por palabra o frase.`);
      return;
    }
    if (value.keywords.length >= BOT_WAKE_KEYWORDS_MAX_COUNT) {
      setError(`Máximo ${BOT_WAKE_KEYWORDS_MAX_COUNT} entradas.`);
      return;
    }
    const n = normalizeWakeKeywordText(t);
    if (value.keywords.some((k) => normalizeWakeKeywordText(k) === n)) {
      setError("Ya existe una entrada equivalente (misma normalización).");
      return;
    }
    setError(null);
    onChange({ ...value, keywords: [...value.keywords, t] });
    setDraft("");
  }

  function removeAt(i: number) {
    onChange({ ...value, keywords: value.keywords.filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Usar palabras personalizadas en este canal
      </label>
      <p className="text-xs text-slate-500">
        Si está inactivo o la lista queda vacía, se usan las palabras predeterminadas del sistema (hola, menú,
        iniciar, etc.).
      </p>

      <div>
        <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">
          Frases de varias palabras
        </span>
        <p className="text-xs text-slate-500 mb-2">
          &quot;Exacta&quot; solo dispara si el mensaje completo coincide. &quot;Prefijo&quot; también si el
          mensaje empieza con la frase y un espacio.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="bot_wake_match_mode"
              checked={value.matchMode === "exact"}
              onChange={() => setMatchMode("exact")}
            />
            Exacta
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="bot_wake_match_mode"
              checked={value.matchMode === "starts_with"}
              onChange={() => setMatchMode("starts_with")}
            />
            Prefijo
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Agregar palabra o frase</label>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
          <input
            className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="Ej: hola, quiero, quiero comprar"
            maxLength={BOT_WAKE_KEYWORDS_MAX_LENGTH}
            disabled={!value.enabled}
          />
          <button
            type="button"
            onClick={addKeyword}
            disabled={!value.enabled}
            className="shrink-0 border border-slate-200 text-slate-800 hover:bg-slate-50 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
          >
            Agregar
          </button>
        </div>
        {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
        <p className="text-xs text-slate-400 mt-1">
          Máximo {BOT_WAKE_KEYWORDS_MAX_COUNT} entradas, {BOT_WAKE_KEYWORDS_MAX_LENGTH} caracteres cada una. La
          comparación ignora mayúsculas, acentos y espacios extra.
        </p>
      </div>

      {value.keywords.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.keywords.map((k, i) => (
            <li
              key={`${normalizeWakeKeywordText(k)}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-sm text-slate-800"
            >
              <span className="max-w-[240px] truncate" title={k}>
                {k}
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-slate-500 hover:text-red-600 text-lg leading-none px-0.5"
                aria-label={`Quitar ${k}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">Ninguna palabra configurada.</p>
      )}
    </div>
  );
}
