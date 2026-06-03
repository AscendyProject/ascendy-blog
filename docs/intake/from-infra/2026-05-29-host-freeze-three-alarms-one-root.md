---
team: infra
proposer: "top-level infra Claude (실시간 진단 + 복구 동행)"
date: 2026-05-29
topic: "알람 3개, 근원은 하나 — 노드 host freeze가 ES down / Prometheus out-of-order / node flapping으로 분기한 인시던트, 그리고 probe 부재 silent hang + 단일 노드풀 drain 함정"
suggestedCategory: "infra"
suggestedTags: ["kubernetes", "elasticsearch", "observability", "incident", "root-cause-analysis", "health-probes"]
redactionReviewed: true
---

> 상위 인프라 팀 raw 글감의 redaction 정제본. Class C 식별자 일반화: 노드 이름·내부 IP("문제
> 노드"), ES 클러스터 이름("ES 클러스터"), PVC/볼륨 이름·볼륨 ID("ES 데이터 볼륨"), 노드 role
> 라벨 값·풀 구성("특정 역할 노드 풀"), 관리형 쿠버네티스 vendor·인스턴스 타입("관리형 쿠버네티스"),
> registry/namespace/image tag, 내부 PR 번호("remediation 변경"). Class B(credential) 없음.
> **Class A 주의 — 이 인시던트 시점(2026-05-29)엔 단일 노드 풀 SPOF가 미해소였다. 그래서 어떤
> 데이터 서비스들이 구체적으로 한 노드에 몰려 있었는지(SPOF 토폴로지)는 일반화했다.** (그 SPOF는
> 이후 노드 추가+분산으로 해소됐고, 그 과정의 배포 함정은 별도 글 `anti-affinity-deploy-order-trap`
> 으로 다룬다 — 상호 링크.)

## 무엇을 했나

모니터링으로 알람 3개가 동시다발로 들어왔다:
1. `ElasticSearchDown`
2. `PrometheusOutOfOrderTimestamps`
3. 특정 노드의 readiness가 15분간 6번 바뀜(flapping)

처음엔 셋이 별개로 보였다 — 검색엔진, 메트릭 수집, 노드 상태. 도메인이 다 다르다. 그런데 진단해보니
**셋 다 한 노드의 host 장애가 만든 세 가지 증상**이었다.

진단 → 복구: 노드 진단(리소스 request는 정상인데 그 위 pod가 비정상 잦은 재시작) → ES 로그(데이터
디스크 health check가 **6분**, 타이머 스레드가 **40초** 정지 = 디스크 IO와 CPU 스케줄링이 동시에
멈추는 host freeze 전형) → Prometheus out-of-order(문제 노드의 kubelet/cadvisor 메트릭이 scrape
지연됐다 몰려와 timestamp 역행 → 거부) → 복구(cordon → drain → [함정] → 노드 재부팅 → uncordon →
정상 복귀).

## 왜 — root가 하나인 이유

host(노드의 하이퍼바이저/하드웨어)가 간헐적으로 freeze하면 그 위 모든 것이 동시에 멈춘다:
- 디스크 IO 멈춤 → ES가 데이터 디렉토리 읽기/쓰기 불가 → 응답 지연 → 모니터링이 "down" 감지
- CPU 스케줄링 멈춤 → ES 타이머 40초 정지, kubelet heartbeat 지연 → 노드 NotReady↔Ready flapping
- kubelet/cadvisor가 멈췄다 살아나며 메트릭 몰아 노출 → timestamp 역행 → Prometheus out-of-order

**교훈 1 — 알람을 도메인별로 따로 쫓지 마라.** 검색엔진 down / 메트릭 깨짐 / 노드 flapping은 표면상
무관하지만, 같은 시각 같은 노드에서 터졌다면 공통 root(그 노드)를 먼저 의심하는 게 빠르다. "노드 →
그 위 워크로드" 순서로 봤고, 그게 셋을 한 번에 설명했다.

## 함정 1 — probe가 없으면 "응답불가"가 "정상"으로 보인다

ES가 디스크 IO hang으로 사실상 응답불가였는데 `kubectl get pod`엔 **`1/1 Running`**으로 떴다.
컨테이너 프로세스는 살아있었기 때문이다. readiness/liveness probe가 없으면 쿠버네티스는 "프로세스가
떠 있음 = 정상"으로 본다. 실제로 요청을 처리하는지는 보지 않는다. 그래서 진단이 `kubectl` 상태가
아니라 **애플리케이션 로그를 직접 읽는** 방식으로만 가능했다.

**remediation(이미 적용):** readiness probe(응답성 체크 → 실패 시 NotReady로 트래픽 차단)와 liveness
probe(보수적 임계 → 진짜 데드락에만 재시작)를 추가했다. liveness는 일부러 관대하게 — **host 장애는
컨테이너 재시작으로 풀리지 않기 때문**(같은 노드에 다시 뜸). probe가 무한 재시작 루프를 만들면 안 된다.

## 함정 2 — 단일 노드풀 + nodeSelector = drain하면 갈 곳이 없다

cordon 후 drain으로 워크로드를 건강한 노드로 옮기려 했다. 그런데 evict된 pod들이 전부 `Pending`에
박혔다. `NODE: <none>` — 스케줄 자체가 안 됐다. 원인: 그 워크로드들이 `nodeSelector`로 특정 역할의
노드만 지정하는데, **그 역할 노드가 방금 cordon한 한 대뿐**이었다. drain으로 비웠지만 갈 곳이 없으니
Pending. 스케줄러가 정확히 말해줬다: `0/N nodes available: didn't match node selector`.

**교훈 2 — 특정 역할 노드가 1대이고 그 역할을 강제하는 nodeSelector 워크로드가 있으면, 그 노드를
drain하는 순간 워크로드는 공중에 뜬다.** drain은 "다른 곳으로 옮긴다"가 아니라 "여기서 쫓아낸다"일
뿐이고, 받아줄 노드가 없으면 Pending이다. 이건 단일 노드 역할 풀의 구조적 함정(SPOF)이고, 가용성
follow-up으로 남겼다 — 이후 노드 추가+분산으로 고쳤고, 그 과정의 배포 함정은 별도 글에서 다룬다.

## 복구

drain으로 못 옮겼으므로 **노드 자체를 살리는** 쪽으로 갔다 — host freeze가 일시적(noisy-neighbor
가능성)일 수 있어 노드를 재부팅했다. 재부팅 후 노드가 Ready로 돌아왔고, uncordon하니 Pending이던
워크로드가 다시 스케줄됐다. ES가 재기동되며 로그에 정상 `started`가 찍히고 디스크 health 경고가
사라졌다 — host 회복 확정. (재부팅은 같은 host일 수 있어, 재발하면 노드를 새 host로 교체하는 게 다음
수순이다. 디스크 IO 6분 hang은 일시적 부하일 수도, 하드웨어 신호일 수도 있어 재발 여부로 가른다.)

## 외부에 공유해도 좋은 일반 교훈
- "여러 도메인의 알람이 동시에 울리면 공통 인프라 root를 먼저 의심하라."
- host freeze가 디스크 IO·CPU 스케줄링·kubelet heartbeat를 한꺼번에 멈춰 ES down / Prometheus
  out-of-order / node flapping으로 분기하는 인과 구조.
- **probe 부재 = silent hang**: 프로세스가 살아있으면 `1/1 Running`이지만 실제 응답불가일 수 있다.
  readiness로 "응답성"을, liveness로 "데드락"을 구분해 잡아야 한다.
- liveness를 host 장애에 무한 재시작하지 않도록 보수적으로 잡는 이유(컨테이너 재시작으로 안 풀리는
  문제가 있다).
- **단일 노드 역할 풀 + nodeSelector의 drain 함정**: 받아줄 노드가 없으면 drain은 Pending만 만든다.
- cordon → drain → (불가 시) 노드 재부팅 → uncordon 복구 절차.

## 코드/설정 스니펫 (일반화)
```yaml
# readiness: 응답성 체크. 실패하면 NotReady로 트래픽 차단 + 알람.
#            "프로세스 살아있음"이 아니라 "실제로 응답하는가"를 본다.
readinessProbe:
  httpGet: { path: /_cluster/health?local=true, port: 9200 }
  timeoutSeconds: 5
  failureThreshold: 3        # 약 30초 무응답이면 NotReady
# liveness: 데드락 수준만 재시작. 보수적으로(여기선 ~180초) 잡아
#           host 장애에 의한 무한 재시작 루프를 피한다.
livenessProbe:
  httpGet: { path: /_cluster/health?local=true, port: 9200 }
  periodSeconds: 30
  failureThreshold: 6        # 약 180초 무응답이어야 재시작
```
```text
# drain 함정 — 스케줄러가 알려주는 신호:
0/N nodes are available: 1 node(s) were unschedulable,
  M node(s) didn't match Pod's node affinity/selector.
# → nodeSelector가 가리키는 역할 노드가 (cordon으로) 0대가 됐다는 뜻.
#   drain 전에 "이 워크로드가 갈 다른 노드가 있는가"를 먼저 확인할 것.
```

## 참고
- Kubernetes liveness/readiness probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- `kubectl drain` 동작: https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/
- ES `_cluster/health` API: https://www.elastic.co/guide/en/elasticsearch/reference/current/cluster-health.html
