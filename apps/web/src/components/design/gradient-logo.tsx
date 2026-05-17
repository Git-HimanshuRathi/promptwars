import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The tiny gradient logo: violet→fuchsia→blue square with a shield centered.
 * Used in the header and on the marketing hero.
 */
export function GradientLogo({
  size = 'sm',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}): React.JSX.Element {
  const dims = size === 'lg' ? 'h-14 w-14' : size === 'md' ? 'h-10 w-10' : 'h-7 w-7';
  const innerInset = size === 'lg' ? 'inset-[2px]' : 'inset-[1px]';
  const iconSize = size === 'lg' ? 'h-7 w-7' : size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  const radius = size === 'lg' ? 'rounded-xl' : 'rounded-md';
  const innerRadius =
    size === 'lg' ? 'rounded-[10px]' : size === 'md' ? 'rounded-md' : 'rounded-[5px]';
  return (
    <span className={cn('relative grid place-items-center', dims, className)}>
      <span
        className={cn(
          'absolute inset-0 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 opacity-90',
          radius,
        )}
      />
      <span className={cn('absolute bg-[#07070A]', innerInset, innerRadius)} />
      <Shield className={cn('relative text-white', iconSize)} aria-hidden />
    </span>
  );
}
