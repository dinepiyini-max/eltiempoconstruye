/**
 * Shared LIVE-PREVIEW OAuth client metadata (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker exposes ONE shared
 * "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`.
 *
 * The public client id may live here. The client **secret must NOT** be committed:
 * inject `GROK_AUTH_CLIENT_SECRET` (deploy) or `GROK_PREVIEW_CLIENT_SECRET`
 * (sandbox/runtime) at process env. If neither is set, federated auth stays off
 * (fail closed) — see `server.ts`.
 *
 * Rotate the broker's preview secret in Vercel/env when it may have leaked from
 * an older git revision; never put the new value back into this file.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;

/** Read preview/deploy OAuth client secret from env only (never hardcode). */
export function resolvePreviewClientSecret(
  readEnv: (key: string) => string | undefined = (key) => {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
  },
): string | undefined {
  return readEnv("GROK_AUTH_CLIENT_SECRET") ?? readEnv("GROK_PREVIEW_CLIENT_SECRET");
}
