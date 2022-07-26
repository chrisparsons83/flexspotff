import type { LoaderArgs } from "@remix-run/node";
import { authenticator } from "~/auth.server";

export let loader = ({ request, params }: LoaderArgs) => {
  return authenticator.authenticate(params.provider, request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
};
