/**
 * Detects contact details in free text. Sharing these in a profile bypasses the
 * accept-before-contact rule, so the profile form rejects them.
 */
const PATTERNS: [RegExp, string][] = [
  [/(?:\+?\d[\s\-.()]*){10,}/, "phone numbers"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, "email addresses"],
  [/\b(?:https?:\/\/|www\.)\S+/i, "website links"],
  [/\b(?:whats\s?app|telegram|insta(?:gram)?|facebook|fb\.com|snapchat|signal)\b/i, "social media handles"],
];

export function findContactInfo(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const [re, label] of PATTERNS) if (re.test(text)) return label;
  return null;
}

/**
 * Phrases common in matrimony fraud (money requests, "stuck at customs" gifts, investment pitches).
 * Messages are still delivered; the recipient sees a safety tip and the sender is flagged for staff.
 */
const SCAM_PATTERNS = [
  /\b(?:send|transfer|lend|loan|need|pay)\b[^.?!]{0,40}\b(?:money|rs\.?|rupees|₹|inr|amount|cash|fees?)\b/i,
  /\b(?:upi|gpay|google\s?pay|phonepe|paytm|bank\s+(?:account|details)|ifsc)\b/i,
  /\b(?:customs?|courier|parcel)\b[^.?!]{0,40}\b(?:fee|charges?|clearance|release|stuck|held)\b/i,
  /\b(?:crypto|bitcoin|forex|trading\s+(?:app|platform|account)|double\s+your|investment\s+(?:plan|opportunity))\b/i,
  /\b(?:gift\s+card|western\s+union|moneygram)\b/i,
];

export function looksLikeScam(text: string | null | undefined): boolean {
  return !!text && SCAM_PATTERNS.some((re) => re.test(text));
}
