import { useRouteLoaderData } from '@remix-run/react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { User } from '~/models/user.server';
import type { loader as rootLoader } from '~/root';

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
