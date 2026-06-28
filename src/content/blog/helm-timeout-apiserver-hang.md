---
title: "helm upgrade --timeout 10m을 줬는데 왜 25분 동안 안 죽었나"
description: "CI의 helm 배포가 25분간 무로그로 멈춰 릴리스 락이 걸렸다. --timeout 10m을 줬는데 왜 안 죽었나 — helm의 --timeout은 wait/hook 구간만 바운드하고 그 이전 apiserver 호출 hang은 안 바운드한다. 진짜 백스톱은 helm 플래그가 아니라 CI job 타임아웃과 pending 자동 롤백, 그 한 쌍이었다."
pubDate: 2026-06-28
author: "Ascendy Engineering"
tags: ["kubernetes", "helm", "ci-cd", "github-actions", "self-healing", "timeout", "incident", "war-story"]
category: "infra"
lang: "ko"
translationKey: "helm-timeout-apiserver-hang"
sourceIntake:
  - "docs/intake/from-infra/2026-06-17-helm-timeout-apiserver-hang.md"
draft: false
redactionReviewed: true
---

## TL;DR

- CI(GitHub Actions)의 `helm upgrade` 배포가 **25분간 아무 로그 없이 멈춰** 있다 수동 취소됐다. 그 바람에 Helm 릴리스가 `pending-upgrade`로 **락이 걸렸고**, 이후 모든 배포가 *"another operation in progress"로* 실패했다. 머지·승인된 변경이 **하루 동안 프로덕션에 안 굴러갔다.**
- 첫 의문은 단순했다 — **`helm upgrade --wait --timeout 10m`을 줬는데, 왜 10분에 안 죽고 25분을 갔나?**
- 답: helm의 `--timeout`은 **`--wait`/hook 단계만** 감싼다. 그 *이전*의 apiserver 호출 hang은 감싸지 않는다. 타이머가 켜지지도 않았던 것이다.
- 그래서 진짜 백스톱은 helm 플래그가 아니라 **바깥 레벨** — CI job 타임아웃 — 이었고, 거기에 *pending 릴리스를 자동 롤백하는 preflight*를 **한 쌍**으로 붙여야 자가복구가 됐다. (보너스: 그 복구 스크립트가 정작 장애 상황에서 자멸할 뻔했다.)

> **이 글에 대하여.** 프로덕션 배포 파이프라인의 실제 인시던트와 그 remediation(이미 머지됨) 기록이다. 클러스터·릴리스·시크릿 식별자는 일반화했다. 근본원인이 된 노드 안정성 이슈 자체는 조사 중이라, 여기서는 *"그날 컨트롤플레인이 일시 저하됐다"* 수준으로만 다룬다 — 이 글의 주제는 *배포 파이프라인의 복원력*이지 노드 장애가 아니다.

## 25분간 멈춰 있던 배포

CI(GitHub Actions)가 프로덕션 쿠버네티스 클러스터에 `helm upgrade`로 배포한다. 어느 날, 배포 run 하나가 **25분간 아무 출력 없이 `in_progress`** 로 멈춰 있다가 수동으로 취소됐다. 그 결과는 두 가지였다.

첫째, 머지·승인까지 끝난 변경이 **하루 동안 프로덕션에 반영되지 않았다.** 이미지는 레지스트리에 빌드·푸시됐는데, 정작 돌고 있는 이미지는 그대로였다.

둘째, 더 고약했다. Helm 릴리스가 **`pending-upgrade`** 상태로 남아 락이 걸렸다. 그 뒤로 모든 배포가 이렇게 실패했다.

```text
Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress
```

복구하려면 사람이 직접 `helm rollback`을 쳐야 했다. 그때까지 우리가 가진 가드는 배포를 **직렬화**하는 concurrency 그룹뿐이었다 — 동시에 두 배포가 같은 릴리스를 건드리지 못하게. 그런데 그건 *동시성*만 막는다. **한 run이 락을 쥔 채 hang하는 것**도, **죽은 run이 남긴 pending 릴리스를 치우는 것**도 못 한다.

## --timeout은 내가 생각한 그 구간을 안 감쌌다

그래서 문서를 다시 읽었다. 의문은 하나였다 — *"분명 `--timeout 10m`을 줬는데, 왜 10분에 안 죽었지?"*

답이 거기 있었다.

> helm의 `--timeout`은 **`--wait`/hook 단계**만 바운드한다. 그 *이전* 단계 — 릴리스 락 획득, apiserver API 호출 — 의 hang은 바운드하지 않는다.

그날은 클러스터 컨트롤플레인이 일시 저하된 날이었다. helm은 **`--wait`에 들어가기도 전에**, apiserver와 말하는 단계에서 멈춰 있었다. 그러니 `--timeout 10m`은 영영 터지지 않는다. *타이머가 켜지지도 않은* 것이다.

여기서 첫 교훈이 나온다. **애플리케이션 레벨 타임아웃을 줬다고 해서 "이 작업은 N분 안에 끝나거나 죽는다"가 보장되지 않는다.** 그 타임아웃이 실제로 *어느 구간*을 감싸는지 확인해야 한다. 진짜 백스톱은 그 바깥 — 프로세스를 통째로 죽일 수 있는 레벨 — 에 있어야 한다. 우리 경우엔 CI의 **job-level `timeout-minutes`** 였다. 그건 helm이 어느 단계에서 멈춰 있든 상관없이, 정해진 시간이 지나면 프로세스를 죽인다.

## 진짜 백스톱은 '한 쌍'이어야 했다

그런데 job 타임아웃 하나로는 부족했다. 그게 hang한 helm을 죽이면, 릴리스는 여전히 `pending-*` 상태로 *남는다.* 락이 풀리지 않는 것이다.

`helm upgrade --atomic`을 쓰면 되지 않나 싶지만 — 아니다. **hard hang에선 helm이 자기 rollback 경로에 도달조차 못 한다.** atomic은 helm이 *살아서 실패를 인지할 때* 작동하지, 프로세스가 통째로 멈춰 죽임당할 때는 손쓸 새가 없다.

그래서 두 장치를 **쌍**으로 넣었다.

- **job 타임아웃**이 hang한 helm을 죽인다 → 릴리스가 `pending-*`로 남는다.
- **preflight pending-recovery**가 다음 run 시작에서 그 `pending-*` 릴리스를 마지막 성공 revision으로 자동 롤백한다(롤백할 revision이 없으면 pending 릴리스 시크릿을 삭제). → 락이 풀린다.

하나만 넣으면 *"죽이지만 안 치움"* 또는 *"치울 게 없으니 안 함"* 이 된다. **자가복구는 종종 '죽이는 장치'와 '치우는 장치'의 쌍을 요구한다.** (여기에 helm 자체의 `--atomic`과, 배포한 이미지 태그가 실제 running image인지 단언하는 rollout assertion을 더했다.)

## 적대적 리뷰가 잡은 두 함정

이 변경을 [적대적 코드 리뷰](/blog/loop-engineering-verifier/)에 돌렸더니, 두 가지가 더 나왔다.

**(1) 버전 드리프트.** 리뷰어가 짚었다 — Helm 4에서 `--atomic`이 `--rollback-on-failure`로 바뀌었고, `setup-helm`은 'latest stable'을 깐다. 즉 *어느 날 CI가 helm major 버전을 말없이 점프하면* 배포 명령이 깨질 수 있다.

리뷰어는 이걸 "파싱 단계에서 실패한다"고 강하게 단정했다. 그래서 *실제로 helm을 돌려봤다* — `--atomic`은 Helm 4에서 **deprecated alias로 여전히 동작했다**(경고만 찍고 진행). "파싱 실패"라는 표현은 과했던 것이다. 하지만 *핵심 우려는 옳았다*: **프로덕션 배포 레인에서 CI가 도구의 major 버전을 말없이 점프하게 두면 안 된다.** 그래서 배포 명령을 바꾸는 대신 **helm 버전을 핀했다**(동작은 그대로 보존). 두 번째 교훈은 여기 둘 다 있다 — 도구 버전을 고정해 "어느 날 latest가 바뀌어서" 류 사고를 값싸게 막는 위생, 그리고 *deprecated-but-working alias는 문서나 `--help`만 보지 말고 실제로 돌려서 확인하라*는 검증 습관(리뷰어의 단정이 실측으로 과장으로 드러난 사례).

**(2) 복구 스크립트가 자기가 고칠 상황에서 자멸한다.** preflight는 이렇게 시작했다.

```bash
set -euo pipefail
status="$(helm status <release> -o json 2>/dev/null | jq -r '.info.status // "absent"')"
```

의도는 *"릴리스가 없으면 `absent`로 치고 그냥 `upgrade --install`로 넘어가자"* 였다. 그런데 `helm status`는 릴리스가 없거나 **apiserver가 저하되면** non-zero로 끝난다. `set -euo pipefail`(특히 `pipefail`) 아래선 그 순간 **스텝 전체가 죽어** `upgrade --install`에 도달하지 못한다. 하필 **이 PR이 노리는 바로 그 apiserver 저하 상황**에서, 복구 스크립트가 자멸하는 것이다.

명령 치환을 명시적 `if/else`로 감쌌다.

```bash
if status_json="$(helm status <release> -o json 2>/dev/null)"; then
  status="$(printf '%s' "$status_json" | jq -r '.info.status // "absent"')"
else
  status="absent"   # 못 읽으면 "복구할 것 없음" → upgrade --install로 fall-through
fi
```

세 번째 교훈. **`set -e` 아래에서 "실패해도 되는 명령"을 명령 치환에 그냥 박으면 안 된다.** 실패를 *명시적으로* 허용하는 분기로 감싸야 한다 — 특히 그 명령이 *장애 상황에서 실패하도록 설계된 진단 명령*이라면.

## 가져갈 것

- **앱-레벨 타임아웃(`helm --timeout`)이 어느 구간을 감싸는지 확인하라.** 진짜 백스톱은 프로세스를 죽일 수 있는 바깥 레벨(여기선 CI job 타임아웃)에 둬야 한다.
- **자가복구는 종종 두 장치의 쌍**이다 — 죽이는 것(job 타임아웃)과 치우는 것(pending 롤백 preflight). 하나만으론 반쪽이다.
- **`set -euo pipefail` + 명령 치환 + 실패해도 되는 진단 명령**은 함정이다. `if/else`로 실패를 명시 허용하라.
- **CI에서 배포 도구 버전을 핀하라.** 'latest stable'이 어느 날 major를 점프하는 사고는 한 줄로 예방된다.
- **deprecated-but-working alias는 실측으로 확인하라.** 문서·`--help`의 단정이 실제 동작과 다를 수 있다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
