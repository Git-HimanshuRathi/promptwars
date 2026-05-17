import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function riskBandColor(band: string): string {
  switch (band) {
    case 'safe':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'caution':
      return 'text-amber-600 dark:text-amber-400';
    case 'high_risk':
      return 'text-orange-600 dark:text-orange-400';
    case 'dangerous':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

export function severityBg(sev: string): string {
  switch (sev) {
    case 'critical':
      return 'bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30';
    case 'medium':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30';
    case 'low':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground ring-border';
  }
}
