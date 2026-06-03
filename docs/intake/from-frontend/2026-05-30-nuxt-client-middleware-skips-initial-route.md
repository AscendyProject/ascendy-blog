---
team: frontend
proposer: "Claude (ascendy-frontend)"
date: 2026-05-30
topic: "한 번 고친 버그가 어떻게 되살아났나 — Nuxt 3 .client 미들웨어가 SSR 첫 라우트를 건너뛴다"
suggestedCategory: "frontend"
suggestedTags: ["nuxt3", "ssr", "middleware", "session-expired", "incident-prevention", "playwright", "regression-test"]
redactionReviewed: true
---

> 프론트엔드 private repo raw 글감의 redaction 정제본. 글감 지침대로 내부 호스트명·내부 API
> 엔드포인트 경로·GitHub PR 번호·내부 컴포넌트 파일 경로를 일반화/축약했다(구체 매핑은 적지
> 않는다 — 이 정제본도 public이라 노트에 원본 식별자를 쓰면 그 자체가 누출이다). absolute-block
> 없음(literal credential·비즈니스 로직·보안 메커니즘 detail 미포함 — 세션 만료 처리는 일반화
> 가능한 SPA recovery 패턴 수준).

## 무엇을 했나

운영자가 "세션 만료 후 `/gallery`에 들어가면 `/login`으로 안 보내진다"고 보고. 같은 증상이 전에
한 번 fix된 이력(글로벌 클라이언트 미들웨어의 `sessionExpired` 분기 + `navigateTo('/login')`)이
있어 단순 회귀로 보였다. 그런데 추적해보니 **fix 코드는 그대로 살아 있었고, 그 코드에 도달하는
path만 끊긴** 회귀였다.

세 가설을 명시적으로 적고, 각각에 **반증 명령**을 미리 붙여 하나씩 떨궜다:
- (a) fix 자체가 사라졌나? → `git log`로 이전 fix 커밋 그대로 확인. **false.**
- (b) 새 HTTP 클라이언트가 axios 인터셉터를 우회하나? → `grep`으로 그런 경로 없음. **false.**
- (c) 새 보호 라우트가 `requiresAuth` 메타를 빠뜨렸나? → `/gallery`에 `definePageMeta({ requiresAuth: true })` 그대로. **false.**

셋 다 false. Playwright로 cold-load 시나리오를 떠보고 결정적 단서를 잡았다 — 콘솔에 `[middleware]`
로그가 **0건**. 미들웨어가 아예 실행되지 않았다.

진단: **Nuxt 3의 `.client.ts` 글로벌 라우트 미들웨어는 SSR-rendered initial route에서 fire하지
않는다.** 사용자가 URL을 직접 입력하거나 북마크·탭 복원으로 도착한 첫 라우트는 서버에서 렌더되고,
클라이언트가 hydrate할 때 그 라우트의 글로벌 클라이언트 미들웨어는 재실행되지 않는다. 클라이언트
라우트 전환(링크 클릭 등)에서만 돈다. 이전 fix는 살아 있었지만 **cold-load path에서는 도달
불가능**했던 것이다.

Fix는 auth-init 플러그인에 cold-load guard를 추가: hydrate 전에 `wasLoggedIn`을 capture하고,
hydrate 후 `!user && (wasLoggedIn || route.meta.requiresAuth) && route.path !== '/login'`이면
`/login`으로 보낸다. 그런데 플러그인 안에서 `navigateTo('/login')`을 처음 시도했더니 **redirect가
안 일어났다** — 또 다른 발견으로 이어졌다.

## 왜 했나 / navigateTo가 아니라 window.location인 이유

운영자가 본 prod 증상은 명백한 보안/UX 회귀였다. 단순 재수정이 아니라 (1) 왜 이전 fix가 무용해졌는지
짚고 (2) 같은 회귀가 다시 머지되지 못하게 잠가야 했다. (백엔드 페어가 401 emission·refresh·CORS·
쿠키 SameSite를 자체 검증해 "프론트가 1차 영역"으로 가설 트리를 좁혀줬다.)

`navigateTo` 대신 **`window.location.replace('/login')`**(hard navigation)을 쓰게 된 경위: 가짜
쿠키 cold-load 시나리오에서 플러그인의 `await fetchUser()` 도중 axios 401 인터셉터가 이미
`logout → router.push('/login')`을 호출한다. 이후 guard가 `navigateTo('/login')`을 또 호출.
**둘 다 boot-time 큐에 들어가 SSR-committed `/gallery` 라우트와 race한다.** 경험적으로 둘 중 어느
것도 commit되지 않고 URL이 `/gallery`에 멈추는 게 관찰됐다(Playwright trace). hard navigation은
브라우저 레벨이라 그 race를 부수고 깨끗하게 `/login`을 로드한다. SPA state도 함께 버리는데, 만료
세션 회복 path엔 정확히 원하는 동작이다.

일반화: **app-boot 도중에는 어떤 SPA navigation도 신뢰할 수 없을 때가 있고, 그땐 `window.location`이
답이다.** 평시엔 SPA 라우팅이 맞다.

## 회귀 방지

Playwright spec에 두 cold-load 케이스(쿠키 없음 / 가짜 쿠키)를 잠갔고, PR-게이트 CI에 넣어 같은
회귀의 재머지를 차단했다. 이전 fix는 client-side navigation에서만 수동 smoke됐고 cold-load 매트릭스에
**잠긴 테스트가 없었던 게 회귀의 진짜 이유**였다.

## 외부에 공유해도 좋은 일반 교훈

- **Nuxt 3 트레이트**: `.client.ts` 글로벌 라우트 미들웨어는 SSR-rendered initial route에서 실행되지
  않는다. 보호 라우트 가드를 그 위에만 얹으면 cold-load(URL 직타·북마크·탭 복원)에서 가드가 우회된다.
  - 해법 1: 미들웨어 파일명에서 `.client` 제거(universal). 단 SSR 측 fetchUser엔 server-side
    인스턴스 필요(client-only API는 unavailable).
  - 해법 2: cold-load 가드를 플러그인/page-level에서 별도로. auth-init 플러그인은 cold-load에서
    fire하니 여기에 redirect 로직을 추가하는 게 surgical.
- **app-boot 중 navigateTo/router.push의 race-and-lose**: SSR-committed route + 인터셉터 push +
  플러그인 push가 동시에 큐잉되면 어느 것도 commit 안 될 수 있다. recovery-from-broken-state에선
  `window.location.replace`가 reliable.
- **회귀 진단 방법론**: 가설을 (a)(b)(c)로 명시하고 각각 반증 명령(`git log -S`, `grep`, route meta
  확인)을 미리 적은 뒤 하나씩 떨군다. 안 떨궈지면 4번째 패턴(이번엔 프레임워크 트레이트)을 찾는다.
- **회귀 방지의 정확한 형태**: 잠근 e2e test가 한 번 깨졌던 path를 정확히 reproduce해야 한다. 전엔
  client-side nav만 smoke됐고 cold-load는 매뉴얼 검증조차 없어 회귀가 unblock된 시점에 아무도 몰랐다.
- **cross-pair 디버깅**: 다른 팀이 자기 영역을 미리 검증해 "여기는 깨끗하니 너희가 1차"로 좁혀주면
  가설 트리가 빨리 준다.

## 코드 스니펫 (일반화)

```ts
// auth-init 플러그인 — cold-load guard (핵심만, 식별자 일반화)
const wasLoggedIn = authStore.isLoggedIn   // await 전에 capture
await hydrateUser()                         // fetchUser 중 401 → 인터셉터 → logout → cookie cleared

if (!authStore.user) {
  const route = useRoute()
  const onProtectedRoute = Boolean(route.meta?.requiresAuth)
  if ((wasLoggedIn || onProtectedRoute) && route.path !== '/login') {
    // Why hard nav: 만료 path에서 axios 인터셉터가 logout() 안에서 이미
    // router.push('/login')을 큐잉했고, 이 플러그인도 navigateTo('/login')을
    // 큐잉한다. 둘 다 SSR-committed /gallery와 race → 실측상 어느 것도 commit
    // 안 됨. window.location.replace가 브라우저 레벨에서 redirect를 강제하고
    // 깨진 SPA state를 버린다 — recovery path가 원하는 그대로.
    window.location.replace('/login')
    return
  }
}
```

```ts
// session-expired regression spec (요지)
test.use({ storageState: { cookies: [], origins: [] } })

test('no cookie + goto /gallery → /login', async ({ page }) => {
  await page.goto('/gallery', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login(?:$|\?|#)/, { timeout: 10_000 })
})

test('garbage auth-token cookie + goto /gallery → /login', async ({ page, context }) => {
  await context.addCookies([
    { name: 'auth-token', value: 'totally-not-a-jwt', domain: 'localhost', path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600 },
  ])
  await page.goto('/gallery', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login(?:$|\?|#)/, { timeout: 10_000 })
})
```

## 참고
- Nuxt 3 route middleware: https://nuxt.com/docs/guide/directory-structure/middleware
- Playwright `context.addCookies`: https://playwright.dev/docs/api/class-browsercontext#browser-context-add-cookies
