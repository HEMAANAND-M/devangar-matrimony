/**
 * Thirumana porutham (Tamil marriage star compatibility) from the bride's and groom's
 * nakshatra and rasi. Tables follow the commonly used Tamil panchangam rules; results are
 * indicative and families should still consult their astrologer.
 */
import { RASIS, STARS } from "./constants";

type Gana = "Deva" | "Manushya" | "Rakshasa";
const GANA: Gana[] = [
  "Deva", "Manushya", "Rakshasa", "Manushya", "Deva", "Manushya", "Deva", "Deva", "Rakshasa",
  "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Deva", "Rakshasa", "Deva", "Rakshasa",
  "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Rakshasa", "Manushya", "Manushya", "Deva",
];

const YONI = [
  "Horse", "Elephant", "Goat", "Serpent", "Serpent", "Dog", "Cat", "Goat", "Cat", "Rat", "Rat", "Cow",
  "Buffalo", "Tiger", "Buffalo", "Tiger", "Deer", "Deer", "Dog", "Monkey", "Mongoose", "Monkey", "Lion",
  "Horse", "Lion", "Cow", "Elephant",
];
const YONI_ENEMIES = [
  ["Horse", "Buffalo"], ["Elephant", "Lion"], ["Goat", "Monkey"], ["Serpent", "Mongoose"],
  ["Dog", "Deer"], ["Cat", "Rat"], ["Cow", "Tiger"],
];

// Rajju groups: head, neck, stomach, thigh, feet.
const RAJJU = [4, 3, 2, 1, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 1, 2, 3, 4];
const RAJJU_NAMES = ["Siro (head)", "Kanda (neck)", "Udara (stomach)", "Ooru (thigh)", "Pada (feet)"];

const VEDHA_PAIRS = [
  ["Ashwini", "Kettai"], ["Bharani", "Anusham"], ["Karthigai", "Visakam"], ["Rohini", "Swathi"],
  ["Thiruvathirai", "Thiruvonam"], ["Punarpoosam", "Uthiradam"], ["Poosam", "Pooradam"],
  ["Ayilyam", "Moolam"], ["Magam", "Revathi"], ["Pooram", "Uthirattathi"], ["Uthiram", "Poorattathi"],
  ["Hastham", "Sathayam"], ["Mirugasirisham", "Chithirai"], ["Chithirai", "Avittam"], ["Mirugasirisham", "Avittam"],
];

type Planet = "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";
const RASI_LORD: Planet[] = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
];
const ENEMIES: Record<Planet, Planet[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
};

// Vasya: rasis attracted to each rasi (index-aligned with RASIS).
const VASYA: string[][] = [
  ["Simmam", "Viruchigam"], ["Kadagam", "Thulam"], ["Kanni"], ["Viruchigam", "Dhanusu"], ["Thulam"],
  ["Rishabam", "Meenam"], ["Kanni", "Magaram"], ["Kadagam"], ["Meenam"], ["Mesham", "Kumbam"], ["Mesham"], ["Magaram"],
];

export type PoruthamResult = {
  name: string;
  matched: boolean;
  /** Rajju and Vedha are treated as essential by most families. */
  essential: boolean;
  note: string;
};

export type PoruthamReport = { results: PoruthamResult[]; score: number; total: number; essentialOk: boolean };

/** Counts from a to b inclusive around a cycle of n (same position = 1). */
const countFrom = (a: number, b: number, n: number) => ((b - a + n) % n) + 1;

export function porutham(
  bride: { star?: string | null; rasi?: string | null },
  groom: { star?: string | null; rasi?: string | null },
): PoruthamReport | null {
  const g = STARS.indexOf(bride.star ?? "");
  const b = STARS.indexOf(groom.star ?? "");
  if (g < 0 || b < 0) return null;
  const count = countFrom(g, b, 27);

  const results: PoruthamResult[] = [];
  const add = (name: string, matched: boolean, note: string, essential = false) =>
    results.push({ name, matched, note, essential });

  add("Dinam", [2, 4, 6, 8, 9, 11, 13, 15, 18, 20, 24, 26, 27].includes(count), `Groom's star is ${count} from the bride's`);

  const [gg, bg] = [GANA[g], GANA[b]];
  const ganaOk = gg === bg || (gg !== "Rakshasa" && bg !== "Rakshasa");
  add("Ganam", ganaOk, `Bride ${gg}, groom ${bg}`);

  add("Mahendram", [4, 7, 10, 13, 16, 19, 22, 25].includes(count), "Prosperity and progeny");
  add("Stree Deergham", count > 13, count > 13 ? "Stars are well apart" : "Stars are close together");

  const [gy, by] = [YONI[g], YONI[b]];
  const yoniEnemy = YONI_ENEMIES.some(([x, y]) => (x === gy && y === by) || (x === by && y === gy));
  add("Yoni", !yoniEnemy, `Bride ${gy}, groom ${by}`);

  const sameRajju = RAJJU[g] === RAJJU[b];
  add("Rajju", !sameRajju, sameRajju ? `Both ${RAJJU_NAMES[RAJJU[g]]}` : "Different rajju", true);

  const vedha = VEDHA_PAIRS.some(([x, y]) => (STARS[g] === x && STARS[b] === y) || (STARS[g] === y && STARS[b] === x));
  add("Vedhai", !vedha, vedha ? "Stars afflict each other" : "No affliction", true);

  const gr = RASIS.indexOf(bride.rasi ?? "");
  const br = RASIS.indexOf(groom.rasi ?? "");
  if (gr >= 0 && br >= 0) {
    const rc = countFrom(gr, br, 12);
    add("Rasi", [1, 7, 9, 10, 11].includes(rc), `Groom's rasi is ${rc} from the bride's`);
    const [gl, bl] = [RASI_LORD[gr], RASI_LORD[br]];
    add("Rasi Adhipathi", !ENEMIES[gl].includes(bl) && !ENEMIES[bl].includes(gl), `Lords ${gl} and ${bl}`);
    add("Vasyam", VASYA[gr].includes(RASIS[br]) || VASYA[br].includes(RASIS[gr]), "Mutual attraction of rasis");
  }

  const score = results.filter((r) => r.matched).length;
  return { results, score, total: results.length, essentialOk: results.filter((r) => r.essential).every((r) => r.matched) };
}
