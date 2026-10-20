import Link from "next/link";
import { acceptFamilyInvite, declineFamilyInvite } from "@/app/actions/family";
import { saveProfile } from "@/app/actions/profile";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { SelectField, TextArea, TextField } from "@/components/fields";
import {
  DOSHAM_LABELS, MARITAL_STATUS_LABELS, MOTHER_TONGUES, PROFILE_FOR_LABELS, RASIS, STARS,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "My profile" };

export default async function EditProfilePage() {
  const user = await requireUser();
  const p = user.profile;
  const v = (x: string | number | null | undefined) => (x == null ? undefined : String(x));
  // Someone without a profile may have been invited to manage a family member's profile instead.
  const invites = p
    ? []
    : await db.familyInvite.findMany({
        where: { phone: user.phone, expiresAt: { gt: new Date() } },
        include: { profile: { select: { name: true, code: true } } },
      });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={p ? `Profile ID ${p.code} · ${p.status.toLowerCase()}` : "Step 3 of 4"}
        title={p ? "Edit profile" : "Create your profile"}
        subtitle="A complete, honest profile helps families decide with confidence."
        action={p && <Link href="/photos" className="rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon transition hover:bg-gold-light/30">Manage photos</Link>}
      />
      {invites.map((i) => (
        <section key={i.id} className="rounded-2xl border border-gold bg-gradient-to-br from-white to-cream p-6 shadow-soft">
          <p className="eyebrow text-gold-dark">Family invitation</p>
          <h2 className="mt-1 text-2xl text-maroon">Manage {i.profile.name}’s profile?</h2>
          <p className="mt-2 text-sm text-stone-600">
            {i.profile.name} ({i.profile.code}) invited you as their {i.relation.toLowerCase()}. You’ll be able to search,
            send and accept interests for them with your own login.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={acceptFamilyInvite.bind(null, i.id)}>
              <button className="rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">Accept invitation</button>
            </form>
            <form action={declineFamilyInvite.bind(null, i.id)}>
              <button className="rounded-full border border-hairline px-6 py-2.5 text-sm text-stone-700 hover:border-gold">Decline</button>
            </form>
          </div>
          <p className="mt-4 text-xs text-stone-500">Or ignore this and create your own profile below.</p>
        </section>
      ))}
      {p?.status === "REJECTED" && p.rejectionReason && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your profile needs changes: {p.rejectionReason}
        </p>
      )}

      <ActionForm action={saveProfile} className="space-y-6">
        <Card title="Basic details">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Profile created for" name="profileFor" options={PROFILE_FOR_LABELS} defaultValue={p?.profileFor} required />
            <TextField label="Full name" name="name" defaultValue={p?.name} required maxLength={80} />
            <SelectField label="Gender" name="gender" options={{ MALE: "Male (groom)", FEMALE: "Female (bride)" }} defaultValue={p?.gender} required />
            <TextField label="Date of birth" name="dateOfBirth" type="date" defaultValue={p?.dateOfBirth.toISOString().slice(0, 10)} required />
            <SelectField label="Marital status" name="maritalStatus" options={MARITAL_STATUS_LABELS} defaultValue={p?.maritalStatus} required />
            <TextField label="Height (cm)" name="heightCm" type="number" min={120} max={230} defaultValue={v(p?.heightCm)} />
            <SelectField label="Mother tongue" name="motherTongue" options={MOTHER_TONGUES} defaultValue={p?.motherTongue} required />
            <TextField label="Sub-sect" name="subSect" defaultValue={v(p?.subSect)} hint="Optional, as your family identifies" />
          </div>
        </Card>

        <Card title="Community & horoscope">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Gothram" name="gothram" defaultValue={v(p?.gothram)} />
            <TextField label="Kuladeivam" name="kuladeivam" defaultValue={v(p?.kuladeivam)} />
            <SelectField label="Star (nakshatra)" name="star" options={STARS} defaultValue={p?.star} />
            <SelectField label="Rasi" name="rasi" options={RASIS} defaultValue={p?.rasi} />
            <SelectField label="Dosham" name="dosham" options={DOSHAM_LABELS} defaultValue={p?.dosham ?? "DONT_KNOW"} required />
            <TextField label="Place of birth" name="birthPlace" defaultValue={v(p?.birthPlace)} />
            <TextField label="Time of birth" name="birthTime" type="time" defaultValue={v(p?.birthTime)} />
          </div>
        </Card>

        <Card title="Education, career & location">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Education" name="education" defaultValue={p?.education} required placeholder="e.g. B.E. Computer Science" />
            <TextField label="Occupation" name="occupation" defaultValue={p?.occupation} required placeholder="e.g. Software engineer" />
            <TextField label="Annual income" name="annualIncome" defaultValue={v(p?.annualIncome)} placeholder="e.g. 6–8 lakhs" />
            <TextField label="City" name="city" defaultValue={p?.city} required />
            <TextField label="State" name="state" defaultValue={p?.state ?? "Tamil Nadu"} required />
            <TextField label="Country" name="country" defaultValue={p?.country ?? "India"} required />
          </div>
        </Card>

        <Card title="Family & about">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Father's occupation" name="fatherOccupation" defaultValue={v(p?.fatherOccupation)} />
            <TextField label="Mother's occupation" name="motherOccupation" defaultValue={v(p?.motherOccupation)} />
            <div className="sm:col-span-2">
              <TextField label="Siblings" name="siblings" defaultValue={v(p?.siblings)} placeholder="e.g. 1 elder sister (married)" />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="About" name="about" defaultValue={v(p?.about)} maxLength={1500} hint="Do not include phone numbers or email addresses here." />
            </div>
          </div>
        </Card>

        <Card title="Partner preferences">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Preferred age from" name="prefAgeMin" type="number" min={18} max={80} defaultValue={v(p?.prefAgeMin)} />
            <TextField label="Preferred age to" name="prefAgeMax" type="number" min={18} max={80} defaultValue={v(p?.prefAgeMax)} />
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-stone-700">Acceptable marital status</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="prefMaritalStatus" value={value} defaultChecked={p ? p.prefMaritalStatus.includes(value as never) : value === "NEVER_MARRIED"} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <TextArea label="Other expectations" name="prefNotes" defaultValue={v(p?.prefNotes)} maxLength={500} />
            </div>
          </div>
        </Card>

        <Card title="Privacy">
          <SelectField
            label="Who can see my photos"
            name="photoVisibility"
            options={{ ALL_MEMBERS: "All registered members", ACCEPTED_ONLY: "Only members whose interest I accept" }}
            defaultValue={p?.photoVisibility ?? "ALL_MEMBERS"}
            required
          />
        </Card>

        <SubmitButton className="w-full py-3">{p ? "Save changes" : "Create profile"}</SubmitButton>
      </ActionForm>
    </div>
  );
}
