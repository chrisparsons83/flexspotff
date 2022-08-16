import type { LoaderArgs } from "@remix-run/node";
import { authenticator } from "~/auth.server";
import z from "zod";

export let loader = ({ request, params }: LoaderArgs) => {
  const provider = z.string().parse(params.provider);
  return authenticator.authenticate(provider, request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
};
