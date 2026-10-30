import { useRouteLoaderData } from '@remix-run/react';
import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import type { User } from '~/models/user.server';
import type { loader as rootLoader } from '~/root';

/**
 * tailwind-merge reads any `bg-*` it does not know as a background colour,
 * so the depth tokens' gradients would knock out the colour under them, and
 * it cannot tell our shadows apart from shadow colours. Naming them keeps
 * each in its own group.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-image': [
        {
          bg: [
            'accent-gradient',
            'header-fill',
            'primary-fill',
            'primary-fill-hover',
          ],
        },
      ],
      shadow: [
        {
          shadow: [
            'press',
            'press-secondary',
            'press-destructive',
            'overlay',
            'card-edge',
            'card-glow',
            'glow',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function isUser(user: any): user is User {
  return user && typeof user === 'object' && typeof user.email === 'string';
}

export function useOptionalUser(): User | undefined {
  const data = useRouteLoaderData<typeof rootLoader>('root');
  if (!data || !isUser(data.user)) {
    return undefined;
  }
  return data.user;
}

export function useUser(): User {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      'No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.',
    );
  }
  return maybeUser;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length > 3 && email.includes('@');
}
