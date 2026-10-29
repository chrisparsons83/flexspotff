import { DiscordLogoIcon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { SocialsProvider } from 'remix-auth-socials';
import { Button } from '~/components/ui/button';
import { PageHeader } from '~/components/ui/page-header';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Log in' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    successRedirect: '/dashboard',
  });

  return {};
};

export default function Login() {
  return (
    <>
      <PageHeader title='Log in' />
      <Form action={`/auth/${SocialsProvider.DISCORD}`} method='POST'>
        <Button type='submit' variant='discord'>
          <DiscordLogoIcon aria-hidden />
          Log in with Discord
        </Button>
      </Form>
    </>
  );
}
