"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-maroon-dark"
    >
      Print or save as PDF
    </button>
  );
}
