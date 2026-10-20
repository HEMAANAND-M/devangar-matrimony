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
