import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const previewSrc = readFileSync(join(root, "src/lib/auth/preview.ts"), "utf8");
const embedSrc = readFileSync(join(root, "src/lib/preview-embedder-origin.ts"), "utf8");
const serverSrc = readFileSync(join(root, "src/lib/auth/server.ts"), "utf8");

describe("A1 — no committed preview secret", () => {
  it("preview.ts has no hex secret literal", () => {
    assert.equal(/PREVIEW_CLIENT_SECRET\s*=/.test(previewSrc), false);
    assert.equal(/8bcdb7fc5a33874ad933ca568918d579/.test(previewSrc), false);
    assert.equal(/8bcdb7fc5a33874ad933ca568918d579/.test(serverSrc), false);
  });
  it("server uses resolvePreviewClientSecret(env)", () => {
    assert.match(serverSrc, /resolvePreviewClientSecret\(env\)/);
    assert.equal(/\bPREVIEW_CLIENT_SECRET\b/.test(serverSrc), false);
    assert.equal(/\?\?\s*PREVIEW_CLIENT_SECRET/.test(serverSrc), false);
  });
});

// Mirror of fixed resolveParentEmbedderOrigin for behavioral checks
function isGrokEmbedderOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "grok.com" || host.endsWith(".grok.com")) return true;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    return false;
  } catch {
    return false;
  }
}
function isRemintPreviewPair(guestHost, parentHost) {
  const guest = guestHost.toLowerCase();
  const parent = parentHost.toLowerCase();
  const sep = ".preview.";
  const i = guest.indexOf(sep);
  if (i <= 0) return false;
  const label = guest.slice(0, i);
  const rest = guest.slice(i + sep.length);
  if (label.includes(".") || !rest.includes(".")) return false;
  return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
  if (parentIsSelf) return null;
  const candidates = [ancestorOrigin ?? "", referrer].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (isGrokEmbedderOrigin(url.origin)) return url.origin;
      if (isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
    } catch {}
  }
  return null;
}

describe("A2 — bridge trust", () => {
  it("source no longer trusts sandbox guest alone", () => {
    assert.equal(
      /isSandboxPreviewGuestHost\(guestHostname\)\s*\|\|/.test(embedSrc),
      false,
    );
    assert.match(embedSrc, /Prefer ancestorOrigins over document\.referrer/);
  });
  it("rejects evil parent on sandbox guest", () => {
    assert.equal(
      resolveParentEmbedderOrigin(false, "https://evil.example", "https://evil.example", "abc.grok-sandbox.com"),
      null,
    );
  });
  it("accepts grok.com parent", () => {
    assert.equal(
      resolveParentEmbedderOrigin(false, "https://evil.example", "https://grok.com", "abc.grok-sandbox.com"),
      "https://grok.com",
    );
  });
});
