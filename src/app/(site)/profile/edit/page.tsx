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
import { type TKey, getT, getTx } from "@/lib/i18n";
import { getLists } from "@/lib/lists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "My profile" };

const SECTIONS = [
  ["basic", "pe.sec.basic"],
  ["horoscope", "pe.sec.horoscope"],
  ["career", "pe.sec.career"],
  ["family", "pe.sec.family"],
  ["lifestyle", "pe.sec.lifestyle"],
  ["about", "pe.sec.about"],
  ["preferences", "pe.sec.preferences"],
  ["privacy", "pe.sec.privacy"],
] as const;

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
          where: { phoneHash: user.phoneHash, expiresAt: { gt: new Date() } },
          include: { profile: { select: { name: true, code: true } } },
        }),
    getLists(),
    p ? horoscopeInfo(p.id) : null,
    p ? db.photo.count({ where: { profileId: p.id } }) : 0,
  ]);
  const strength = p ? completeness(p, photoCount, { horoscope: !!horoscope }) : null;
  const otherCities = p?.prefCities.filter((c) => !lists.cities.includes(c)) ?? [];
  const [t, tx] = await Promise.all([getT(), getTx()]);
  const VISIBILITY = { ALL_MEMBERS: t("pe.visibility.all"), ACCEPTED_ONLY: t("pe.visibility.accepted") };
  const translated = (options: string[] | Record<string, string>) =>
    Object.fromEntries((Array.isArray(options) ? options.map((o) => [o, o]) : Object.entries(options)).map(([k, val]) => [k, tx(val)]));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={p ? t("pe.eyebrowEdit", { code: p.code, status: t(`pe.status.${p.status.toLowerCase()}` as TKey) }) : t("pe.eyebrowNew")}
        title={t(p ? "pe.titleEdit" : "pe.titleNew")}
        subtitle={t("pe.subtitle")}
        action={p && <Link href="/photos" className="rounded-full border border-gold/60 px-5 py-2 text-sm text-maroon transition hover:bg-gold-light/30">{t("pe.managePhotos")}</Link>}
      />

      <div className="grid gap-8 lg:grid-cols-[210px_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label={t("pe.sectionsNav")} className="sticky top-24 space-y-5">
            {strength && (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow text-gold-dark">{t("pe.strength")}</p>
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
                  <a href={`#${id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-stone-600 transition hover:border-gold hover:text-maroon">{t(label)}</a>
                </li>
              ))}
              {p && (
                <li>
                  <a href="#horoscope-file" className="-ml-px block border-l border-transparent py-1.5 pl-4 text-stone-600 transition hover:border-gold hover:text-maroon">{t("pe.horoscopeFile")}</a>
                </li>
              )}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          {invites.map((i) => (
            <section key={i.id} className="rounded-2xl border border-gold bg-gradient-to-br from-white to-cream p-6 shadow-soft">
              <p className="eyebrow text-gold-dark">{t("pe.inviteEyebrow")}</p>
              <h2 className="mt-1 text-2xl text-maroon">{t("pe.inviteTitle", { name: i.profile.name })}</h2>
              <p className="mt-2 text-sm text-stone-600">
                {t("pe.inviteBody", { name: i.profile.name, code: i.profile.code, relation: tx(i.relation.charAt(0) + i.relation.slice(1).toLowerCase()).toLowerCase() })}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={acceptFamilyInvite.bind(null, i.id)}>
                  <button className="rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-maroon-dark">{t("pe.acceptInvite")}</button>
                </form>
                <form action={declineFamilyInvite.bind(null, i.id)}>
                  <button className="rounded-full border border-hairline px-6 py-2.5 text-sm text-stone-700 hover:border-gold">{t("pe.declineInvite")}</button>
                </form>
              </div>
              <p className="mt-4 text-xs text-stone-500">{t("pe.orIgnore")}</p>
            </section>
          ))}
          {p?.status === "REJECTED" && p.rejectionReason && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {t("pe.needsChanges", { reason: p.rejectionReason })}
            </p>
          )}

          {strength && strength.missing.length > 0 && (
            <section className="rounded-2xl border border-gold/40 bg-gradient-to-br from-white to-cream p-5 shadow-soft">
              <p className="eyebrow text-gold-dark">{t("pe.addNext")}</p>
              <p className="mt-1 text-sm text-stone-600">{t("pe.addNextBody")}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {strength.missing.slice(0, 5).map((m) => (
                  <li key={m.label}>
                    <a href={m.href.replace("/profile/edit", "")} className="inline-block rounded-full border border-gold/50 bg-white px-3.5 py-1.5 text-xs text-maroon transition hover:bg-gold-light/40">
                      + {tx(m.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <datalist id="education-options">{lists.education.map((e) => <option key={e} value={e} />)}</datalist>
          <datalist id="occupation-options">{lists.occupations.map((e) => <option key={e} value={e} />)}</datalist>

          <ActionForm action={saveProfile} className="space-y-6">
            <Section id="basic" title={t("pe.sec.basic")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label={t("pe.profileFor")} name="profileFor" options={translated(PROFILE_FOR_LABELS)} defaultValue={p?.profileFor} required />
                <TextField label={t("pe.fullName")} name="name" defaultValue={p?.name} required maxLength={80} />
                <SelectField label={t("pe.gender")} name="gender" options={{ MALE: t("pe.male"), FEMALE: t("pe.female") }} defaultValue={p?.gender} required />
                <TextField label={t("pe.dob")} name="dateOfBirth" type="date" defaultValue={p?.dateOfBirth.toISOString().slice(0, 10)} required />
                <SelectField label={t("pe.maritalStatus")} name="maritalStatus" options={translated(MARITAL_STATUS_LABELS)} defaultValue={p?.maritalStatus} required />
                <TextField label={t("pe.height")} name="heightCm" type="number" min={120} max={230} defaultValue={v(p?.heightCm)} />
                <SelectField label={t("pe.motherTongue")} name="motherTongue" options={translated(MOTHER_TONGUES)} defaultValue={p?.motherTongue} required />
                <ChoiceField label={t("pe.subSect")} name="subSect" options={lists.subSects} defaultValue={p?.subSect} hint={t("pe.subSectHint")} />
              </div>
            </Section>

            <Section id="horoscope" title={t("pe.sec.horoscope")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceField label={t("pe.gothram")} name="gothram" options={lists.gothrams} defaultValue={p?.gothram} />
                <TextField label={t("pe.kuladeivam")} name="kuladeivam" defaultValue={v(p?.kuladeivam)} />
                <SelectField label={t("pe.star")} name="star" options={translated(STARS)} defaultValue={p?.star} />
                <SelectField label={t("pe.rasi")} name="rasi" options={translated(RASIS)} defaultValue={p?.rasi} />
                <SelectField label={t("pe.lagnam")} name="lagnam" options={translated(RASIS)} defaultValue={p?.lagnam} />
                <SelectField label={t("pe.dosham")} name="dosham" options={translated(DOSHAM_LABELS)} defaultValue={p?.dosham ?? "DONT_KNOW"} required />
                <TextField label={t("pe.birthPlace")} name="birthPlace" defaultValue={v(p?.birthPlace)} />
                <TextField label={t("pe.birthTime")} name="birthTime" type="time" defaultValue={v(p?.birthTime)} />
              </div>
            </Section>

            <Section id="career" title={t("pe.sec.careerFull")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("pe.education")} name="education" list="education-options" defaultValue={p?.education} required placeholder={t("pe.educationPh")} />
                <TextField label={t("pe.occupation")} name="occupation" list="occupation-options" defaultValue={p?.occupation} required placeholder={t("pe.occupationPh")} />
                <TextField label={t("pe.income")} name="annualIncome" defaultValue={v(p?.annualIncome)} placeholder={t("pe.incomePh")} />
                <ChoiceField label={t("pe.city")} name="city" options={lists.cities} defaultValue={p?.city} required />
                <TextField label={t("pe.state")} name="state" defaultValue={p?.state ?? "Tamil Nadu"} required />
                <TextField label={t("pe.country")} name="country" defaultValue={p?.country ?? "India"} required />
              </div>
            </Section>

            <Section id="family" title={t("pe.sec.family")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("pe.fatherName")} name="fatherName" defaultValue={v(p?.fatherName)} maxLength={80} />
                <TextField label={t("pe.fatherOcc")} name="fatherOccupation" defaultValue={v(p?.fatherOccupation)} />
                <TextField label={t("pe.motherName")} name="motherName" defaultValue={v(p?.motherName)} maxLength={80} />
                <TextField label={t("pe.motherOcc")} name="motherOccupation" defaultValue={v(p?.motherOccupation)} />
                <SelectField label={t("pe.familyType")} name="familyType" options={translated(FAMILY_TYPE_OPTIONS)} defaultValue={p?.familyType} />
                <SelectField label={t("pe.familyStatus")} name="familyStatus" options={translated(FAMILY_STATUS_OPTIONS)} defaultValue={p?.familyStatus} />
                <TextField label={t("pe.nativePlace")} name="nativePlace" defaultValue={v(p?.nativePlace)} placeholder={t("pe.nativePlacePh")} maxLength={80} />
                <TextField label={t("pe.siblings")} name="siblings" defaultValue={v(p?.siblings)} placeholder={t("pe.siblingsPh")} />
              </div>
            </Section>

            <Section id="lifestyle" title={t("pe.sec.lifestyle")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label={t("pe.diet")} name="diet" options={translated(DIET_OPTIONS)} defaultValue={p?.diet} />
                <SelectField label={t("pe.complexion")} name="complexion" options={translated(COMPLEXION_OPTIONS)} defaultValue={p?.complexion} />
                <div className="sm:col-span-2">
                  <CheckboxGroup label={t("pe.languages")} name="languages" options={translated(LANGUAGES)} defaultValues={p?.languages} columns={4} />
                </div>
              </div>
            </Section>

            <Section id="about" title={t("pe.sec.about")}>
              <TextArea label={t("pe.about")} name="about" defaultValue={v(p?.about)} maxLength={1500} rows={5} hint={t("pe.aboutHint")} />
            </Section>

            <Section id="preferences" title={t("pe.sec.preferences")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label={t("pe.ageFrom")} name="prefAgeMin" type="number" min={18} max={80} defaultValue={v(p?.prefAgeMin)} />
                <TextField label={t("pe.ageTo")} name="prefAgeMax" type="number" min={18} max={80} defaultValue={v(p?.prefAgeMax)} />
                <div className="sm:col-span-2">
                  <CheckboxGroup
                    label={t("pe.prefMarital")}
                    name="prefMaritalStatus"
                    options={translated(MARITAL_STATUS_LABELS)}
                    defaultValues={p ? p.prefMaritalStatus : ["NEVER_MARRIED"]}
                    columns={4}
                  />
                </div>
                <SelectField
                  label={t("pe.dosham")}
                  name="prefDosham"
                  options={{ NO: t("pe.prefNoDosham"), YES: t("pe.prefDosham") }}
                  defaultValue={p?.prefDosham === "DONT_KNOW" ? null : p?.prefDosham}
                  placeholder={t("pe.noPreference")}
                />
                <TextField label={t("pe.educationContains")} name="prefEducation" defaultValue={v(p?.prefEducation)} placeholder={t("pe.educationContainsPh")} maxLength={80} />
                <div className="sm:col-span-2">
                  <input type="hidden" name="prefExcludeOwnGothram" value="0" />
                  <label className="flex items-start gap-2.5 text-sm text-stone-700">
                    <input type="checkbox" name="prefExcludeOwnGothram" value="1" defaultChecked={p?.prefExcludeOwnGothram ?? true} className="mt-0.5 h-4 w-4 accent-maroon" />
                    <span>
                      {t("pe.excludeGothram")}
                      <span className="block text-xs text-stone-500">{t("pe.excludeGothramHint")}</span>
                    </span>
                  </label>
                </div>
                <details className="rounded-xl border border-hairline px-4 py-3 sm:col-span-2" open={!!p?.prefStars.length}>
                  <summary className="cursor-pointer text-sm font-medium text-maroon">
                    {t("pe.prefStars")} {p?.prefStars.length ? t("pe.selected", { count: p.prefStars.length }) : t("pe.anyParen")}
                  </summary>
                  <div className="mt-3">
                    <CheckboxGroup label={t("pe.leaveUnticked")} name="prefStars" options={translated(STARS)} defaultValues={p?.prefStars} />
                  </div>
                </details>
                <details className="rounded-xl border border-hairline px-4 py-3 sm:col-span-2" open={!!p?.prefCities.length}>
                  <summary className="cursor-pointer text-sm font-medium text-maroon">
                    {t("pe.prefCities")} {p?.prefCities.length ? t("pe.selected", { count: p.prefCities.length }) : t("pe.anyParen")}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <CheckboxGroup label={t("pe.leaveUnticked")} name="prefCities" options={lists.cities} defaultValues={p?.prefCities} />
                    <TextField label={t("pe.otherCities")} name="prefCitiesOther" defaultValue={otherCities.join(", ")} placeholder={t("pe.otherCitiesPh")} maxLength={300} />
                  </div>
                </details>
                <div className="sm:col-span-2">
                  <TextArea label={t("pe.otherExpectations")} name="prefNotes" defaultValue={v(p?.prefNotes)} maxLength={500} />
                </div>
              </div>
            </Section>

            <Section id="privacy" title={t("pe.sec.privacy")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label={t("pe.photoVisibility")} name="photoVisibility" options={VISIBILITY} defaultValue={p?.photoVisibility ?? "ALL_MEMBERS"} required />
                <SelectField label={t("pe.horoscopeVisibility")} name="horoscopeVisibility" options={VISIBILITY} defaultValue={p?.horoscopeVisibility ?? "ACCEPTED_ONLY"} required />
              </div>
            </Section>

            <div className="sticky bottom-3 z-10 rounded-full bg-cream/80 p-1 backdrop-blur">
              <SubmitButton className="w-full py-3">{t(p ? "pe.save" : "pe.create")}</SubmitButton>
            </div>
          </ActionForm>

          {p && (
            <div id="horoscope-file" className="scroll-mt-28">
              <Card title={t("pe.horoscopeTitle")}>
                <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-4">
                    {horoscope ? (
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm">
                        <span className="text-emerald-800">{t(horoscope.mime === "application/pdf" ? "pe.uploadedPdf" : "pe.uploadedImage", { date: dateOnly(horoscope.uploadedAt) })}</span>
                        <a href={`/api/horoscope/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-maroon underline decoration-gold/50 underline-offset-4">{t("pe.view")}</a>
                        <ActionForm action={deleteHoroscope} confirm={t("pe.removeConfirm")}>
                          <button type="submit" className="text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-red-700">{t("pe.remove")}</button>
                        </ActionForm>
                      </div>
                    ) : (
                      <p className="text-sm text-stone-600">{t("pe.horoscopeIntro")}</p>
                    )}
                    <ActionForm action={uploadHoroscope} className="space-y-3">
                      <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
                        {t(horoscope ? "pe.replaceFile" : "pe.horoscopeFile")}
                        <input
                          type="file"
                          name="horoscope"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          required
                          className="mt-1.5 block w-full text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-maroon file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-maroon-dark"
                        />
                        <span className="mt-1.5 block text-xs font-normal text-stone-500">{t("pe.fileHint")}</span>
                      </label>
                      <SubmitButton variant="secondary">{t("pe.upload")}</SubmitButton>
                    </ActionForm>
                    <p className="text-xs text-stone-500">
                      {t("pe.visibleTo", { who: VISIBILITY[p.horoscopeVisibility].toLowerCase() })} <a href="#privacy" className="underline">{t("pe.privacyLink")}</a>.
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
