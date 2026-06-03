---
team: infra
proposer: "top-level infra Claude (진단 + 적용 동행, operator 실행)"
date: 2026-06-03
topic: "제약을 먼저 넣고 capacity를 나중에 넣으면 CD가 조용히 멈춘다 — required anti-affinity와 빠진 두 번째 노드"
suggestedCategory: "infra"
suggestedTags: ["kubernetes", "helm", "pod-anti-affinity", "continuous-deployment", "deploy-order", "root-cause-analysis"]
redactionReviewed: true
---

> 상위 인프라 팀 raw 글감의 redaction 정제본. Class C 식별자는 일반화: 노드 이름·내부 IP·역할 라벨
> 값("infra 노드"/"app 노드"/"역할 라벨"), 워크로드 실명("검색엔진"/"그래프DB"/"캐시·브로커"/"벡터DB"),
> 이미지 태그·레지스트리·릴리스명·namespace, 관리형 쿠버네티스 vendor·인스턴스 타입, CD 트리거의
> 구체 구현(시크릿/워크플로 파일), 내부 PR 번호·helm 리비전, 막힌 CD의 레인명("무관한 애플리케이션
> CD 레인"). Class B(credential 값) 없음. **정확 인시던트 수치(연속 실패 횟수·정지 시간)는 operator가
> 공개로 결정** — war-story 임팩트를 위해 유지(credential 아님, 운영 텔레메트리지만 의도적 공개).
> 클러스터별 미해결 상태·예정 remediation 세부는 Class A로 intake에 아예 적지 않음.

## 무엇을 했나

데이터 평면(검색·그래프·캐시/브로커)이 한 노드에 몰려 있던 SPOF를 풀기로 했다. 방식: **노드를
한 대 추가**하고, 두 무거운 stateful(검색엔진·그래프DB)에 `required` podAntiAffinity를 걸어 **서로
다른 노드에 강제 분산**, 캐시·브로커는 app 노드로 분리. 한 노드가 얼어도 stateful은 최대 하나만
영향받게 하는 게 목표였다.

차트 변경(anti-affinity + nodeSelector)은 PR로 미리 머지돼 있었다. 그런데 적용 상태를 보니 —
**helm 릴리스가 `failed`였고, 어제 하루 동안 같은 업그레이드가 5번 연속 실패**해 있었다. 전부 같은
메시지: `Deployment/<graphDB> not ready: Progress deadline exceeded`.

## 왜 — 제약을 만족할 노드가 없었다

그 5번의 실패는 **무관한 애플리케이션 CD가 새 이미지를 배포하려던 것**이었다. 우리 CD는 앱 repo가
빌드 후 인프라로 배포 이벤트를 쏘면 인프라가 `helm upgrade`로 그 이미지 태그만 갈아끼우는 구조다.
그 업그레이드는 차트 전체를 다시 적용하므로 **머지돼 있던 SPOF 수정(required anti-affinity)도 함께
적용**됐다.

문제: anti-affinity는 "검색엔진과 그래프DB를 같은 노드에 두지 마라"인데, 그 시점엔 **해당 역할의
노드가 한 대뿐**이었고 검색엔진이 이미 그 위에 있었다. 그래서 그래프DB는 **갈 노드가 없어 Pending**
→ readiness 영원히 안 됨 → `Progress deadline exceeded` → 업그레이드 실패. 5번 반복되며 릴리스는
`failed`로 굳었다.

**핵심 교훈 — 순서가 전부다. `required` 제약은 그 제약을 만족할 capacity가 *먼저* 있어야 한다.**
분산하라는 제약(anti-affinity)을 분산될 자리(노드)보다 먼저 넣으면, 제약은 "배치 불가"로 바뀌어
배포를 막는다. 게다가 피해자가 SPOF 수정과 무관한 **다른 팀의 CD**였다는 게 사악한 점이다 — 그 팀은
"내 배포가 왜 안 되지?"를 영문도 모른 채 25시간 겪었고, 원인은 전혀 다른 인프라 변경이었다. 빠진
전제는 단 하나, **두 번째 노드**였다.

## 함정 — runbook의 "위험한 부분"이 이미 지나가 있었다

이 작업의 runbook은 캐시·브로커(PV 없는 Celery 브로커)를 다른 노드로 옮기는 걸 가장 위험한 단계로
봤다 — 옮기면 pod가 재생성되며 **큐에 쌓인/처리 중인 브로커 상태가 날아간다.** 그래서 "스케줄러 정지
→ 큐 drain → 옮김 → 복구"를 준비했다.

그런데 실제 상태를 보니 **브로커는 이미 app 노드에서 25시간째 돌고 있었다.** 어제의 실패한
업그레이드들이 그래프DB readiness에서 최종 실패했지만, **브로커 Deployment 패치는 이미 부분 적용**돼
브로커가 진작 옮겨가 있었던 것이다. 즉 runbook의 위험한 cutover는 이미 (의도치 않게) 끝나 있었고,
같은 차트를 다시 적용해도 브로커는 **안 움직인다 = 큐 flush 없음**.

손대기 전 확인 방법: **현재 배포된 manifest와 새로 렌더한 manifest를 diff.** stateful·브로커의 pod
template에 **변경이 0**임을 확인 → "재적용해도 template-trigger 재생성은 없다"를 *예측*한 뒤 실행했다.
(주의: manifest diff는 template 변경으로 인한 rollout 부재까지만 보여준다 — hook·외부 변경·스케줄러
효과·런타임 실패는 보장하지 못한다. *무중단의 확인*은 적용 후 지표다.) 결과는 깔끔한 reconcile:
두 번째 노드를 추가하니 그래프DB가 비로소 배치되고, 한 번의 `helm upgrade`로 릴리스가
`failed → deployed`로 정리됐다. **적용 후** 모든 stateful pod의 나이(AGE)·재시작 횟수가 그대로 =
**재생성 0(예측이 실측으로 확인됨)**.

**교훈 — 위험한 절차를 실행하기 전에 "그 위험이 아직 유효한가"를 현재 상태로 검증하라.** runbook은
"브로커가 옮겨야 하는 상태"를 전제했지만, 부분 적용된 실패 배포가 전제를 이미 무효화했다. manifest
diff가 "위험한 cutover"를 "no-op reconcile일 것"으로 *예측*했고, 적용 후 AGE/RESTARTS 체크가 무중단을
*확인*했다(diff는 예측, 지표는 확인).

## 또 하나 — `--reuse-values`가 stuck 배포를 끌고 올 뻔했다

reconcile 시 helm엔 `--reuse-values`(직전 릴리스 값 재사용)가 있다. 그런데 직전 "값"은 **실패한
애플리케이션 배포가 쓰려던 새 이미지 태그**였다. `--reuse-values`로 돌렸으면 SPOF/릴리스-상태 수정에
**엉뚱한 버전 변경이 부수효과로 딸려 갔을** 것이다. 그래서 일부러 `--reuse-values` 대신 **현재 라이브
태그를 명시(`--set`)**해 reconcile을 순수 "상태 정리"로만 한정했다. 막혀 있던 새 버전은 인프라가 수동
배포할 게 아니라 **그 애플리케이션 CD가 다시 쏘면 되는 일**(이제 SPOF가 풀려 성공한다)이라 그쪽
레인으로 넘겼다.

## 외부에 공유해도 좋은 일반 교훈
- **`required` 제약 ↔ capacity 순서 의존성**: 분산을 강제하는 anti-affinity는 분산될 노드가 먼저
  있어야 한다. 순서가 어긋나면 제약이 배포를 막는다. "capacity 먼저, 제약 나중."
- **공유 차트에서 한 팀의 변경이 다른 팀 CD를 막는 cross-team 함정**: 단일 helm 릴리스를 여러
  파이프라인이 공유하면, 한 변경의 실패가 무관한 배포를 인질로 잡는다.
- **위험한 runbook 단계는 실행 전 "현재 상태로 전제 재검증"**: 부분 적용된 실패 배포가 전제를
  바꿔놨을 수 있다. manifest diff로 "template-trigger 재생성 없음"을 *예측*하고, 적용 후
  AGE/RESTARTS로 *확인*.
- **`--reuse-values`의 함정**: 직전 릴리스가 실패한 배포면 그 실패가 쓰려던 값을 끌고 온다. 상태
  정리는 라이브 값을 명시해 순수하게 한정하라.
- 진단 흐름: `helm history`로 실패 패턴 확인 → 원인이 readiness(배치 불가)임을 파악 → 부족한 전제
  (노드)를 채움 → diff로 안전 검증 → 무중단 reconcile.
- 잔여 한계: 분산(anti-affinity)은 한 노드 장애의 *피해 범위*를 줄이지, host 장애 *자체*를 막진
  못한다. blast-radius 대책과 freeze-frequency 대책은 다르다.

## 코드/설정 스니펫 (일반화)
```yaml
# 두 stateful을 서로 다른 노드에 강제 분산.
# 주의: 이 제약을 만족할 "두 번째 노드"가 먼저 있어야 한다. 없으면 한쪽이 Pending → 배포가 막힌다.
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels: { <stateful-group-label>: "true" }
        topologyKey: kubernetes.io/hostname
```
```text
# 실패의 신호 — readiness가 영원히 안 되는 이유:
Deployment/<graphDB> not ready: Progress deadline exceeded
# helm history에 같은 실패가 반복되면 "재시도"가 아니라 "전제가 빠졌다(배치할 노드)"를 의심하라.
```
```bash
# 위험한 재적용 전에 "template-trigger 재생성 없음"을 예측하는 read-only diff:
diff <(helm get manifest <release> -n <ns>) \
     <(helm template <release> ./chart -n <ns> -f values.yaml --set <tags>)
# stateful pod template 변경이 없으면 = template-trigger 재생성 없음(예측).
# 실제 무중단은 적용 후 AGE/RESTARTS로 확인(diff가 hook/스케줄러/런타임까지 보장하진 않음).
```

## 참고
- podAntiAffinity: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#inter-pod-affinity-and-anti-affinity
- helm upgrade `--reuse-values`: https://helm.sh/docs/helm/helm_upgrade/
