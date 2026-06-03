---
title: "분산하라는 제약이 배포를 막았다 — required anti-affinity와 빠진 두 번째 노드"
description: "SPOF를 풀려고 두 stateful에 'required' anti-affinity를 걸었다. 그런데 그 제약을 만족할 두 번째 노드가 아직 없어서, 무관한 팀의 CD가 25시간 조용히 막히고 helm 배포가 5번 연속 실패했다. 분산 제약은 분산될 자리보다 먼저 들어가면 배포를 막는다 — 순서 의존성, 그리고 위험한 runbook 전제를 실행 전 재검증한 이야기."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["kubernetes", "helm", "pod-anti-affinity", "continuous-deployment", "deploy-order", "root-cause-analysis"]
category: "infra"
lang: "ko"
translationKey: "anti-affinity-deploy-order-trap"
sourceIntake:
  - "docs/intake/from-infra/2026-06-03-anti-affinity-deploy-order-trap.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 단일 노드에 몰린 SPOF를 풀려고, 두 무거운 stateful(검색엔진·그래프DB)에 **`required` podAntiAffinity**를 걸어 서로 다른 노드로 강제 분산하기로 했다.
- 그런데 그 제약을 만족할 **두 번째 노드가 아직 없었다.** 그래프DB는 갈 곳이 없어 Pending → readiness 실패 → **무관한 팀의 CD가 25시간 동안 조용히 막히고, helm 배포가 5번 연속 실패**했다.
- 핵심: **`required` 제약은 그 제약을 만족할 capacity가 *먼저* 있어야 한다.** 분산하라는 제약을 분산될 자리(노드)보다 먼저 넣으면, 제약은 "배치 불가"가 되어 배포를 막는다. 공유 릴리스에선 그 피해가 무관한 팀으로 번진다.
- 보너스 교훈: runbook이 "가장 위험한 단계"로 꼽았던 브로커 이전은, 실패한 배포가 이미 부분 적용해놔서 *무효화*돼 있었다. **위험한 절차는 실행 전에 "그 위험이 아직 유효한가"를 현재 상태로 재검증하라.**

> **소스 노트.** 이 글은 상위 인프라 팀의 인테이크(`docs/intake/from-infra/2026-06-03-anti-affinity-deploy-order-trap.md`)를 정제한 것이다. 노드·워크로드·릴리스 이름, 이미지 태그, vendor, CD 트리거 구현 등 내부 식별자는 일반화했다. 앞선 호스트 장애 회고에서 "단일 역할 노드 풀 = drain하면 갈 곳이 없다"는 SPOF를 follow-up으로 남겼고, 이 글은 그 SPOF를 실제로 고치다 밟은 함정의 기록이다.

## SPOF를 풀려다 — failed 릴리스 5개

데이터 평면(검색·그래프·캐시/브로커)이 한 노드에 전부 몰려 있었다. 그 노드가 얼면 전부 같이 죽는 단일 장애점(SPOF). 풀기로 한 방식은 단순했다 — **노드를 한 대 추가**하고, 두 무거운 stateful에 `required` anti-affinity를 걸어 **서로 다른 노드에 강제로 흩뜨린다.** 차트 변경은 PR로 미리 머지해뒀다.

그런데 적용 상태를 보니 이상했다. **helm 릴리스가 `failed`였고, 어제 하루 동안 같은 업그레이드가 5번 연속 실패**해 있었다. 전부 같은 메시지였다.

```text
Deployment/<graphDB> not ready: Progress deadline exceeded
```

## 왜 — 제약을 만족할 노드가 없었다

그 5번의 실패는 사실 **SPOF 수정과 무관한, 다른 팀의 CD**였다. 우리 CD는 앱 repo가 빌드 후 인프라로 배포 이벤트를 쏘면, 인프라가 `helm upgrade`로 그 이미지 태그만 갈아끼우는 구조다. 그런데 그 업그레이드는 **차트 전체를 다시 적용**한다. 그래서 머지돼 있던 SPOF 수정(required anti-affinity)이 그 배포에 **딸려 함께 적용**됐다.

문제는 타이밍이었다. anti-affinity는 "검색엔진과 그래프DB를 같은 노드에 두지 마라"인데, 그 시점엔 **해당 역할의 노드가 한 대뿐**이었고 검색엔진이 이미 그 위에 있었다. 그래서 그래프DB는 **갈 수 있는 노드가 없어 Pending**에 멈췄다 → readiness가 영원히 안 됨 → `Progress deadline exceeded` → 업그레이드 실패. 이게 5번 반복되며 릴리스는 `failed`로 굳었다.

여기서 함정의 사악한 점이 드러난다. 피해자는 SPOF를 건드린 적도 없는 **다른 팀의 배포**였다. 그 팀은 "내 배포가 왜 안 되지?"를 영문도 모른 채 **25시간**을 겪었고, 원인은 전혀 다른 인프라 변경이었다. 빠진 전제는 단 하나, **두 번째 노드**였다.

> **순서가 전부다.** `required` 제약은 그 제약을 만족할 capacity가 *먼저* 있어야 한다. 분산하라는 제약을 분산될 자리보다 먼저 넣으면, 제약은 "배치 불가"로 바뀌어 배포를 막는다. 그리고 공유 릴리스를 여러 파이프라인이 함께 쓰면, **한 변경의 실패가 무관한 배포를 인질로 잡는다.**

## 함정 2 — "가장 위험한 단계"가 이미 지나가 있었다

이 작업의 runbook은 캐시·브로커(영속 볼륨이 없는 Celery 브로커)를 다른 노드로 옮기는 걸 **가장 위험한 단계**로 봤다. 옮기면 pod가 재생성되며 큐에 쌓이거나 처리 중이던 브로커 상태가 날아가기 때문이다. 그래서 "스케줄러 정지 → 큐 비우기 → 옮김 → 복구"라는 조심스러운 절차를 준비했다.

그런데 실제 상태를 보니 — **브로커는 이미 app 노드에서 25시간째 돌고 있었다.** 어제의 실패한 업그레이드들이 그래프DB readiness에서 *최종* 실패했지만, **브로커 Deployment 패치는 그 전에 이미 부분 적용**돼 브로커가 진작 옮겨가 있었던 것이다. 즉 runbook이 두려워한 위험한 cutover는 **이미 (의도치 않게) 끝나 있었고**, 같은 차트를 다시 적용해도 브로커는 안 움직인다 — 큐 flush가 없다.

손대기 전에 이걸 어떻게 확인했나. **현재 배포된 manifest와, 새로 렌더한 manifest를 diff했다.**

```bash
diff <(helm get manifest <release> -n <ns>) \
     <(helm template <release> ./chart -n <ns> -f values.yaml --set <tags>)
```

stateful과 브로커의 pod template에 **변경이 0**임을 확인했다. 그래서 "재적용해도 template이 바뀌지 않으니 재생성도 없다"를 *예측*하고 실행했다. 결과는 깔끔한 reconcile — 두 번째 노드를 추가하니 그래프DB가 비로소 배치됐고, 한 번의 `helm upgrade`로 릴리스가 `failed → deployed`로 정리됐다. 적용 후 모든 stateful pod의 나이(AGE)와 재시작 횟수가 그대로인 것을 확인 = **재생성 0.**

> 위험한 절차를 실행하기 전에 **"그 위험이 아직 유효한가"를 현재 상태로 검증하라.** runbook은 "브로커가 옮겨져야 하는 상태"를 전제했지만, 부분 적용된 실패 배포가 그 전제를 이미 무효화해놨다. **manifest diff는 예측이고, 적용 후 AGE/RESTARTS는 확인이다.** diff는 template 변경의 부재까지만 보여준다 — hook·외부 변경·런타임 실패까지 보장하진 않으니, 무중단의 *확인*은 언제나 적용 후 지표다.

## 함정 3 — `--reuse-values`가 stuck 배포를 끌고 올 뻔했다

reconcile할 때 helm엔 `--reuse-values`(직전 릴리스 값 재사용)가 있다. 편해 보인다. 그런데 직전 "값"은 **실패한 그 배포가 쓰려던 새 이미지 태그**였다. `--reuse-values`로 돌렸으면, 단순히 릴리스 상태만 정리하려던 작업에 **엉뚱한 버전 변경이 부수효과로 딸려 갔을** 것이다.

그래서 일부러 `--reuse-values` 대신 **현재 라이브 태그를 명시(`--set`)**해서, reconcile을 순수하게 "상태 정리"로만 한정했다. 막혀 있던 새 버전은 인프라가 수동으로 밀 게 아니라, **그 애플리케이션 CD가 다시 쏘면 되는 일**(이제 SPOF가 풀려 성공한다)이라 그쪽 레인으로 넘겼다.

## 가져갈 것

- **capacity 먼저, 제약 나중.** 분산을 강제하는 `required` 제약은 분산될 노드가 먼저 있어야 한다. 순서가 어긋나면 제약이 배포를 막는다.
- **공유 helm 릴리스는 cross-team 인질극의 무대다.** 여러 파이프라인이 한 릴리스를 공유하면, 한 변경의 실패가 무관한 팀의 배포를 멈춘다. 실패가 어디서 왔는지조차 안 보인다.
- **위험한 runbook 단계는 실행 전에 현재 상태로 전제를 재검증하라.** 부분 적용된 실패 배포가 "위험"을 이미 무효화했을 수 있다. **diff는 예측, 적용 후 지표는 확인** — 둘은 다른 일이다.
- **`--reuse-values`는 직전 실패 배포의 값을 끌고 온다.** 상태 정리는 라이브 값을 명시해 순수하게 한정하라.
- 그리고 한계 — 분산은 한 노드 장애의 *피해 범위*를 줄이지, 장애 *자체*를 막진 못한다. blast-radius 대책과 freeze-frequency 대책은 다른 문제다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
