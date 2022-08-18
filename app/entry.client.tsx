import { RemixBrowser } from "@remix-run/react";
import { useLocation, useMatches } from "@remix-run/react";
import * as Sentry from "@sentry/remix";
import { useEffect } from "react";
import { hydrate } from "react-dom";

Sentry.init({
  dsn: window.ENV.SENTRY_DSN,
  environment: window.ENV.NODE_ENV,
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
