export function ageFrom(dob: Date, now = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** Date of birth bounds for an inclusive age range, for DB filtering. */
export function dobRangeForAges(minAge: number, maxAge: number, now = new Date()) {
  const latest = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
  const earliest = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate() + 1);
  return { gte: earliest, lte: latest };
}

export function heightLabel(cm: number | null | undefined): string | null {
  if (!cm) return null;
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}ft ${totalIn % 12}in (${cm} cm)`;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}
