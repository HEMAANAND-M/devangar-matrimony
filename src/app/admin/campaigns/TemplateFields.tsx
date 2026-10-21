"use client";

import { useState } from "react";
import { inputCls, selectCls } from "@/components/admin/ui";

const HINTS: Record<string, string> = {
  message: "Up to 1000 characters. Use {name} for the member's first name.",
  link: "Optional. A page on this site (/upgrade) or an https:// address.",
};

/** Template picker whose parameter inputs follow the selected template ("name" is filled per member). */
export function TemplateFields({
  templates,
  initialTemplate,
  initialParams,
}: {
  templates: Record<string, readonly string[]>;
  initialTemplate: string;
  initialParams: Record<string, string>;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const keys = (templates[template] ?? []).filter((k) => k !== "name");
  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium text-stone-600">
        Message template
        <select name="template" value={template} onChange={(e) => setTemplate(e.target.value)} className={`${selectCls} mt-1 w-full`}>
          {Object.keys(templates).map((t) => (
            <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
          ))}
        </select>
        <span className="mt-1 block font-normal text-stone-500">
          WhatsApp sends the pre-approved Meta template with this name. Variables in order: {templates[template]?.join(", ")}.
        </span>
      </label>
      {keys.map((key) => (
        <label key={`${template}-${key}`} className="block text-xs font-medium text-stone-600">
          {key}
          {key === "message" ? (
            <textarea name={`p_${key}`} defaultValue={initialParams[key] ?? ""} rows={4} maxLength={1000} required className={`${inputCls} mt-1 w-full`} />
          ) : (
            <input name={`p_${key}`} defaultValue={initialParams[key] ?? ""} required={key !== "link"} maxLength={200} className={`${inputCls} mt-1 w-full`} />
          )}
          {HINTS[key] && <span className="mt-1 block font-normal text-stone-500">{HINTS[key]}</span>}
        </label>
      ))}
    </div>
  );
}
