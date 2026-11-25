/* eslint-disable @typescript-eslint/no-require-imports -- Node 내장 CJS 테스트에서 TS 서버 모듈을 격리해 실행한다. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function fixture({ env = {}, fetch: backend = async () => { throw Error("예상하지 않은 BE 요청"); }, incoming = {}, signupAccount = async () => ({ provider: "GOOGLE", displayName: "테스트" }), document } = {}) {
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
    "next/navigation": { redirect, unstable_rethrow: (error) => { if (error.location) throw error; } },
    "next/cache": { revalidatePath: () => {} },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/features/auth/server": { getSignupAccount: signupAccount },
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
    vm.runInNewContext(output, { module: record, exports: record.exports, require: (id) => load(id, path.dirname(file)), process: { env: { AUTH_USE_MOCK: "false", NODE_ENV: "test", ...env } }, fetch: backend, Headers, Request, Response, URL, URLSearchParams, FormData, Blob, File, Buffer, AbortController, setTimeout, clearTimeout, document }, { filename: file });
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

test("공통 오류의 traceId·추가 데이터·필드 오류를 보존한다", async () => {
  const f = fixture({ fetch: async () => Response.json({ success: false, error: { code: "AUTH_ACCOUNT_SUSPENDED", message: "정지된 계정입니다.", traceId: "fixture-trace", data: "2040-01-01T09:00:00+09:00", errors: [{ field: "name", reason: "이름 오류" }] } }, { status: 403 }) });
  await assert.rejects(f.load("@/lib/api").api("/api/v1/auth/refresh"), (error) => error.traceId === "fixture-trace" && error.data === "2040-01-01T09:00:00+09:00" && error.fields[0].field === "name");
});

const sessionRequest = () => new Request("http://localhost:3000/api/auth/session", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" }, body: "{}" });

test("정지 오류는 403과 종료 시각을 보존하고 로그인으로 안내한다", async () => {
  const f = fixture({ fetch: async () => Response.json({ success: false, error: { code: "AUTH_ACCOUNT_SUSPENDED", message: "정지된 계정입니다.", traceId: "fixture-suspend", data: "2040-01-01T09:00:00+09:00" } }, { status: 403 }) });
  f.jar.set("refreshToken", "fixture-old");
  const response = await f.load("@/app/api/auth/session/route").POST(sessionRequest());
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.until, "2040-01-01T09:00:00+09:00");
  assert.equal(body.traceId, "fixture-suspend");
  assert.equal(new URL(body.redirectTo, "http://localhost:3000").searchParams.get("error"), "AUTH_ACCOUNT_SUSPENDED");
  assert.equal(f.jar.has("refreshToken"), false);
});

test("일시 장애는 503으로 유지하며 정상 refresh 쿠키를 지우지 않는다", async () => {
  const f = fixture({ fetch: async () => { throw new TypeError("fixture network failure"); } });
  f.jar.set("refreshToken", "fixture-old");
  const response = await f.load("@/app/api/auth/session/route").POST(sessionRequest());
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.redirectTo, undefined);
  assert.equal(f.values.get("refreshToken"), "fixture-old");
});

function signupForm(name = "테스트") { const form = new FormData(); form.set("name", name); form.set("terms", "on"); form.set("privacy", "on"); return form; }

test("이름의 서버 오류는 필드 오류와 traceId로 반환한다", async () => {
  const f = fixture({ fetch: async () => Response.json({ success: false, error: { code: "COMMON_INVALID_INPUT", message: "입력 오류", traceId: "fixture-name", errors: [{ field: "name", reason: "다른 이름을 입력해 주세요." }] } }, { status: 400 }) });
  const result = await f.load("@/features/auth/actions").completeMockSignupAction("fixture-ticket", undefined, {}, signupForm());
  assert.equal(result.nameError, "다른 이름을 입력해 주세요.");
  assert.equal(result.traceId, "fixture-name");
  assert.equal(result.error, undefined);
});

test("가입 티켓 조회 장애를 만료로 바꾸지 않는다", async () => {
  const f = fixture({ signupAccount: async () => { throw new Error("fixture offline"); } });
  const result = await f.load("@/features/auth/actions").completeMockSignupAction("fixture-ticket", undefined, {}, signupForm());
  assert(!result.error.includes("만료"));
  assert(result.error.includes("다시 시도"));
});

test("만료 티켓은 내부 복귀 경로를 보존해 로그인으로 보낸다", async () => {
  const f = fixture({ signupAccount: async () => null });
  await assert.rejects(f.load("@/features/auth/actions").completeMockSignupAction("expired", "/invite/fixture", {}, signupForm()), (error) => new URL(error.location, "http://localhost:3000").searchParams.get("error") === "AUTH_SIGNUP_TICKET_INVALID" && new URL(error.location, "http://localhost:3000").searchParams.get("returnPath") === "/invite/fixture");
});

test("명세 밖 문자와 영구 정지를 구분한다", async () => {
  const f = fixture();
  const result = await f.load("@/features/auth/actions").completeMockSignupAction("fixture-ticket", undefined, {}, signupForm("Иван"));
  assert(result.nameError);
  assert(f.load("@/features/auth/errors").getLoginErrorMessage("AUTH_ACCOUNT_SUSPENDED").includes("영구"));
});

test("프록시용 Server Action Origin은 운영 도메인만 추가로 허용한다", () => {
  const config = fixture().load("../next.config.ts").default;
  const { isCsrfOriginAllowed } = require("next/dist/server/app-render/csrf-protection");
  const allowed = config.experimental.serverActions.allowedOrigins;
  assert.equal(isCsrfOriginAllowed("moayo.site", allowed), true);
  assert.equal(isCsrfOriginAllowed("evil.invalid", allowed), false);
  assert.equal(isCsrfOriginAllowed("moayo.site.evil.invalid", allowed), false);
});

test("가입 제출 시 만료도 traceId를 보존해 로그인으로 이동한다", async () => {
  const f = fixture({ fetch: async () => Response.json({ success: false, error: { code: "AUTH_SIGNUP_TICKET_INVALID", message: "가입 정보가 만료됐어요.", traceId: "fixture-expired" } }, { status: 400 }) });
  await assert.rejects(f.load("@/features/auth/actions").completeMockSignupAction("fixture-ticket", undefined, {}, signupForm()), (error) => new URL(error.location, "http://localhost:3000").searchParams.get("traceId") === "fixture-expired");
});

test("API 재시도 중 정지되면 쿠키를 정리하고 종료 시각을 안내한다", async () => {
  const f = fixture({ fetch: async (url) => new URL(url).pathname.endsWith("/refresh") ? Response.json({ success: false, error: { code: "AUTH_ACCOUNT_SUSPENDED", message: "정지 계정", data: "2040-01-01T09:00:00+09:00", traceId: "fixture-refresh" } }, { status: 403 }) : expired() });
  f.jar.set("refreshToken", "fixture-old");
  await assert.rejects(f.load("@/lib/api").api("/api/v1/test-resource", { allowAuthRefresh: true }), (error) => new URL(error.location, "http://localhost:3000").searchParams.get("until") === "2040-01-01T09:00:00+09:00");
  assert.equal(f.jar.has("refreshToken"), false);
});

test("명시적 복귀 경로가 없으면 실제 계정의 마지막 방으로 이동한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/auth/refresh") return ok(tokens);
    assert.equal(path, "/api/v1/accounts/me");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access");
    return ok({ lastRoomId: 12 });
  } });
  f.jar.set("refreshToken", "fixture-refresh");
  const response = await f.load("@/app/api/auth/session/route").POST(sessionRequest());
  assert.deepEqual(await response.json(), { redirectTo: "/rooms/12" });
});

test("회원 탈퇴는 확인 문구를 JSON으로 보내고 refresh 삭제 쿠키를 보존한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new URL(url).pathname, "/api/v1/accounts/me");
    assert.equal(init.method, "DELETE");
    assert.deepEqual(JSON.parse(init.body), { confirmText: "탈퇴합니다" });
    return ok(null, "refreshToken=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  } });
  f.jar.set("accessToken", "fixture-access");
  f.jar.set("refreshToken", "fixture-refresh");
  const input = new FormData();
  input.set("confirmText", "탈퇴합니다");
  await assert.rejects(f.load("@/features/account/actions").withdrawAccountAction({}, input), (error) => error.location === "/");
  assert.equal(f.values.has("accessToken"), false);
  assert.equal(f.options.get("refreshToken").maxAge, 0);
});

test("최초 프로필 건너뛰기는 빈 객체로 방 프로필을 갱신한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/accounts/me") return ok({ accountId: 12, name: "테스트", provider: "GOOGLE", email: "", role: "USER", toneMode: "OFF", createdAt: "2026-11-01" });
    if (path === "/api/v1/rooms/3") return ok({ roomId: 3, name: "테스트 방", myMembership: {}, needsProfileSetup: true });
    assert.equal(path, "/api/v1/rooms/3/members/me/profile");
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(init.body), {});
    return ok({ accountId: 12 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const input = new FormData();
  input.set("intent", "skip");
  await assert.rejects(f.load("@/features/room/first-profile/actions").completeFirstRoomProfileAction("3", {}, input), (error) => error.location === "/rooms/3");
});

test("프로필 이름만 수정할 때 이미지와 역할 표시 키를 보내지 않는다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/accounts/me") return ok({ accountId: 12, name: "테스트", provider: "GOOGLE", email: "", role: "USER", toneMode: "OFF", createdAt: "2026-11-01" });
    if (path === "/api/v1/rooms/3") return ok({ roomId: 3, name: "테스트 방", myMembership: { nickname: "이전 이름", positionLabel: "디자인", profileImageUrl: "https://fixture.invalid/photo" } });
    assert.equal(path, "/api/v1/rooms/3/members/me/profile");
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(init.body), { nickname: "새 이름" });
    return ok({ accountId: 12 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const input = new FormData();
  input.set("nickname", "새 이름");
  assert.equal((await f.load("@/features/room/profile/actions").updateRoomProfileAction("3", {}, input)).success, true);
});

test("방 개설은 JSON multipart 파트를 보내고 서버가 반환한 방으로 이동한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new URL(url).pathname, "/api/v1/rooms");
    assert.equal(init.method, "POST");
    assert.equal(new Headers(init.headers).has("content-type"), false);
    const request = init.body.get("request");
    assert.equal(request.type, "application/json");
    assert.deepEqual(JSON.parse(await request.text()), { name: "연동 테스트", description: "" });
    assert.equal(init.body.has("image"), false);
    return ok({ roomId: 31 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const input = new FormData();
  input.set("name", "연동 테스트");
  await assert.rejects(f.load("@/features/room/management/actions").saveManagedRoomAction(null, {}, input), (error) => error.location === "/rooms/31");
});

test("방 설명을 비우면 빈 문자열만 PATCH하고 기존 이미지를 유지한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new URL(url).pathname, "/api/v1/rooms/3");
    if (!init.method) return ok({ roomId: 3, name: "테스트 방", description: "기존 설명", myMembership: { role: "OWNER" } });
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(init.body), { description: "" });
    return ok({ roomId: 3 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const input = new FormData();
  input.set("description", "");
  const result = await f.load("@/features/room/management/actions").saveManagedRoomAction(3, {}, input);
  assert.equal(result.success, true);
});

test("채팅 사이드바 목록은 활성 방의 채널 API를 사용한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/rooms") return ok([{ roomId: 3, name: "활성 방", status: "ACTIVE" }, { roomId: 4, name: "비활성 방", status: "INACTIVE" }]);
    assert.equal(path, "/api/v1/rooms/3/channels");
    return ok([{ channelId: 16, channelType: "PUBLIC", name: "일반" }, { channelId: 17, channelType: "DIRECT", peer: { accountId: 20, displayName: "모아" } }]);
  } });
  f.jar.set("accessToken", "fixture-access");
  const { listMyChannels, listMyDmThreads } = f.load("@/features/chat/server");
  const [channels, dms] = await Promise.all([listMyChannels(), listMyDmThreads()]);
  assert.equal(channels[0].id, 16);
  assert.equal(dms[0].roomId, 3);
  assert.equal(dms[0].accountId, 20);
});

test("대시보드 조회는 Bearer를 붙이고 레이아웃 버전과 위젯 좌표를 매핑한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new URL(url).pathname, "/api/v1/rooms/3/dashboard");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access");
    return ok({ layoutVersion: 7, widgets: [{ widgetId: 11, widgetType: "MOOD", x: 0, y: 1, w: 3, h: 4 }] });
  } });
  f.jar.set("accessToken", "fixture-access");
  const { getDashboardSnapshot, usesMockDashboardEvents } = f.load("@/features/widget/server");
  const snapshot = await getDashboardSnapshot(3);
  assert.equal(usesMockDashboardEvents(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    revision: 7,
    widgets: [{ id: 11, roomId: 3, widgetType: "MOOD", x: 0, y: 1, width: 3, height: 4 }],
    editors: [],
  });
});

test("위젯 추가는 서버 최신 배치에서 빈자리를 계산한다", async () => {
  const mood = { widgetId: 11, widgetType: "MOOD", x: 0, y: 0, w: 3, h: 4 };
  const calls = [];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    calls.push(new URL(url).pathname);
    if (!init.method) return ok({ layoutVersion: 7, widgets: [mood] });
    assert.equal(init.method, "POST");
    const placement = JSON.parse(init.body);
    assert.deepEqual(placement, { widgetType: "VOTE", x: 3, y: 0, w: 3, h: 3 });
    return ok({ layoutVersion: 8, widgets: [mood, { widgetId: 12, ...placement }] });
  } });
  f.jar.set("accessToken", "fixture-access");
  const result = await f.load("@/features/widget/actions").addWidgetAction(3, "VOTE");
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.revision, 8);
  assert.deepEqual(calls, ["/api/v1/rooms/3/dashboard", "/api/v1/rooms/3/dashboard/widgets"]);
});

test("배치 충돌 시 오류 메시지와 최신 서버 스냅샷을 함께 반환한다", async () => {
  const calls = [];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    calls.push(new URL(url).pathname);
    if (!init.method) return ok({ layoutVersion: 9, widgets: [{ widgetId: 11, widgetType: "MOOD", x: 2, y: 0, w: 3, h: 4 }] });
    assert.equal(init.method, "PUT");
    assert.deepEqual(JSON.parse(init.body), { widgets: [{ widgetId: 11, x: 0, y: 4, w: 3, h: 4 }] });
    return Response.json({ success: false, error: { code: "DASHBOARD_WIDGET_OVERLAP", message: "다른 위젯과 겹치는 위치입니다." } }, { status: 409 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const result = await f.load("@/features/widget/actions").saveWidgetPlacementAction(3, 11, { x: 0, y: 4, width: 3, height: 4 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DASHBOARD_WIDGET_OVERLAP");
  assert.equal(result.message, "다른 위젯과 겹치는 위치입니다.");
  assert.equal(result.snapshot.revision, 9);
  assert.deepEqual(calls, ["/api/v1/rooms/3/dashboard/layout", "/api/v1/rooms/3/dashboard"]);
});

test("위젯 제거와 레이아웃 초기화는 서버가 반환한 새 ID를 사용한다", async () => {
  const calls = [];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    calls.push([init.method, new URL(url).pathname]);
    assert.equal(init.body, undefined);
    const widgetId = init.method === "DELETE" ? 11 : 21;
    return ok({ layoutVersion: widgetId, widgets: [{ widgetId, widgetType: "MOOD", x: 0, y: 0, w: 3, h: 4 }] });
  } });
  f.jar.set("accessToken", "fixture-access");
  const actions = f.load("@/features/widget/actions");
  assert.equal((await actions.removeWidgetAction(3, 12)).snapshot.widgets[0].id, 11);
  assert.equal((await actions.resetWidgetLayoutAction(3)).snapshot.widgets[0].id, 21);
  assert.deepEqual(calls, [["DELETE", "/api/v1/rooms/3/dashboard/widgets/12"], ["POST", "/api/v1/rooms/3/dashboard/reset"]]);
});

test("다운로드는 매번 새 서명 URL을 발급받아 302로 이동한다", async () => {
  let calls = 0;
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new URL(url).pathname + new URL(url).search, "/api/v1/rooms/3/files/41/download-url");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access");
    return ok({ url: "https://storage.example/meeting.pdf?signature=" + ++calls });
  } });
  f.jar.set("accessToken", "fixture-access");
  const { downloadRoomFile } = f.load("@/features/room-files/server");
  for (const signature of [1, 2]) {
    const response = await downloadRoomFile("3", "41");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("location"), "https://storage.example/meeting.pdf?signature=" + signature);
  }
});

test("활성 공지 배너는 활성 목록의 종료 시각을 사용한다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url) => {
    assert.equal(new URL(url).pathname + new URL(url).search, "/api/v1/notices/active");
    return ok({
      banner: { noticeId: 9, noticeType: "URGENT", title: "긴급 점검" },
      notices: [{ noticeId: 9, noticeType: "URGENT", displayEndsAt: "2040-01-01T00:00:00Z" }],
    });
  } });
  f.jar.set("accessToken", "fixture-access");
  const result = await f.load("@/features/notice/server").getNoticeBanner();
  assert.equal(result.banner.noticeId, 9);
  assert.equal(result.refreshAt, Date.parse("2040-01-01T00:00:00Z"));
});

test("댓글과 메시지 신고는 명세 필드만 제출하고 서버의 중복 오류를 반환한다", async () => {
  const targets = ["COMMENT", "MESSAGE"];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new URL(url).pathname + new URL(url).search, "/api/v1/reports");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { targetId: 41, targetType: targets.shift(), reason: "ABUSE" });
    return Response.json({ success: false, error: { code: "REPORT_DUPLICATED", message: "이미 신고한 내용입니다." } }, { status: 409 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const { submitReportAction } = f.load("@/features/report/actions");
  for (const targetType of ["COMMENT", "MESSAGE"]) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ roomId: "3", targetId: "41", targetType, reason: "ABUSE" })) form.set(key, value);
    assert.equal((await submitReportAction({}, form)).error, "이미 신고한 내용입니다.");
  }
});

test("허용되지 않은 첨부 확장자와 20MB 초과 파일은 백엔드 호출 전에 막는다", async () => {
  const f = fixture();
  const { uploadRoomFile } = f.load("@/features/room-files/upload-server");
  await assert.rejects(uploadRoomFile(3, "CARD_ATTACHMENT", new File(["content"], "sample.exe")), { code: "FILE_TYPE_NOT_ALLOWED" });
  await assert.rejects(uploadRoomFile(3, "CHAT_ATTACHMENT", new File([new Uint8Array(20 * 1024 ** 2 + 1)], "sample.pdf")), { code: "FILE_SIZE_EXCEEDED" });
});

test("팀 상태는 선택한 기간의 오늘 현황과 날짜별 평균을 한 요청으로 조회한다", async () => {
  const queries = [];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const target = new URL(url);
    assert.equal(target.pathname, "/api/v1/rooms/3/moods");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access");
    const period = target.searchParams.get("period");
    queries.push(period);
    const length = period === "DAYS_30" ? 30 : 7;
    return ok({
      distribution: { VERY_GOOD: 1, NORMAL: 1 },
      members: [{ accountId: 7, displayName: "모아", profileImageUrl: null, mood: null, comment: null }],
      trend: Array.from({ length }, (_, index) => ({
        date: "2026-11-" + String(index + 1).padStart(2, "0"),
        counts: index === 1 ? { VERY_GOOD: 1, NORMAL: 1 } : {},
      })),
    });
  } });
  f.jar.set("accessToken", "fixture-access");
  const { getTeamMood } = f.load("@/features/mood/server");
  for (const period of [7, 30]) {
    const data = await getTeamMood(3, period);
    assert.equal(data.distribution.VERY_GOOD, 1);
    assert.equal(data.members[0].mood, null);
    assert.equal(data.trend.length, period);
    assert.equal(data.trend[0].average, null);
    assert.equal(data.trend[1].average, 4);
  }
  assert.deepEqual(queries, ["DAYS_7", "DAYS_30"]);
});

test("위젯 기분 변경은 내 한마디를 유지하고 상세 화면에서는 지울 수 있다", async () => {
  const writes = [];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const target = new URL(url);
    if (target.pathname === "/api/v1/accounts/me") return ok({
      accountId: 7, name: "모아", email: "", provider: "GOOGLE", role: "USER",
      toneMode: "OFF", createdAt: "2026-11-01T00:00:00+09:00",
    });
    if (target.pathname === "/api/v1/rooms/3/moods") {
      assert.equal(target.search, "?period=TODAY");
      return ok({ members: [{ accountId: 8, comment: "다른 멤버" }, { accountId: 7, comment: "기존 한마디" }] });
    }
    assert.equal(target.pathname, "/api/v1/rooms/3/moods/me");
    assert.equal(init.method, "PUT");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access");
    writes.push(JSON.parse(init.body));
    return ok(null);
  } });
  f.jar.set("accessToken", "fixture-access");
  const { submitMoodAction, saveMoodFormAction } = f.load("@/features/mood/actions");
  assert.equal((await submitMoodAction({ roomId: 3, mood: "VERY_GOOD" })).saved, true);
  const form = new FormData();
  form.set("mood", "NORMAL");
  form.set("note", " ");
  assert.equal((await saveMoodFormAction(3, {}, form)).saved, true);
  form.set("note", "가".repeat(51));
  assert.equal((await saveMoodFormAction(3, {}, form)).saved, undefined);
  assert.deepEqual(writes, [{ mood: "VERY_GOOD", comment: "기존 한마디" }, { mood: "NORMAL", comment: null }]);
});

test("목 상태값 저장은 같은 방의 오늘 기록을 갱신하고 한마디를 보존한다", async () => {
  const f = fixture({ env: { AUTH_USE_MOCK: "true", NEXT_PUBLIC_USE_MOCK: "true" } });
  const { submitMoodAction } = f.load("@/features/mood/actions");
  const { getTeamMood } = f.load("@/features/mood/server");
  const { getMyAccount } = f.load("@/features/account/server");
  const me = await getMyAccount();
  const { listMyRooms } = f.load("@/features/room/server");
  const [room] = await listMyRooms();
  assert.equal((await submitMoodAction({ roomId: room.id, mood: "GOOD", comment: "한마디" })).saved, true);
  assert.equal((await submitMoodAction({ roomId: room.id, mood: "EXHAUSTED" })).saved, true);
  const data = await getTeamMood(room.id, 7);
  assert.equal(data.members.find(({ id }) => id === me.id).note, "한마디");
  assert.equal(data.members.find(({ id }) => id === me.id).mood, "EXHAUSTED");
  assert.equal(data.trend.length, 7);
});

test("공유 이미지에는 선택한 기간의 추이와 기록 없는 날도 표시한다", () => {
  const labels = [];
  const context = { scale() {}, fillRect() {}, fillText(text) { labels.push(text); } };
  const f = fixture({ document: { createElement: () => ({ getContext: () => context }) } });
  const { drawMoodImage } = f.load("@/features/mood/share-image");
  drawMoodImage({
    roomName: "모아", date: "2026-11-25", period: 7,
    trend: [{ date: "2026-11-24", average: null }, { date: "2026-11-25", average: 4 }],
    distribution: { GOOD: 1 }, members: [], includeNotes: false, background: "white", foreground: "black",
  });
  assert.ok(labels.includes("오늘 1명 참여 · 평균 4.0"));
  assert.ok(labels.includes("최근 7일 평균 추이"));
  assert.ok(labels.includes("11-24  —"));
  assert.ok(labels.includes("11-25  4.0"));
});

test("아이디어 보드는 지난 회차 카드의 목록 본문을 사용하고 현재 회차도 유지한다", async () => {
  const calls = [];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const route = new URL(url);
    const endpoint = route.pathname + route.search;
    calls.push(endpoint);
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access");
    if (route.pathname.endsWith("/sessions/current")) return ok({ sessionId: 4, status: "IN_PROGRESS" });
    if (route.pathname.endsWith("/sessions/3")) return ok({ sessionId: 3, status: "CLOSED", cardCount: 1, participantCount: 2 });
    if (route.pathname.endsWith("/sessions")) return ok({ content: [{ sessionId: 3 }], hasNext: true });
    assert.equal(endpoint, "/api/v1/rooms/7/idea-cards?sessionId=3");
    return ok([{ cardId: 31, cardType: "AGENDA", content: "목록 본문", version: 2, createdAt: "2026-11-01T00:00:00Z" }]);
  } });
  f.jar.set("accessToken", "fixture-access");
  const board = await f.load("@/features/idea/server").getIdeaBoard(7, 3, 0);
  assert.equal(board.active.id, 4);
  assert.equal(board.selected.id, 3);
  assert.equal(board.selected.participantCount, 2);
  assert.equal(board.hasNextHistory, true);
  assert.equal(board.cards[0].content, "목록 본문");
  assert.equal(board.cards[0].sessionId, 3);
  assert.equal(board.usesMockStream, false);
  assert.equal(calls.length, 4);
});

test("아이디어 카드 이동 충돌은 서버가 제공한 최신 순서와 버전을 돌려준다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new URL(url).pathname, "/api/v1/rooms/7/idea-cards/31/position");
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(init.body), { cardType: "KEEP", toIndex: 0, version: 2 });
    return Response.json({ success: false, error: { code: "CARD_VERSION_CONFLICT", message: "최신 카드가 있어요.", data: { cardId: 31, cardType: "TRY", sortOrder: 1, version: 3 } } }, { status: 409 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const result = await f.load("@/features/idea/position-actions").moveIdeaCard(7, 31, { cardType: "KEEP", toIndex: 0, version: 2 });
  assert.equal(result.error, "최신 카드가 있어요.");
  assert.equal(result.cards[0].cardType, "TRY");
  assert.equal(result.cards[0].version, 3);
});

test("새 아이디어 카드에는 활성 회차를 확인하고 업로드한 파일 ID를 보낸다", async () => {
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/sessions/current")) return ok({ sessionId: 3 });
    assert.equal(path, "/api/v1/rooms/7/idea-cards");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { cardType: "AGENDA", title: "회고", content: "의견", fileIds: [41, 42] });
    return ok({ cardId: 31 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const form = new FormData();
  form.set("type", "AGENDA");
  form.set("title", "회고");
  form.set("content", "의견");
  form.append("fileId", "41");
  form.append("fileId", "42");
  const { saveIdeaCard } = f.load("@/features/idea/actions");
  assert.equal((await saveIdeaCard(7, 3, null, {}, form)).saved, true);
  assert.match((await saveIdeaCard(7, 2, null, {}, form)).error, /회차가 바뀌었어요/);
});

test("아이디어 상세 흐름은 편집 잠금과 댓글·리액션에 각각 명세 메서드를 사용한다", async () => {
  const operations = [
    ["POST", "/edit-lock", undefined],
    ["POST", "/comments", { content: "새 의견" }],
    ["PATCH", "/comments/51", { content: "수정 의견" }],
    ["DELETE", "/comments/51", undefined],
    ["PUT", "/reactions/FIRE", undefined],
    ["DELETE", "/reactions/FIRE", undefined],
    ["DELETE", "/edit-lock", undefined],
  ];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const [method, suffix, data] = operations.shift();
    assert.equal(new URL(url).pathname, "/api/v1/rooms/7/idea-cards/31" + suffix);
    assert.equal(init.method, method);
    assert.deepEqual(init.body === undefined ? undefined : JSON.parse(init.body), data);
    return ok(null);
  } });
  f.jar.set("accessToken", "fixture-access");
  const actions = f.load("@/features/idea/discussion-actions");
  assert.equal((await actions.setIdeaEditLock(7, 31, true)).saved, true);
  assert.equal((await actions.changeIdeaComment(7, 31, "add", null, "새 의견")).saved, true);
  assert.equal((await actions.changeIdeaComment(7, 31, "edit", 51, "수정 의견")).saved, true);
  assert.equal((await actions.changeIdeaComment(7, 31, "remove", 51, "")).saved, true);
  assert.equal((await actions.setIdeaReaction(7, 31, "FIRE", true)).saved, true);
  assert.equal((await actions.setIdeaReaction(7, 31, "FIRE", false)).saved, true);
  assert.equal((await actions.setIdeaEditLock(7, 31, false)).saved, true);
  assert.equal(operations.length, 0);
});

test("목 보드는 댓글과 리액션을 저장하고 마감 후에도 카드 이동을 허용한다", async () => {
  const f = fixture({ env: { AUTH_USE_MOCK: "true", NEXT_PUBLIC_USE_MOCK: "true" } });
  const [room] = await f.load("@/features/room/server").listMyRooms();
  const { getIdeaBoard } = f.load("@/features/idea/server");
  const { saveIdeaCard, startIdeaSession, closeIdeaSession } = f.load("@/features/idea/actions");
  const { moveIdeaCard } = f.load("@/features/idea/position-actions");
  const { changeIdeaComment, setIdeaReaction, loadIdeaCardDetail } = f.load("@/features/idea/discussion-actions");
  let { active } = await getIdeaBoard(room.id);
  if (!active) {
    const session = new FormData();
    session.set("title", "목 회고");
    assert.equal((await startIdeaSession(room.id, {}, session)).saved, true);
    ({ active } = await getIdeaBoard(room.id));
  }
  const form = new FormData();
  form.set("type", "AGENDA");
  form.set("title", "목 저장 확인");
  form.set("content", "");
  assert.equal((await saveIdeaCard(room.id, active.id, null, {}, form)).saved, true);
  const card = (await getIdeaBoard(room.id)).cards.find(({ title }) => title === "목 저장 확인");
  assert.equal((await changeIdeaComment(room.id, card.id, "add", null, "새 댓글")).saved, true);
  assert.equal((await setIdeaReaction(room.id, card.id, "FIRE", true)).saved, true);
  const detail = await loadIdeaCardDetail(room.id, card.id);
  assert.equal(detail.discussion.comments[0].text, "새 댓글");
  assert.equal(detail.discussion.reactions[0].count, 1);
  assert.equal((await closeIdeaSession(room.id, active.id)).saved, true);
  assert.equal((await changeIdeaComment(room.id, card.id, "add", null, "차단")).saved, undefined);
  assert.equal((await moveIdeaCard(room.id, card.id, { cardType: "TRY", toIndex: 0, version: 0 })).saved, true);
});

test("브리핑은 소식 전체 건수를 유지하며 확인과 유형별 소거를 구분한다", async () => {
  const calls = [];
  const root = "/api/v1/rooms/7/briefing";
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const { pathname, search } = new URL(url);
    assert.equal(search, "");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer fixture-access");
    calls.push([init.method ?? "GET", pathname, init.body]);
    return ok({ visible: true, teamNews: [{ eventType: "TASK_CREATED", count: 25, items: [
      { eventId: 1, targetType: "TASK", targetId: 31, title: "회고 준비", actorName: "서윤", createdAt: "2026-11-22T18:00:00+09:00" },
    ] }] });
  } });
  f.jar.set("accessToken", "fixture-access");
  const briefing = await f.load("@/features/briefing/server").getRoomBriefing(7);
  const { briefingTargetHref } = f.load("@/features/briefing/model");
  assert.equal(briefing.counts.TASK_CREATED, 25);
  assert.equal(briefing.news[0].summary, "서윤님이 새 업무를 등록했어요.");
  assert.equal(briefing.news[0].title, "회고 준비");
  assert.equal(briefingTargetHref(briefing.news[0].target), "/rooms/7/boards/task?open=31&briefingFocus=31");
  const { confirmBriefingAction } = f.load("@/features/briefing/actions");
  assert.equal((await confirmBriefingAction(7, "CARD_CONVERTED")).ok, false);
  assert.equal((await confirmBriefingAction(7, "TASK_CREATED")).ok, true);
  assert.equal((await confirmBriefingAction(7)).ok, true);
  assert.deepEqual(calls, [
    ["GET", root, undefined],
    ["POST", root + "/dismiss", JSON.stringify({ eventType: "TASK_CREATED" })],
    ["POST", root + "/check", undefined],
  ]);
});

test("중재는 상태 필터와 목록 정렬을 적용하고 해제된 충돌의 열린 초안을 보여 준다", async () => {
  const root = "/api/v1/rooms/7/conflicts";
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer fixture-access");
    const { pathname, search } = new URL(url);
    if (pathname === root + "/9") return ok({
      status: "DISMISSED", cardA: { cardId: 41, sessionId: 3, sessionClosed: true },
      myDraft: { draftId: 12, cardType: "AGENDA", title: "절충", status: "DRAFT" },
    });
    assert.equal(pathname, root);
    if (search === "?status=PROPOSED") return ok([
      { conflictId: 7, status: "PROPOSED", detectedAt: "2026-11-22T17:00:00+09:00", adoptedCardId: 31 },
      { conflictId: 8, status: "PROPOSED", detectedAt: "2026-11-22T18:00:00+09:00" },
    ]);
    return Response.json({ success: false, error: { code: "MEDIATION_WIDGET_REQUIRED", message: "중재 위젯을 추가하세요." } }, { status: 409 });
  } });
  f.jar.set("accessToken", "fixture-access");
  const { getMediationBoard, getMediationDetail } = f.load("@/features/mediation/server");
  const { needsMediation } = f.load("@/features/mediation/model");
  const board = await getMediationBoard(7, "PROPOSED");
  assert.deepEqual(Array.from(board.items, ({ id }) => id), [8, 7]);
  assert.equal(board.items.filter(needsMediation).length, 1);
  assert.equal((await getMediationBoard(7)).enabled, false);
  const detail = await getMediationDetail(7, 9);
  assert.equal(detail.status, "DISMISSED");
  assert.equal(detail.draft.title, "절충");
  assert.equal(detail.left.href, "/rooms/7/boards/idea?session=3&open=41&briefingFocus=41");
});

test("중재 변경은 명세의 POST 경로와 본문을 사용하고 AI 한도 오류를 전달한다", async () => {
  const root = "/api/v1/rooms/7/conflicts/9";
  const calls = [];
  const f = fixture({ env: { NEXT_PUBLIC_USE_MOCK: "false" }, fetch: async (url, init) => {
    const pathname = new URL(url).pathname;
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer fixture-access");
    calls.push([init.method, pathname, init.body ? JSON.parse(init.body) : undefined]);
    if (pathname.endsWith("/compromise-drafts")) {
      return Response.json({ success: false, error: { code: "AI_QUOTA_EXCEEDED", message: "오늘 한도를 초과했어요." } }, { status: 429 });
    }
    return ok(null);
  } });
  f.jar.set("accessToken", "fixture-access");
  const actions = f.load("@/features/mediation/actions");
  assert.equal((await actions.generateCompromise(7, 9)).error, "오늘 한도를 초과했어요.");
  assert.equal((await actions.dismissConflict(7, 9)).saved, true);
  assert.equal((await actions.discardCompromise(7, 9, 12)).saved, true);
  const form = new FormData();
  form.set("title", "새 제목");
  assert.equal((await actions.adoptCompromise(7, 9, 12, {}, form)).saved, true);
  assert.deepEqual(calls, [
    ["POST", root + "/compromise-drafts", undefined],
    ["POST", root + "/dismiss", undefined],
    ["POST", root + "/compromise-drafts/12/discard", undefined],
    ["POST", root + "/compromise-drafts/12/adopt", { title: "새 제목", content: "" }],
  ]);
});

test("목 중재는 초안 폐기 후 재감지되고 해제한 충돌의 열린 초안을 채택한다", async () => {
  const f = fixture({ env: { AUTH_USE_MOCK: "true", NEXT_PUBLIC_USE_MOCK: "true" } });
  const [room] = await f.load("@/features/room/server").listMyRooms();
  const { getMediationBoard, getMediationDetail } = f.load("@/features/mediation/server");
  const { generateCompromise, discardCompromise, dismissConflict, adoptCompromise } = f.load("@/features/mediation/actions");
  const [conflict] = (await getMediationBoard(room.id)).items;
  const detail = () => getMediationDetail(room.id, conflict.id);
  assert.equal((await generateCompromise(room.id, conflict.id)).saved, true);
  assert.equal((await detail()).status, "PROPOSED");
  assert.equal((await discardCompromise(room.id, conflict.id, (await detail()).draft.id)).saved, true);
  assert.equal((await detail()).status, "REDETECTED");
  assert.equal((await generateCompromise(room.id, conflict.id)).saved, true);
  assert.equal((await dismissConflict(room.id, conflict.id)).saved, true);
  assert.ok((await generateCompromise(room.id, conflict.id)).error);
  const form = new FormData();
  form.set("title", "목 절충안");
  assert.equal((await adoptCompromise(room.id, conflict.id, (await detail()).draft.id, {}, form)).saved, true);
  assert.equal((await detail()).status, "DISMISSED");
  assert.match((await detail()).adoptedHref, /open=\d+/);
  assert.equal((await detail()).draft, null);
});
