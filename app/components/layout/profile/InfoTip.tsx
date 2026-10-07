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
 * An ⓘ that explains a stat whose name cannot. Shown on hover, on keyboard
 * focus and on a tap, unlike a `title`, which never appears on focus or on a
 * phone and gives no hint that there is anything to read.
 *
 * A tap opens it outright rather than toggling, since a phone may also send
 * focus for the same tap, and a tap anywhere else closes it - Safari on iOS
 * never moves focus to a tapped button, so blur alone would leave it open.
 *
 * The tip is placed against the viewport rather than its parent, so it is not
 * clipped by a table that scrolls sideways - which, in CSS, also clips
 * anything that pokes out above or below it.
 */
export default function InfoTip({
  label,
  icon,
  iconClassName = 'text-slate-400 hover:text-slate-300 focus-visible:text-slate-300',
  className = 'inline-flex align-middle',
  children,
}: {
  /** What the button is for, read by screen readers, e.g. "About Timing". */
  label: string;
  /** In place of the ⓘ, for a marker that explains itself on hover. */
  icon?: ReactNode;
  iconClassName?: string;
  /** The wrapper's layout; text sits on the line rather than centred. */
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
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

  // A fixed tip would stay put while the page moved under it; and a tap
  // elsewhere is how a phone puts it away.
  const open = position !== null;
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) hide();
    };
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    document.addEventListener('pointerdown', away);
    return () => {
      window.removeEventListener('scroll', hide, { capture: true });
      document.removeEventListener('pointerdown', away);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className={className}
      // Mouse only: a phone sends these for a tap too, and the tap is handled.
      onPointerEnter={event => event.pointerType === 'mouse' && show()}
      onPointerLeave={event => event.pointerType === 'mouse' && hide()}
    >
      <button
        ref={buttonRef}
        type='button'
        aria-label={label}
        aria-describedby={id}
        onFocus={show}
        onBlur={hide}
        onClick={show}
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

/**
 * Text that opens an explanation on hover, focus or a tap - a stat label, or a
 * number whose context does not fit beside it. Dotted underneath so there is
 * a sign it has more to say, which a `title` never gives and a phone never
 * shows.
 */
export function InfoText({
  label,
  tip,
  className,
  children,
}: {
  /** Read by screen readers in place of the text, e.g. "Weeks Won". */
  label: string;
  tip: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <InfoTip
      label={label}
      icon={children}
      className='inline'
      iconClassName={clsx(
        'text-left underline decoration-dotted decoration-slate-500 underline-offset-2 hover:decoration-slate-300',
        className,
      )}
    >
      {tip}
    </InfoTip>
  );
}
