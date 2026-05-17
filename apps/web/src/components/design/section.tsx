import { cn } from '@/lib/utils';

/**
 * Section with the small uppercase eyebrow + big tracked-tight headline.
 * Matches the LEXGUARD design language across all pages.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl',
        className,
      )}
    >
      {eyebrow && (
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60 font-semibold">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base md:text-lg text-white/60 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
