---
title: "시크릿을 자가복구시키는 데 정작 중요했던 건 '도구'가 아니라 '어디서 도느냐'였다"
description: "삭제될 수 있는 쿠버네티스 pull-secret을 자가복구시키려다 '제대로 된 플랫폼 답'(External Secrets Operator)으로 직행할 뻔했다. operator의 한마디 'CI secret 쓰면 안 돼?'가 설계를 뒤집었다. 결정적인 건 도구의 정교함이 아니라, source와 reconcile 엔진이 둘 다 클러스터 밖에 있느냐였다."
pubDate: 2026-06-13
author: "Ascendy Engineering"
tags: ["kubernetes", "secrets", "self-healing", "design-decision", "over-engineering", "war-story"]
category: "infra"
lang: "ko"
translationKey: "secret-self-heal-source-location"
sourceIntake:
  - "docs/intake/from-infra/2026-06-13-secret-self-heal-source-location.md"
draft: false
redactionReviewed: true
---

## TL;DR

- private 이미지를 쓰면 클러스터엔 레지스트리 로그인용 **pull-secret**이 필요하다. 이게 **Helm 차트 밖에서** 만들어지면 차트가 *소유하지 않아서*, 누군가 out-of-band로 지우면 **차트가 되살리지 않는다.** → `ImagePullBackOff`. 그래서 **자가복구(self-heal)**가 과제.
- "제대로 된 플랫폼 답"으로 **External Secrets Operator(ESO) + 클라우드 Secrets Manager**에 직행할 뻔했다. 그런데 operator의 한마디 — **"굳이? CI secret 쓰면 안 돼?"** — 가 설계를 다시 짜게 했다.
- 깨달은 것: **결정적 속성은 도구의 정교함이 아니라, *복구의 source와 reconcile 엔진이 둘 다 클러스터 밖에 있느냐*였다.** CI push가 그걸 — 새 컴포넌트·부트스트랩 자격증명 없이, 기존 배포 파이프라인을 재사용해 — 더 단순하게 달성했다.
- 단, robustness ≠ immunity. 그래서 scope를 *이 시크릿 하나*로 묶고, **탐지 알람을 백스톱으로** 박았다.

> **소스 노트.** infra 팀 인테이크를 정제한 글이다. 촉발 인시던트의 구체와 열린 운영 follow-up은 제외하고(Class A), 클러스터·레지스트리·CI 식별자는 익명화했다 — 글은 일반 설계-결정 수준에만 머문다. 같은 인프라 결정·삽질 결의 [분산하라는 제약이 배포를 막았다](/blog/anti-affinity-deploy-order-trap/), [알람 3개, 근원은 하나](/blog/host-freeze-three-alarms-one-root/)와 이어진다.

## 차트가 안 만든 시크릿은, 차트가 안 고친다

private 컨테이너 이미지를 쓰면 클러스터가 레지스트리에서 이미지를 받기 위해 **pull-secret**(쿠버네티스 `imagePullSecrets`, `dockerconfigjson` 타입)이 필요하다. 그런데 이 시크릿은 흔히 **Helm 차트가 아니라 차트 *밖*에서** 만들어진다.

그 말은 — **차트가 그 객체를 소유하지 않는다.** 정리 스크립트, 네임스페이스 작업, 사람 실수… 어떤 이유로든 그게 *out-of-band*로 사라지면, `helm upgrade`를 다시 돌려도 **차트는 그걸 되살리지 않는다.** 자기가 만든 게 아니니까. 그리고 다음 이미지 pull이나 pod 재시작이 `ImagePullBackOff`로 깨진다.

그래서 과제는 분명했다. **이 시크릿을 자가복구(self-heal)시키자.** 흥미로운 건 *어떻게*였다.

## "제대로 된 답"으로 직행할 뻔했다

처음엔 망설임 없이 "플랫폼 엔지니어링의 정답"으로 갔다 — **External Secrets Operator(ESO) + 클라우드 Secrets Manager.** 시크릿의 진실을 클러스터 밖 저장소에 두고, 클러스터 안 컨트롤러가 그걸 계속 reconcile하는, 멋지고 표준적인 그림.

구현 직전, operator가 물었다.

> **"굳이 그거 써? 그냥 CI secret 쓰면 안 돼?"**

그 한 마디가 설계를 멈춰 세웠다. 그리고 다시 따져보니, 더 단순한 쪽이 맞았다.

## 결정적인 건 '도구'가 아니라 'source와 엔진의 위치'였다

이 문제의 핵심 위협은 **"삭제자를 모를 수 있다"**는 것이었다. out-of-band 삭제는 출처가 다양해서, "누가 지웠는지 찾아서 막는다"만으론 부족하다 — **누가 지우든 자동으로 복구**돼야 한다.

그러면 자연히 질문은 이렇게 간다. ***복구의 source(진실의 원천)가 어디에 있는가?*** 클러스터 *안*에 있으면, 클러스터 안에서의 삭제 한 방에 source까지 같이 날아갈 수 있으니까.

이 렌즈로 두 옵션을 보면:

```text
[ESO]  외부 저장소 ──(pull)──▶ [클러스터 안: 오퍼레이터 + CRD + RBAC + 부트스트랩 cred] ──▶ Secret
                                ^^^^^^^ reconcile 엔진이 클러스터 안 ^^^^^^^
[CI]   CI secret ──(워크플로가 읽음 · 클러스터 밖)──(push: kubectl apply)──▶ Secret
       ^^^ source 밖 ^^^         ^^^ 엔진도 밖 ^^^
```

- **ESO (pull 모델)** — source는 밖이다(좋다). 하지만 **reconcile *기계* — 오퍼레이터·CRD·RBAC, 그리고 외부 저장소에 접근하기 위한 부트스트랩 자격증명 — 은 여전히 클러스터 *안*에 산다.** 그 부트스트랩 자격증명 자체가 또 지워질 수 있는 in-cluster 객체다. *더 작지만 진짜인* chicken-egg.
- **CI push 모델** — CI(예: GitHub Actions) secret에 로그인 정보를 두고, **워크플로가 그걸 읽어** 배포 직전 `kubectl apply`로 시크릿을 재생성. **source도 밖, reconcile 엔진(CI 러너)도 밖.**

여기서 기술적 제약 하나가 선택을 갈랐다. **GitHub Actions secret은 값을 읽는 API가 없다** — 값은 워크플로 *런 안에서만* 노출된다. 그래서 ESO의 *pull* 백엔드로는 애초에 못 쓴다. "GitHub secret을 ESO에 물린다"는 성립하지 않고, **"워크플로가 secret을 받아 cluster에 민다"(push)만** 가능하다.

결론은 의외로 분명했다. **CI push가 ESO보다 한 면 더 단순하고 강했다.** 같은 핵심 속성(source가 밖)을 주면서, **reconcile 엔진까지 클러스터 밖**에 두고, **이미 있는 배포 워크플로 + 클러스터 자격증명을 재사용**해서 새로 늘어나는 surface가 거의 0이며, **부트스트랩 chicken-egg가 없다.**

"무거운 정답"이 아니라 "이 문제에 맞는 답"이 이긴 케이스였다.

## 그래도 — 과하게 가지 않기

CD 리뷰에서 중요한 규율이 하나 나왔다. **이 push 모델을 *모든* 시크릿으로 확장하지 말 것.**

앱·런타임 시크릿을 전부 워크플로로 밀기 시작하면, CI가 점점 비밀관리 *플랫폼*처럼 비대해지고 접근권·감사·rotation이 사방에 퍼진다. 그래서 push 모델은 **pull-secret 하나의 self-heal로만** 채택하고, "여러 시크릿을 통합 관리할 필요가 *실제로* 커지면 그때 ESO"로 — ESO를 *버린 게 아니라 미뤄둔* 옵션으로 남겼다. 도구를 버린 게 아니라, *적용 범위*를 정직하게 그은 것이다.

## robustness ≠ immunity

push 모델도 "넣고 잊는" 게 아니다. CI 러너, 클러스터 자격증명, 워크플로 자체가 망가지면 self-heal도 멈춘다. 그래서 정확한 표현은 **"source of truth를 클러스터의 삭제 도메인에서 *분리*한다"**이지, "삭제 불가능하게 만든다"가 아니다.

그래서 설계에 **탐지 알람을 *필수*로** 박았다 — 시크릿이 없으면 다음 배포를 기다리지 않고 *즉시* 알리도록. **자동복구가 1선, 탐지 알람이 백스톱.** (구현에선 시크릿 값이 로그·argv에 안 새도록 env→임시파일(`umask 077`)→`--from-file`, apply 출력 억제, 실패해도 임시파일을 지우는 `trap`까지 — 작은 것들이 모여 안전을 만든다.)

## 가져갈 것

- **차트가 만들지 않은 k8s Secret은 차트가 복구하지 않는다.** 차트 밖에서 만든 시크릿은 out-of-band 삭제에 무방비다 — self-heal을 *명시적으로* 설계해야 한다.
- **자가복구 설계의 결정 프레임**: 위협이 "삭제자를 모름"이라면, 결정적인 건 *도구*가 아니라 ***복구의 source와 reconcile 엔진이 어디서 도느냐***다. 둘 다 클러스터 밖이어야 강하다.
- **"제대로 된 플랫폼 답"이 늘 맞는 답은 아니다.** ESO의 reconcile 엔진은 클러스터 안에 남아 부트스트랩 chicken-egg를 만든다. CI push는 기존 배포 자격증명을 재사용해 그걸 회피했다 — *이 문제엔* 더 단순한 쪽이 더 강했다.
- **단순함을 핑계로 무한 확장하지 마라.** scope를 한 시크릿으로 묶고, 통합 필요가 커지면 그때 무거운 도구로. 그리고 **robustness ≠ immunity** — 자동복구 옆엔 탐지 알람을 백스톱으로 둬라.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
