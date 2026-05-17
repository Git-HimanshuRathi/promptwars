import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Glass panel — same primitive used in the live-analysis view.
 * Soft inset highlight + deep drop shadow + subtle white border.
 */
export const Glass = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      {...rest}
      className={cn(
        'relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_30px_60px_-20px_rgba(0,0,0,0.6)]',
        className,
      )}
    >
      {children}
    </div>
  ),
);
Glass.displayName = 'Glass';
