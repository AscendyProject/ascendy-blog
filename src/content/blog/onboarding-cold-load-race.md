---
title: "온보딩이 매 로그인마다 다시 떴다 — '빠른 fix'가 틀린 이유와 진짜 원인(cold-load race)"
description: "'온보딩을 skip해도 다음 로그인에 또 뜬다.' 1차 진단은 '부모가 서버에 PATCH를 안 한다'였고 그대로 코딩했다. 그런데 자식 컴포넌트가 이미 PATCH하고 있었다 — 리뷰가 잡았다. 진짜 원인은 cold-load race. plugin chain은 직렬화돼도, 별개로 mount된 컴포넌트의 onMounted가 race window를 만든다."
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
- **진짜 원인 = cold-load race.** gallery의 `onMounted` 게이트가 auth-init plugin의 `await fetchUserSettings()`를 race한다. 신규 로그인에서 게이트가 default `onboardingCompleted=false`를 읽고 wizard를 띄움 — fetch가 끝나 `true`가 와도 게이트는 이미 fired된 뒤.
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

저장이 되고 있다면, 문제는 **읽는 타이밍**이다.

신규 로그인 흐름엔 두 개의 비동기 흐름이 있었다:

- **auth-init plugin** — 로그인 직후 `await fetchUserSettings()`로 서버에서 설정을 끌어와 store를 채운다.
- **gallery 페이지의 `onMounted` 게이트** — 마운트되면 `onboardingCompleted`를 보고 `false`면 wizard를 띄운다.

이 둘이 **race한다.** plugin이 `fetchUserSettings()`를 끝내기 전에 gallery가 mount되면, 게이트는 store의 **default 값 `onboardingCompleted = false`**를 읽는다. → wizard를 띄운다. 잠시 뒤 fetch가 끝나 `true`가 store에 들어와도, 게이트는 *이미 fired된 뒤*라 소용없다.

핵심은 이거다 — **plugin chain 안의 `await`은 정확히 직렬화된다.** auth-init은 fetch를 제대로 기다린다. 문제는 그 chain과 **별개로 mount된 컴포넌트**다. gallery의 `onMounted`는 plugin의 `await`을 기다려주지 않는다. 직렬화는 *한 chain 안*에서만 보장되고, 서로 다른 두 진입점(plugin / 컴포넌트 mount) 사이엔 보장이 없다. 그 틈이 race window다.

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

- **Cold-load race는 SPA에서 흔하다.** `await`이 한 plugin chain 안에서 직렬화돼도, 그 chain과 별개로 mount된 컴포넌트의 `onMounted`는 그 `await`을 기다리지 않는다. 직렬화 보장은 *한 chain 안*에서만 성립한다.
- **default 값을 읽는 게이트를 의심하라.** hydration 전에 평가되는 모든 UI 게이트는 "아직 안 들어온 값"을 "서버가 준 값"으로 착각할 수 있다. `hasFetched` 같은 *로드 완료 신호* + `watch(immediate: true)`가 일반 해법이다.
- **두 fix shape의 차이는 first-time user의 실패 모드다.** default-true는 fetch 실패 시 온보딩을 영원히 숨기고, hasFetched guard는 "로드 안 됨"과 "서버가 false"를 구분한다. 짧은 fix가 늘 옳은 건 아니다.
- **잘못된 1차 진단에 그대로 코딩하지 마라.** 진단은 가설이다. 이 사례에선 자식 컴포넌트가 이미 PATCH하고 있다는 사실을 리뷰어가 cross-check해 줬다 — review-driven development가 헛걸음을 줄인 한 사례.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
