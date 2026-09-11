import type { CallToolResult } from "./types.ts";

const ALLOWED_LOGIN_HOSTS = new Set([
  "gate.grok.me",
  "gate.app-builder-testing.com",
]);

export function isAllowedLoginUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (ALLOWED_LOGIN_HOSTS.has(host)) return true;
    // allow same-origin relative was never used here — gate returns absolute
    return false;
  } catch {
    return false;
  }
}

export function isLoginRequired(result: CallToolResult): boolean {
  return result.ok === false && result.loginRequired === true;
}

export function isConnectorPending(result: CallToolResult): boolean {
  return result.ok === false && result.pending === true;
}

export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function redirectToLoginIfRequired(result: CallToolResult): boolean {
  if (!isLoginRequired(result)) return false;
  const url = result.loginUrl;
  if (!url) return false;
  if (typeof window === "undefined") return false;
  if (!isAllowedLoginUrl(url)) return false;
  if (isFramed()) {
    const opened = window.open(url, "_blank");
    if (opened) {
      opened.opener = null;
      return true;
    }
  }
  window.location.assign(url);
  return true;
}
