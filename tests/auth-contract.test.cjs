/* eslint-disable @typescript-eslint/no-require-imports -- Node 내장 CJS 테스트에서 TS 서버 모듈을 격리해 실행한다. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function fixture({ env = {}, fetch: backend = async () => { throw Error("예상하지 않은 BE 요청"); }, incoming = {}, signupAccount = async () => ({ provider: "GOOGLE", displayName: "테스트" }) } = {}) {
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
    vm.runInNewContext(output, { module: record, exports: record.exports, require: (id) => load(id, path.dirname(file)), process: { env: { AUTH_USE_MOCK: "false", NODE_ENV: "test", ...env } }, fetch: backend, Headers, Request, Response, URL, URLSearchParams, FormData, Blob, File, Buffer, AbortController, setTimeout, clearTimeout }, { filename: file });
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
