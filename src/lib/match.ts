import type { Profile } from "@prisma/client";
import { ageFrom } from "./format";
import { porutham } from "./porutham";

export type MatchProfile = Pick<
  Profile,
  | "gender" | "dateOfBirth" | "maritalStatus" | "star" | "rasi" | "dosham" | "city" | "education" | "gothram"
  | "prefAgeMin" | "prefAgeMax" | "prefMaritalStatus" | "prefStars" | "prefDosham" | "prefCities" | "prefEducation"
>;

export type MatchResult = { score: number; reasons: string[]; concerns: string[] };

type Check = { met: boolean; good: string; bad: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The preference checks `seeker` has set, evaluated against `other`. Unset preferences are skipped. */
function preferenceChecks(seeker: MatchProfile, other: MatchProfile, whose: "your" | "their"): Check[] {
  const checks: Check[] = [];
  if (seeker.prefAgeMin || seeker.prefAgeMax) {
    const age = ageFrom(other.dateOfBirth);
    checks.push({
      met: age >= (seeker.prefAgeMin ?? 18) && age <= (seeker.prefAgeMax ?? 80),
      good: whose === "your" ? "Within your preferred age" : "You fit their preferred age",
      bad: whose === "your" ? "Outside your preferred age" : "Outside their preferred age",
    });
  }
  if (seeker.prefMaritalStatus.length) {
    checks.push({
      met: seeker.prefMaritalStatus.includes(other.maritalStatus),
      good: whose === "your" ? "Marital status as you prefer" : "Your marital status suits them",
      bad: whose === "your" ? "Marital status differs from your preference" : "Your marital status differs from their preference",
    });
  }
  if (seeker.prefStars.length) {
    checks.push({
      met: !!other.star && seeker.prefStars.includes(other.star),
      good: whose === "your" ? "Star is one you prefer" : "Your star is one they prefer",
      bad: whose === "your" ? "Star not in your preferred list" : "Your star is not in their preferred list",
    });
  }
  if (seeker.prefDosham === "NO" || seeker.prefDosham === "YES") {
    checks.push({
      met: other.dosham === seeker.prefDosham,
      good: whose === "your" ? "Dosham as you prefer" : "Your dosham suits them",
      bad: whose === "your" ? "Dosham differs from your preference" : "Your dosham differs from their preference",
    });
  }
  if (seeker.prefCities.length) {
    checks.push({
      met: seeker.prefCities.some((c) => same(c, other.city)),
      good: whose === "your" ? "Lives in a city you prefer" : "You live in a city they prefer",
      bad: whose === "your" ? "Not in your preferred cities" : "Not in their preferred cities",
    });
  }
  if (seeker.prefEducation) {
    checks.push({
      met: other.education.toLowerCase().includes(seeker.prefEducation.trim().toLowerCase()),
      good: whose === "your" ? "Education as you prefer" : "Your education suits them",
      bad: whose === "your" ? "Education differs from your preference" : "Your education differs from their preference",
    });
  }
  return checks;
}

/**
 * 0–100 compatibility between the viewer and another member: 35 points for how well the other
 * fits the viewer's preferences, 35 for the reverse, 10 for the gothram rule and 20 for porutham.
 * Preferences nobody has set count as neutral rather than as a match or a miss.
 */
export function matchScore(viewer: MatchProfile, other: MatchProfile): MatchResult {
  const reasons: string[] = [];
  const concerns: string[] = [];
  let score = 0;

  for (const [checks, whose] of [
    [preferenceChecks(viewer, other, "your"), "your"],
    [preferenceChecks(other, viewer, "their"), "their"],
  ] as const) {
    if (!checks.length) {
      score += 35 * 0.75;
      continue;
    }
    const met = checks.filter((c) => c.met);
    score += (35 * met.length) / checks.length;
    if (met.length === checks.length) reasons.push(whose === "your" ? "Fits all your preferences" : "You fit all their preferences");
    else met.slice(0, 2).forEach((c) => reasons.push(c.good));
    checks.filter((c) => !c.met).forEach((c) => concerns.push(c.bad));
  }

  if (viewer.gothram && other.gothram && same(viewer.gothram, other.gothram)) {
    concerns.push("Same gothram");
  } else {
    score += 10;
    if (viewer.gothram && other.gothram) reasons.push("Different gothram");
  }

  const [bride, groom] = viewer.gender === "FEMALE" ? [viewer, other] : [other, viewer];
  const report = porutham(bride, groom);
  if (report) {
    const share = report.score / report.total;
    score += 20 * share * (report.essentialOk ? 1 : 0.5);
    if (share >= 0.6 && report.essentialOk) reasons.push(`Porutham ${report.score}/${report.total}`);
    if (!report.essentialOk) concerns.push("Essential porutham missing");
    else if (share < 0.5) concerns.push(`Only ${report.score} of ${report.total} poruthams match`);
  } else {
    score += 12;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons: reasons.slice(0, 4), concerns: concerns.slice(0, 4) };
}
