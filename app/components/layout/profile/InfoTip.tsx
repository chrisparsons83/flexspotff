import { InformationCircleIcon } from '@heroicons/react/outline';
import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

const TIP_WIDTH = 256;
const GAP = 8;
/** Below this much room above the icon, the tip opens underneath instead. */
const ROOM_ABOVE = 120;

// Measuring the tip has to happen before paint, but there is nothing to
// measure on the server.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * An ⓘ that explains a stat whose name cannot. Shown on hover and on keyboard
 * focus or a tap, unlike a `title`, which never appears on focus or on a phone
 * and gives no hint that there is anything to read.
 *
 * The tip is placed against the viewport rather than its parent, so it is not
 * clipped by a table that scrolls sideways - which, in CSS, also clips
 * anything that pokes out above or below it.
 */
export default function InfoTip({
  label,
  icon,
  iconClassName = 'text-slate-400 hover:text-slate-300 focus-visible:text-slate-300',
  children,
}: {
  /** What the button is for, read by screen readers, e.g. "About Timing". */
  label: string;
  /** In place of the ⓘ, for a marker that explains itself on hover. */
  icon?: ReactNode;
  iconClassName?: string;
  children: ReactNode;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  const show = () => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return;
    // Clamped to the right edge first and the left edge last, so a viewport
    // narrower than the tip still keeps its start on screen.
    const left = Math.max(
      Math.min(anchor.left - GAP, window.innerWidth - TIP_WIDTH - GAP),
      GAP,
    );
    setPosition(
      anchor.top > ROOM_ABOVE
        ? { left, top: anchor.top - GAP, transform: 'translateY(-100%)' }
        : { left, top: anchor.bottom + GAP },
    );
  };
  const hide = () => setPosition(null);

  // A long explanation can be taller than the room above the icon; once it is
  // laid out, drop it underneath rather than run it off the top.
  useIsomorphicLayoutEffect(() => {
    if (!position?.transform) return;
    const tip = tipRef.current?.getBoundingClientRect();
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!tip || !anchor || tip.top >= GAP) return;
    setPosition({ left: position.left, top: anchor.bottom + GAP });
  }, [position]);

  // A fixed tip would stay put while the page moved under it.
  useEffect(() => {
    if (!position) return;
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', hide, { capture: true });
  }, [position]);

  return (
    <span
      className='inline-flex align-middle'
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        ref={buttonRef}
        type='button'
        aria-label={label}
        aria-describedby={id}
        onFocus={show}
        onBlur={hide}
        className={clsx(
          'cursor-help rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400',
          iconClassName,
        )}
      >
        {icon ?? (
          <InformationCircleIcon aria-hidden='true' className='h-4 w-4' />
        )}
      </button>
      <span
        ref={tipRef}
        role='tooltip'
        id={id}
        hidden={!position}
        style={{
          ...position,
          width: TIP_WIDTH,
          maxWidth: `calc(100vw - ${GAP * 2}px)`,
        }}
        className='pointer-events-none fixed z-50 whitespace-normal rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-relaxed text-slate-200 shadow-lg'
      >
        {children}
      </span>
    </span>
  );
}
