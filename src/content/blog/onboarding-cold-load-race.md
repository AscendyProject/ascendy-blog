---
title: "온보딩이 매 로그인마다 다시 떴다 — '빠른 fix'가 틀린 이유와 진짜 원인(cold-load race)"
description: "'온보딩을 skip해도 다음 로그인에 또 뜬다.' 1차 진단 '부모가 PATCH를 안 한다'대로 코딩했지만, 자식이 이미 PATCH 중이었다 — 리뷰가 잡았다. 진짜 원인은 cold-load race: Pinia가 $subscribe 콜백을 await하지 않아, 로그인 hydration이 fire-and-forget으로 돌며 gallery mount와 race한다."
pubDate: 2026-06-11
author: "Ascendy Engineering"
tags: ["nuxt", "pinia", "race-condition", "settings-hydration", "lessons-from-review"]
category: "frontend"
lang: "ko"
translationKey: "onboarding-cold-load-race"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-11-onboarding-cold-load-race.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 버그: **온보딩 wizard를 skip해도 다음 로그인 때 또 뜬다.**
- **1차 진단이 틀렸다.** "gallery 페이지가 로컬 ref만 닫고 서버에 PATCH를 안 한다"는 진단을 받아 부모에 PATCH 호출을 추가하는 PR을 올렸다 — 그런데 **자식 컴포넌트가 이미 `await updateUserSettings(...)` 후에 `emit('complete')`를 부르고 있었다.** 부모에서 또 PATCH하면 중복 호출 + 토스트 노이즈. Codex 리뷰가 잡고 PR을 닫았다.
- **진짜 원인 = cold-load race.** 콜드 부트에선 Nuxt가 async plugin을 마운트 전에 await해 안전하다. 버그는 **로그인 전이** 경로 — plugin이 등록한 `authStore.$subscribe(async () => await hydrate…)`가 hydration을 트리거하는데, **Pinia는 `$subscribe` 콜백을 await하지 않는다(fire-and-forget).** 그 사이 gallery가 mount돼 게이트가 default `onboardingCompleted=false`를 읽고 wizard를 띄움.
- **fix**: `hasFetched` 플래그 + `watch(..., { immediate: true })`로 "로드 완료 전엔 게이트 평가 안 함." default-true-then-override(A)가 아니라 hasFetched guard(B)를 택한 이유는 *first-time user의 첫 fetch가 실패할 때*다.

> **소스 노트.** frontend 팀 인테이크를 정제한 글이다. 백엔드 API 경로·코드 위치는 일반화/제거했고, 시크릿·식별자는 없다. 같은 *리뷰가-잡았다* 결의 [한 번 고친 버그가 어떻게 되살아났나](/blog/nuxt-client-middleware-skips-initial-route/), [주석 처리한 리스너가 만든 race](/blog/commented-out-listeners-race/)와 이어진다.

## 증상: 닫아도 되살아나는 마법사

운영자 보고는 한 줄이었다. *"온보딩 wizard를 skip해도 다음 로그인 때 또 뜬다."*

온보딩은 보통 한 번 끝내면 끝이다. 사용자 설정에 `onboarding_completed: true`가 저장되고, 다음부터는 안 뜬다. 그런데 매 로그인마다 되살아난다는 건 둘 중 하나다 — **서버에 저장이 안 되거나**, **저장은 됐는데 읽는 타이밍이 틀렸거나.**

## 1차 진단: "부모가 서버에 PATCH를 안 한다"

첫 진단은 전자였다. *"gallery 페이지의 `@complete` 바인딩이 로컬 ref만 닫고 서버에 PATCH를 안 한다."* 그럴듯했다. wizard를 닫는 핸들러가 화면 상태(`showOnboarding.value = false`)만 바꾸고 서버엔 안 알리면, 다음 로그인에 서버는 여전히 `false`를 줄 테니까.

그래서 그대로 코딩했다. 부모에 `onOnboardingComplete()` 핸들러를 추가하고 `updateUserSettings({ onboarding_completed: true })`을 호출하는 PR을 올렸다.

## 리뷰가 잡은 것: 자식은 이미 PATCH하고 있었다

Codex 리뷰가 PR을 막았다. **자식 컴포넌트 `MobileOnboardingWizard`가 이미 `await updateUserSettings(...)`를 한 다음에 `emit('complete')`를 부르고 있었다.**

즉 닫기 흐름은 이미 이랬다:

1. 자식: `await updateUserSettings({ onboarding_completed: true })` — **서버 PATCH 완료**
2. 자식: `emit('complete')`
3. 부모: 이벤트 받아 `showOnboarding.value = false`

서버 저장은 *이미 되고 있었다.* 1차 진단이 틀린 것이다. 내가 부모에 PATCH를 또 넣었다면 **매 dismiss마다 중복 PATCH + 토스트 노이즈**만 늘었을 것이다. PR을 닫고 브랜치를 지웠다.

여기서 배운 게 하나 있다 — **잘못된 1차 진단을 받으면 그대로 코딩하지 말고, 진단이 가리키는 반대편(자식 컴포넌트가 정말 PATCH를 안 하는지)을 먼저 확인해야 한다.** 진단은 가설이지 사실이 아니다. 이 경우 그 확인을 사람이 아니라 리뷰어(Codex)가 대신 해줬다.

## 진짜 원인: cold-load race

저장이 되고 있다면, 문제는 **읽는 타이밍**이다. 그리고 여기서 처음 짚었던 그림은 *틀렸다* — 이게 이 글의 두 번째 반전이다.

설정을 끌어오는 `hydrateUserAndSettings()`(→ `await fetchUserSettings()`)는 auth-init plugin 안에 있고, **두 군데서 불린다.**

1. **콜드 부트 경로** — `defineNuxtPlugin(async () => { … await hydrateUserAndSettings() … })`. 앱이 저장된 토큰으로 시작할 때 plugin setup 안에서 직접 await한다.
2. **로그인 전이 경로** — plugin이 등록하는 `authStore.$subscribe(async (_m, state) => { if (로그인됨) await hydrateUserAndSettings() })`. 앱이 떠 있는 상태에서 토큰이 바뀌면(=로그인) 호출된다.

처음엔 "plugin이 `await fetchUserSettings()`를 하는데 gallery의 `onMounted`가 그걸 race한다"고 적었다. 그런데 **경로 1에선 그게 불가능하다.** Nuxt는 async plugin setup이 반환한 promise를 **앱 마운트 전에 await**한다. plugin이 fetch를 진짜로 기다리면, 어떤 컴포넌트의 `onMounted`도 그 뒤에 뜬다. 콜드 부트에선 게이트가 이미 *fetch된 값*을 본다 — race 없음.

**진짜 race는 경로 2다.** 그리고 핵심은 한 줄로 요약된다 — **Pinia는 `$subscribe` 콜백을 await하지 않는다.** async 구독자가 돌려준 promise를 그냥 버린다. 그래서 로그인으로 토큰이 바뀌면 `$subscribe`가 `hydrateUserAndSettings()`를 *fire-and-forget*으로 띄우고, 그 사이 라우터는 `/gallery`로 넘어가 컴포넌트를 mount한다. gallery의 게이트가 평가되는 순간 `fetchUserSettings()`는 아직 in-flight고, 게이트는 store의 **default `onboardingCompleted = false`**를 읽어 wizard를 띄운다. fetch가 끝나 `true`가 들어와도 게이트는 *이미 fired된 뒤*다.

여기서 일반화할 교훈이 나온다 — **`await`이 한 함수 안에서 직렬화되는 건 끝이 아니다. 그 await를 *누가 기다려 주느냐*가 관건이다.** Nuxt는 plugin setup을 기다리고, Pinia는 `$subscribe` 콜백을 안 기다린다. *같은* hydration 함수라도 어느 진입점에서 불리느냐에 따라 직렬화되기도, fire-and-forget이 되기도 한다. "plugin이 await하니까 안전하다"는 경로 1에만 맞고, 버그는 경로 2에 숨어 있었다.

## fix: "로드 완료 전엔 평가하지 않는다"

고치는 방법은 게이트가 *default 값*이 아니라 *로드된 값*만 보게 만드는 것이다. store에 "한 번이라도 fetch가 끝났나"를 알리는 `hasFetched` 플래그를 두고, 게이트를 그 플래그에 반응하는 watcher로 바꿨다.

```ts
// stores/settings.ts — hasFetched 플래그
const hasFetched = ref(false)

async function fetchUserSettings(): Promise<void> {
  isLoading.value = true
  try {
    const { data } = await api().get<UserSettingsPublic>("/me/settings")
    applySettingsToState(data)
  } catch (err) {
    console.error("[settings] fetchUserSettings failed:", err)
  } finally {
    isLoading.value = false
    hasFetched.value = true  // 성공이든 실패든
  }
}
```

```ts
// pages/gallery/index.vue — onMounted 인라인 게이트를 watcher로 교체
watch(
  () => settingsStore.hasFetched,
  (loaded) => {
    if (!loaded) return            // 아직 로드 전 — 평가하지 않음
    if (!authStore.user) return
    if (!settingsStore.onboardingCompleted) {
      showOnboarding.value = true
    }
  },
  { immediate: true },
)
```

`{ immediate: true }`라서 이미 로드가 끝난 상태(재방문)면 즉시 평가하고, 아직이면 `hasFetched`가 `true`로 flip될 때 평가한다. race window가 사라진다.

`finally`에서 **성공이든 실패든** `hasFetched`를 `true`로 올리는 게 중요하다. 이유는 다음 절에.

## 왜 default-true-then-override가 아니라 hasFetched guard였나

선택지는 둘이었다.

- **A. Default-true-then-override** — `onboardingCompleted` 기본값을 `true`로 두고, fetch가 끝나면 서버 값으로 덮어쓴다. 게이트는 평소엔 안 뜨다가 서버가 `false`라고 하면 뜬다.
- **B. hasFetched guard** — 로드 완료 신호를 별도 플래그로 두고, 그게 `true`가 될 때까지 게이트를 평가하지 않는다.

A가 더 짧다. 한 줄도 안 든다 — 그냥 기본값만 바꾸면 된다. 그런데 A의 **실패 모드가 위험하다.** 진짜 첫 사용자의 첫 `fetchUserSettings()`가 transient하게 실패한다고 하자(네트워크 깜빡임, 콜드 백엔드). A에선 `onboardingCompleted`가 default `true`로 남아 있으니 **온보딩이 영원히 안 뜬다.** 정작 온보딩이 가장 필요한 사람에게.

B는 그 경우를 깔끔히 구분한다. fetch가 실패해도 `finally`에서 `hasFetched = true`가 되고, `onboardingCompleted`는 store default 그대로 — 신규 사용자라면 `false`다. 게이트가 평가되고 wizard가 뜬다. B는 **"아직 로드 안 됨" vs "로드됐고 서버가 false다"를 분리**한다. A는 그 둘을 default 값 하나로 뭉갠다.

backend도 명시적으로 B를 권했고, frontend도 같은 결론에 도달했다. 한 줄 더 드는 값을 했다.

## 가져갈 것

- **`await`이 직렬화되는지보다 *누가 그 await를 기다리느냐*가 중요하다.** 같은 hydration 함수라도 Nuxt plugin setup에서 불리면(콜드 부트) 마운트 전에 await되지만, Pinia `$subscribe` 콜백에서 불리면(로그인 전이) **await되지 않고 fire-and-forget**으로 돈다. 후자가 컴포넌트 mount와 race한다 — `$subscribe`·`watch`·이벤트 핸들러처럼 "async인데 호출자가 안 기다리는" 진입점을 의심하라.
- **default 값을 읽는 게이트를 의심하라.** hydration 전에 평가되는 모든 UI 게이트는 "아직 안 들어온 값"을 "서버가 준 값"으로 착각할 수 있다. `hasFetched` 같은 *로드 완료 신호* + `watch(immediate: true)`가 일반 해법이다.
- **두 fix shape의 차이는 first-time user의 실패 모드다.** default-true는 fetch 실패 시 온보딩을 영원히 숨기고, hasFetched guard는 "로드 안 됨"과 "서버가 false"를 구분한다. 짧은 fix가 늘 옳은 건 아니다.
- **잘못된 1차 진단에 그대로 코딩하지 마라.** 진단은 가설이다. 이 사례에선 자식 컴포넌트가 이미 PATCH하고 있다는 사실을 리뷰어가 cross-check해 줬다 — review-driven development가 헛걸음을 줄인 한 사례.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
