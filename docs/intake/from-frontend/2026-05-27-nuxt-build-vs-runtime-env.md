---
team: frontend
date: 2026-05-27
topic: "Nuxt 3 build-time vs runtime env injection — 프로덕션 reCAPTCHA 스크립트가 끝내 emit되지 않은 로그인 장애"
suggestedCategory: frontend
suggestedTags: ["nuxt3", "recaptcha", "env", "production-incident", "build-vs-runtime", "capacitor"]
redactionNote: "원본(frontend private repo)의 실제 도메인, host-split infra 결정 detail, PR 링크는 일반화. env var 이름은 표준 Nuxt 관례라 유지(값은 없음). 코드 스니펫은 리터럴 값 없음."
---

# (정제본) Nuxt build-time vs runtime env — 로그인 장애

> frontend 팀 raw 인테이크의 redaction 정제본. raw 원본은 frontend private repo의
> `docs/blog-intake/`에 있다. 포스트의 `sourceIntake`가 이 파일을 가리킨다.

## 무엇을

production 로그인이 두 단계로 깨졌고, 둘 다 같은 원인 — Nuxt `runtimeConfig.public`이
build-time인지 runtime인지의 혼동.

1. axios baseURL을 build-time 상대경로(`/api`)에서 runtime env 기반 절대 URL로 이동.
   host-split ingress라 same-origin `/api` 호출이 frontend로 라우팅돼 502(backend는
   요청 자체를 못 받음)였던 것을, 클라이언트가 backend host를 직접 호출하도록 변경.
2. 같은 패턴이 reCAPTCHA 스크립트 주입에도 필요. `nuxt.config.ts`의 build-time
   `head.script`에서 runtime client plugin으로 이동.

## 왜

- `nuxt.config.ts`는 **build 시점**에 evaluate된다. CI Docker build 컨테이너는 `.env*`를
  안 받으므로(gitignored+dockerignored), build-time `process.env.*_SITE_KEY`는 빈 값 →
  `<script src=...>`가 prod HTML head에 emit 안 됨. pod runtime env는 `useRuntimeConfig()`로
  읽히지만 그땐 이미 HTML이 build돼 굳은 뒤다.
- 대안(Docker build args + CI secret + Dockerfile ARG)은 ① secret 노출 surface↑ ② key
  변경 시 재빌드 ③ build env와 runtime env 이중 sync. runtime injection은 pod env 한 곳만.

## 공개 가능 (게재 OK)

- `runtimeConfig.public`은 server-injected라 클라이언트에서 deploy-time 값이 보이지만,
  `nuxt.config.ts`의 정적 부분(`app.head.script` 등)은 build 시점 evaluate → 같은 env에서
  다른 결과.
- "build-time이 필요한 것(preload, critical CSS, build-locked head src)" vs "runtime이
  필요한 것(API URL, feature flag, third-party site key)" 의식적 분리.
- 외부 third-party 스크립트는 client plugin에서 `useRuntimeConfig` 읽고 idempotent 가드
  후 `document.head.appendChild` 주입 — build 의존성 없이 깔끔.
- host-split ingress에서 클라이언트가 same-origin `/api`로 호출하면 502 invisible failure.
  backend log가 0줄이면 frontend→frontend self-loop 의심.
- 같은 패턴을 공유하는 두 단계 fix는, 첫 PR에서 패턴을 발견하면 인접 build-time-eval
  surface를 동시에 audit하는 게 두 번째 incident를 피하는 가장 싼 길.
- Capacitor 앱과 web을 같은 코드베이스로 운영 시 `isNativePlatform()` 분기로 web 전용
  스크립트를 건너뛰는 패턴.

## redaction 적용 (원본 → 일반화)

- 실제 prod 도메인(앱/API) → `example.com` / `api.example.com`
- host-split 선택의 내부 motivation·Helm coupling·CD 파일 구조 → "host-split + Helm coupling 패턴"
- PR #103/#104 GitHub 링크 → "두 PR(같은 패턴의 두 face)"
- env var 값 → 절대 비공개(본문에 없음). 이름(`NUXT_PUBLIC_*`)은 표준 관례라 유지.

## 외부 인용 링크 (공개)

- Nuxt 3 runtime config: https://nuxt.com/docs/guide/going-further/runtime-config
- reCAPTCHA v3: https://developers.google.com/recaptcha/docs/v3
