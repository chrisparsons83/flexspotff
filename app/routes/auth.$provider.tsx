import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import z from 'zod';
import { authenticator } from '~/services/auth.server';

export let loader = () => redirect('/login');

export let action = ({ request, params }: ActionFunctionArgs) => {
  const provider = z.string().parse(params.provider);
  return authenticator.authenticate(provider, request);
};
