import { createCookieSessionStorage } from '@remix-run/node';
import { DAYS_AHEAD } from '~/utils/constants';
import { envSchema } from '~/utils/helpers';

const env = envSchema.parse(process.env);

// export the whole sessionStorage object
export let sessionStorage = createCookieSessionStorage({
  cookie: {
    domain: env.NODE_ENV === 'production' ? env.COOKIE_DOMAIN : undefined,
    name: '_session', // use any name you want here
    sameSite: 'lax', // this helps with CSRF
    path: '/', // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: [env.SESSION_SECRET],
    secure: env.NODE_ENV === 'production', // enable this in prod only
    maxAge: 60 * 60 * 24 * DAYS_AHEAD, // 30 days
  },
});

// you can also export the methods individually for your own usage
export let { getSession, commitSession, destroySession } = sessionStorage;
