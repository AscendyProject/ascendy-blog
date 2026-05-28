---
title: "두 곳에 정의된 워크로드를 한 번에 안 지운 이유 — 단계적 이행 결정"
description: "같은 워크로드가 raw 매니페스트와 Helm chart 두 곳에 정의돼 있었다. 한 PR로 mass deletion하는 대신 단계적 이행을 택한 이유 — 코멘트 대신 실행 가능한 게이트, 그리고 리뷰어 인지 비용의 분할."
pubDate: 2026-05-28
author: "Ascendy Engineering"
tags: ["kubernetes", "helm", "migration", "decision-making", "risk-management"]
category: "infra"
lang: "ko"
translationKey: "k8s-helm-transition-decision"
sourceIntake:
  - "docs/intake/from-infra/2026-05-27-k8s-helm-overlap-transition.md"
draft: true
redactionReviewed: false
---

## TL;DR

- 프로덕션 워크로드 12개가 두 경로(raw Kubernetes 매니페스트 + Helm chart)에 **중복 정의**돼 있었다. single source of truth로 정리해야 했다.
- 한 PR에서 **한 번에 삭제(A)** 대신, **권위는 Helm으로 선언하되 실제 삭제는 후속 PR로 미루는 단계적 이행(C)**을 택했다.
- 결정적 이유 둘: ① "쓰지 마라"는 **코멘트로는 못 막는다 — 실행 가능한 게이트**가 필요했고, ② mass deletion의 blast radius가 **리뷰어 한 명의 인지 한계**를 넘었다.

## 배경 — 같은 워크로드, 두 개의 정의

워크로드 12개가 raw Kubernetes 매니페스트와 Helm chart 템플릿 양쪽에 동시에 정의돼 있었다. 활성 배포(CD) 경로는 Helm 하나였지만, 문제는 레거시 배포 스크립트였다. 이 스크립트는 `kubectl set image`로 **라이브 Deployment를 직접 수정**하는 두 번째 경로를 갖고 있었다. 이 경로는 Helm release lifecycle **바깥**에서 동작하므로, release가 기록한 상태와 클러스터의 실제 상태를 어긋나게(desync) 만들 수 있었다.

## 세 가지 옵션

- **A.** Helm을 권위로 선언하고 raw 매니페스트 12개를 **한 PR에서 동시 삭제**. 직접 수정 경로도 제거.
- **B.** raw 매니페스트를 권위로 선언하고 Helm을 지원 역할로 격하.
- **C.** Helm을 권위로 선언하되, raw 매니페스트는 `DO NOT DEPLOY` 헤더로 마킹 + 레거시 스크립트의 직접 수정 경로에 **하드 게이트**를 건다. 실제 삭제는 후속 PR(Phase 2)로.

**B는 빠르게 탈락했다.** 지난 분기 동안 chart에 쌓인 incident hardening — 이미지 태그 가드, 마이그레이션 훅, 배포 후 smoke-test, 레지스트리 시크릿 점검 — 이 전부 Helm hook annotation과 `--reuse-values` / `required` 의미론에 의존한다. 이걸 vanilla 매니페스트로 재구현하는 건 불가능하다. B를 고르면 chart가 어차피 배포돼야 하므로 "raw가 single source"라는 약속이 거짓이 된다.

## A vs C — 깨끗함은 리뷰어의 인지 비용으로 산다

A는 디스크 위에 두 트리가 공존하는 혼란을 **즉시** 끝낸다. 대신 12파일 삭제 + 스크립트 deprecation을 한 PR에서 검토시킨다. 리뷰어는 12개 파일이 정말 어디서도 참조되지 않는지 일일이 확인하고, 동시에 스크립트 deprecation까지 따라가야 한다.

C를 고른 결정적 이유는 둘이다.

**1. 하드 게이트는 코멘트로 못 한다.** `DO NOT DEPLOY` 헤더는 reader가 파일을 *열었을 때만* 보인다. 하지만 스크립트 안의 직접 수정 호출은 파일을 안 열어도 실행된다. 그래서 코멘트가 아니라 **실행 단계에서 막는 게이트**를 넣었다 — 환경변수 **또는** 명시 플래그 중 하나의 ack가 있어야만 실행되도록(OR 시맨틱). 둘 다 요구하면 우회가 너무 무거워져 incident 시점의 escape hatch 의미가 사라진다.

```bash
# 레거시 경로: ack(env var 또는 flag) 하나가 없으면 실행 거부.
BYPASS="${BYPASS:-0}"
for arg in "$@"; do
  case "$arg" in --acknowledge-bypass) BYPASS=1 ;; esac
done
if [ "$BYPASS" != "1" ]; then
  echo "ERROR: Helm이 권위입니다. 이 레거시 경로는 BYPASS=1 또는" >&2
  echo "  --acknowledge-bypass 중 하나의 명시적 ack가 필요합니다." >&2
  exit 1
fi
echo "WARN: 레거시 우회 경로가 트리거됨 — 의도된 우회입니까?" >&2
```

**2. mass deletion의 blast radius가 리뷰어 인지 한계를 넘는다.** 12개 파일 중 일부가 다른 곳에서 참조될 수도, 아닐 수도 있다. 모든 참조를 한 PR에서 검증하면서 스크립트 deprecation까지 따라가는 건 한 명에게 너무 많은 동시 검증을 요구한다. Phase 1에서 게이트를 깔고 → 게이트가 트리거되는 빈도를 관찰하고 → 그 데이터로 Phase 2에서 진짜 삭제를 하면, 두 번째 PR은 **"이미 안 쓰던 코드를 지운다"**가 된다. 리뷰 부담이 다르다.

## 결정 / 트레이드오프

A가 더 깨끗하다. 하지만 **깨끗함은 리뷰어의 인지 비용으로 산다.** Phase 1 → Phase 2 분리는 그 비용을 두 번에 나눠 지불하는 명시적 선택이다. 단점도 정직하게: 두 트리가 디스크에 공존하는 사실 자체가 새로 온 사람을 헷갈리게 하고, 헤더 코멘트는 grep 결과의 첫 줄일 뿐 강제가 아니다. 그래서 강제는 코멘트가 아니라 게이트가 맡는다.

## 후속

- Phase 2: 게이트 트리거 빈도 관찰 후 raw 매니페스트 실제 삭제.
- 참고: [Helm Hooks](https://helm.sh/docs/topics/charts_hooks/), [`helm upgrade --reuse-values`](https://helm.sh/docs/helm/helm_upgrade/).

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
