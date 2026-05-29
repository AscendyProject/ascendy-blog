---
title: "빌드타임 env vs 런타임 env — 같은 함정에 두 번 빠진 로그인 장애"
description: "Nuxt 3에서 production 로그인이 두 번 깨졌다. 둘 다 원인은 하나 — runtimeConfig.public이 build 시점에 evaluate되는지 runtime에 읽히는지의 혼동. CI 빌드 컨테이너가 env를 못 받아 reCAPTCHA 스크립트가 끝내 안 나간 사건."
pubDate: 2026-05-28
author: "Ascendy Engineering"
tags: ["nuxt3", "recaptcha", "env", "build-vs-runtime", "capacitor"]
category: "frontend"
lang: "ko"
translationKey: "nuxt-build-vs-runtime-env"
sourceIntake:
  - "docs/intake/from-frontend/2026-05-27-nuxt-build-vs-runtime-env.md"
draft: true
redactionReviewed: false
---

## TL;DR

- production 로그인이 **두 단계로** 깨졌고, 둘 다 같은 원인이었다 — Nuxt `runtimeConfig.public`이 **build 시점에 굳는지, runtime에 읽히는지**의 혼동.
- `nuxt.config.ts`는 빌드 시점에 evaluate된다. CI Docker 빌드 컨테이너는 `.env`를 받지 않으므로, build-time `process.env`로 만든 `<script>` 태그는 **빈 값으로 사라진다**.
- 첫 502를 잡고 끝난 줄 알았는데 같은 함정에 다시 빠졌다. 교훈: **한 패턴을 발견하면 인접한 build-time-eval 지점을 즉시 함께 audit하라.**

## 배경 — 첫 번째 502

production 로그인이 502로 죽었다. pod 환경변수는 정확히 설정돼 있었는데도. 원인은 ingress의 **host-split** 구조였다 — 앱과 API가 다른 호스트로 분리돼 있는데, 클라이언트가 same-origin 상대경로 `/api`로 호출하니 요청이 frontend로 라우팅돼 502가 났다. backend는 요청 자체를 받지 못했다.

> **invisible failure 신호:** backend 로그가 0줄인데 클라이언트는 502를 받는다면, frontend → frontend self-loop를 의심하라.

복구 경로는 둘이었다 — (A) ingress에 path 규칙 추가(분 단위 복구, 하지만 host-split 디자인을 흐림, infra 작업), (B) 클라이언트가 backend 호스트를 직접 호출(host-split 보존, 빌드+배포 cycle 필요). 시간 여유가 있어 **B**를 택했다. axios baseURL을 build-time 상대경로에서 **runtime env 기반 절대 URL**로 옮겼다.

```ts
// axios client (excerpt) — env-driven baseURL, dev fallback
const isNative = Capacitor.isNativePlatform()
const config = useRuntimeConfig()
const webApiBase = (config.public.apiBase as string) || '/api'
const baseURL = isNative ? (config.public.nativeApiUrl as string) : webApiBase
```

## 두 번째 함정 — 같은 원인, 다른 얼굴

로그인이 backend에 도달하기 시작했다. 그런데 이번엔 `RECAPTCHA_REQUIRED`. 추적해보니 **같은 build-time vs runtime 함정**이었다.

reCAPTCHA 스크립트는 `nuxt.config.ts`의 `head.script` 배열로 주입되고 있었다. 그런데 `nuxt.config.ts`는 **빌드 시점에 evaluate**된다. CI Docker 빌드 컨테이너는 `.env`를 받지 않는다(gitignored + dockerignored). 그래서 build-time `process.env.<...>_SITE_KEY`는 빈 값이고, `<script src=...>`가 prod HTML `<head>`에 **emit조차 되지 않았다**. pod의 runtime 환경변수는 `useRuntimeConfig().public`으로 읽히지만, 그 시점엔 이미 HTML이 빌드돼 굳은 뒤다.

해결: 빌드 시점 `head.script` 대신, **runtime client plugin**에서 `useRuntimeConfig`로 site key를 읽어 주입한다. 빌드 의존성이 사라진다.

```ts
// runtime client plugin — third-party 스크립트 주입 (build 의존성 없음)
import { Capacitor } from '@capacitor/core'
const SRC = 'https://www.google.com/recaptcha/api.js'

export default defineNuxtPlugin(() => {
  if (Capacitor.isNativePlatform()) return          // web 전용
  const siteKey = useRuntimeConfig().public.recaptchaSiteKey as string
  if (!siteKey || typeof window === 'undefined') return
  if ((window as any).grecaptcha) return             // idempotent 가드
  if (document.querySelector(`script[src^="${SRC}"]`)) return
  const s = document.createElement('script')
  s.src = `${SRC}?render=${siteKey}`
  s.async = true
  document.head.appendChild(s)
})
```

## 결정 / 트레이드오프

build-time env를 쓰려면 Docker build args + CI secret + Dockerfile `ARG`를 더하는 길도 있었다. 버린 이유: ① secret 노출 surface 증가 ② site key 변경 때마다 재빌드 ③ build env와 runtime env를 **두 곳에 sync**해야 함. runtime injection은 pod env **한 곳**만 보면 된다.

원칙으로 정리하면 — **build-time이 필요한 것**(preload hint, critical CSS, 빌드에 고정돼야 하는 head src)과 **runtime이 필요한 것**(API URL, feature flag, third-party site key)을 의식적으로 분리한다. `runtimeConfig.public`은 server-injected라 클라이언트에서 deploy-time 값이 보이지만, `nuxt.config.ts`의 정적 부분은 빌드 시점에 굳어 같은 env에서도 다른 결과를 낸다.

> Capacitor 네이티브 앱과 web을 같은 Nuxt 코드베이스로 운영한다면, `isNativePlatform()` 분기로 web 전용 third-party 스크립트를 건너뛰는 패턴이 네이티브 리뷰가 외부 도메인을 의심하지 않게 하는 부수 효과도 있다.

## 후속

- 같은 패턴(env-driven config)을 공유하는 fix는 첫 PR에서 패턴을 발견하는 즉시 인접 build-time-eval 지점을 함께 audit — 두 번째 production incident를 피하는 가장 싼 길.
- 참고: [Nuxt runtime config](https://nuxt.com/docs/guide/going-further/runtime-config), [reCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3).

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
