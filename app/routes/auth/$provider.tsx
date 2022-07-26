import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import invariant from "tiny-invariant";
import { authenticator } from "~/auth.server";

export let loader = () => redirect("/login");

export let action = ({ request, params }: ActionArgs) => {
  invariant(params.provider, "This is not a valid provider");
  return authenticator.authenticate(params.provider, request);
};
