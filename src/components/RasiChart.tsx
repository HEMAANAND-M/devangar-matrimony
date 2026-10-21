import { RASIS } from "@/lib/constants";
import { getT, getTx } from "@/lib/i18n";

// South Indian chart: rasis sit in fixed cells clockwise from Meenam in the top-left corner.
const CELLS: [col: number, row: number][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0],
]; // index-aligned with RASIS (Mesham … Meenam)

const SIZE = 60;

export async function RasiChart({ rasi, lagnam }: { rasi?: string | null; lagnam?: string | null }) {
  const moon = RASIS.indexOf(rasi ?? "");
  const asc = RASIS.indexOf(lagnam ?? "");
  if (moon < 0 && asc < 0) return null;
  const [t, tx] = await Promise.all([getT(), getTx()]);
  const aria = t("chart.aria", { rasi: rasi ? tx(rasi) : t("chart.unknown") }) + (lagnam ? t("chart.ariaLagnam", { lagnam: tx(lagnam) }) : "");
  return (
    <figure className="max-w-xs">
      <svg viewBox={`0 0 ${SIZE * 4} ${SIZE * 4}`} className="w-full" role="img" aria-label={aria}>
        <rect x="0.5" y="0.5" width={SIZE * 4 - 1} height={SIZE * 4 - 1} fill="#fffdf8" stroke="#b08d57" />
        {CELLS.map(([c, r], i) => (
          <g key={RASIS[i]}>
            <rect x={c * SIZE} y={r * SIZE} width={SIZE} height={SIZE} fill={i === moon || i === asc ? "#f3ece0" : "none"} stroke="#d9c7a5" />
            <text x={c * SIZE + 4} y={r * SIZE + 11} fontSize="7.5" fill="#8a6a3b">{tx(RASIS[i])}</text>
            {i === asc && (
              <text x={c * SIZE + SIZE / 2} y={r * SIZE + (i === moon ? 30 : 37)} textAnchor="middle" fontSize="11" fontWeight="600" fill="#5e1229">{t("chart.lagnam")}</text>
            )}
            {i === moon && (
              <text x={c * SIZE + SIZE / 2} y={r * SIZE + (i === asc ? 46 : 37)} textAnchor="middle" fontSize="11" fontWeight="600" fill="#5e1229">{t("chart.moon")}</text>
            )}
          </g>
        ))}
        <text x={SIZE * 2} y={SIZE * 2 - 4} textAnchor="middle" fontSize="15" fill="#5e1229" fontFamily="Georgia, serif">{t("chart.title")}</text>
        <text x={SIZE * 2} y={SIZE * 2 + 14} textAnchor="middle" fontSize="8" fill="#8a6a3b">{t("chart.south")}</text>
      </svg>
      <figcaption className="mt-2 text-xs text-stone-500">
        {t("chart.caption")}
      </figcaption>
    </figure>
  );
}
