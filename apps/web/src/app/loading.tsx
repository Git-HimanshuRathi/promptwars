import { Glass } from '@/components/design/glass';

export default function Loading() {
  return (
    <div
      className="mx-auto max-w-[1600px] px-4 sm:px-6 py-16 space-y-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="shimmer h-10 w-2/3 rounded-md" />
      <div className="shimmer h-5 w-1/2 rounded-md" />
      <div className="grid md:grid-cols-3 gap-4 mt-10">
        <Glass className="p-6 h-32 shimmer" />
        <Glass className="p-6 h-32 shimmer" />
        <Glass className="p-6 h-32 shimmer" />
      </div>
    </div>
  );
}
