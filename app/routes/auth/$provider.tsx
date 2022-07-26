import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticator } from "~/auth.server";

export let loader = () => redirect("/login");

export let action = ({ request, params }: ActionArgs) => {
  return authenticator.authenticate(params.provider, request);
};
