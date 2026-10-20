import { Card, PageHeader } from "@/components/Card";

export const metadata = { title: "Safety guidelines" };

const SECTIONS: [string, string[]][] = [
  [
    "Before you connect",
    [
      "Read the full profile, including family and horoscope details, before sending an interest.",
      "Involve your family early. Most good matches are found when both families talk directly.",
      "Use the Report option on any profile that seems fake, misleading or inappropriate.",
    ],
  ],
  [
    "When you start talking",
    [
      "Never share bank details, OTPs, passwords or ID documents over chat or phone.",
      "Never send money to anyone you have met here, for any reason — emergencies, travel, visas or gifts.",
      "Verify details such as job, education and family background independently before making commitments.",
    ],
  ],
  [
    "Meeting in person",
    [
      "Meet first in a public place, preferably with family members present.",
      "Tell a family member where you are going and who you are meeting.",
      "Arrange your own travel and do not accept stays at the other person’s home on a first meeting.",
    ],
  ],
  [
    "How we protect you",
    [
      "Every mobile number is verified by OTP before a profile can be created.",
      "Every profile and photo is reviewed by our team before it is shown to other members.",
      "Contact numbers are revealed only after both sides accept an interest, and photos can be hidden until then.",
      "Reported profiles are reviewed and removed if they break our rules.",
    ],
  ],
];

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Trust & safety"
        title="Safety guidelines"
        subtitle="Simple practices that keep you and your family safe while you search."
      />
      <div className="space-y-6">
        {SECTIONS.map(([title, items]) => (
          <Card key={title} title={title}>
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-stone-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
