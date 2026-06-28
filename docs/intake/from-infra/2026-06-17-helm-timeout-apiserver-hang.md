---
team: infra
date: 2026-06-17
topic: "CI(GitHub Actions)의 helm upgrade 배포가 25분간 무로그로 멈춰 수동 취소됐고, 그 바람에 Helm 릴리스가 pending-upgrade로 락이 걸려 이후 모든 배포가 'another operation in progress'로 실패. 머지된 변경이 하루 동안 프로덕션에 안 굴러감. 반전: 'helm upgrade --timeout 10m을 줬는데 왜 10분에 안 죽었나' — --timeout은 --wait/hook 구간만 바운드하고 그 이전 apiserver 호출 hang은 안 바운드. 진짜 백스톱은 helm 플래그가 아니라 CI job-level timeout + pending 자동 롤백 preflight(한 쌍). 그리고 복구 스크립트가 set -euo pipefail 때문에 정작 그 apiserver 저하 상황에서 자멸할 뻔."
suggestedCategory: "infra"
suggestedTags: ["kubernetes", "helm", "ci-cd", "github-actions", "self-healing", "timeout", "incident", "war-story"]
source: "infra 팀 인테이크(상위 워크스페이스 raw). 일반 k8s/helm/CI 교훈 — vendor·클러스터·시크릿 식별자는 redaction."
redactionReviewed: true
---

> **redaction(infra 캐논):** 클라우드 K8s 제품명·리전·네임스페이스·**helm 릴리스 이름**→일반화
> ("프로덕션 클러스터"/"the release"). CI concurrency 그룹명·**시크릿 이름**·레지스트리 경로/
> 호스트·노드 식별자·내부 PR/run ID·핸드오프 경로 제거. 타임아웃 값(10m 등)은 운영 패턴이라
> 공유 가능, 노드 수·클러스터 규모·비용 수치는 제외. **Class A 경계:** 이 인시던트의 근본원인
> (노드 flap + apiserver 부하)은 *별도의 미해결 노드 안정성 이슈*와 같은 root이고 그 노드 이슈는
> 조사 중 → 글에선 **"그날 컨트롤플레인이 일시 저하됐다" 수준으로만**, 미해결 노드 이슈 상세·범위
> 금지. 배포 자가복구 자체는 main 머지된 remediation이라 공유 가능. 시크릿 없음.

## 사건 (공개 가능 범위)

- CI(GitHub Actions)가 프로덕션 K8s 클러스터에 `helm upgrade`로 배포. 배포 run 하나가 **25분간
  무로그로 in_progress**로 멈췄다 수동 취소됨. 결과: ① 머지·승인된 변경이 **하루 동안 프로덕션
  미반영**(이미지는 레지스트리에 빌드·푸시됐는데 running image 안 바뀜) ② Helm 릴리스가
  **`pending-upgrade`**로 락 → 이후 모든 배포가 `Error: UPGRADE FAILED: another operation
  (install/upgrade/rollback) is in progress`로 실패 → 사람이 직접 `helm rollback` 쳐야 복구.
- 기존 가드는 **concurrency 그룹**(동시 두 배포가 같은 릴리스 못 건드리게)뿐. 동시성은 막지만
  *한 run이 락을 쥔 채 hang*하는 것도, *죽은 run이 남긴 pending 릴리스 치우기*도 못 함.

## 진짜 반전 (글의 심장 3박자)

1. **의문:** `helm upgrade --wait --timeout 10m`을 줬는데 왜 10분에 안 죽고 25분을 갔나?
2. **깨달음(문서 재독):** helm `--timeout`은 **`--wait`/hook 단계만** 바운드한다. 그 *이전*
   단계 — 릴리스 락 획득, apiserver API 호출 — 의 hang은 바운드하지 않는다. 그날 컨트롤플레인이
   일시 저하돼, helm은 *`--wait`에 들어가기도 전에* apiserver와 말하는 단계에서 멈춰 있었다.
   타이머가 켜지지도 않은 것. → **교훈①: 앱-레벨 타임아웃을 줬다고 '이 작업은 N분 안에 끝나거나
   죽는다'가 보장되지 않는다. 그 타임아웃이 *어느 구간*을 감싸는지 확인하고, 진짜 백스톱은
   프로세스를 통째로 죽일 수 있는 바깥 레벨에 둬라(여기선 CI job-level `timeout-minutes`).**
3. **반전(fix 의존성):** `--atomic` 하나로 될 것 같지만, hard hang에선 helm이 자기 rollback
   경로에 *도달조차 못 한다.* 그래서 **job-timeout(hang 죽임) + preflight-recovery(pending
   자동 롤백)는 한 쌍**이다. 하나만 넣으면 "죽이지만 안 치움" 또는 "치울 게 없으니 안 함".

넣은 자가복구: ① CI **job-level `timeout-minutes`**(hard hang kill→공유 락 해제) ② **preflight
pending-recovery**(`pending-*` 릴리스를 마지막 성공 revision으로 자동 롤백, 없으면 pending 시크릿
삭제) ③ `helm upgrade --atomic`(helm 자체 실패 경로 auto-rollback) ④ **rollout assertion**(dispatch
한 이미지 태그가 실제 running image인지 단언).

## 적대적 리뷰가 잡은 두 함정

1. **버전 드리프트:** Helm 4에서 `--atomic`이 `--rollback-on-failure`로 바뀌었고 `setup-helm`은
   'latest stable'을 깐다 → 어느 날 helm major 점프 시 사고 위험. (리뷰어는 "파싱 단계 실패"라
   blocker 지적했으나 *실측*하니 `--atomic`은 Helm 4에서 **deprecated alias로 여전히 동작**, 경고만.
   "파싱 실패"는 과했음 — 그러나 핵심 우려는 옳음.) → 배포 명령 대신 **helm 버전을 핀**
   (behavior-preserving). **교훈②: 문서/`--help`만 보지 말고 deprecated-but-working alias는 실제로
   돌려 확인하라.**
2. **복구 스크립트가 자기가 고칠 상황에서 자멸:** preflight가 `set -euo pipefail` 아래
   `status="$(helm status <release> -o json ...)"`로 시작했는데, `helm status`는 릴리스 부재·
   **apiserver 저하 시 non-zero**로 끝남 → `pipefail`에 스텝 전체가 죽어 `upgrade --install`에
   도달 못함. *하필 이 PR이 노리는 apiserver 저하 상황*에서 복구가 자멸. → explicit `if/else`로
   실패를 명시 허용. **교훈③: `set -e` 아래 '실패해도 되는 진단 명령'을 명령 치환에 그냥 박지
   마라. 실패를 명시 허용하는 분기로 감싸라.**

## 일반화 교훈 (가져갈 것)

- 앱 타임아웃(`helm --timeout`)이 *어느 구간*을 감싸는지 확인; 진짜 백스톱은 프로세스를 죽이는
  바깥 레벨에.
- self-heal은 종종 **두 장치의 쌍**(죽이는 것 + 치우는 것)이 필요.
- `set -euo pipefail` + 명령 치환 + "실패해도 되는 진단 명령" 조합의 함정 → `if/else`.
- CI에서 배포 도구 버전 핀으로 "latest stable 어느 날 major 점프" 예방.
- deprecated-but-working alias는 문서가 아니라 *실측*으로 확인.

## 연결

- 적대적 리뷰가 두 함정을 잡은 결 → redteam 글들([loop-engineering-verifier], [review-tool-caught-the-author])과 같은 결.

## 외부 공유 불가 (요약)

- 미해결 노드 안정성 이슈 상세(Class A — "컨트롤플레인 일시 저하"로만). 클러스터/릴리스/시크릿/
  레지스트리/concurrency 그룹 식별자(일반화). 노드 수·규모·비용. 시크릿 값 없음.

## 참고 링크 (공개)

- Helm 3 `helm upgrade`(`--atomic`): https://helm.sh/docs/v3/helm/helm_upgrade/
- Helm 4 `helm upgrade`(`--rollback-on-failure`): https://helm.sh/docs/helm/helm_upgrade/
- Azure/setup-helm: https://github.com/Azure/setup-helm
