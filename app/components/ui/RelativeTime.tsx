import { useEffect, useState } from 'react';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "in 3 hours", "tomorrow", "in 4 days"; past a week, the date itself. */
export function relativeTime(value: Date, now: number) {
  const diff = value.getTime() - now;
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const size = Math.abs(diff);
  if (size < HOUR) return format.format(Math.round(diff / MINUTE), 'minute');
  if (size < DAY) return format.format(Math.round(diff / HOUR), 'hour');
  if (size < 7 * DAY) return format.format(Math.round(diff / DAY), 'day');
  return value.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/**
 * A time as how far off it is, with the exact time on hover. The server and
 * the first client render agree to the minute, and it keeps itself current
 * after that.
 */
export default function RelativeTime({ value }: { value: string | Date }) {
  const date = new Date(value);
  const [now, setNow] = useState(() => Date.now());
  const [exact, setExact] = useState<string>();

  useEffect(() => {
    setNow(Date.now());
    // The viewer's own zone, which the server cannot know.
    setExact(date.toLocaleString());
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.getTime()]);

  return (
    <time dateTime={date.toISOString()} title={exact} suppressHydrationWarning>
      {relativeTime(date, now)}
    </time>
  );
}
