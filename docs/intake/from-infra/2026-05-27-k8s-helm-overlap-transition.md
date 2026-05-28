---
team: infra
date: 2026-05-27
topic: "같은 워크로드를 두 곳(raw 매니페스트 + Helm chart)에 정의하던 상태를 한 PR의 mass deletion이 아니라 단계적 이행으로 정리한 결정"
suggestedCategory: infra
suggestedTags: ["kubernetes", "helm", "migration", "decision-making", "risk-management"]
redactionNote: "원본(infra private repo)의 내부 식별자(워크로드 파일명, 환경변수/플래그명, 스크립트명, CI 파일명, chart 디렉토리명, PR 번호)는 일반화 후 게재. raw는 비공개 repo에만 존재."
---

# (정제본) 두 곳에 정의된 워크로드 — 한 번에 안 지운 이유

> 이 파일은 infra 팀의 raw 인테이크를 redaction한 **정제본**이다. raw 원본은
> infra private repo의 `docs/blog-intake/`에 있다. 포스트의 `sourceIntake`가
> 이 파일을 가리킨다.

## 무엇을

프로덕션 워크로드 12개가 두 경로(raw Kubernetes 매니페스트 + Helm chart 템플릿)에
동시에 정의돼 있었다. 활성 CD는 Helm 한 경로지만, 레거시 배포 스크립트가
`kubectl set image`로 라이브 Deployment를 직접 mutate하는 두 번째 경로를 갖고
있어 release state와 cluster state를 desync시킬 수 있었다.

세 옵션 — (A) Helm을 권위로 선언하고 raw 매니페스트 12개를 한 PR에서 동시 삭제,
(B) raw를 권위로 격상, (C) Helm을 권위로 선언하되 raw 매니페스트는 "DO NOT DEPLOY"
헤더로 마킹 + 레거시 스크립트의 직접 mutate 경로에 하드 게이트, 실제 삭제는 후속
PR(Phase 2)로 — 중 **C**를 택했다.

## 왜

- **B 탈락:** 지난 분기 chart에 쌓인 incident hardening(이미지 태그 가드, 마이그레이션
  훅, smoke-test, 시크릿 점검 등)이 Helm hook 의미론에 의존 — vanilla 매니페스트로는
  재구현 불가.
- **A vs C:** A는 confusion을 즉시 끝내지만 12파일 삭제 + 스크립트 deprecation을 한 PR에서
  검토시켜 reviewer의 인지 비용이 크다. C는 review surface가 작고 mechanical.
- **C의 결정적 이유 둘:** ① 하드 게이트는 코멘트로 못 한다 — 헤더는 파일을 열어야
  보이지만, 스크립트의 mutate 호출은 안 열어도 실행되므로 실행 가능한 게이트가 필요.
  ② mass deletion의 blast radius가 reviewer 인지 한계를 넘는다 — Phase 분리는 그 비용을
  두 번에 나눠 지불하는 명시적 선택.

## 공개 가능 (게재 OK)

- 의사결정 구조(A/B/C, B 탈락 사유, A vs C 인지 비용 trade-off).
- 코멘트 vs 실행 가능한 게이트의 차이.
- Phase 분리의 인지 비용 논리.
- Helm hook 의존 hardening이 vanilla 매니페스트로 못 옮겨간다는 일반적 사실.
- `kubectl set image`가 Helm release lifecycle 바깥에서 desync를 만든다는 일반적 사실.

## redaction 적용 (원본 → 일반화)

- 워크로드 12개 파일명 → "프로덕션 워크로드 12개"
- 환경변수/플래그 실명 → "환경변수 또는 플래그 중 하나의 명시적 ack(OR 시맨틱)"
- 배포 스크립트명 → "레거시 배포 스크립트" / "Helm 기반 배포 스크립트"
- CI 워크플로우 파일명 → "프로덕션 CD 워크플로우"
- chart 디렉토리명 → "프로덕션 Helm chart"
- PR 번호 → "지난 분기의 hardening PR들"

## 외부 인용 링크 (공개)

- Helm Hooks: https://helm.sh/docs/topics/charts_hooks/
- `helm upgrade --reuse-values`: https://helm.sh/docs/helm/helm_upgrade/
