import { betterAuth } from 'better-auth';

const DEVELOPMENT_SECRET = 'local-development-secret-change-before-production-2026';
const DEFAULT_TRUSTED_ORIGINS = [
  'https://light-novel-reader.w3145965836.workers.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

function configuredOrigins(env) {
  return String(env.APP_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function trustedOrigins(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const origins = new Set([...DEFAULT_TRUSTED_ORIGINS, ...configuredOrigins(env)]);

  if (requestOrigin && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(requestOrigin)) {
    origins.add(requestOrigin);
  }

  return Array.from(origins);
}

export function isTrustedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  return !origin || trustedOrigins(request, env).includes(origin);
}

export function createAuth(request, env) {
  const isSecureRequest = new URL(request.url).protocol === 'https:';

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET || DEVELOPMENT_SECRET,
    baseURL: new URL(request.url).origin,
    basePath: '/api/auth',
    trustedOrigins: trustedOrigins(request, env),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24
    },
    advanced: {
      useSecureCookies: isSecureRequest,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isSecureRequest,
        sameSite: isSecureRequest ? 'none' : 'lax'
      },
      database: {
        generateId: () => crypto.randomUUID()
      }
    }
  });
}
