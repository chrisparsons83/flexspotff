import { FOCUS_RING } from './styles';
import { Form, useLocation } from '@remix-run/react';
import { cn } from '~/utils';
import { THEME_PREFERENCES, type ThemePreference } from '~/utils/theme';

const LABELS: Record<ThemePreference, string> = {
  system: 'System',
  dark: 'Dark',
  light: 'Light',
};

type Props = {
  /** The visitor's preference, from the root loader. */
  value: ThemePreference;
  className?: string;
};

/**
 * Picks System, Dark or Light. Each is a submit button in one form that
 * posts to /resources/theme, which sets the cookie and sends the visitor back
 * here, so it works before the page has hydrated and without JavaScript.
 */
export function ThemeToggle({ value, className }: Props) {
  const { pathname, search } = useLocation();

  return (
    <Form
      method='post'
      action='/resources/theme'
      className={cn('flex', className)}
      aria-label='Theme'
    >
      <input type='hidden' name='redirectTo' value={pathname + search} />
      {THEME_PREFERENCES.map(theme => (
        <button
          key={theme}
          type='submit'
          name='theme'
          value={theme}
          aria-pressed={theme === value}
          className={cn(
            'h-8 px-3 text-sm font-semibold transition-colors duration-fast',
            theme === value
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {LABELS[theme]}
        </button>
      ))}
    </Form>
  );
}
