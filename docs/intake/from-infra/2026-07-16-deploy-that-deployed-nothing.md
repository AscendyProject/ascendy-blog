---
team: infra
date: 2026-07-16
topic: "성공한 배포가 아무것도 배포하지 않았다 — CD가 mutable 태그(latest)를 helm에 넘겼고, 이전 배포도 같은 latest라 렌더된 pod 스펙이 이전과 글자 하나 다르지 않아 쿠버네티스가 새 ReplicaSet을 안 만듦(롤아웃 0). helm success·rollout status complete·'실행 이미지가 배포 태그를 포함하는가' 안전망까지 전부 초록불이었지만(태그가 latest라 그 grep이 공허하게 참), 프로덕션은 노드가 캐시한 옛 이미지를 계속 서빙. thesis 둘: ① 이름은 같고 내용은 바뀌는 mutable 태그를 오케스트레이터는 이름만 보고 '변화 없음'으로 판정 ② 방어 장치(태그 grep)의 유효성이 그 방어가 지키려던 속성(태그 immutability)에 의존 → 그 속성이 깨지자 방어도 조용히 깨짐. fix: immutable per-commit(sha) 태그 + 배포 dispatch 단계에서 mutable 태그를 문 앞에서 거부(false positive 0, 새 secret 0, fail-loud)."
suggestedCategory: "infra"
suggestedTags: ["infra", "kubernetes", "helm", "ci-cd", "mutable-tags", "postmortem"]
source: "infra 팀 인테이크(top-level infra). 크레덴셜 없음(Class B 없음). 인프라측 거부 가드가 main에 머지되어 조용한 no-op 클래스가 닫힘(remediation shipped) → resolved trap으로 서술."
redactionReviewed: true
---

> infra 팀 인테이크 정제본. **삽질기 형식.** **크레덴셜 없음**(인증·시크릿·abuse 로직
> 무관). **resolved:** 인프라측 mutable-태그 거부 가드가 main에 머지되어 조용한 no-op
> 클래스가 닫힘(이제 mutable 태그는 큰 소리로 실패) → 본문은 이미 닫힌 trap으로 서술(현재
> 열린 약점 아님). **redaction(Class C 식별자 일반화):** 레지스트리 호스트·이미지 경로,
> 프로덕션 클러스터·앱 네임스페이스·helm 릴리스 이름, CD/배포/CI 워크플로 파일명과 dispatch
> 페이로드 필드, 내부 배포 타깃 목록, repo/org 이름은 전부 일반화형으로만 서술(frontend/backend는
> generic이라 유지). 태그 명명(`latest`·`sha-<short>`·`latest|main|stable|edge` denylist)은
> 일반 관례라 유지. 쿠버네티스·helm·docker 도구명은 공개 OSS라 무방. 외부 참조(k8s/helm 공식
> 문서)는 발행 전 200 확인.

## 핵심 (인테이크에서 도출)

1. **증상.** operator-gated 배포 버튼 → 워크플로 success. 그런데 하드 리프레시·시크릿 창에도
   프로덕션은 옛 버전. 여러 머지가 하나도 반영 안 됨. 실패 스텝 없음.
2. **초록불 세 개가 전부 진실.** helm "upgrade 성공", `kubectl rollout status` "이미 완료",
   그리고 배포 후 안전망 검사 pass — 셋 다 사실인데 프로덕션만 안 바뀜.
3. **근본 원인 — mutable 태그 + 동일 렌더 = 롤아웃 0.** 배포는 `helm upgrade --reuse-values
   --set <component>.image.tag=<TAG>`. 이번 TAG도 `latest`, 지난번도 `latest` → 렌더된 pod
   스펙이 이전과 완전히 동일. 롤아웃을 일으키는 건 helm이 아니라 Deployment 컨트롤러이고,
   컨트롤러는 pod 템플릿 문자열 변화를 감지할 때만 새 ReplicaSet을 만듦. 이름(`...:latest`)이
   같으면 다이제스트가 바뀌어도 "변화 없음". 노드는 캐시한 옛 이미지를 계속 서빙.
4. **두 번째 층 — 안전망이 공허하게 통과.** 안전망은 '실행 이미지가 방금 배포한 태그를 포함하는가'
   grep. 태그가 `latest`면 옛 이미지도 `...:latest`라 롤아웃이 0이어도 항상 매칭 = 무의미.
   **방어의 유효성이 그 방어가 지키려던 속성(태그 immutability)에 의존**했고, 그 속성이 깨지자
   방어도 같이 조용히 깨짐. 세 초록불이 같은 눈먼 지점을 공유.
5. **메커니즘 선택의 오답.** 사후 탐지(generation 상승/새 ReplicaSet 확인)는 정상 idempotent
   재배포(같은 sha 재시도)에서 false positive. '정상 no-op'과 '나쁜 no-op(mutable 태그가 새
   내용을 숨김)'을 가르려면 결국 태그 mutability 신호 필요. 레지스트리 다이제스트 비교는 견고하나
   배포 runner에 레지스트리 인증(새 secret 표면)이 붙어 과함. → 최종: **mutable 태그를 dispatch
   단계에서 거부**(false positive 0, 새 secret 0, fail-loud + 교정 안내).
6. **thesis 둘.** ① 이름은 고정·내용은 유동인 태그를 오케스트레이터는 이름만 비교한다. ② 방어 장치의
   유효성이 그 방어가 지키려는 속성에 의존하고 있었다.

## 연결

- 성공 신호가 실패를 가린 결(레이스로 인한 stuck 배포 자가치유 등 인프라 삽질기)과 같은 계열.
  helm/k8s 정합성·silent-failure 트랩.

## 외부 공유 불가

- 레지스트리 호스트·이미지 경로, 프로덕션 클러스터·앱 네임스페이스·helm 릴리스명, CD/배포/CI 워크플로
  파일명·dispatch 페이로드 필드, 내부 배포 타깃 목록, repo/org 이름 — 전부 일반화(구체값은 게재 안 함).
  PR/이슈 번호는 generic 라벨로. 크레덴셜·시크릿 없음. 인프라 거부 가드는 main에 머지된 remediation.
