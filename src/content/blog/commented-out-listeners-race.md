---
title: "주석으로 끈 기능은 되살아나지 않는다 — 복원하다 만난 double-trigger 레이스"
description: "긴급 차단으로 주석 처리한 자동동기화 트리거가 끝내 복원되지 않아 기능이 조용히 죽었다. 복원하면서 드러난 두 번째 버그는 double-trigger 레이스 — check와 act 사이의 await가 재진입 락을 무력화하는 패턴. 주석은 복원을 누락시키고, JS도 await 경계에서 인터리빙한다."
pubDate: 2026-05-31
author: "Ascendy Engineering"
tags: ["capacitor", "concurrency", "race-condition", "incident-prevention", "vue"]
category: "frontend"
lang: "ko"
translationKey: "commented-out-listeners-race"
sourceIntake:
  - "docs/intake/from-frontend/2026-05-28-commented-out-listeners-race.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 자동동기화가 "토글은 켜져 있는데 아무것도 안 올라간다"는 제보. 추적해보니 재트리거 listener **두 개가 주석 처리된 채 방치**돼 있었다.
- 원래 동작하던 기능을 **긴급 차단**으로 주석 처리했다가, **복원이 누락**됐다. 조건 게이트는 들어갔는데 트리거 복원이 빠져 "게이트는 저장되는데 트리거는 죽은" 상태가 한참 남았다.
- 복원하면서 두 번째 버그가 드러났다: **double-trigger 레이스** — check와 act 사이에 `await`가 있어 재진입 락이 무력화됐다. JS가 single-thread여도 `await` 경계에서 인터리빙이 생긴다.

## 배경 — 토글은 켜졌는데 안 된다

제보가 들어왔다 — 네이티브 갤러리 자동동기화가 안 된다고. 토글은 분명히 켜져 있었다. 추적해보니 범인은 자동 재트리거 listener 두 개였다. **주석 처리된 채** 방치돼 있었던 것이다.

- 네트워크(WiFi) 재연결 시 동기화를 재시작하는 listener
- 앱이 foreground로 복귀할 때 새 미디어를 감지하는 listener

살아있는 건 앱을 처음 켤 때 도는 cold-start 트리거 하나뿐이었다. 그래서 앱 시작 시점에 WiFi와 새 사진이 동시에 맞아떨어지지 않으면, 자동동기화는 사실상 돌지 않았다.

## 왜 주석 처리됐나 — 긴급 차단의 흔적

원래 자동동기화는 잘 동작했다. 그런데 **특정 진입 시점에 원치 않게 동기화가 시작되는 것을 긴급히 막아야** 했고, 그 빠른 차단으로 listener를 주석 처리했다. 의도한 후속 작업은 "기본 OFF + 조건 게이트가 켜지면 그때부터 동기화"였다.

조건 게이트는 제대로 들어갔다(동기화 진입 두 지점 모두에서 게이트를 검사한다). 그런데 **트리거 복원이 누락**됐다. 결과적으로 "게이트는 저장되는데, 그 게이트를 읽어 실제로 시작할 트리거는 죽어있는" 상태가 한참 이어졌다.

## 교훈 1 — 주석은 복원을 누락시킨다

긴급 차단을 **코드 주석**으로 하면 복원이 잘 누락된다. 주석 블록은 실행 경로에서 빠진 채, 코드 리뷰에서도 "의도적으로 죽인 코드"처럼 보여 영영 안 살아난다(텍스트야 `grep`에 잡히지만, 그게 *복원해야 할* 코드라는 신호는 어디에도 없다). 긴급 차단은 차라리:

- **명시적 feature flag**로 끄거나,
- **한 줄 early-return + TODO(만료 조건)**로 남기는 게 낫다. 적어도 흔적이 코드로 남아 검색·리뷰에 걸린다.

그리고 한 가지 더 — **조건 게이트와 트리거는 별개의 축**이다. "게이트 플래그가 저장된다"와 "그 플래그를 읽어 동작을 시작한다"는 서로 다른 검증 포인트다. 게이트 저장만 테스트하고 끝내면 트리거 쪽 회귀를 놓친다.

## 교훈 2 — double-trigger 레이스 (await가 락을 무력화한다)

되살린 두 listener에는 함정이 하나 더 숨어 있었다. 둘 다 같은 전역 락(`autoSyncRunning`)을 검사하는데, 문제는 **검사(check)와 락 set(act) 사이에 `await`가 끼어 있었다**는 것이다. 두 이벤트(앱 resume + WiFi 재연결)가 거의 동시에 발생하면, 둘 다 `if (autoSyncRunning) return` 가드를 통과한 뒤 한참 뒤에야 각자 락을 set한다 → 같은 동기화를 두 번 시작하는 레이스다.

```ts
// BEFORE (race): 락은 동적 import·store 검사 이후에야 set됨
Network.addListener('networkStatusChange', async (status) => {
  if (!status.connected || status.connectionType !== 'wifi') return;
  if (autoSyncRunning || syncCancelled) return;          // ← check
  const { useSettingsStore } = await import('~/stores/settings'); // ← await (gap!)
  // … store 검사 …
  autoSyncRunning = true;                                // ← act (너무 늦음)
  await startFullSync({ wifiOnly: true });
});

// AFTER (fixed): predicate 통과 즉시 락 claim, 게이트 검사는 try 안 → finally에서 release
Network.addListener('networkStatusChange', async (status) => {
  if (!status.connected || status.connectionType !== 'wifi') return;
  if (autoSyncRunning || syncCancelled) return;
  autoSyncRunning = true;                                // ← 첫 await 전에 동기 claim
  try {
    const { useSettingsStore } = await import('~/stores/settings');
    const { useAuthStore } = await import('~/stores/auth');
    const settingsStore = useSettingsStore();
    const authStore = useAuthStore();
    if (!authStore.isLoggedIn || !settingsStore.gallerySyncEnabled) return;
    if (settingsStore.syncInProgress) return;
    await startFullSync({ wifiOnly: true });
  } catch (e) {
    console.error('[GallerySync] Wi-Fi auto sync failed:', e);
  } finally {
    autoSyncRunning = false;                             // early-return도 여기서 해제
  }
});
```

핵심은 **JS가 single-thread인데도 레이스가 난다**는 점이다. `await` 경계마다 다른 콜백이 끼어들 수 있으므로, "check-then-act"의 두 단계 사이에 `await`가 있으면 그 락은 무력하다. 락은 **싸구려 동기 술어를 통과한 직후·첫 `await` 이전에 동기적으로 claim**하고, 이후 게이트 검사는 `try` 안에 넣어 early-return 시에도 `finally`에서 풀어야 한다.

## 후속

- "긴급 차단 = 주석"을 팀 컨벤션에서 빼고, feature flag 또는 만료 TODO로 대체.
- `await` 경계를 넘는 재진입 락은 "claim-before-await" 패턴으로 리뷰 체크리스트에 추가.
- 여러 listener가 같은 락을 공유하면, 락 획득을 listener마다 복붙하지 말고 **공통 wrapper/헬퍼**에 두어 drift를 막는다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
