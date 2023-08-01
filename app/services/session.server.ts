import { createCookieSessionStorage } from "@remix-run/node";
import { DateTime } from "luxon";

const DAYS_AHEAD = 30;

// export the whole sessionStorage object
export let sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production", // enable this in prod only
    maxAge: 60 * 60 * 24 * DAYS_AHEAD, // 30 days
    expires: DateTime.now().plus({days: DAYS_AHEAD}).toJSDate(),
  },
});

// you can also export the methods individually for your own usage
export let { getSession, commitSession, destroySession } = sessionStorage;
