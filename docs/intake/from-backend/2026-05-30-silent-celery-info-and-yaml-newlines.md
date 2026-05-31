---
team: backend
proposer: "Claude (ascendy-backend)"
date: 2026-05-30
topic: "조용히 사라지는 Celery 워커 INFO 로그 — 두 겹 함정(Python 로깅 + YAML 줄바꿈)"
suggestedCategory: "backend"
suggestedTags: ["celery", "python-logging", "docker-compose", "yaml", "observability", "debugging"]
redactionReviewed: true
---

> 백엔드 private repo raw 글감의 redaction 정제본. 일반화된 패턴/코드만 담고,
> 내부 실명은 이 정제본에도 적지 않는다(노트 자체가 public surface).

## 무엇을 했나

다른 이슈를 디버깅하던 중 워커 로그에 "태스크 시작" INFO 라인이 한 줄도 없음을 발견.
ERROR 라인은 있는데 INFO만 없다는 **비대칭**이 결정적 단서. 라이브 dispatch 프로브
(존재하지 않는 id로 `task.delay(...)` 해서 `logger.error(...)`만 강제)로 "태스크는 도는데
로그만 묵음" 상태를 확정. 두 겹 원인을 각각 별도 PR로 닫음:

1. **Python 로깅**: `basicConfig(level=INFO)`가 웹 앱 import 시점에만 실행되는 구조라,
   워커 프로세스(다른 진입점)는 root logger를 기본 WARNING으로 시작 → app 모듈의
   `logger.info(...)`가 묵음. 게다가 Celery prefork 자식 프로세스는 Celery 내부 셋업이
   레벨을 다시 만져, 부모 한 번으로 부족. fix 3종: (a) 워커 진입 모듈에서 basicConfig
   (b) `setup_logging` 시그널에 빈 핸들러 연결(Celery 자체 셋업 스킵) (c)
   `worker_process_init`에서 자식마다 재적용.
2. **YAML/bash (부수 발견)**: 컨테이너 CMD를 점검하니 `--loglevel`/`--queues`/
   `--concurrency`/`--max-memory-per-child`가 컨테이너 안에서 별도 (실패하는) 쉘 명령으로
   실행되고 있었음. 원인: compose의 `command: |-` literal block scalar가 줄마다 LF를
   보존한 채 `bash -lc`로 넘어가고, bash가 인용 안 된 LF를 **명령어 구분자**로 처리.
   실제로는 `celery worker` 한 줄만 인자 0개로 돌고 나머지는 무시 — 한 버그가
   concurrency·메모리제한·로그레벨 동시 미적용을 유발. fix: `|-` → `>-`(LF→space) 또는
   list 형태.

## 왜 했나

같은 함정에 두 번 헛걸음한 게 글감 가치. 첫째 "워커가 죽어 태스크 안 도는 듯" 오진 →
사실 태스크는 정상, INFO만 안 찍힘. 둘째 `--concurrency` 미적용을 한참 후 발견. 둘 다
"본 적 있는 도구를 다른 진입점에서 쓰면 같지 않다"는 함정. 디버깅 시간 대부분이 코드
작성이 아니라 **비대칭을 알아채는 데** 쓰임.

## 외부 공유 OK
- Celery 5.x prefork + `worker_hijack_root_logger=False`에서 INFO가 자식에 전파 안 되는 동작.
- `setup_logging` + `worker_process_init` 시그널 표준 패턴.
- YAML 1.2 block scalar 인디케이터(`|`/`>`/`|-`/`>-`)의 LF 보존/접기 차이.
- bash가 인용 안 된 LF를 명령 구분자로 처리한다는 POSIX 동작.
- 진단 패턴: "ERROR는 보이고 INFO만 안 보임" 비대칭 + 존재하지 않는 id로 active probe.

## redaction 기록 (일반화 — 실명 미기재)
- 컨테이너/서비스명, 내부 패키지 경로, 비즈니스 도메인 모듈명: 일반화(코드 스니펫은 `your_task` 등 placeholder, `app.celery_app:celery`는 일반 Celery 관례 수준만).
- PR 번호: "후속 PR로 분리해 닫음"으로 일반화.
- `docker compose config`가 env_file을 expand해 secret을 출력한다는 *사실*은 공개 가치 있음 / 어떤 키가 풀리는지 식별자·URL은 제외(본문에 없음).
- 자격증명 값 없음(확인).
