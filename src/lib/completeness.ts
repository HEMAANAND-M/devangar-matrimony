import type { Profile } from "@prisma/client";

type Extras = { horoscope?: boolean };

const CHECKS: [label: string, href: string, done: (p: Profile, photos: number, x: Extras) => boolean][] = [
  ["Add a photo", "/photos", (_, n) => n > 0],
  ["Write a few lines about yourself", "/profile/edit#about", (p) => (p.about?.length ?? 0) >= 50],
  ["Add your star and rasi", "/profile/edit#horoscope", (p) => !!p.star && !!p.rasi],
  ["Add gothram and kuladeivam", "/profile/edit#horoscope", (p) => !!p.gothram && !!p.kuladeivam],
  ["Add birth time and place", "/profile/edit#horoscope", (p) => !!p.birthTime && !!p.birthPlace],
  ["Upload your horoscope", "/profile/edit#horoscope-file", (_, __, x) => x.horoscope !== false],
  ["Add your height", "/profile/edit#basic", (p) => !!p.heightCm],
  ["Add family details", "/profile/edit#family", (p) => !!p.fatherOccupation && !!p.motherOccupation && !!p.siblings],
  ["Add native place and family type", "/profile/edit#family", (p) => !!p.nativePlace && !!p.familyType],
  ["Add diet and languages", "/profile/edit#lifestyle", (p) => !!p.diet && p.languages.length > 0],
  ["Set partner preferences", "/profile/edit#preferences", (p) => !!p.prefAgeMin && !!p.prefAgeMax],
  ["Add more photos", "/photos", (_, n) => n >= 3],
];

/**
 * Profile strength and the next things to add. Pass `extras.horoscope` when known; leaving it
 * out skips that check rather than counting it as missing.
 */
export function completeness(profile: Profile, photoCount: number, extras: Extras = {}) {
  const missing = CHECKS.filter(([, , done]) => !done(profile, photoCount, extras)).map(([label, href]) => ({ label, href }));
  // Required fields count as the first 40%; each optional check adds an equal share of the rest.
  const percent = Math.round(40 + (60 * (CHECKS.length - missing.length)) / CHECKS.length);
  return { percent, missing };
}
