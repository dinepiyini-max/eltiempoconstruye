import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientSrc = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
const loginSrc = readFileSync(join(root, "src/lib/app-data/login.ts"), "utf8");

/** Mirror of safeSameOriginPath for regression without TS loader */
function safeSameOriginPath(raw, fallback = "/") {
  const value = (raw ?? "").trim() || fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  try {
    const u = new URL(value, "https://example.invalid");
    if (u.origin !== "https://example.invalid") return fallback;
    return `${u.pathname}${u.search}${u.hash}` || fallback;
  } catch {
    return fallback;
  }
}

function isAllowedLoginUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "gate.grok.me" || host === "gate.app-builder-testing.com";
  } catch {
    return false;
  }
}

describe("M1 safeSameOriginPath", () => {
  it("is wired in client.ts", () => {
    assert.match(clientSrc, /safeSameOriginPath\(opts\.callbackURL/);
    assert.match(clientSrc, /safeSameOriginPath\(redirectTo/);
  });
  it("allows relative paths", () => {
    assert.equal(safeSameOriginPath("/obra?x=1"), "/obra?x=1");
  });
  it("blocks absolute and protocol-relative", () => {
    assert.equal(safeSameOriginPath("https://evil.example/phish"), "/");
    assert.equal(safeSameOriginPath("//evil.example/phish"), "/");
    assert.equal(safeSameOriginPath("javascript:alert(1)"), "/");
  });
});

describe("M4 loginUrl allowlist", () => {
  it("is wired", () => {
    assert.match(loginSrc, /isAllowedLoginUrl/);
    assert.match(loginSrc, /gate\.grok\.me/);
  });
  it("allows gate hosts only", () => {
    assert.equal(isAllowedLoginUrl("https://gate.grok.me/login"), true);
    assert.equal(isAllowedLoginUrl("https://evil.example/login"), false);
    assert.equal(isAllowedLoginUrl("http://gate.grok.me/login"), false);
  });
});
