/**
 * Hand-drawn SVG charts for the admin dashboard. Single-series charts use one brand hue; the
 * two-category bride/groom split uses a validated pair (#a8324f / #c28a2c, CVD ΔE 19) and always
 * shows numbers beside the marks, since the gold sits just under 3:1 contrast.
 */

export const SERIES = "#a8324f";
export const BRIDES = "#a8324f";
export const GROOMS = "#c28a2c";

export type DayPoint = { day: string; value: number };

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= max) ?? pow * 10;
  return step * 4;
}

/**
 * Daily bar chart with a recessive grid, a headline total and a per-bar hover tooltip
 * (a native <title> plus a highlight band). `format` renders values in labels and tooltips.
 */
export function DailyBars({
  data,
  label,
  format = (v: number) => v.toLocaleString("en-IN"),
}: {
  data: DayPoint[];
  label: string;
  format?: (v: number) => string;
}) {
  // Drawn at roughly its on-screen size so 10px labels stay legible when three charts sit side by side.
  const W = 360;
  const H = 160;
  const pad = { top: 10, right: 4, bottom: 20, left: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(12, slot - 2));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const total = data.reduce((s, d) => s + d.value, 0);
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 4);

  return (
    <figure>
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-sm tabular-nums text-stone-600">
          <span className="font-semibold text-ink">{format(total)}</span> in {data.length} days
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label}: ${format(total)} over ${data.length} days`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#ece6dc" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#78716c" className="tabular-nums">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = Math.max(d.value > 0 ? 2 : 0, pad.top + innerH - y(d.value));
          const r = Math.min(4, barW / 2, h);
          const base = pad.top + innerH;
          const top = base - h;
          return (
            <g key={d.day} className="group">
              <title>{`${dayLabel(d.day)}: ${format(d.value)}`}</title>
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" className="group-hover:fill-[#f3ece0]" />
              {h > 0 && (
                // Rounded data end, square at the baseline.
                <path
                  d={`M${x},${base} V${top + r} a${r},${r} 0 0 1 ${r},${-r} H${x + barW - r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`}
                  fill={SERIES}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={pad.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#78716c">
                  {dayLabel(d.day)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="#d6cfc3" strokeWidth={1} />
      </svg>
    </figure>
  );
}

/** Horizontal bars for a ranked breakdown; values are printed so colour is never the only cue. */
export function BarList({ rows, total }: { rows: { label: string; value: number }[]; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const sum = total ?? rows.reduce((s, r) => s + r.value, 0);
  if (!rows.length) return <p className="text-sm text-stone-500">No data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.value}`} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-stone-700 group-hover:text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums text-stone-600">
              {r.value.toLocaleString("en-IN")}
              {sum > 0 && <span className="ml-1.5 text-xs text-stone-400">{Math.round((r.value / sum) * 100)}%</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-sand">
            <div className="h-1.5 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: SERIES }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Brides vs grooms per city as a split bar, with the shortfall called out: where the community
 * needs more of one side.
 */
export function GenderSplit({ rows }: { rows: { city: string; brides: number; grooms: number }[] }) {
  if (!rows.length) return <p className="text-sm text-stone-500">No live profiles yet.</p>;
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-stone-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRIDES }} />Brides</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: GROOMS }} />Grooms</span>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const total = r.brides + r.grooms;
          const gap = r.grooms - r.brides;
          return (
            <li key={r.city} title={`${r.city}: ${r.brides} brides, ${r.grooms} grooms`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-stone-700">{r.city}</span>
                <span className="shrink-0 text-xs tabular-nums text-stone-600">
                  {r.brides} {r.brides === 1 ? "bride" : "brides"} · {r.grooms} {r.grooms === 1 ? "groom" : "grooms"}
                  {gap !== 0 && (
                    <span className="ml-2 font-medium text-maroon">short of {Math.abs(gap)} {gap > 0 ? "bride" : "groom"}{Math.abs(gap) === 1 ? "" : "s"}</span>
                  )}
                </span>
              </div>
              <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
                {r.brides > 0 && <div style={{ width: `${(r.brides / total) * 100}%`, background: BRIDES }} />}
                {r.grooms > 0 && <div style={{ width: `${(r.grooms / total) * 100}%`, background: GROOMS }} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
