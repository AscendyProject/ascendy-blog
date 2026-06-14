---
team: frontend
date: 2026-06-11
topic: "온보딩 마법사가 매 로그인마다 다시 뜨는 버그 — 잘못된 1차 진단(부모가 PATCH해야 한다)을 Codex가 잡고, 진짜 원인은 cold-load race였다. mount된 컴포넌트의 onMounted 게이트가 auth-init plugin의 fetchUserSettings를 race. fix는 hasFetched 플래그 + immediate watcher. default-true-then-override(A) vs hasFetched guard(B) trade-off."
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

**진짜 원인 = cold-load race**: gallery 페이지의 `onMounted` 게이트가 auth-init plugin의
`await fetchUserSettings()`를 race한다. 신규 로그인에서 게이트가 default `onboardingCompleted=false`를
읽어 wizard를 띄움. fetch가 끝나 true가 와도 게이트는 이미 fired된 후.

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
- Cold-load race는 SPA에서 흔하다. `await`이 한 plugin chain 안에서 정확히 직렬화되더라도, 그 chain과
  **별개로 mount된 컴포넌트의 onMounted가 race window**를 만든다.
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
