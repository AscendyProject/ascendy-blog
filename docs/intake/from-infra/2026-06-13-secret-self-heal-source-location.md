---
team: infra
date: 2026-06-13
topic: "삭제될 수 있는 쿠버네티스 pull-secret을 자가복구시키는 결정 — '제대로 된 플랫폼 답'(ESO + 클라우드 Secrets Manager)으로 갈 뻔하다가 operator의 한마디('CI secret 쓰면 안 돼?')에 재설계. 결정적 속성은 도구의 정교함이 아니라 source와 reconcile 엔진이 둘 다 클러스터 밖에 있느냐였고, CI push가 그걸 새 컴포넌트·부트스트랩 자격증명 없이 달성."
suggestedCategory: "infra"
suggestedTags: ["kubernetes", "secrets", "self-healing", "design-decision", "over-engineering", "war-story"]
redactionReviewed: true
---

> infra 팀 raw 글감의 redaction 정제본. **Class A 제외**: 촉발 인시던트의 클러스터-특정 디테일과
> 열린 운영 follow-up(카테고리·상태·시점·횟수·활성 여부)은 일절 미포함 — 글은 일반 패턴/설계-결정
> 수준에만 머문다(글감이 이미 그 수준). **Class B 없음.** **Class C 익명화**: 클러스터/클라우드
> provider명·레지스트리 호스트·robot 사용자명·네임스페이스·Helm 릴리스/차트명·CI 환경/secret 이름·
> 거버넌스 tier/gate 번호 → `registry.example.com`·`<ns>`·`<pull-secret>`·`<env>` 등으로.

## 무엇을

private 컨테이너 이미지를 쓰면 클러스터가 레지스트리에서 이미지를 받기 위해 **pull-secret**
(쿠버네티스 `imagePullSecrets`, `dockerconfigjson` 타입)이 필요하다. 이게 **Helm 차트가 아니라
차트 *밖*에서 생성**되는 경우가 흔하고, 그러면 차트가 그 객체를 *소유하지 않아* — 정리 스크립트·
네임스페이스 작업·사람 실수 등 **out-of-band 삭제**로 사라지면 **차트가 되살리지 않는다.** 다음 이미지
pull/pod 재시작이 `ImagePullBackOff`로 깨진다. 그래서 이 시크릿을 **자가복구(self-heal)**시키는 게 과제.

처음엔 "제대로 된 플랫폼 답"으로 직행했다 — **External Secrets Operator(ESO) + 클라우드 Secrets
Manager.** 그런데 구현 직전 operator가 물었다: **"굳이 그걸 써? 그냥 CI secret 쓰면 안 돼?"** 그 한
마디가 설계를 다시 짜게 했고, 더 단순한 쪽으로 갔다.

## 왜 — 결정적 속성은 '도구'가 아니라 'source와 엔진의 위치'였다

핵심 위협은 **"삭제자를 모를 수 있다"**였다. out-of-band 삭제는 출처가 다양해 "삭제자를 찾아 막는다"
만으론 부족하다 — **누가 지우든 자동 복구**돼야 한다. 그러면 질문은 *"복구의 source가 어디 있느냐"*로
간다. 클러스터 안에 있으면 클러스터 안 삭제 한 방에 source까지 같이 날아갈 수 있으니까.

이 렌즈로 두 옵션:
- **ESO (pull 모델)** — 클러스터 *안*의 컨트롤러가 *밖*의 저장소를 읽어 계속 reconcile. source는
  밖(좋다). 하지만 **reconcile *기계*(오퍼레이터·CRD·RBAC + 외부 저장소 접근용 부트스트랩 자격증명)는
  여전히 클러스터 *안*에 산다.** 그 부트스트랩 자격증명 자체가 또 지워질 수 있는 in-cluster 객체다
  (= 더 작지만 진짜인 chicken-egg).
- **CI push 모델** — CI(예: GitHub Actions) secret에 로그인 정보를 두고, 워크플로가 그걸 읽어 배포
  직전 `kubectl apply`로 시크릿을 재생성. **source(CI secret)도 밖, reconcile 엔진(CI 러너)도 밖.**

기술 제약 하나가 선택을 갈랐다: **GitHub Actions secret은 값을 읽는 API가 없다**(값은 워크플로 *런
안에서만* 노출). 그래서 ESO의 *pull* 백엔드로는 못 쓰고 **push로만** 가능하다 — "secret을 ESO에
물린다"가 애초에 성립 안 하고 "워크플로가 받아 cluster에 민다"가 답.

**결론: CI push가 ESO보다 한 면 더 단순·강했다.** 같은 핵심 속성(source가 밖)을 주면서 reconcile
엔진까지 밖에 두고, **이미 있는 배포 워크플로 + 클러스터 자격증명을 재사용**해 새 surface가 거의 0,
**부트스트랩 chicken-egg가 없다.** "무거운 정답"이 아니라 "이 문제에 맞는 답"이 이긴 케이스.

## 과하게 가지 않기 — scope를 '이 시크릿 하나'로

CD 리뷰의 규율: **push 모델을 *모든* 시크릿으로 확장하지 말 것.** 앱/런타임 시크릿을 다 워크플로로
밀면 CI가 비밀관리 *플랫폼*처럼 비대해지고 접근권·감사·rotation이 사방에 퍼진다. 그래서 push는
**pull-secret 하나의 self-heal로만** 채택하고, "여러 시크릿 통합 필요가 실제로 커지면 그때 ESO"로
ESO를 *미뤄둔* 옵션으로 남겼다. 도구를 버린 게 아니라 *적용 범위*를 정직하게 그은 것.

## robustness ≠ immunity

push도 "넣고 잊는" 게 아니다. CI 러너·클러스터 자격증명·워크플로가 망가지면 self-heal도 멈춘다.
정확한 표현은 **"source of truth를 클러스터의 삭제 도메인에서 분리한다"**이지 "삭제 불가로 만든다"가
아니다. 그래서 **탐지 알람을 *필수*로** 박았다 — 시크릿이 없으면 배포를 기다리지 않고 즉시 알리도록.
자동복구가 1선, 탐지 알람이 백스톱.

구현 디테일도 작은 것이 모여 안전을 만든다:
- **배포 직전 ensure 스텝**(가장 큰 gap = 배포/새 pull 시점을 닫음) + 선택적 주기 reconcile.
- **시크릿 로그 누출 방지**: 값을 argv가 아니라 env→임시파일(`umask 077`)→`--from-file`로, apply
  출력 억제, 실패해도 임시파일을 지우는 `trap`.
- *어떤 모드가 무인 prod 변이인지* 명시 — 배포 안 ensure는 operator 트리거 배포의 일부라 무인
  자동화 아님, 주기 무인 reconcile은 별도 정책 예외 필요라고 선을 그음.

## 외부에 공유해도 좋은 부분
- "차트 밖에서 만든 k8s Secret은 차트가 소유 안 해 out-of-band 삭제 시 복구 안 됨 → self-heal 필요" 일반 실패모드.
- **자가복구 설계의 결정 프레임**: 위협이 "삭제자를 모름"이면 *source와 reconcile 엔진의 위치*가 결정적 — 둘 다 클러스터 밖이어야 강하다.
- **ESO(pull) vs CI(push)** 비교 + "GitHub Actions secret은 read API 없어 pull 백엔드 불가, push만" 사실.
- ESO **부트스트랩 chicken-egg**와 CI push가 *기존 배포 자격증명 재사용*으로 회피한다는 점.
- **scope 규율**(한 시크릿만; 전체 비밀 플랫폼화 경계) + **robustness≠immunity**(탐지 알람 필수) + no-secret-logging(env→tempfile→trap).
- "무거운 정답으로 직행할 뻔하다 단순 질문에 재설계"한 의사결정 회고.

## 외부에 공유하면 안 되는 부분 (redaction)
- **Class A**: 촉발 인시던트의 클러스터-특정 디테일·열린 follow-up(카테고리/상태/시점/횟수/활성 여부) → 전량 제외. 글은 일반 패턴/설계 수준만.
- **Class C**: 클러스터/클라우드 provider명·레지스트리 호스트·robot 사용자명·네임스페이스·Helm 릴리스/차트명·CI 환경/secret 이름·tier/gate 번호 → 익명화.
