---
team: infra
proposer: "top-level infra Claude"
date: 2026-05-31
topic: "recreate 한 번에 벡터DB가 영영 안 떴다 — compose ${VAR} 보간은 env_file이 아니라 파싱 시점 호스트 셸/top-level .env에서 해석된다"
suggestedCategory: "infra"
suggestedTags: ["docker-compose", "vector-database", "object-storage", "silent-failure", "credentials", "root-cause-analysis"]
redactionReviewed: true
---

> 상위 인프라 팀 raw 글감의 redaction 정제본. Class C 식별자 일반화: 오브젝트 스토리지 공급자·
> 엔드포인트·버킷 이름("S3 호환 오브젝트 스토리지"), 실제 env 변수명(placeholder `OBJSTORE_ACCESS_KEY`
> 등), 서비스·컨테이너·파일·repo 이름, 벡터DB 제품명과 내부 coordinator 컴포넌트 명칭("오브젝트
> 스토리지 기반 벡터DB"/"메타·데이터·쿼리 coordinator"로 일반화), PR 번호. **Class B(실제 키 값)
> 없음** — 이 글은 "키가 비어 있었다"는 *현상*만 다루고 값은 어디에도 없다(전부 placeholder). 로컬
> dev 한정 함정이고(프로덕션은 K8s 시크릿으로 주입하므로 이 보간 함정 자체가 없음), remediation
> (top-level `.env` 가드 + compose 경고 주석)은 main에 머지 완료.

## 무엇을 했나

별건(워커 기동 명령) 검증 중 `docker compose up -d --force-recreate <worker>`를 돌렸다. 의도는 워커
컨테이너 하나만 새 설정으로 다시 만드는 것이었는데, compose가 의존성 그래프를 따라 **벡터DB까지
재생성**했고, 그 벡터DB가 그 뒤로 healthcheck를 영영 통과하지 못했다 — `health: starting`에서 몇 분이
지나도 그대로. 워커는 떴지만 app 초기화가 벡터DB 연결 재시도로 막혔고, 스케줄러는 연결 실패로 종료됐다.

처음엔 "벡터DB가 느리게 뜨나" → 다음엔 "재시작 충격으로 내부 상태가 깨졌나(coordinator 미등록)"로
의심이 흘렀다. 단순 restart도, full recreate도 안 풀렸다. 로그를 좁혀 들어가니 진짜 원인이 나왔다.

## 왜 — 로그가 가리킨 곳

이 벡터DB는 여러 내부 컴포넌트(메타·데이터·쿼리 coordinator 등)로 구성된다. 로그에서 **메타
coordinator는 `Healthy`**인데 **데이터·쿼리 coordinator는 "find no available …, check … state"**로
끝없이 재시도하고 있었다. 그 사이 결정적 한 줄:

```
storage ... ["failed to check blob bucket exist"] [bucket=<…>] [error="400 Bad Request"]
```

이 벡터DB는 오브젝트 스토리지(S3 호환)에 메타·데이터를 올리는데, 그 **버킷 접근이 400**으로 실패하고
있었다. 데이터·쿼리 coordinator는 스토리지 초기화가 안 되면 등록을 못 한다 → "starting" 무한 루프.
즉 "벡터DB가 깨진" 게 아니라 **스토리지 자격증명이 비어 있었다.** 그리고 내내 흘려보던 경고 한 줄:

```
WARN: The "OBJSTORE_ACCESS_KEY" variable is not set. Defaulting to a blank string.
```

## 왜 — compose 보간은 env_file이 아니다

compose의 벡터DB 서비스는 스토리지 키를 이렇게 받고 있었다(일반화):

```yaml
services:
  vectordb:
    env_file:
      - ./app/.env.secrets      # ← 컨테이너 안쪽 env. ${...} 보간엔 기여 안 함.
    environment:
      OBJSTORE_ACCESS_KEY: "${OBJSTORE_ACCESS_KEY}"   # ← 파싱 시점 호스트/.env 에서 해석
      OBJSTORE_SECRET_KEY: "${OBJSTORE_SECRET_KEY}"   #   셸에 없으면 빈 문자열
```

`${...}`는 **compose 파싱 시점에 호스트 셸 환경변수(또는 같은 디렉터리 top-level `.env`)에서 해석**된다.
그게 핵심 함정이다 — 이 서비스에 `env_file`도 붙어 있었지만, **`env_file`은 컨테이너 *안쪽* 환경에만
들어가지 파싱 시점의 `${...}` 보간에는 전혀 기여하지 않는다.** 두 메커니즘은 다른 층이다.

그래서 평소 운영자가 creds가 로드된 셸로 스택을 올릴 땐 멀쩡했는데, 자격증명 없는 셸에서
`--force-recreate`가 벡터DB를 다시 만드는 순간 `${OBJSTORE_ACCESS_KEY}`가 **빈 문자열**로 박혔고, 빈
키로는 버킷 인증이 안 되니 400, coordinator가 못 떠서 stuck — 이 모든 게 에러 없이 "starting" 한
단어로만 보였다.

복구는 단순했다: **자격증명을 셸에 로드한 뒤** 벡터DB를 다시 recreate. 데이터 볼륨은 멀쩡했다(스토리지
자격증명 문제였지 손상이 아니었으니까).

## 왜 — 진짜 교훈은 비대칭이다

같은 스택의 다른 서비스(워커/스케줄러)는 **`env_file`로 자격증명을 받기 때문에 셸과 무관하게 항상
정상**이었다. 오직 벡터DB만 `${...}` **호스트 보간**으로 받아 셸에 의존했다. 이 비대칭이 함정의
정체다 — "스택이 평소 잘 뜨니까 creds는 어딘가 잘 들어가고 있다"는 믿음이, recreate 대상이 하필
보간-의존 서비스일 때 조용히 깨진다. 게다가 그 서비스에 `env_file`이 붙어 있다는 사실이 **"creds는
파일에서 오니까 안전하다"는 잘못된 안심**을 준다.

작은 결론: 자격증명을 셸에 로드하고 recreate하면 끝. 큰 결론: **compose에서 `${VAR}` 보간과 서비스
`env_file`은 서로 다른 메커니즘이고, 한 스택에서 두 방식이 섞이면 "recreate 안전성"이 서비스마다
달라진다.** 보간-의존 값은 top-level `.env`(compose가 자동 로드)로 고정해 셸 의존성을 없애는 게 정공법이다.

## 외부에 공유해도 좋은 일반 교훈
- docker-compose `${VAR}` 보간은 **파싱 시점 호스트 셸 / top-level `.env`**에서 해석된다 — 서비스
  `env_file`(컨테이너 내부 env)과는 다른 층이고, env_file은 `${...}` 보간에 기여하지 않는다. "env_file
  붙였으니 됐겠지"가 거짓 안심이 된다.
- creds 없는 셸에서의 `--force-recreate`가 보간 값을 **빈 문자열로** 조용히 주입하는 silent-failure.
  "variable is not set, defaulting to blank" 경고는 쉽게 묻힌다.
- `--force-recreate <svc>`가 의존성 그래프를 따라 **다른 서비스까지 재생성**할 수 있다(의도치 않은
  blast radius). 한 서비스만 건드리려면 `--no-deps`.
- 오브젝트 스토리지 기반 벡터DB의 coordinator는 **스토리지 접근이 안 되면 등록 자체를 못 한다** —
  증상은 "그냥 starting", 원인은 한참 떨어진 스토리지 인증. 메타 coordinator만 Healthy이고 데이터·쿼리
  coordinator가 "not available"이면 스토리지/메타스토어를 의심하라.
- 한 스택에서 자격증명 주입 방식이 서비스마다 다르면(env_file vs 보간) "recreate 안전성"이 비대칭이
  된다 — 보간-의존 값은 top-level `.env`로 고정.

## 코드/설정 스니펫 (일반화)
```
# 증상(빈 키 → 스토리지 400 → coordinator 미등록):
WARN: The "OBJSTORE_ACCESS_KEY" variable is not set. Defaulting to a blank string.
...
storage: failed to check blob bucket exist  error="400 Bad Request"
meta-coordinator:  StateCode=Healthy
query/data-coordinator: find no available ... check ... state   # 무한 재시도 → health: starting
```
```bash
# 정공법(셸 의존성 제거): top-level .env(compose가 자동 로드)
# 1) top-level .env에 보간 변수 채움(gitignored). 어느 셸에서든 자동 로드.
#    .env.example을 템플릿으로 둬서 "어떤 ${VAR}가 필요한지" 가시화.
# 2) 또는 즉석 복구: creds를 셸에 로드한 뒤 recreate
set -a; source path/to/secrets.env; set +a
docker compose up -d --no-deps --force-recreate vectordb   # --no-deps로 blast radius 차단
```

## 참고
- Docker Compose 환경변수 보간(shell + `.env`): https://docs.docker.com/reference/compose-file/interpolation/
- Compose `env_file` vs `environment`: https://docs.docker.com/reference/compose-file/services/#env_file
