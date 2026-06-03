---
team: frontend
proposer: "Claude (ascendy-frontend)"
date: 2026-06-01
topic: "장기 키 없이 GitHub Actions에서 GCP로 — WIF, 디테일에서 6일"
suggestedCategory: "infra"
suggestedTags: ["workload-identity-federation", "github-actions", "gcp", "ci-cd", "oidc", "security"]
redactionReviewed: true
---

> 프론트엔드 private repo raw 글감(`2026-06-01-wif-github-actions-gcp.md`)의 redaction 정제본.
> 글감 `sensitivity` 블록대로 식별자는 전부 placeholder로 치환했다 — GCP project ID/number,
> Service Account email, Workload Identity Pool/Provider 이름, GitHub org/repo 이름과 numeric
> repository_id/owner_id, 내부 task/PR 번호. 일반 패턴(WIF flow, immutable-ID binding, 5분
> OIDC ceiling, GPP ADC opt-in, JAVA_HOME pin)은 Google/GitHub/GPP 공식 가이드의 적용이라
> 본문 자체는 발행 가능(do_not_publish: none — raw credential·비즈니스 로직·방어 내부 로직 없음).
> 내부 리뷰 주체는 "static review"로 일반화(특정 리뷰어 명명 안 함).

## 무엇을 했나

안드로이드 내부 테스트 배포 자동화를 처음엔 뻔한 SA 키 경로로 시작했다 — Service Account JSON
키를 받아 base64로 인코딩해 GitHub repository Secret에 붙이고, 워크플로 안에서 디코드. 작업 도중
GCP Cloud Console이 SA 키 생성 시 띄우는 표준 경고를 만났다:

> Service account keys could pose a security risk if compromised. We recommend you avoid
> downloading service account keys and instead use the Workload Identity Federation.

운영자는 경고의 권고(WIF)를 택했다. 그 뒤로 **6일 동안 잘못된 가정을 하나씩 잡아내는** 과정이
이어졌다 — WIF 스펙 자체가 아니라 그 주변 디테일에서(자격증명 수명, GPP의 ADC 핸드셰이크,
GitHub Actions 스텝 순서, 러너의 사전설치 JDK). 살아남은 패턴과, 그걸 안착시킨 정정들의 기록.

## 동작한 패턴

### 1. 흐름
```
GitHub OIDC token  ──▶  GCP STS subject token  ──▶  SA impersonation
   (5분 수명)              (WIF로 교환)               (ADC 체인)
```
- `permissions: id-token: write`를 top level에(OIDC 발급 필수). 없으면 auth 스텝이
  "OIDC token request not authorized for this workflow"로 실패.
- `google-github-actions/auth@<full-SHA>`를 특정 커밋에 pin(floating tag 금지 —
  자격증명을 다루는 워크플로이므로).
- 입력 3개를 명시 고정: `create_credentials_file: true`, `export_environment_variables: true`,
  `cleanup_credentials: true`. 다음 메이저에서 기본값이 바뀔 수 있어 입력을 잠가 계약 드리프트 차단.

### 2. provider 조건: mutable 이름이 아니라 immutable 숫자 ID
첫 시도는 뻔한 것이었다: `attribute.repository == 'org/repo'`. 자격증명 경로에선 틀렸다.
repo 이름은 **변경 가능**하다 — rename / transfer / 삭제 후 재squat. 잠깐 renamed 이름을 squat한
공격자가 조건을 만족하는 OIDC 토큰을 발급할 수 있다. 올바른 형태는 GitHub이 같이 emit하는
**immutable 숫자 ID**에 bind한다:
```
attribute.repository_id == '<numeric>' &&
attribute.repository_owner_id == '<numeric>' &&
attribute.ref == 'refs/heads/main'
```
`attribute.ref`도 중요하다. 애플리케이션 레이어에 "main-only" 가드가 있어도, 그 가드는 IAM이
OIDC 토큰을 평가한 *다음에* 돈다. 같은 repo의 다른 워크플로가 non-main ref에서 auth를 호출하면
애플리케이션 게이트가 발동하기 전에 OIDC 교환이 IAM에서 성공해버린다. `principalSet://...` IAM
바인딩도 `attribute.repository/<name>`이 아니라 `attribute.repository_id/<numeric>`을 써야 한다.

### 3. 자격증명 수명은 1시간이 아니라 **5분**
가장 많이 정정된 오해. auth 액션은 두 흐름을 emit한다:

| 흐름 | 유효 수명 |
|---|---|
| `create_credentials_file: true` (이 패턴이 쓰는 ADC config) | **5분** — 파생 자격증명이 GitHub OIDC 토큰 만료를 상속 |
| `token_format: access_token` (다른 흐름) | 최대 1시간, 단 평문 access token이 러너 env에 상주 |

평문 토큰이 러너에 안 남는 첫째를 택했다. 운영상 함의: auth 스텝부터 Play 업로드까지 전부 5분
안에 끝나야 한다. → auth 스텝을 `npm ci`·`build:android` 뒤, Gradle 업로드 직전으로 최대한 늦춘다.
STS 교환을 일찍 당기는 "warmup" 스텝은 추가하지 말 것 — 예산을 당겨쓸 뿐 늘리지 않는다.

### 4. GPP의 숨은 요구: `useApplicationDefaultCredentials = true`
Gradle Play Publisher는 `serviceAccountCredentials.set(...)`을 지운다고 ADC를 자동 활성화하지
않는다. README 인증 절대로, 명시적 auth 전략 선택을 요구하며 없으면 "No credentials specified"로
실패한다:
```gradle
play {
    def adcPath = System.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if (adcPath) {
        useApplicationDefaultCredentials.set(true)
        resolutionStrategy.set(ResolutionStrategy.AUTO)
    }
}
```
`GOOGLE_APPLICATION_CREDENTIALS` 게이트는 로컬/CI 분기도 겸한다 — 로컬 `bundleRelease`(ADC 없음)는
GPP 기본 `IGNORE` 전략에 머물러, version-code 해석 태스크가 Play를 조회해 실패하지 않는다.

### 5. setup-java / setup-android 순서와 JAVA_HOME 레이스
- `setup-android`의 `sdkmanager --licenses`는 JDK ≥ 17 필요. ubuntu-22.04 러너 기본 `JAVA_HOME`은
  JDK 11을 가리킨다. 그래서 `setup-java`가 **먼저** 돌아 `sdkmanager`가 JDK 21을 detect하게.
- 이후 어떤 스텝이 `JAVA_HOME`을 mutate할 수 있다. 벨트앤서스펜더: Gradle 호출 스텝에서
  `env: JAVA_HOME: ${{ steps.setup-java.outputs.path }}`로 launching JVM을 pin.
- 진단 스텝 2개를 워크플로에 **영구** 유지: setup-java 뒤 `echo "$JAVA_HOME"; which java; java -version`,
  Gradle 호출 안 `bundleRelease` 전 `./gradlew --version`. 셸 레벨 Java만으론 부족 — Gradle의
  launching JVM이 "invalid source release: 21" 오류의 binding signal.

### 6. `.gitignore` + `.dockerignore`에 `gha-creds-*.json`
auth 액션은 자격증명 config 파일을 `/tmp`가 아니라 `$GITHUB_WORKSPACE/gha-creds-<hash>.json`에
쓴다. `cleanup_credentials: true`가 happy path를 처리. 심층방어로 Cleanup 스텝이 workspace
루트와 한 단계 아래에서 `rm -f gha-creds-*.json`, 그리고 `.gitignore`·`.dockerignore` 둘 다
`gha-creds-*.json`을 등재(로컬 CI 에뮬레이션이 실수로 커밋·Docker 이미지에 굽는 것 방지).

## static review가 잡은 것 (실행 전)
마이그레이션 변경은 APPROVE 전까지 **다섯 라운드의 static review**를 거쳤고, 매 라운드가 diff만으론
안 보이는 실제 구멍을 찾았다:

| 라운드 | finding | 왜 중요했나 |
|---|---|---|
| 1 | GPP `useApplicationDefaultCredentials.set(true)` 누락 | `serviceAccountCredentials.set`만 지우면 GPP가 "자격증명 미선택" 상태 → config가 아니라 publish에서 실패 |
| 1 | mutable 이름 attribute 조건 | repo rename/squat 공격 벡터 |
| 1 | auth 스텝이 긴 빌드 앞에 위치 | 연합 자격증명이 5분+ 불필요하게 workspace에 상주 |
| 2 | "1시간 ceiling" 과대주장 | 다른 흐름의 숫자; config 흐름은 5분 OIDC 만료 상속 |
| 2 | "warmup으로 예산 연장" 제안 | STS 교환을 당기면 예산이 *줄어든다* |
| 3 | "auth 입력에 `access_token_lifetime: 3600s` 추가" | 우리가 안 쓰는 다른 흐름용 입력 |
| 4 | "verified redesign options" 표현 | Gradle-split·`token_format` 전환 둘 다 후속 재현이 필요한 후보지 검증된 옵션 아님 |

공통점: diff는 내부적으로 일관됐고 변경은 right-shaped였으며, upstream 문서와 대조한 정독이
틈을 잡았다. static review의 일은 정확히 그것 — 변경을 그것이 구현한다고 주장하는 스펙과 대조.

## live 실행만 드러낸 것 (5라운드 통과 후)
5라운드 모두 통과한 뒤에도 첫 live dispatch가 3번 실패했고, 각 실패가 static review가 볼 수 없던 걸 드러냈다:
1. **Google Play Android Developer API 미활성화** — WIF 성공, GPP 자격증명 획득, Play API 호출,
   Play가 `SERVICE_DISABLED` 반환. Console에서 원클릭 수정.
2. **워크플로의 `java-version: 17`** — Capacitor 8 android 모듈이 source/target에
   `JavaVersion.VERSION_21`을 선언, JDK 17은 source 21을 못 받는다. 로컬 빌드가 이걸 숨겼던 건
   Android Studio 번들 JBR이 JDK 21이라서.
3. **스텝 순서** — `setup-android`를 `setup-java` 앞에 둔 too-clever 스왑이 `sdkmanager`가 러너
   사전설치 JDK 11을 찾아 거부하게 만들었다. 되돌림.

(5)의 진단 스텝 덕에 #2·#3은 다음 dispatch 로그에서 30초 안에 보였다.

## 계속 가져갈 패턴
- 자격증명 워크플로의 모든 액션은 full commit SHA로 pin(human-readable tag는 뒤 주석에). floating
  메이저 tag는 비자격증명 경로엔 괜찮지만 여기선 안 됨.
- top에 `permissions:` 블록, `contents: read` + `id-token: write`만. 나머지 default-deny.
- WIF provider 조건의 신뢰 경계는 immutable 숫자 ID. mutable 문자열 식별자는 trapdoor.
- 자격증명 유효 수명은 auth 액션의 광고 능력이 아니라 선택한 흐름에 달렸다 — 쓰는 흐름의
  README "Token lifetimes" 절을 읽을 것.
- 작은 idempotent `setup-wif.sh` 한 장이면 Pool/Provider/SA 재rotate가 30초 작업이 된다. 운영 runbook 자산.
- `JAVA_HOME`·`./gradlew --version`을 찍는 진단 스텝은 임시가 아니라 영구로. 툴체인 드리프트는 터지기 전까진 조용하다.

## 참고
- `google-github-actions/auth` — README + issue #474 (5분 OIDC).
- Google IAM — Workload Identity Federation with deployment pipelines (immutable-ID 가이드).
- Triple-T/gradle-play-publisher — README "Authenticating Gradle Play Publisher".
- GPP issue #916 — bare `ResolutionStrategy.AUTO`의 `MissingPropertyException`.
