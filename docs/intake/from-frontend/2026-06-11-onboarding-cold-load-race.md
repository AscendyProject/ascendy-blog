---
team: frontend
date: 2026-06-11
topic: "온보딩 마법사가 매 로그인마다 다시 뜨는 버그 — 잘못된 1차 진단(부모가 PATCH해야 한다)을 Codex가 잡고, 진짜 원인은 cold-load race였다. 콜드 부트는 Nuxt가 async plugin을 마운트 전 await해 안전하고, 진짜 race는 Pinia가 await하지 않는 $subscribe 콜백(로그인 hydration)이 fire-and-forget으로 돌며 gallery mount와 경합한 것. fix는 hasFetched 플래그 + immediate watcher. default-true-then-override(A) vs hasFetched guard(B) trade-off."
suggestedCategory: "frontend"
suggestedTags: ["nuxt", "pinia", "race-condition", "settings-hydration", "incident-postmortem"]
redactionReviewed: true
---

> frontend 팀 raw 글감의 정제본. **Class A 없음**(닫힌 버그, 미수정 보안 갭 아님).
> 백엔드 API path는 일반화(`/me/settings`), 백엔드 코드 위치는 제거. 운영자/사용자 식별 정보 없음.
> Nuxt 구조 경로(pages/gallery, stores/settings, plugins/auth-init)는 이야기의 골격이라 유지 —
> 시크릿·식별자 아님.

## 무엇을

운영자 보고: "온보딩 wizard를 skip해도 다음 로그인 때 또 뜬다."

**1차 진단**: "gallery 페이지의 `@complete` 바인딩이 로컬 ref만 닫고 서버에 PATCH를 안 한다."
이 진단대로 부모에 `onOnboardingComplete()` 핸들러를 추가해 `updateUserSettings({ onboarding_completed: true })`을
호출하는 PR을 올렸다(이후 close).

**Codex 리뷰가 잡음**: 자식 컴포넌트 `MobileOnboardingWizard`가 이미 `await updateUserSettings(...)`를
한 다음 `emit('complete')`를 부른다. 부모에서 또 PATCH하면 매 dismiss마다 중복 호출 + 토스트 노이즈.
→ 1차 진단이 틀렸다. PR close + 브랜치 삭제.

**진짜 원인 = cold-load race (메커니즘 정정)**: hydration(`await fetchUserSettings()`)은 auth-init
plugin 안에서 두 군데서 불린다 — (1) `defineNuxtPlugin(async)` setup의 콜드 부트 경로, (2) plugin이
등록한 `authStore.$subscribe(async () => await hydrate…)`의 로그인 전이 경로. 경로 1은 Nuxt가 async
plugin을 **앱 마운트 전에 await**하므로 게이트가 fetch된 값을 봐 race 없음. **진짜 race는 경로 2** —
**Pinia는 `$subscribe` 콜백을 await하지 않는다(fire-and-forget).** 로그인으로 토큰이 바뀌면 hydration이
fire-and-forget으로 돌고, 그 사이 gallery가 mount되어 게이트가 default `onboardingCompleted=false`를
읽어 wizard를 띄움. (원raw글감은 race를 경로 1의 boot-await로 지목했으나, 실제 plugin 코드 대조 결과
경로 2의 `$subscribe` un-awaited 콜백이 원인 — Codex round-1 지적 + 실코드 검증으로 정정.)

**fix**: settings store에 `hasFetched` ref 추가 + `fetchUserSettings`의 finally에서 success/error
무관하게 true로 flip. gallery 게이트를 `watch(() => settingsStore.hasFetched, ..., { immediate: true })`로
감싸 미로드 시점엔 early return.

## 두 fix shape (trade-off)

- **A. Default-true-then-override**: `onboardingCompleted` 기본값 true, fetch 후 서버 값으로 덮어쓰기.
  빠르지만 실패 모드가 위험 — 진짜 첫 사용자의 첫 fetch가 transient하게 실패하면 default true 때문에
  wizard가 영원히 안 뜬다.
- **B. hasFetched guard**: 로드 완료 신호 ref 별도로, 그게 true가 될 때까지 게이트 평가 안 함.
  한 줄 더 들지만 "로드 안 됨" vs "로드됐고 서버가 false"를 깔끔히 구분. → backend/frontend 둘 다 B.

## 패턴
- `await`이 한 함수 안에서 직렬화되는지보다 **그 await를 누가 기다려 주느냐**가 관건. Nuxt는 plugin
  setup을 마운트 전에 await하지만, **Pinia는 `$subscribe` 콜백을 await하지 않는다.** 같은 hydration
  함수라도 진입점에 따라 직렬화/fire-and-forget이 갈린다. `$subscribe`·`watch`·이벤트 핸들러처럼
  "async인데 호출자가 안 기다리는" 진입점이 컴포넌트 mount와 race window를 만든다.
- "boolean fetched-flag + `watch(immediate: true)`" 패턴은 hydration-gated UI 어디에든 일반화 가능.
- 두 fix shape의 trade-off = first-time user failure mode를 어떻게 다루느냐. 교과서적 선택지 비교.
- 잘못된 1차 진단에 그대로 코딩하지 말고 자식 컴포넌트까지 cross-check — review가 catch한 게 핵심 학습.

## 코드 스니펫

```ts
// stores/settings.ts — hasFetched guard 추가
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
    hasFetched.value = true  // success OR error
  }
}
```

```ts
// pages/gallery/index.vue — onMounted 인라인 게이트를 watcher로 교체
watch(
  () => settingsStore.hasFetched,
  (loaded) => {
    if (!loaded) return
    if (!authStore.user) return
    if (!settingsStore.onboardingCompleted) {
      showOnboarding.value = true
    }
  },
  { immediate: true },
)
```

## 외부에 공유해도 좋은 부분
- cold-load race 구조와 "별개 mount 컴포넌트가 만드는 race window".
- hasFetched 플래그 + immediate watcher 패턴.
- default-true-then-override vs hasFetched guard trade-off(first-time user failure mode).
- 잘못된 1차 진단 → review catch → revisit → 진짜 fix 흐름(review-driven development).

## 외부에 공유하면 안 되는 부분
- 백엔드 API path·코드 위치는 일반화/제거 완료. 운영자/사용자 식별 정보 없음.
