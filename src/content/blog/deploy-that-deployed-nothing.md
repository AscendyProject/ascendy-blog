---
title: "성공한 배포가 아무것도 배포하지 않았다 — mutable 태그가 삼킨 롤아웃"
description: "배포는 success로 끝났고, 롤아웃 상태도 완료였고, 안전망 검사까지 초록불이었다. 그런데 프로덕션은 안 바뀌었다. 범인은 mutable 태그(latest) — 이름은 같고 내용만 바뀌니 쿠버네티스가 '변화 없음'으로 판정했고, 태그로 검증하던 안전망까지 공허하게 통과했다."
pubDate: 2026-07-19
author: "Ascendy Engineering"
tags: ["infra", "kubernetes", "helm", "ci-cd", "mutable-tags", "postmortem"]
category: "infra"
lang: "ko"
translationKey: "deploy-that-deployed-nothing"
sourceIntake:
  - "docs/intake/from-infra/2026-07-16-deploy-that-deployed-nothing.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 프론트엔드 변경을 프로덕션에 올리려고 배포 버튼을 눌렀다. 워크플로는 **success**, `rollout status`는 **완료**, 배포 후 안전망 검사도 **통과.** 초록불 세 개가 전부 켜졌는데 — **프로덕션은 옛 버전 그대로였다.**
- 범인은 배포에 쓰던 **mutable 태그(`latest`)였다.** 이번 배포도 `latest`, 지난 배포도 `latest` → helm이 렌더한 pod 스펙이 이전과 *글자 하나 다르지 않았다.* 쿠버네티스는 "변화 없음"으로 보고 새 pod를 안 띄웠다. **helm 성공 ≠ 롤아웃 발생.**
- 더 고약한 건, 바로 이런 조용한 미배포를 잡으라고 만든 안전망이 *공허하게 통과*했다는 것이다. "실행 이미지가 배포한 태그를 포함하나"를 grep했는데, 태그가 `latest`면 롤아웃이 0이어도 항상 참이었다.
- 교훈 둘: **① 이름은 같고 내용만 바뀌는 태그를, 오케스트레이터는 이름만 보고 판정한다. ② 방어 장치의 유효성이, 그 방어가 지키려던 속성에 의존하고 있었다.**

> **이 글에 대하여.** 인프라 삽질기다. 이미 닫힌 함정을 되짚는 사후 기록이며(mutable 태그를 문 앞에서 거부하는 가드가 배포되어 이 조용한 no-op 클래스는 닫혔다), 크레덴셜과는 무관하다. 쿠버네티스·helm 같은 도구명은 그대로 쓰되, 내부 식별자(레지스트리 경로·클러스터·네임스페이스·릴리스·워크플로 이름 등)는 일반화했다.

## 증상 — 성공한 배포, 안 바뀐 프로덕션

프론트엔드 최신 변경 여러 건을 프로덕션에 올리려고, operator가 눌러야 도는 배포 버튼을 눌렀다. 배포 워크플로는 **completed / success**로 끝났다.

그런데 브라우저를 하드 리프레시해도, 시크릿 창으로 새로 들어가도 — 프로덕션 웹 UI는 옛 버전 그대로였다. 여러 번 머지된 변경이 *하나도* 반영되지 않았다.

로그를 훑어도 실패한 스텝이 없었다. 오히려 그 반대였다. 성공을 가리키는 신호가 셋이나 있었다.

## 초록불 세 개가 전부 진실이었다

디버깅을 가장 어렵게 만든 건, 뭔가가 *빨간불*이어서가 아니었다. **초록불 세 개가 전부 켜져 있었고, 셋 다 거짓말이 아니었다는 것**이었다.

1. **helm은 "upgrade 성공"을** 반환했다.
2. **`kubectl rollout status`는 "이미 완료됨"을** 반환했다.
3. **배포 후 안전망 검사도 통과**했다 — "지금 실행 중인 이미지가, 방금 배포한 태그를 포함하는가"를 확인하는 스텝이었다.

셋 다 사실이었다. 그리고 셋 다 "프로덕션이 안 바뀌었다"는 사실과 *모순되지 않았다.* 이게 이 사건의 핵심 난이도다 — 성공 신호 여러 개가 **같은 눈먼 지점을 공유**하면, 그 지점은 어느 신호로도 안 잡힌다.

## 근본 원인 — mutable 태그 + 동일 렌더 = 롤아웃 0

배포 명령은 대략 이런 형태였다.

```bash
# 매 배포가 같은 mutable 태그를 넘긴다.
helm upgrade --install <release> ./chart \
  --reuse-values \
  --set frontend.image.tag=latest    # ← 지난번도 latest, 이번도 latest
```

`--reuse-values`는 이전 릴리스의 값을 그대로 물려받고, `--set`으로 이번 태그만 덮어쓴다. 그런데 덮어쓴 값(`latest`)이 이전 값(`latest`)과 같았다. 그래서 **helm이 렌더한 pod 스펙이 이전 릴리스와 완전히 동일**했다 — 이미지 레퍼런스가 `.../frontend:latest`로 글자 하나 다르지 않았다.

여기서 흔한 오해를 하나 짚어야 한다. helm은 릴리스 리비전을 새로 하나 만든다. **하지만 그게 곧 롤아웃은 아니다.** 롤아웃을 일으키는 주체는 helm이 아니라 쿠버네티스의 **Deployment 컨트롤러**이고, 컨트롤러는 pod 템플릿에 변화가 감지될 때만 새 ReplicaSet을 만든다. 렌더된 pod 스펙이 이전과 똑같으면, 컨트롤러 입장에선 *할 일이 없다.* 새 ReplicaSet도, 새 pod도, 새 이미지 pull도 없다. 노드는 이미 캐시해 둔 옛 `latest` 이미지를 그대로 계속 서빙한다.

그래서 helm은 "성공", `rollout status`는 "이미 완료"를 반환한다. **전부 사실이다.** 프로덕션이 안 바뀐 것과도 모순되지 않는다.

여기서 mutable 태그의 함정이 완성된다. `latest`라는 *이름*은 그대로인데, 그 이름이 가리키는 *내용*(이미지 다이제스트)은 매 빌드마다 바뀐다. 그런데 helm과 쿠버네티스는 태그 **문자열**만 비교하지, 그 문자열이 레지스트리에서 새 다이제스트를 가리키게 됐는지는 모른다. **이름이 같으면 "변화 없음"으로 판정한다.**

## 두 번째 층 — 안전망이 공허하게 통과한 이유

이 파이프라인엔 *바로 이런* 조용한 미배포를 잡으라고 만든 검증 스텝이 있었다. 로직은 단순했다.

```bash
# 배포 후: 실행 중 이미지가 방금 배포한 태그를 포함하는가?
live=$(kubectl get deployment frontend -o jsonpath='{..image}')  # -> .../frontend:latest
echo "$live" | grep -q -- "$TAG"    # TAG=latest → 항상 매칭
```

배포 후 실행 중인 이미지 레퍼런스를 읽어서, 방금 dispatch한 태그 문자열이 거기 들어있는지 grep한다. 없으면 실패시킨다. 합리적으로 들린다.

그런데 태그가 `latest`이면 이 검사는 **언제나 참**이다. 실행 중인 (옛) 이미지도 `.../frontend:latest`, dispatch한 태그도 `latest` — grep이 매칭된다. **심지어 롤아웃이 전혀 안 일어났어도 매칭된다.**

이게 이 사건에서 가장 곱씹을 지점이다. **안전망이 검증하려던 바로 그 실패 모드에서, 안전망 자신이 무력화되는 구조**였다. 이 검사가 의미를 가지려면 태그가 배포마다 유니크해야 한다 — 즉 *immutable*이어야 한다. sha 태그였다면 옛 pod엔 옛 sha가, 새 배포엔 새 sha가 있어 grep이 진짜 assertion이 됐을 것이다.

한 줄로 요약하면 이렇다. **방어 장치의 유효성이, 그 방어가 지키려던 속성(태그의 immutability)에 의존하고 있었다.** 그 속성이 깨지자 방어도 같이 — 조용히 — 깨졌다. 세 초록불이 전부 진실이었던 이유가 여기 있다. 셋 다 태그 문자열만 봤고, 셋 다 같은 곳에서 눈이 멀어 있었다.

## 메커니즘을 고를 때의 오답 하나

fix를 짤 때 첫 후보는 "배포 후 롤아웃이 *실제로* 일어났는지 사후 탐지"였다 — Deployment의 generation이 올랐는지, 새 ReplicaSet이 생겼는지 확인하는 것.

그런데 여기엔 **false positive**가 있다. 같은 sha를 *의도적으로* 재배포하는 경우(예: 일시적 실패 후 재시도)엔 pod 스펙이 안 바뀌므로 generation도 안 오르는데, 그건 *정상*이다 — 이미 맞는 이미지가 떠 있으니까. "정상 no-op(같은 내용을 다시 적용)"과 "나쁜 no-op(mutable 태그가 새 내용을 숨김)"을 구분하려면, 결국 **태그의 mutability라는 신호가 필요**하다. generation만으론 둘을 못 가른다.

레지스트리 다이제스트를 직접 비교하는 방법은 어떤 태그에도 견고하지만, 배포 runner에 레지스트리 인증(= 새 secret 표면)을 붙여야 해서 방어심층용으론 과했다.

그래서 최종 선택은 더 단순한 쪽이었다 — **mutable 태그를 dispatch 단계에서, 문 앞에서 거부**하는 것.

```bash
case "$TAG" in
  latest|main|stable|edge)
    echo "❌ mutable 태그 '$TAG' 거부: 조용한 no-op 롤아웃을 유발한다."
    echo "   immutable 태그로 dispatch 하라 (예: sha-<short-sha>)."
    exit 1
    ;;
esac
```

이 방식은 false positive가 0이고, 새 secret도 0이며, "immutable 태그를 쓰라"는 권장 흐름을 파이프라인이 *강제*하게 만든다. 거부당하면 배포는 **큰 소리로** 실패하고, 에러 메시지가 정확한 fix(sha 태그로 dispatch)를 알려준다. 그리고 부수 효과로, 앞의 grep 안전망도 다시 진짜 assertion이 된다 — 태그가 immutable해졌으니까.

조용한 미배포보다, 문 앞에서 큰 소리로 튕겨내는 실패가 언제나 낫다.

## 가져갈 것

- **helm 성공은 롤아웃 발생이 아니다.** 롤아웃을 일으키는 건 helm이 아니라 Deployment 컨트롤러이고, 컨트롤러는 pod 템플릿 *문자열* 변화만 본다. 태그 이름이 같으면 다이제스트가 바뀌었어도 "변화 없음".
- **mutable 태그(`latest`)는 이름은 고정, 내용은 유동이다.** 오케스트레이터는 이름만 비교한다. CD에서 immutable per-commit(`sha-<short>`)이나 다이제스트 배포를 권하는 근본 이유가 이것이다.
- **방어 장치가 지키려는 속성에, 방어 자신의 유효성이 의존하면 안 된다.** 태그로 검증하는 안전망은 태그가 immutable해야만 유효한데, 정작 막으려던 실패가 그 immutability를 깬다.
- **사후 탐지보다 원천 차단.** generation 탐지는 정상 재배포에서 오탐을 낸다. 나쁜 no-op을 가리려면 결국 태그 mutability 신호가 필요하니, mutable 태그 자체를 문 앞에서 거부하는 게 더 단순하고 오탐이 없다. **Fail loud, not silent.**

성공을 가장한 미배포는, 명시적인 실패보다 훨씬 비싸다. 세 개의 초록불이 전부 진실이었는데 결과만 틀렸던 이 사건이, 그 값을 톡톡히 치르게 했다.

## 참고

- [Kubernetes — 컨테이너 이미지와 `imagePullPolicy`](https://kubernetes.io/docs/concepts/containers/images/)
- [Kubernetes — Deployment 업데이트(롤아웃은 pod 템플릿이 바뀔 때만)](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Helm — `helm upgrade`와 `--reuse-values`](https://helm.sh/docs/helm/helm_upgrade/)

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
