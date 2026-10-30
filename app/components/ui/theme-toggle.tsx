import { FOCUS_RING } from './styles';
import { MoonIcon, SunIcon } from '@radix-ui/react-icons';
import { Form, useLocation } from '@remix-run/react';
import { cn } from '~/utils';

type Props = { className?: string };

const buttonClass = cn(
  'size-8 items-center justify-center text-muted-foreground transition-colors duration-fast hover:text-foreground [&_svg]:size-4',
  FOCUS_RING,
);

/**
 * One button that flips between dark and light: a sun in the dark, a moon in
 * the light. A visitor who has never pressed it follows their OS. Both
 * buttons are in the page and the `dark` class picks which shows, so it is
 * right before hydration, when `system` has resolved only in the browser.
 * The form posts to /resources/theme, which sets the cookie and sends the
 * visitor back here, so it works without JavaScript.
 */
export function ThemeToggle({ className }: Props) {
  const { pathname, search } = useLocation();

  return (
    <Form
      method='post'
      action='/resources/theme'
      className={cn('flex', className)}
      aria-label='Theme'
    >
      <input type='hidden' name='redirectTo' value={pathname + search} />
      <button
        type='submit'
        name='theme'
        value='light'
        aria-label='Switch to light mode'
        title='Switch to light mode'
        className={cn('hidden dark:flex', buttonClass)}
      >
        <SunIcon aria-hidden />
      </button>
      <button
        type='submit'
        name='theme'
        value='dark'
        aria-label='Switch to dark mode'
        title='Switch to dark mode'
        className={cn('flex dark:hidden', buttonClass)}
      >
        <MoonIcon aria-hidden />
      </button>
    </Form>
  );
}
