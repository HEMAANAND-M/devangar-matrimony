"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="eyebrow text-gold-dark">Something went wrong</p>
      <h1 className="mt-3 text-5xl text-maroon">We hit a snag</h1>
      <p className="mt-4 text-stone-600">
        Please try again. If it keeps happening, contact support
        {error.digest && <> and mention reference <code className="rounded bg-sand px-1.5 py-0.5 text-xs">{error.digest}</code></>}.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-maroon px-8 py-3 text-sm font-medium text-white shadow-soft transition hover:bg-maroon-dark"
      >
        Try again
      </button>
    </div>
  );
}
