import Link from "next/link";
import { submitStory } from "@/app/actions/stories";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card } from "@/components/Card";
import { TextArea, TextField } from "@/components/fields";
import { Mandala } from "@/components/Ornaments";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n";

export const metadata = {
  title: "Success stories",
  description: "Couples from the Devangar community who found each other on Devangar Matrimony.",
};

export default async function StoriesPage() {
  const [user, stories] = await Promise.all([
    getCurrentUser(),
    db.successStory.findMany({
      where: { published: true },
      omit: { photo: true },
      orderBy: [{ weddingDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 60,
    }),
  ]);
  const withPhoto = new Set(
    (await db.successStory.findMany({ where: { published: true, photo: { not: null } }, select: { id: true } })).map((s) => s.id),
  );
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const t = await getT();

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden pt-6 text-center">
        <Mandala className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 text-gold opacity-10" />
        <div className="relative">
          <p className="eyebrow text-gold-dark">{t("stories.eyebrow")}</p>
          <h1 className="mt-3 text-5xl text-maroon sm:text-6xl">{t("stories.title")}</h1>
          <div className="ornament mx-auto mt-5 max-w-xs justify-center">
            <svg viewBox="0 0 10 10" className="h-2 w-2" fill="currentColor" aria-hidden><path d="M5 0l5 5-5 5-5-5z" /></svg>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-stone-600">{t("stories.lead")}</p>
        </div>
      </section>

      {stories.length ? (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <article key={s.id} className="flex flex-col overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft">
              {withPhoto.has(s.id) ? (
                // eslint-disable-next-line @next/next/no-img-element -- small, cached and served by our route
                <img src={`/api/stories/${s.id}`} alt={`${s.coupleNames}`} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-maroon-dark to-maroon">
                  <Mandala className="h-32 w-32 text-gold opacity-40" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-7">
                <h2 className="text-2xl text-maroon">{s.coupleNames}</h2>
                <p className="eyebrow mt-1 text-gold-dark">{[s.city, s.weddingDate && t("stories.married", { date: fmt(s.weddingDate) })].filter(Boolean).join(" · ")}</p>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-stone-700">{s.story}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mx-auto max-w-md rounded-2xl border border-hairline bg-white px-6 py-10 text-center text-stone-600 shadow-soft">
          {t("stories.empty")}
        </p>
      )}

      <div className="mx-auto max-w-2xl">
        {user?.profile ? (
          <Card title={t("stories.share")}>
            <p className="mb-5 text-sm text-stone-600">{t("stories.shareBody")}</p>
            <ActionForm action={submitStory} className="space-y-4">
              <TextField label={t("stories.names")} name="coupleNames" required maxLength={120} placeholder={t("stories.namesPlaceholder")} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("stories.city")} name="city" maxLength={60} defaultValue={user.profile.city} />
                <TextField label={t("stories.weddingDate")} name="weddingDate" type="date" />
              </div>
              <TextArea label={t("stories.story")} name="story" required rows={5} maxLength={3000} />
              <label className="block text-[0.8rem] font-medium tracking-wide text-stone-600">
                {t("stories.photo")}
                <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:text-maroon" />
              </label>
              <SubmitButton>{t("stories.submit")}</SubmitButton>
            </ActionForm>
          </Card>
        ) : (
          <p className="text-center text-sm text-stone-600">
            {t("stories.signInPrompt")} <Link href={user ? "/dashboard" : "/login"} className="text-maroon underline decoration-gold/50 underline-offset-4">{t("stories.signIn")}</Link> {t("stories.toShare")}
          </p>
        )}
      </div>
    </div>
  );
}
