const pulse = "animate-pulse rounded-lg bg-sand";

export function HeaderSkeleton() {
  return (
    <div className="mb-8 border-b border-hairline pb-6">
      <div className={`${pulse} h-3 w-24`} />
      <div className={`${pulse} mt-3 h-10 w-72`} />
      <div className={`${pulse} mt-3 h-4 w-96 max-w-full`} />
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
          <div className="aspect-[4/5] animate-pulse bg-gradient-to-br from-sand to-gold-light/50" />
          <div className="space-y-2 p-4">
            <div className={`${pulse} h-5 w-2/3`} />
            <div className={`${pulse} h-3 w-1/3`} />
            <div className={`${pulse} h-3 w-full`} />
          </div>
        </div>
      ))}
    </div>
  );
}
