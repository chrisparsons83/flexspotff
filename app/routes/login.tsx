import type { LoaderArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { SocialsProvider } from "remix-auth-socials";

import { authenticator } from "~/services/auth.server";

interface SocialButtonProps {
  provider: SocialsProvider;
  label: string;
}

export const loader = async ({ request }: LoaderArgs) => {
  await authenticator.isAuthenticated(request, {
    successRedirect: "/dashboard",
  });

  return {};
};

const SocialButton: React.FC<SocialButtonProps> = ({ provider, label }) => (
  <Form action={`/auth/${provider}`} method="POST">
    <button className="focus-visible:ring-offset-2zd inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {label}
    </button>
  </Form>
);

export default function Login() {
  return (
    <>
      <SocialButton
        provider={SocialsProvider.DISCORD}
        label="Login with Discord"
      />
    </>
  );
}
