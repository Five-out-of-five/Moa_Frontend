# 로그인 연동과 화면 목 데이터 유지

## 설정

인증과 도메인 데이터는 별도로 전환한다. 실제 환경변수 파일은 수정·커밋하지 않았으며 `.env.example`에는 값 없는 키만 제공한다.

로컬 실제 로그인 검증 시 `.env.local`에 다음 값을 지정하고 개발 서버를 재시작한다.

```dotenv
AUTH_USE_MOCK=false
NEXT_PUBLIC_USE_MOCK=true
BACKEND_BASE_URL=http://localhost:8080
AUTH_OAUTH_BASE_URL=http://localhost:8080
AUTH_FRONTEND_ORIGIN=http://localhost:3000
```

`npm run dev` 후 **http://localhost:3000/login**에서 시작한다. `localhost`와 `127.0.0.1`은 서로 다른 쿠키 호스트이므로 로그인 왕복에서 섞지 않는다.

운영은 AUTH_USE_MOCK=false, NEXT_PUBLIC_USE_MOCK=true를 유지한다. AUTH_OAUTH_BASE_URL과 AUTH_FRONTEND_ORIGIN은 https://moayo.site를 사용한다. BACKEND_BASE_URL은 배포 환경의 Next → BE 접속 주소로 설정한다. 환경변수 반영 후 프론트를 재빌드한다.

기존 AUTH_GOOGLE_LOGIN_URL / AUTH_KAKAO_LOGIN_URL / AUTH_NAVER_LOGIN_URL이 있으면 제공자별 URL을 우선한다. 없으면 OAuth base의 `/oauth2/authorization/{provider}`를 사용한다.

## 계약과 흐름

1. 로그인 버튼은 fetch·prefetch 대신 브라우저 링크로 OAuth 시작 BFF에 진입한다.
2. BFF는 내부 returnPath만 허용해 BE의 OAuth 시작 URL에 전달하고 복귀 경로를 5분간 보관한다.
3. 기존 회원은 `/auth/callback` 페이지를 먼저 렌더링한다. 첫 요청에서 refresh하지 않는다.
4. 페이지가 같은 사이트의 `POST /api/auth/session`을 호출하면 BFF가 refreshToken 쿠키로 BE refresh API를 호출한다.
5. accessToken은 Next의 httpOnly 쿠키에 저장하고 BE가 회전시킨 refreshToken의 속성을 유지해 브라우저에 전달한다. 토큰을 BFF JSON 응답이나 URL에 넣지 않는다.
6. 신규 회원의 `/signup?ticket=...&returnPath=...`는 `/signup/[ticket]?next=...`로 연결한다. 이름과 필수 약관 동의를 제출해 가입하며 응답 쿠키를 저장한다.
7. 성공하면 returnPath 또는 `/workspaces`로 이동한다. 외부 URL과 인증 경로로의 복귀는 거절한다.
8. 로그아웃은 BE 응답의 refreshToken 삭제 쿠키를 전달하고 로컬 accessToken·목 로그인 쿠키도 제거한다.

`/api/auth/callback`은 이전 링크 호환용이다. 이 경로에서도 refresh를 즉시 실행하지 않고 새 페이지로 넘긴다.

## 만료와 권한

- `api()`는 서버의 accessToken을 Bearer 헤더로 전달한다.
- `AUTH_ACCESS_TOKEN_EXPIRED`인 Server Action은 refresh 후 원래 요청을 한 번만 재시도한다. Route Handler는 쿠키 쓰기가 가능한 경우 `allowAuthRefresh: true`를 명시한다.
- Server Component는 쿠키를 쓸 수 없으므로 callback 페이지와 BFF를 거쳐 원래 페이지 조회를 재실행한다. 짧은 재시도 표식으로 연속 refresh 리다이렉트를 방지한다.
- 로그인 후 셸·계정·방 목록에서 실제 인증 세션을 확인한다. 목 계정 조회도 실제 인증 모드에서는 세션 검증을 먼저 거친다.
- 도메인 목 모드의 이름·역할·방 소속·카드 데이터는 기존 데모 계정 자료다. 실제 소셜 계정 ID를 목 방 소속과 임의로 혼합하지 않는다. 실제 방 데이터 연결은 각 도메인 API 연동 작업이다.

## 검증

```sh
npm run test:auth
npm run typecheck
```

계약 테스트는 로컬 대체 응답과 쿠키 저장소로 쿠키 회전·속성·삭제, 복귀 경로, CSRF, Bearer 재시도 1회, 읽기 전용 서버 조회의 callback 전환, 가입 필드를 확인한다.

구글·카카오·네이버의 실제 콘솔·계정·운영 CloudFront 환경은 이 테스트가 대신하지 않는다. 운영 전 아래 흐름을 실제 BE와 확인한다.

- 기존 회원 로그인과 신규 회원 가입, 초대 경로 복귀
- 액세스 토큰 만료 후 갱신·refreshToken 회전
- 로그아웃 후 두 토큰 쿠키 삭제와 보호 화면 접근 차단
- 정지 계정·이메일 중복·재가입 제한·만료 ticket 안내
- 운영 쿠키 Secure·Strict·호스트 일치

실제 토큰·쿠키·가입 티켓은 로그나 테스트 결과에 남기지 않는다.
