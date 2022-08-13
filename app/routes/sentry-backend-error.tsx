import type { ActionFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";

export const action: ActionFunction = async ({ request }) => {
  throw new Error("Sentry Error");
};

export default function SentryBackendError() {
  return (
    <Form>
      <button type="submit">Send Error</button>
    </Form>
  );
}
