import type { ReactNode } from 'react';

/**
 * Small print set inline after a card's headline, in place of a line under
 * it. Line height none, so a card with it is no taller than a card without.
 */
export default function LeadContext({ children }: { children: ReactNode }) {
  return (
    <span className='ml-2 text-sm font-normal leading-none text-slate-400'>
      {children}
    </span>
  );
}
