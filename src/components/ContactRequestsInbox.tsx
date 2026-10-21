import Link from "next/link";
import { respondContact } from "@/app/actions/contact";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { ageFrom } from "@/lib/format";
import { featureEnabled } from "@/lib/settings";
import { ActionForm, SubmitButton } from "./ActionForm";
import { Card } from "./Card";

/** Phone-number requests received by a member, with approve / decline. Placed on the interests page. */
export async function ContactRequestsInbox({ profileId }: { profileId: string }) {
  if (!(await featureEnabled("contactRequests"))) return null;
  const requests = await db.contactRequest.findMany({
    where: { toId: profileId, status: "PENDING" },
    include: { from: { select: { name: true, code: true, dateOfBirth: true, city: true, occupation: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!requests.length) return null;
  const t = await getT();

  return (
    <Card title={t("contact.inboxTitle", { count: requests.length })}>
      <p className="-mt-2 mb-4 text-sm text-stone-600">{t("contact.inboxBody")}</p>
      <ul className="divide-y divide-hairline">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-sm">
              <Link href={`/profiles/${r.from.code}`} className="font-semibold text-maroon hover:underline">
                {r.from.name} ({r.from.code})
              </Link>
              <p className="text-stone-600">{t("common.yrs", { age: ageFrom(r.from.dateOfBirth) })} · {r.from.occupation} · {r.from.city}</p>
            </div>
            <div className="flex gap-2">
              <ActionForm action={respondContact.bind(null, r.id, true)}>
                <SubmitButton className="!px-4 !py-1.5">{t("contact.share")}</SubmitButton>
              </ActionForm>
              <ActionForm action={respondContact.bind(null, r.id, false)}>
                <SubmitButton variant="secondary" className="!px-4 !py-1.5">{t("contact.decline")}</SubmitButton>
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
