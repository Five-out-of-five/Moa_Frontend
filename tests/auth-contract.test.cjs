/* eslint-disable @typescript-eslint/no-require-imports -- Node 내장 CJS 테스트에서 TS 서버 모듈을 격리해 실행한다. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function fixture({ env = {}, fetch: backend = async () => { throw Error("예상하지 않은 BE 요청"); }, incoming = {} } = {}) {
  const values = new Map();
  const options = new Map();
  const jar = {
    get: (name) => values.has(name) ? { name, value: values.get(name) } : undefined,
    has: (name) => values.has(name),
    set: (name, value, setting) => { values.set(name, value); options.set(name, setting); },
    delete: (name) => { values.delete(name); options.delete(name); },
  };
  const modules = new Map();
  const headers = new Headers({ host: "localhost:3000", ...incoming });
  const redirect = (location) => { const error = new Error("NEXT_REDIRECT"); error.location = location; throw error; };
  const overrides = {
    "server-only": {},
    "next/headers": { cookies: async () => jar, headers: async () => headers },
    "next/navigation": { redirect },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/features/auth/server": { getSignupAccount: async () => ({ provider: "GOOGLE", displayName: "테스트" }) },
  };
  function load(name, parent = path.join(process.cwd(), "src")) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith(".") && !name.startsWith("@/")) return require(name);
    let file = name.startsWith("@/") ? path.join(process.cwd(), "src", name.slice(2)) : path.resolve(parent, name);
    if (!path.extname(file)) file += ".ts";
    if (file === path.join(process.cwd(), "src/features/auth/server.ts")) return overrides["@/features/auth/server"];
    if (modules.has(file)) return modules.get(file).exports;
    const record = { exports: {} };
    modules.set(file, record);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(output, { module: record, exports: record.exports, require: (id) => load(id, path.dirname(file)), process: { env: { AUTH_USE_MOCK: "false", NODE_ENV: "test", ...env } }, fetch: backend, Headers, Request, Response, URL, FormData, AbortController, setTimeout, clearTimeout }, { filename: file });
    return record.exports;
  }
  return { load, jar, values, options };
}
const tokens = { accessToken: "fixture-access", accessTokenExpiresAt: "2040-01-01T00:00:00Z" };
function ok(data, cookie) { return Response.json({ success: true, data }, { headers: cookie ? { "Set-Cookie": cookie } : {} }); }
function expired() { return Response.json({ success: false, error: { code: "AUTH_ACCESS_TOKEN_EXPIRED", message: "액세스 토큰 만료" } }, { status: 401 }); }

test("복귀 주소는 정규화 후에도 내부 경로만 허용한다", () => {
  const { getAuthReturnPath } = fixture().load("@/features/auth/return-path");
  assert.equal(getAuthReturnPath("/invite/fixture?mode=join#start"), "/invite/fixture?mode=join#start");
  for (const value of ["https://evil.invalid", "//evil.invalid", "/.//evil.invalid", "/%2e%2e//evil.invalid", "/\\evil.invalid", "/%5cevil.invalid", "/login", "/auth/callback", "/api/auth/session", "/a\nb"]) assert.equal(getAuthReturnPath(value), null);
});

test("새 refresh 쿠키의 Strict·Secure·유효기간을 유지하고 액세스 토큰은 httpOnly로 저장한다", async () => {
  const f = fixture({ env: { NODE_ENV: "production" } });
  await f.load("@/features/auth/cookie-session").storeAuthTokens(tokens, new Headers({ "Set-Cookie": "refreshToken=fixture-new; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800" }));
  assert.equal(f.values.get("refreshToken"), "fixture-new");
  assert.equal(f.options.get("refreshToken").sameSite, "strict");
  assert.equal(f.options.get("refreshToken").secure, true);
  assert.equal(f.options.get("refreshToken").maxAge, 604800);
  assert.equal(f.options.get("refreshToken").domain, undefined);
  assert.equal(f.options.get("accessToken").httpOnly, true);
  assert.equal(f.options.get("accessToken").secure, true);
});

test("만료된 액세스 토큰 응답은 저장하지 않는다", async () => {
  const f = fixture();
  await assert.rejects(f.load("@/features/auth/cookie-session").storeAuthTokens({ ...tokens, accessTokenExpiresAt: "2000-01-01T00:00:00Z" }, new Headers()));
  assert.equal(f.values.size, 0);
});

test("로그아웃의 refresh 삭제 쿠키 속성을 유지한다", async () => {
  const f = fixture();
  await f.load("@/features/auth/cookie-session").relayRefreshCookie(new Headers({ "Set-Cookie": "refreshToken=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" }));
  assert.equal(f.options.get("refreshToken").maxAge, 0);
  assert.equal(f.options.get("refreshToken").sameSite, "strict");
});

test("세션 BFF는 refresh 쿠키를 BE로 보내고 토큰을 응답 본문에 노출하지 않는다", async () => {
  let calls = 0;
  const f = fixture({ fetch: async (url, init) => {
    calls++;
    assert.equal(new URL(url).pathname, "/api/v1/auth/refresh");
    assert.equal(new Headers(init.headers).get("cookie"), "refreshToken=fixture-old");
    assert.equal(new Headers(init.headers).has("origin"), false);
    return ok(tokens, "refreshToken=fixture-new; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800");
  } });
  f.jar.set("refreshToken", "fixture-old");
  const response = await f.load("@/app/api/auth/session/route").POST(new Request("http://localhost:3000/api/auth/session", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ returnPath: "/invite/fixture" }) }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), JSON.stringify({ redirectTo: "/invite/fixture" }));
  assert.equal(f.values.get("refreshToken"), "fixture-new");
  assert.equal(calls, 1);
});

test("세션 BFF는 외부 Origin과 refresh 쿠키 누락을 차단한다", async () => {
  const f = fixture();
  const { POST } = f.load("@/app/api/auth/session/route");
  assert.equal((await POST(new Request("http://localhost:3000/api/auth/session", { method: "POST", headers: { host: "localhost:3000", origin: "https://evil.invalid" }, body: "{}" }))).status, 403);
  assert.equal((await POST(new Request("http://localhost:3000/api/auth/session", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" }, body: "{}" }))).status, 401);
});

test("인증 만료는 refresh 후 Bearer를 교체해 원 요청을 한 번 재시도한다", async () => {
  const seen = [];
  const f = fixture({ fetch: async (url, init) => {
    const route = new URL(url).pathname;
    seen.push(route);
    if (route.endsWith("/refresh")) return ok(tokens, "refreshToken=fixture-new; Path=/; HttpOnly; SameSite=Strict");
    if (seen.length === 1) return expired();
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer fixture-access");
    assert.equal(init.body, JSON.stringify({ title: "재시도 본문" }));
    return ok({ saved: true });
  } });
  f.jar.set("accessToken", "fixture-expired"); f.jar.set("refreshToken", "fixture-old");
  const result = await f.load("@/lib/api").api("/api/v1/test-resource", { method: "POST", json: { title: "재시도 본문" }, allowAuthRefresh: true });
  assert.equal(result.saved, true);
  assert.deepEqual(seen, ["/api/v1/test-resource", "/api/v1/auth/refresh", "/api/v1/test-resource"]);
});

test("재시도도 만료되면 무한 refresh 없이 종료한다", async () => {
  let calls = 0;
  const f = fixture({ fetch: async (url) => { calls++; return new URL(url).pathname.endsWith("/refresh") ? ok(tokens) : expired(); } });
  f.jar.set("refreshToken", "fixture-old");
  await assert.rejects(f.load("@/lib/api").api("/api/v1/test-resource", { allowAuthRefresh: true }), (error) => error.code === "AUTH_ACCESS_TOKEN_EXPIRED");
  assert.equal(calls, 3);
});

test("서버 조회의 만료는 쿠키를 회전시키기 전에 callback 페이지로 넘긴다", async () => {
  let calls = 0;
  const f = fixture({ incoming: { "x-moa-request-path": "/rooms/1?view=grid" }, fetch: async () => { calls++; return expired(); } });
  await assert.rejects(f.load("@/lib/api").api("/api/v1/test-resource"), (error) => error.location === "/auth/callback?reason=expired&returnPath=%2Frooms%2F1%3Fview%3Dgrid");
  assert.equal(calls, 1);
});

test("공통 봉투가 아닌 CORS 오류도 ApiError로 안내한다", async () => {
  const f = fixture({ fetch: async () => new Response("Forbidden", { status: 403 }) });
  await assert.rejects(f.load("@/lib/api").api("/api/v1/auth/refresh"), (error) => error.status === 403 && error.code === "API_RESPONSE_INVALID");
});

test("가입 완료는 합의된 필드와 쿠키를 사용하고 복귀 경로를 유지한다", async () => {
  const f = fixture({ fetch: async (url, init) => {
    assert.equal(new URL(url).pathname, "/api/v1/auth/signup");
    assert.deepEqual(JSON.parse(init.body), { ticket: "fixture-ticket", name: "테스트", termsAgreed: true, privacyAgreed: true });
    return ok(tokens, "refreshToken=fixture-signup; Path=/; HttpOnly; SameSite=Strict");
  } });
  f.jar.set("moa_auth_return", "/invite/fixture");
  const form = new FormData(); form.set("name", "테스트"); form.set("terms", "on"); form.set("privacy", "on");
  await assert.rejects(f.load("@/features/auth/actions").completeMockSignupAction("fixture-ticket", undefined, {}, form), (error) => error.location === "/invite/fixture");
  assert.equal(f.values.get("refreshToken"), "fixture-signup");
  assert.equal(f.values.has("moa_auth_return"), false);
});

test("인증 목 모드에서는 세션 BFF가 BE를 호출하지 않는다", async () => {
  const f = fixture({ env: { AUTH_USE_MOCK: "true" } });
  const response = await f.load("@/app/api/auth/session/route").POST(new Request("http://localhost:3000/api/auth/session", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" }, body: "{}" }));
  assert.equal(response.status, 400);
});
