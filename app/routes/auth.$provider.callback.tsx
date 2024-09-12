import type { LoaderArgs } from '@remix-run/node';
import z from 'zod';
import { authenticator } from '~/services/auth.server';

export let loader = ({ request, params }: LoaderArgs) => {
  const provider = z.string().parse(params.provider);
  return authenticator.authenticate(provider, request, {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
  });
};
