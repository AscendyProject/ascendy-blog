---
title: "한 번 고친 버그가 어떻게 되살아났나 — 그리고 진단이 한 번 더 뒤집힌 이야기"
description: "세션 만료 후 보호 페이지가 로그인으로 안 보내졌다. fix 코드는 멀쩡히 살아 있었는데 거기 도달하는 path만 끊겼다. 처음엔 'Nuxt 트레이트'로 진단했지만 그것도 틀렸다 — 미들웨어가 지원하지 않는 `.client` suffix를 붙인 비표준 네이밍의 부산물이었다. 게시 과정의 팩트체크가 코드 정정까지 이끈 기록."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["nuxt3", "ssr", "middleware", "session-expired", "incident-prevention", "playwright"]
category: "frontend"
lang: "ko"
translationKey: "nuxt-client-middleware-skips-initial-route"
sourceIntake:
  - "docs/intake/from-frontend/2026-05-30-nuxt-client-middleware-skips-initial-route.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 세션 만료 후 보호 페이지(`/gallery`)에 들어가면 로그인으로 보내져야 하는데, 그냥 머물렀다. 같은 버그는 **전에 한 번 고친 이력**이 있었다.
- 그런데 그 fix 코드는 **멀쩡히 살아 있었다.** 죽은 건 코드가 아니라 **거기 도달하는 path**였다 — cold-load(URL 직타·북마크·탭 복원)에서 그 미들웨어가 아예 안 돌았다.
- 처음엔 *"Nuxt 3의 `.client` 글로벌 미들웨어는 SSR 첫 라우트에서 안 도는 트레이트"*로 진단했다. **그런데 그것도 틀렸다.** Nuxt 3 미들웨어는 플러그인과 달리 `.client`/`.server` suffix를 **지원하지 않는다.** `*.global.client.ts`의 `.client`는 미들웨어 로더가 인지하지 않는 **잉여 토큰**이었고, 그래서 의도와 다르게 동작한 것이다.
- 정통 패턴은 `.global.ts`(universal) + body 안의 `import.meta.server` 분기. 그리고 이 두 번째 정정은 **게시 과정의 팩트체크가 끌어냈다** — 글이 코드를 고쳤다.

> **소스 노트.** 이 글은 프론트엔드 팀이 세션 만료 리다이렉트 회귀를 추적하며 남긴 인테이크(`docs/intake/from-frontend/2026-05-30-nuxt-client-middleware-skips-initial-route.md`)를 정제한 것이다. 게시화 과정에서 블로그 편집국이 원 진단(`.client` 미들웨어가 SSR에서 안 도는 Nuxt 트레이트)을 공식 문서로 팩트체크해 **부정확함을 발견**했고, 그 피드백이 프론트엔드 팀의 코드 정정(파일명 정통화 + `import.meta.server` 분기)으로 이어졌다. 이 글은 그 정정된 진단을 담는다. 내부 호스트명·엔드포인트·구체 컴포넌트 경로는 일반화했다.

## 멀쩡한 fix, 끊긴 경로

운영자 제보는 단순했다. "세션 만료된 상태로 `/gallery`에 들어갔는데 `/login`으로 안 보내진다." 보안·UX 회귀다. 그리고 이 증상엔 전과가 있었다 — 글로벌 클라이언트 미들웨어에 `sessionExpired` 분기와 `navigateTo('/login')`을 넣어 이미 한 번 고친 적이 있었다. 그러니 처음엔 누군가 그 fix를 되돌린 단순 회귀처럼 보였다.

그래서 가설을 세 개 세우고, 각각에 **반증 명령**을 미리 붙였다. 추측만 늘어놓는 대신, 떨어뜨릴 방법을 먼저 정한 것이다.

- **(a) fix 자체가 사라졌나?** → `git log`로 이전 fix 커밋을 확인. 그대로 살아 있었다. **false.**
- **(b) 새 HTTP 클라이언트가 axios 인터셉터를 우회하나?** → `grep`으로 그런 경로를 찾았지만 없었다. **false.**
- **(c) 새 보호 라우트가 `requiresAuth` 메타를 빠뜨렸나?** → `/gallery`엔 `definePageMeta({ requiresAuth: true })`가 그대로 있었다. **false.**

셋 다 false. 세 가설이 다 떨어지면, 남은 건 우리가 아직 의심하지 않은 **네 번째 무언가**다.

## 결정적 단서: 미들웨어가 아예 안 돌았다

Playwright로 cold-load 시나리오(브라우저를 새로 띄워 URL을 직접 입력하는 상황)를 떠봤다. 콘솔 로그를 보고 단서가 잡혔다 — `[middleware]` 로그가 **0건**이었다. fix가 무용했던 게 아니라, **미들웨어가 아예 실행되지 않았다.**

이전 fix는 바로 그 글로벌 클라이언트 미들웨어 안에 있었다. 코드는 살아 있었지만, **cold-load path에서는 애초에 도달할 수 없는 자리**에 있었던 것이다. 평소 앱을 돌아다니다 세션이 만료되면(=클라이언트 전환) 정상 작동했고, 그래서 한동안 아무도 몰랐다. 만료된 세션으로 보호 URL을 **직접** 열 때만 구멍이 열렸다.

## 첫 진단, 그리고 그것을 뒤집은 팩트체크

여기서 우리가 처음 내린 진단은 이거였다.

> *"Nuxt 3의 `.client` 글로벌 라우트 미들웨어는 SSR-rendered initial route에서 fire하지 않는다."*

그럴듯했다. 관찰된 동작과 맞아떨어졌으니까. 그런데 이 글을 게시하려고 다듬는 과정에서, 그 진단을 **공식 문서로 한 번 더 확인**하자 어긋났다. 정정해야 했다.

[Nuxt 3 미들웨어 문서](https://nuxt.com/docs/3.x/directory-structure/middleware)에 따르면 — **미들웨어는 플러그인과 달리 `.client`/`.server` 파일명 suffix를 지원하지 않는다.** 환경 분기는 미들웨어 *코드 안에서* `import.meta.client` / `import.meta.server`로 해야 한다. 우리 파일명 `*.global.client.ts`는 `.global`로 글로벌 등록은 트리거되지만, `.client`는 **미들웨어 로더가 인지하지 않는 잉여 토큰**이었다.

즉 "Nuxt가 `.client` 글로벌 미들웨어를 SSR에서 안 돌린다"는 **프레임워크 일반 트레이트가 아니라, 우리가 붙인 비표준 파일명의 부산물**이었다. 비표준 네이밍이 *의도된 듯한 동작*(SSR에서 안 도는 것처럼 보임)을 내는 바람에, "Nuxt가 원래 그렇다"고 잘못 일반화하기 쉬웠던 것이다. 일반화하기 전에 *왜* 그렇게 도는지 공식 문서로 한 번 더 확인하는 단계가, 정확히 이 함정을 막는다.

## Fix: 정통 패턴으로 돌아가고, 의도된 안전망은 남긴다

정정된 진단에 맞춰 코드도 정통 패턴으로 돌렸다.

- 글로벌 미들웨어 파일명에서 `.client`를 떼어 **`.global.ts`(universal)** 로 바꾸고(파일 history 보존), body 첫 줄에 `if (import.meta.server) return`를 추가했다. **외부 관찰 동작은 동일하다** — web의 SSR pass에서는 early return(기존 비표준 suffix가 SSR을 우회하던 것과 같음), hydration·이후 client navigation에서 실행, native(SSR 없음)에서는 no-op.

그런데 cold-load 자체를 막는 가드는 미들웨어가 아니라 **플러그인(앱 부팅 시 도는 자리)** 에 따로 두고, 그건 **의도적으로 유지**했다. hydrate 전에 "원래 로그인 상태였는지"를 capture하고, hydrate 후 사용자가 없으면 로그인으로 보낸다.

```ts
// 앱 부팅 플러그인 — cold-load guard (의도된 안전망, 유지)
const wasLoggedIn = authStore.isLoggedIn   // await 전에 capture
await hydrateUser()                         // fetchUser 중 401 → 인터셉터 → logout → cookie 정리

if (!authStore.user) {
  const route = useRoute()
  const onProtectedRoute = Boolean(route.meta?.requiresAuth)
  if ((wasLoggedIn || onProtectedRoute) && route.path !== '/login') {
    window.location.replace('/login')
    return
  }
}
```

왜 이 가드를 미들웨어로 합치지 않고 플러그인에 남겼나. 그 플러그인은 biometric·native splash·cold-load guard 같은 client-only 동작이 한 파일에 모여 있어, 잘못 건드리면 native 사용자 전체를 splash에 묶을 위험이 있다(그래서 내부 규칙이 "먼저 묻고 건드려라" 영역으로 못박았다). 그리고 그 가드는 아래의 e2e가 잠그고 있고, hard navigation을 쓰는 이유(아래 race)가 주석에 명시돼 있다 — **우연히 비표준 미들웨어를 메우던 코드가 아니라, 의도된 race-handling 안전망**이라는 뜻이다. 같은 한 줄이라도 그 줄을 둘러싼 가드(spec·주석·규칙)가 의도를 결정한다.

## 작은 후속: navigateTo가 안 먹혔다

이 가드를 처음엔 `navigateTo('/login')`으로 짰는데, **리다이렉트가 안 일어났다.**

추적해보니 boot-time race였다. 가짜 쿠키 cold-load에서 플러그인의 `await fetchUser()` 도중, axios 401 인터셉터가 `logout()` 안에서 이미 `router.push('/login')`을 큐에 넣는다. 그 뒤 우리 가드가 `navigateTo('/login')`을 또 큐에 넣는다. **두 navigation이 SSR-committed `/gallery` 라우트와 동시에 경쟁하고, 실측상 셋 중 어느 것도 commit되지 않는다.** URL은 `/gallery`에 멈춰 있었다(Playwright trace로 확인).

`window.location.replace`는 브라우저 레벨이라 그 race를 부수고 깨끗하게 `/login`을 로드한다. SPA state도 같이 버려지는데, **만료 세션 회복 path에선 정확히 그게 원하는 동작**이다. 평시엔 SPA 라우팅이 맞지만, **app-boot 도중엔 어떤 SPA navigation도 신뢰할 수 없을 때가 있고**, 회복 경로라면 그때는 `window.location`이 답이다.

## 진짜 원인은 "잠긴 테스트가 없었다"

버그를 고치는 것과, 같은 버그가 다시 들어오지 못하게 막는 것은 다른 일이다. 이 회귀의 **진짜 원인**은 미들웨어 네이밍이 아니라 그 위에 있었다 — 이전 fix는 client-side navigation에서만 수동으로 smoke됐고, **cold-load 매트릭스에는 잠긴 테스트가 하나도 없었다.** 그래서 회귀가 unblock된 순간에 아무도 몰랐다.

그래서 Playwright spec에 cold-load 두 케이스(쿠키 없음 / 가짜 쿠키)를 못 박고, PR 게이트 CI에 넣었다.

```ts
test.use({ storageState: { cookies: [], origins: [] } })

test('쿠키 없음 + /gallery 직접 진입 → /login', async ({ page }) => {
  await page.goto('/gallery', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login(?:$|\?|#)/, { timeout: 10_000 })
})

test('가짜 auth-token 쿠키 + /gallery 직접 진입 → /login', async ({ page, context }) => {
  await context.addCookies([
    { name: 'auth-token', value: 'totally-not-a-jwt', domain: 'localhost', path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600 },
  ])
  await page.goto('/gallery', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login(?:$|\?|#)/, { timeout: 10_000 })
})
```

## 가져갈 것

- **Nuxt 3 미들웨어는 `.client`/`.server` suffix를 지원하지 않는다(플러그인 전용).** 환경 분기는 파일명이 아니라 body 안의 `import.meta.client`/`import.meta.server`로. `*.global.client.ts` 같은 네이밍은 `.global`로 등록은 되지만 `.client`는 의미 없는 잉여 토큰이다.
- **비표준 네이밍이 *의도된 듯한 동작*을 낼 때를 조심하라.** "프레임워크가 원래 그렇다"고 일반화하기 전에, *왜* 그렇게 도는지 공식 문서로 한 번 더 확인하는 단계가 함정을 막는다.
- **app-boot 중 navigation은 race-and-lose할 수 있다.** SSR-committed route + 인터셉터 push + 플러그인 push가 동시에 큐잉되면 어느 것도 commit 안 될 수 있다. 회복 경로에선 `window.location.replace`가 reliable.
- **회귀 진단은 가설 + 반증 명령을 먼저 적고 시작.** (a)(b)(c)를 명시하고 각각 `git log -S`·`grep`·메타 확인을 붙여 하나씩 떨군다.
- **회귀 방지 테스트는 한 번 깨졌던 path를 정확히 reproduce해야 한다.** "고쳤다"와 "다시 안 깨지게 잠갔다"는 별개다. 잠그지 않으면, 다음 회귀는 unblock된 순간 조용히 들어온다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
