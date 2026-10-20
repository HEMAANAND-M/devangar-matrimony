import type { Profile } from "@prisma/client";

const CHECKS: [label: string, href: string, done: (p: Profile, photos: number) => boolean][] = [
  ["Add a photo", "/photos", (_, n) => n > 0],
  ["Write a few lines about yourself", "/profile/edit", (p) => (p.about?.length ?? 0) >= 50],
  ["Add your star and rasi", "/profile/edit", (p) => !!p.star && !!p.rasi],
  ["Add gothram and kuladeivam", "/profile/edit", (p) => !!p.gothram && !!p.kuladeivam],
  ["Add birth time and place", "/profile/edit", (p) => !!p.birthTime && !!p.birthPlace],
  ["Add your height", "/profile/edit", (p) => !!p.heightCm],
  ["Add family details", "/profile/edit", (p) => !!p.fatherOccupation && !!p.motherOccupation && !!p.siblings],
  ["Set partner preferences", "/profile/edit", (p) => !!p.prefAgeMin && !!p.prefAgeMax],
  ["Add more photos", "/photos", (_, n) => n >= 3],
];

export function completeness(profile: Profile, photoCount: number) {
  const missing = CHECKS.filter(([, , done]) => !done(profile, photoCount)).map(([label, href]) => ({ label, href }));
  // Required fields count as the first 40%; each optional check adds an equal share of the rest.
  const percent = Math.round(40 + (60 * (CHECKS.length - missing.length)) / CHECKS.length);
  return { percent, missing };
}
