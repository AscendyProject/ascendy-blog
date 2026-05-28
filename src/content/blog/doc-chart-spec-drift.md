---
title: "Spec을 따랐는데 false negative — 문서와 코드가 갈라질 때"
description: "거버넌스 문서의 명령과 Helm chart의 runtime 요구사항이 따로 진화하자, 문서를 정확히 따른 verify가 false negative를 냈고 그것이 '환경 문제'로 오분류됐다. doc-as-spec 워크플로의 구조적 약점과 그 반복 메커니즘."
pubDate: 2026-05-28
author: "Ascendy Engineering"
tags: ["helm", "documentation", "agent-workflow", "root-cause-analysis"]
category: "infra"
lang: "ko"
translationKey: "doc-chart-spec-drift"
sourceIntake:
  - "docs/intake/from-infra/2026-05-28-doc-chart-sync-path-drift.md"
draft: true
redactionReviewed: false
---

## TL;DR

- 거버넌스 문서에 적힌 명령을 **그대로** 돌렸더니 실패했다. 첫 진단은 "환경이 깨졌나"였지만, 실제로는 **문서의 명령 형태가 chart의 실제 요구사항과 갈라져** 있었다.
- 문서를 정확히 따른 verify가 **false negative**를 냈고, 그게 "외부 환경의 문제"로 오분류돼 한 사이클을 더 끌었다.
- 작은 결론: 문서를 sync하면 끝. **큰 결론: sync를 유지하는 *메커니즘*이 없으면, chart의 runtime contract가 바뀔 때마다 같은 패턴이 반복된다.**

## 무엇이 일어났나

한 PR의 검증 단계에서 거버넌스 문서의 명령을 실행했다. 명령은 실패했고, 첫 분석은 "main에 원래 있던 breakage"였다. 별건으로 분리하고 그 PR 머지는 막지 않았다.

다음 사이클을 열기 직전 다시 조사하니 main은 깨져 있지 않았다. chart 자체는 멀쩡했고, **거버넌스 문서에 적힌 명령 형태가 chart의 runtime 요구사항과 어긋나** 있었다. 문서라는 spec을 따른 쪽이 false negative를 만들고, 그 false negative가 "환경 breakage"로 잘못 분류된 사건이다. 후속 PR이 문서의 명령 블록을 chart의 실제 invocation 형태와 일치시켜 고쳤다.

## 직접 원인은 사소하다

chart의 helpers 파일이 어느 시점에 `required` 가드를 받았다 — 값이 없으면 render를 실패시키는 Helm 함수다. 도입 PR은 incident 대응이었다(이미지 태그가 빈 채 release가 나가는 regress 차단). 가드 후로는 `helm template` / `helm lint`가 image tag를 명시적으로 받아야 통과한다.

CI의 lint job은 이걸 알고 있었다 — 가드 직후 갱신돼 각 component에 placeholder 태그를 전달하도록 바뀌었다. **CI는 green.** 그러나 거버넌스 문서의 명령 블록은 갱신되지 않았다. 가드 도입 *전*의 명령 형태(`helm lint <chart>`)를 그대로 두고 있었다. 같은 chart, 두 가지 결과 — CI는 통과, 문서를 따른 쪽은 실패.

## 문제는 결정 구조다

이건 단순 누락이 아니라 **doc-as-spec 워크플로의 구조적 약점**이다.

거버넌스 문서는 검증할 때 읽는 단일 진입점이다 — "이 명령을 돌리면 검증이 끝난다"는 약속. CI는 그 약속의 *실행*일 뿐 *정의*가 아니다.

이 가정은 chart의 runtime contract가 바뀌는 순간 깨진다. 가드가 도입되거나, helper가 새 required field를 갖거나, image repository가 바뀌면, 문서의 명령은 더 이상 chart의 진짜 요구를 반영하지 않는다. 그리고 CI는 그 gap을 못 잡는다 — CI는 *자기 자신의* invocation으로 통과하면 끝이지, 문서의 invocation이 sync됐는지 검증하지 않는다.

결과: 두 source of truth가 같은 chart에 대해 다른 명령을 말하기 시작한다. 다음에 문서를 따라 검증하는 쪽은, 자기가 spec을 정확히 실행했는데도 false negative를 받는다. 그리고 false negative를 받았을 때의 첫 본능은 **"환경에 뭔가 깨졌나"**다 — 문서가 "이 명령은 통과해야 한다"고 말하므로, 통과하지 않으면 환경 탓으로 분류된다. 그렇게 drift가 한 사이클 더 이어진다.

## 결정 / 트레이드오프

작은 결론은 "문서를 sync하면 끝"이다. 큰 결론은 다르다 — **어떻게 sync가 유지되는지를 메커니즘으로 잡지 않으면, 이 패턴은 chart의 runtime contract가 바뀔 때마다 반복된다.** 이건 우리가 반복해서 catch해 온 path-drift 패턴이고, 누락은 의지의 문제가 아니라 **메커니즘 부재**의 문제다.

실무 메모 둘:
- 한 파일 안에 같은 명령 블록이 두 곳(예: Commands와 Verification)에 있으면 **두 곳 다** sync해야 한다. 한 곳만 고치면 같은 PR 안에서 drift가 즉시 재발한다.
- `required` 같은 chart-level 가드를 도입하면 sync할 surface가 "문서 + CI + 검증 스크립트" 세 군데로 는다. 도입 PR에서 이 셋을 같이 건드려야 drift가 안 생긴다.

## 후속

- sync를 강제하는 메커니즘(예: 문서의 명령 블록을 CI가 그대로 실행해 검증) 검토.
- 참고: [Helm `required`](https://helm.sh/docs/chart_template_guide/functions_and_pipelines/#using-the-required-function), [Helm `--set`](https://helm.sh/docs/intro/using_helm/#the-set-flag).

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
