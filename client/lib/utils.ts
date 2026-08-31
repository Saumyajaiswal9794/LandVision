import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind CSS class names cleanly, resolving conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats confidence values to human readable percentages.
 */
export function formatConfidence(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}
