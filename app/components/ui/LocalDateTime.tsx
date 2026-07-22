import { useEffect, useState } from 'react';

/**
 * Zone used for the server render and the first client render. The site is a
 * US-Eastern league (the draft announcement embed also pins this zone), so most
 * viewers see no flash at all, and everyone else sees a closer approximation
 * than UTC before the viewer's real zone takes over.
 */
const FALLBACK_TIME_ZONE = 'America/New_York';

type Props = {
  value: string | number | Date;
  options?: Intl.DateTimeFormatOptions;
  /** Defaults to undefined, which uses the viewer's browser locale. */
  locale?: string;
};

/**
 * Renders a date/time in the viewer's local timezone.
 *
 * A plain `date.toLocaleString(undefined, …)` formats in the server's timezone
 * during SSR, and React keeps that text through hydration — so every viewer
 * would see the server zone (UTC). Instead we render a fixed fallback zone
 * (Eastern) on the server and the first client render — making the two
 * deterministically match, so there is no hydration mismatch — then re-format
 * in the browser's actual zone after mount.
 */
export default function LocalDateTime({ value, options, locale }: Props) {
  const [text, setText] = useState(() =>
    new Date(value).toLocaleString(locale, {
      ...options,
      timeZone: FALLBACK_TIME_ZONE,
    }),
  );

  useEffect(() => {
    setText(new Date(value).toLocaleString(locale, options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locale, JSON.stringify(options)]);

  return <span suppressHydrationWarning>{text}</span>;
}
