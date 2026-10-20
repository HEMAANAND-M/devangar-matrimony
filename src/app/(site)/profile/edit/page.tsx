import Link from "next/link";
import { acceptFamilyInvite, declineFamilyInvite } from "@/app/actions/family";
import { deleteHoroscope, saveProfile, uploadHoroscope } from "@/app/actions/profile";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/Card";
import { ChoiceField } from "@/components/ChoiceField";
import { CheckboxGroup, SelectField, TextArea, TextField } from "@/components/fields";
import { RasiChart } from "@/components/RasiChart";
import { completeness } from "@/lib/completeness";
import {
  COMPLEXION_OPTIONS, DIET_OPTIONS, DOSHAM_LABELS, FAMILY_STATUS_OPTIONS, FAMILY_TYPE_OPTIONS, LANGUAGES,
  MARITAL_STATUS_LABELS, MOTHER_TONGUES, PROFILE_FOR_LABELS, RASIS, STARS,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { horoscopeInfo } from "@/lib/horoscope";
import { getLists } from "@/lib/lists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "My profile" };

const SECTIONS = [
  ["basic", "Basic details"],
  ["horoscope", "Community & horoscope"],
  ["career", "Education & career"],
  ["family", "Family"],
  ["lifestyle", "Lifestyle"],
  ["about", "About"],
  ["preferences", "Partner preferences"],
  ["privacy", "Privacy"],
] as const;

const VISIBILITY = { ALL_MEMBERS: "All registered members", ACCEPTED_ONLY: "Only members whose interest I accept" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28">
      <Card title={title}>{children}</Card>
    </div>
  );
}

export default async function EditProfilePage() {
  const user = await requireUser();
  const p = user.profile;
  const v = (x: string | number | null | undefined) => (x == null ? undefined : String(x));
  // Someone without a profile may have been invited to manage a family member's profile instead.
  const [invites, lists, horoscope, photoCount] = await Promise.all([
    p
      ? []
      : db.familyInvite.findMany({
          where: { phone: user.phone, expiresAt: { gt: new Date() } },
          include: { profile: { select: { name: true, code: true } } },
        }),
    getLists(),
    p ? horoscopeInfo(p.id) : null,
    p ? db.photo.count({ where: { profileId: p.id } }) : 0,
  ]);
  const strength = p ? completeness(p, photoCount, { horoscope: !!horoscope }) : null;
  const otherCities = p?.prefCities.filter((c) => !lists.cities.includes(c)) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={p ? `Profile ID ${p.code} · ${p.status.toLowerCase()}` : "Step 3 of 4"}
        title={p ? "Edit profile" : "Create your profile"}
        subtitle="A complete, honest profile helps families decide with confidence."
        action={p && <Link href="/photos" className="rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon transition hover:bg-gold-light/30">Manage photos</Link>}
      />

      <div className="grid gap-8 lg:grid-cols-[210px_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="Profile sections" className="sticky top-24 space-y-5">
            {strength && (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow text-gold-dark">Strength</p>
                  <p className="font-display text-xl font-semibold text-maroon">{strength.percent}%</p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold to-maroon" style={{ width: `${strength.percent}%` }} />
                </div>
              </div>
            )}
            <ul className="space-y-0.5 border-l border-hairline text-sm">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-stone-600 transition hover:border-gold hover:text-maroon">{label}</a>
                </li>
              ))}
              {p && (
                <li>
                  <a href="#horoscope-file" className="-ml-px block border-l border-transparent py-1.5 pl-4 text-stone-600 transition hover:border-gold hover:text-maroon">Horoscope file</a>
                </li>
              )}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
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

          {strength && strength.missing.length > 0 && (
            <section className="rounded-2xl border border-gold/40 bg-gradient-to-br from-white to-cream p-5 shadow-soft">
              <p className="eyebrow text-gold-dark">Add next</p>
              <p className="mt-1 text-sm text-stone-600">Profiles with these details receive noticeably more interests.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {strength.missing.slice(0, 5).map((m) => (
                  <li key={m.label}>
                    <a href={m.href.replace("/profile/edit", "")} className="inline-block rounded-full border border-gold/50 bg-white px-3.5 py-1.5 text-xs text-maroon transition hover:bg-gold-light/40">
                      + {m.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <datalist id="education-options">{lists.education.map((e) => <option key={e} value={e} />)}</datalist>
          <datalist id="occupation-options">{lists.occupations.map((e) => <option key={e} value={e} />)}</datalist>

          <ActionForm action={saveProfile} className="space-y-6">
            <Section id="basic" title="Basic details">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Profile created for" name="profileFor" options={PROFILE_FOR_LABELS} defaultValue={p?.profileFor} required />
                <TextField label="Full name" name="name" defaultValue={p?.name} required maxLength={80} />
                <SelectField label="Gender" name="gender" options={{ MALE: "Male (groom)", FEMALE: "Female (bride)" }} defaultValue={p?.gender} required />
                <TextField label="Date of birth" name="dateOfBirth" type="date" defaultValue={p?.dateOfBirth.toISOString().slice(0, 10)} required />
                <SelectField label="Marital status" name="maritalStatus" options={MARITAL_STATUS_LABELS} defaultValue={p?.maritalStatus} required />
                <TextField label="Height (cm)" name="heightCm" type="number" min={120} max={230} defaultValue={v(p?.heightCm)} />
                <SelectField label="Mother tongue" name="motherTongue" options={MOTHER_TONGUES} defaultValue={p?.motherTongue} required />
                <ChoiceField label="Sub-sect" name="subSect" options={lists.subSects} defaultValue={p?.subSect} hint="As your family identifies" />
              </div>
            </Section>

            <Section id="horoscope" title="Community & horoscope">
              <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceField label="Gothram" name="gothram" options={lists.gothrams} defaultValue={p?.gothram} />
                <TextField label="Kuladeivam" name="kuladeivam" defaultValue={v(p?.kuladeivam)} />
                <SelectField label="Star (nakshatra)" name="star" options={STARS} defaultValue={p?.star} />
                <SelectField label="Rasi (moon sign)" name="rasi" options={RASIS} defaultValue={p?.rasi} />
                <SelectField label="Lagnam (ascendant)" name="lagnam" options={RASIS} defaultValue={p?.lagnam} />
                <SelectField label="Dosham" name="dosham" options={DOSHAM_LABELS} defaultValue={p?.dosham ?? "DONT_KNOW"} required />
                <TextField label="Place of birth" name="birthPlace" defaultValue={v(p?.birthPlace)} />
                <TextField label="Time of birth" name="birthTime" type="time" defaultValue={v(p?.birthTime)} />
              </div>
            </Section>

            <Section id="career" title="Education, career & location">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Education" name="education" list="education-options" defaultValue={p?.education} required placeholder="e.g. B.E. Computer Science" />
                <TextField label="Occupation" name="occupation" list="occupation-options" defaultValue={p?.occupation} required placeholder="e.g. Software engineer" />
                <TextField label="Annual income" name="annualIncome" defaultValue={v(p?.annualIncome)} placeholder="e.g. 6–8 lakhs" />
                <ChoiceField label="City" name="city" options={lists.cities} defaultValue={p?.city} required />
                <TextField label="State" name="state" defaultValue={p?.state ?? "Tamil Nadu"} required />
                <TextField label="Country" name="country" defaultValue={p?.country ?? "India"} required />
              </div>
            </Section>

            <Section id="family" title="Family">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Father's name" name="fatherName" defaultValue={v(p?.fatherName)} maxLength={80} />
                <TextField label="Father's occupation" name="fatherOccupation" defaultValue={v(p?.fatherOccupation)} />
                <TextField label="Mother's name" name="motherName" defaultValue={v(p?.motherName)} maxLength={80} />
                <TextField label="Mother's occupation" name="motherOccupation" defaultValue={v(p?.motherOccupation)} />
                <SelectField label="Family type" name="familyType" options={FAMILY_TYPE_OPTIONS} defaultValue={p?.familyType} />
                <SelectField label="Family status" name="familyStatus" options={FAMILY_STATUS_OPTIONS} defaultValue={p?.familyStatus} />
                <TextField label="Native place" name="nativePlace" defaultValue={v(p?.nativePlace)} placeholder="e.g. Somanur, Coimbatore" maxLength={80} />
                <TextField label="Siblings" name="siblings" defaultValue={v(p?.siblings)} placeholder="e.g. 1 elder sister (married)" />
              </div>
            </Section>

            <Section id="lifestyle" title="Lifestyle">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Diet" name="diet" options={DIET_OPTIONS} defaultValue={p?.diet} />
                <SelectField label="Complexion" name="complexion" options={COMPLEXION_OPTIONS} defaultValue={p?.complexion} />
                <div className="sm:col-span-2">
                  <CheckboxGroup label="Languages spoken" name="languages" options={LANGUAGES} defaultValues={p?.languages} columns={4} />
                </div>
              </div>
            </Section>

            <Section id="about" title="About">
              <TextArea label="About" name="about" defaultValue={v(p?.about)} maxLength={1500} rows={5} hint="A few lines about yourself and your family. Do not include phone numbers or email addresses." />
            </Section>

            <Section id="preferences" title="Partner preferences">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Preferred age from" name="prefAgeMin" type="number" min={18} max={80} defaultValue={v(p?.prefAgeMin)} />
                <TextField label="Preferred age to" name="prefAgeMax" type="number" min={18} max={80} defaultValue={v(p?.prefAgeMax)} />
                <div className="sm:col-span-2">
                  <CheckboxGroup
                    label="Acceptable marital status"
                    name="prefMaritalStatus"
                    options={MARITAL_STATUS_LABELS}
                    defaultValues={p ? p.prefMaritalStatus : ["NEVER_MARRIED"]}
                    columns={4}
                  />
                </div>
                <SelectField
                  label="Dosham"
                  name="prefDosham"
                  options={{ NO: "Prefer no dosham", YES: "Prefer dosham (to match mine)" }}
                  defaultValue={p?.prefDosham === "DONT_KNOW" ? null : p?.prefDosham}
                  placeholder="No preference"
                />
                <TextField label="Education contains" name="prefEducation" defaultValue={v(p?.prefEducation)} placeholder="e.g. Engineering" maxLength={80} />
                <div className="sm:col-span-2">
                  <input type="hidden" name="prefExcludeOwnGothram" value="0" />
                  <label className="flex items-start gap-2.5 text-sm text-stone-700">
                    <input type="checkbox" name="prefExcludeOwnGothram" value="1" defaultChecked={p?.prefExcludeOwnGothram ?? true} className="mt-0.5 h-4 w-4 accent-maroon" />
                    <span>
                      Exclude my own gothram
                      <span className="block text-xs text-stone-500">Same-gothram alliances are traditionally avoided. Applied to matches and search by default.</span>
                    </span>
                  </label>
                </div>
                <details className="rounded-xl border border-hairline px-4 py-3 sm:col-span-2" open={!!p?.prefStars.length}>
                  <summary className="cursor-pointer text-sm font-medium text-maroon">
                    Preferred stars {p?.prefStars.length ? `(${p.prefStars.length} selected)` : "(any)"}
                  </summary>
                  <div className="mt-3">
                    <CheckboxGroup label="Leave all unticked for no preference" name="prefStars" options={STARS} defaultValues={p?.prefStars} />
                  </div>
                </details>
                <details className="rounded-xl border border-hairline px-4 py-3 sm:col-span-2" open={!!p?.prefCities.length}>
                  <summary className="cursor-pointer text-sm font-medium text-maroon">
                    Preferred cities {p?.prefCities.length ? `(${p.prefCities.length} selected)` : "(any)"}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <CheckboxGroup label="Leave all unticked for no preference" name="prefCities" options={lists.cities} defaultValues={p?.prefCities} />
                    <TextField label="Other cities" name="prefCitiesOther" defaultValue={otherCities.join(", ")} placeholder="Separate with commas" maxLength={300} />
                  </div>
                </details>
                <div className="sm:col-span-2">
                  <TextArea label="Other expectations" name="prefNotes" defaultValue={v(p?.prefNotes)} maxLength={500} />
                </div>
              </div>
            </Section>

            <Section id="privacy" title="Privacy">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Who can see my photos" name="photoVisibility" options={VISIBILITY} defaultValue={p?.photoVisibility ?? "ALL_MEMBERS"} required />
                <SelectField label="Who can see my horoscope file" name="horoscopeVisibility" options={VISIBILITY} defaultValue={p?.horoscopeVisibility ?? "ACCEPTED_ONLY"} required />
              </div>
            </Section>

            <div className="sticky bottom-3 z-10 rounded-full bg-cream/80 p-1 backdrop-blur">
              <SubmitButton className="w-full py-3">{p ? "Save changes" : "Create profile"}</SubmitButton>
            </div>
          </ActionForm>

          {p && (
            <div id="horoscope-file" className="scroll-mt-28">
              <Card title="Horoscope (jathagam)">
                <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-4">
                    {horoscope ? (
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm">
                        <span className="text-emerald-800">✓ {horoscope.mime === "application/pdf" ? "PDF" : "Image"} uploaded {dateOnly(horoscope.uploadedAt)}</span>
                        <a href={`/api/horoscope/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-maroon underline decoration-gold/50 underline-offset-4">View</a>
                        <ActionForm action={deleteHoroscope} confirm="Remove your horoscope file?">
                          <button type="submit" className="text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-red-700">Remove</button>
                        </ActionForm>
                      </div>
                    ) : (
                      <p className="text-sm text-stone-600">Families often ask for the horoscope before talking. Upload it once and share it on your terms.</p>
                    )}
                    <ActionForm action={uploadHoroscope} className="space-y-3">
                      <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
                        {horoscope ? "Replace file" : "Horoscope file"}
                        <input
                          type="file"
                          name="horoscope"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          required
                          className="mt-1.5 block w-full text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-maroon file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-maroon-dark"
                        />
                        <span className="mt-1.5 block text-xs font-normal text-stone-500">PDF, JPEG, PNG or WebP, up to 5 MB. Photos of the horoscope are re-saved without location data.</span>
                      </label>
                      <SubmitButton variant="secondary">Upload</SubmitButton>
                    </ActionForm>
                    <p className="text-xs text-stone-500">
                      Visible to: {VISIBILITY[p.horoscopeVisibility].toLowerCase()} — change this under <a href="#privacy" className="underline">Privacy</a>.
                    </p>
                  </div>
                  <RasiChart rasi={p.rasi} lagnam={p.lagnam} />
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
