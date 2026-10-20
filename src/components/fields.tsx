export const inputCls =
  "mt-1.5 block w-full rounded-lg border border-hairline bg-cream/40 px-3.5 py-2.5 text-sm text-ink shadow-[inset_0_1px_1px_rgb(30_26_23/0.03)] transition placeholder:text-stone-400 focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-gold/15";

type Common = { label: string; name: string; required?: boolean; hint?: string };

function Label({ label, required, hint, children }: Common & { children: React.ReactNode }) {
  return (
    <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
      {label}
      {required && <span className="text-gold-dark"> *</span>}
      {children}
      {hint && <span className="mt-1.5 block text-xs font-normal tracking-normal text-stone-500">{hint}</span>}
    </label>
  );
}

export function TextField(
  props: Common & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "required">,
) {
  const { label, hint, ...rest } = props;
  return (
    <Label label={label} name={props.name} required={props.required} hint={hint}>
      <input {...rest} className={inputCls} />
    </Label>
  );
}

export function TextArea(
  props: Common & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "required">,
) {
  const { label, hint, ...rest } = props;
  return (
    <Label label={label} name={props.name} required={props.required} hint={hint}>
      <textarea rows={3} {...rest} className={inputCls} />
    </Label>
  );
}

export function SelectField({
  label,
  name,
  required,
  hint,
  options,
  defaultValue,
  placeholder = "Select",
}: Common & {
  options: string[] | Record<string, string>;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const entries = Array.isArray(options) ? options.map((o) => [o, o] as const) : Object.entries(options);
  return (
    <Label label={label} name={name} required={required} hint={hint}>
      <select name={name} required={required} defaultValue={defaultValue ?? ""} className={inputCls}>
        <option value="">{placeholder}</option>
        {entries.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Label>
  );
}
