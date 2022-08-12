import { RemixBrowser } from "@remix-run/react";
import { hydrate } from "react-dom";

import { useLocation, useMatches } from "@remix-run/react";
import * as Sentry from "@sentry/remix";
import { useEffect } from "react";

declare global {
  interface Window {
    ENV: {
      SENTRY_DSN: string;
    };
  }
}

Sentry.init({
  dsn: window.ENV.SENTRY_DSN,
  tracesSampleRate: 1,
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.remixRouterInstrumentation(
        useEffect,
        useLocation,
        useMatches
      ),
    }),
  ],
});

hydrate(<RemixBrowser />, document);
