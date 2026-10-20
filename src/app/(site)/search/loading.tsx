import { CardGridSkeleton, HeaderSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <CardGridSkeleton />
    </div>
  );
}
