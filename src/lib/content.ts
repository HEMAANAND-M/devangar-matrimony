import "server-only";
import { getSetting } from "./settings";

export type Faq = { q: string; a: string };
export type Testimonial = { quote: string; names: string; city?: string };
export type SafetySection = { title: string; items: string[] };

export const DEFAULT_FAQ: Faq[] = [
  {
    q: "Who can register on Devangar Matrimony?",
    a: "Members of the Devangar (Devanga) community looking for a life partner, or parents and relatives creating a profile on their behalf. Every mobile number is verified by OTP.",
  },
  {
    q: "Is registration free?",
    a: "Yes. Creating a profile, searching and sending a limited number of interests every day is free. Premium membership unlocks contact numbers, more daily interests and chat.",
  },
  {
    q: "Who can see my phone number and photos?",
    a: "Your phone number is shown only to members whose interest you have accepted. You can choose to show photos to all members or only to members you have accepted.",
  },
  {
    q: "How are profiles verified?",
    a: "Our team reviews every profile and photo before it goes live. Members can also verify their identity with a government ID and a selfie to earn verified badges.",
  },
  {
    q: "Can my parents manage my profile?",
    a: "Yes. From Settings you can invite up to two family members, who can search, send interests and reply on your behalf with their own login.",
  },
  {
    q: "How do I hide or delete my profile?",
    a: "You can hide your profile from search at any time from your dashboard, or permanently delete your account from Settings.",
  },
];

export const DEFAULT_SAFETY: SafetySection[] = [
  {
    title: "Before you connect",
    items: [
      "Read the full profile, including family and horoscope details, before sending an interest.",
      "Involve your family early. Most good matches are found when both families talk directly.",
      "Use the Report option on any profile that seems fake, misleading or inappropriate.",
    ],
  },
  {
    title: "When you start talking",
    items: [
      "Never share bank details, OTPs, passwords or ID documents over chat or phone.",
      "Never send money to anyone you have met here, for any reason — emergencies, travel, visas or gifts.",
      "Verify details such as job, education and family background independently before making commitments.",
    ],
  },
  {
    title: "Meeting in person",
    items: [
      "Meet first in a public place, preferably with family members present.",
      "Tell a family member where you are going and who you are meeting.",
      "Arrange your own travel and do not accept stays at the other person’s home on a first meeting.",
    ],
  },
  {
    title: "How we protect you",
    items: [
      "Every mobile number is verified by OTP before a profile can be created.",
      "Every profile and photo is reviewed by our team before it is shown to other members.",
      "Contact numbers are revealed only after both sides accept an interest, and photos can be hidden until then.",
      "Reported profiles are reviewed and removed if they break our rules.",
    ],
  },
];

export const getFaq = () => getSetting<Faq[]>("content.faq", DEFAULT_FAQ);
export const getSafety = () => getSetting<SafetySection[]>("content.safety", DEFAULT_SAFETY);
/** No defaults: testimonials are only shown once real families have given them. */
export const getTestimonials = () => getSetting<Testimonial[]>("content.testimonials", []);

/** Safety page text format: "## Section title" lines start a section, other lines are its points. */
export function parseSafety(text: string): SafetySection[] {
  const sections: SafetySection[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) sections.push({ title: line.replace(/^#+\s*/, "").slice(0, 80), items: [] });
    else {
      if (!sections.length) sections.push({ title: "Safety", items: [] });
      sections[sections.length - 1].items.push(line.replace(/^[-*•]\s*/, "").slice(0, 400));
    }
  }
  return sections.filter((s) => s.items.length);
}

export const formatSafety = (sections: SafetySection[]) =>
  sections.map((s) => [`## ${s.title}`, ...s.items.map((i) => `- ${i}`)].join("\n")).join("\n\n");
