import { useEffect, useState } from 'react';

type Props = {
  value: string | number | Date;
  options?: Intl.DateTimeFormatOptions;
  /** Defaults to undefined, which uses the viewer's browser locale. */
  locale?: string;
};

/**
 * Renders a date/time in the viewer's local timezone.
 *
 * Because Remix server-side-renders components, a plain
 * `date.toLocaleString(undefined, …)` formats in the server's timezone (UTC in
 * production) and React keeps that text through hydration — so every viewer
 * sees UTC. This component renders the server (UTC) string first to avoid a
 * blank flash, then re-formats in the browser's timezone after mount.
 */
export default function LocalDateTime({ value, options, locale }: Props) {
  const format = () => new Date(value).toLocaleString(locale, options);
  const [text, setText] = useState(format);

  useEffect(() => {
    setText(format());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locale, JSON.stringify(options)]);

  return <span suppressHydrationWarning>{text}</span>;
}
