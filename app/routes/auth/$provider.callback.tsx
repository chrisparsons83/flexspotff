import type { LoaderArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { authenticator } from "~/auth.server";

export let loader = ({ request, params }: LoaderArgs) => {
  invariant(params.provider, "This is not a valid provider");
  return authenticator.authenticate(params.provider, request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
};
