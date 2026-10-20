"use client";

import { useState } from "react";
import { inputCls } from "./fields";

const OTHER = "__other";

/**
 * Select from an admin-managed list, with "Other…" revealing a text box. The chosen value is
 * submitted under `name` either way, so the server never sees the sentinel.
 */
export function ChoiceField({
  label,
  name,
  options,
  defaultValue,
  required,
  hint,
  placeholder = "Select",
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string | null;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const initialOther = !!defaultValue && !options.includes(defaultValue);
  const [choice, setChoice] = useState(initialOther ? OTHER : (defaultValue ?? ""));
  const [other, setOther] = useState(initialOther ? (defaultValue ?? "") : "");
  const value = choice === OTHER ? other : choice;
  return (
    <div className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
      <label htmlFor={`${name}-choice`}>
        {label}
        {required && <span className="text-gold-dark"> *</span>}
      </label>
      <select id={`${name}-choice`} value={choice} onChange={(e) => setChoice(e.target.value)} required={required} className={inputCls}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={OTHER}>Other…</option>
      </select>
      {choice === OTHER && (
        <input
          aria-label={`${label} (other)`}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          required={required}
          maxLength={60}
          placeholder="Please specify"
          className={inputCls}
        />
      )}
      <input type="hidden" name={name} value={value} />
      {hint && <span className="mt-1.5 block text-xs font-normal tracking-normal text-stone-500">{hint}</span>}
    </div>
  );
}
