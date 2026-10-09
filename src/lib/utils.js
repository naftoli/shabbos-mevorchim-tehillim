import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// The shadcn-standard class combiner: clsx for conditionals, tailwind-merge to
// resolve conflicting Tailwind utilities (last one wins).
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
