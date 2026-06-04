---
team: infra
proposer: "top-level infra Claude (재설계 + 리뷰 동행)"
date: 2026-06-03
topic: "공개로 서빙되지만 비밀인 값 — 소유증명 키를 '공개값'으로 오분류해 git에 커밋했다가, 리뷰가 준비밀임을 잡고 엣지 secret 서빙으로 재설계한 이야기"
suggestedCategory: "infra"
suggestedTags: ["cloudflare-workers", "secrets-hygiene", "secret-classification", "code-review", "indexnow"]
redactionReviewed: true
---

> 상위 인프라 팀 raw 글감의 redaction 정제본. Class C 일반화: 블로그 도메인·Worker 이름·registry
> 경로("블로그 도메인"/"그 Worker"), 정확한 키 경로·route 패턴("`/<key>.txt` route"), 내부 PR
> 번호("최초 구현 / 재설계 PR"). **Class B(실제 키 값) 없음** — 본문에 키 값 일절 없음(rotate된
> inert 키조차 미기재), 블로그팀도 복원 금지. Class A 아님: 재설계가 main에 머지됐고 옛 키는
> rotate(미게시=inert)라 현재 열린 노출 없음 = remediated, publish 가능.

## 무엇을 했나

검색엔진 크롤을 앞당기려고 색인 자동 통보(IndexNow) Worker를 만들었다. 이 프로토콜은 도메인 소유를
증명하려고 `https://<host>/<key>.txt`에 키 파일을 두고, ping마다 그 키를 함께 보낸다. 우리는 이 키를
**"소유 증명용 공개값"으로 분류**하고 — 그래서 거리낌 없이 — 설정 파일에 평문으로 커밋하고, 정적
사이트가 `/<key>.txt`로 게시하게 설계했다.

리뷰에서 막혔다. 리뷰어가 공식 문서를 들고 왔다: **"Only you and the search engines should know the
key and your file key location."** 즉 이 키는 *공개값*이 아니라 **준비밀(semi-secret)**이다. 키를 아는
사람은 우리 도메인 전체에 대해 "이 URL이 바뀌었다"는 색인 통보를 **위조 제출**할 수 있다(읽기/삭제는
불가, severity는 낮지만 0은 아니다). "공개여도 된다"는 전제 자체가 틀렸던 것이다.

## 왜 틀렸나 — 분류가 먼저, 커밋은 나중

키를 git에 커밋한 시점의 판단은 "어차피 URL로 누구나 가져갈 수 있으니 공개값"이었다. 함정은 거기
있었다: **"엔드포인트에서 가져갈 수 있다 ≠ 아무 데나 적어도 된다."** 검색엔진이 fetch하는 것과, 키가
git 히스토리·PR·핸드오프에 평문으로 박히는 것은 다른 노출이다. 문서가 "키 위치도 너와 검색엔진만
알아야 한다"고 한 이유다 — obscurity가 (약하게나마) 방어선의 일부다.

**교훈 1 — 값을 커밋하기 전에 "이건 secret인가?"를 명시적으로 분류하라.** "공개여도 될 것 같다"는
직감이 아니라, 그 값을 아는 사람이 *무엇을 할 수 있는지*로 판단한다. 위조 제출이 가능하면, low-severity
라도 그건 준비밀이고 git 밖에 있어야 한다.

## 패턴 — 키를 어디에도 커밋하지 않고 서빙하기

준비밀로 다시 분류하니 제약이 생겼다: 키 파일은 `/<key>.txt`에 *공개로 서빙*돼야 하는데(검색엔진이
인증 없이 fetch), 키 값과 키가 든 경로는 *git에 없어야* 한다. 정적 파일 방식은 이 둘을 동시에 만족
못 한다(파일이 repo에 들어감).

해법 — **Worker가 키 파일을 직접 서빙**:
- 키 = **엣지 Worker secret**. 운영자가 직접 생성(`openssl rand`)해 시크릿으로만 주입하고, 값을
  아무에게도(에이전트 포함) 공유하지 않는다 → repo·로그·핸드오프 어디에도 안 들어감.
- Worker의 `fetch` 핸들러가 요청 경로가 `/<key>.txt`와 정확히 일치할 때 시크릿 값을 `text/plain`으로
  반환한다. **인증 없음**(검색엔진이 가져가야 하므로 = 의도된 공개). 나머지 경로는 운영자 전용 게이트.
- ping의 `keyLocation`은 런타임에 `host + "/" + secret + ".txt"`로 조립 → 키가 든 URL조차 저장되지 않는다.
- route(`/<key>.txt → Worker`)는 **경로에 키가 들어가므로 설정 파일에 커밋하지 않고** 운영자가
  대시보드/CLI로 out-of-band 설정한다.

결과: 정적 사이트는 키 파일을 보유하지 않고, 키 값·키-경로 어느 것도 git에 없으며, 검색엔진은 평소대로
`/<key>.txt`를 가져간다. 그리고 **이미 노출됐던 옛 키는 rotate** — 한 번도 라이브로 게시된 적이 없어
영영 유효해지지 않으니 폐기로 충분했다.

**교훈 2 — "공개로 서빙돼야 하지만 git엔 없어야 하는 값"은, 정적 파일 대신 엣지에서 secret으로
서빙하면 둘 다 만족한다.** 파일명/경로가 곧 비밀이면, 그 경로를 담는 설정(route)도 커밋에서 빼고
운영자 주입으로 돌린다.

**교훈 3 — 리뷰가 분류 실수를 잡는 게 정상 동작이다.** 값을 커밋하기 전 "이거 secret 아냐?" 한 줄을
누가 물어줬다면 더 빨랐겠지만, 적어도 머지 전에 잡혀 rotate + 재설계로 끝났다.

## 외부에 공유해도 좋은 일반 교훈
- **"엔드포인트에서 가져갈 수 있다 ≠ git에 평문으로 박아도 된다"** — 소유증명 토큰류 준비밀의 분류 원칙.
- 소유증명 키를 **정적 파일 대신 Worker가 secret에서 `/<key>.txt`로 서빙**하는 패턴: 키 = 엣지 secret,
  route는 키-경로라 미커밋(out-of-band), keyLocation은 런타임 조립 → 키·키-경로 모두 git 밖, 서빙은 공개 유지.
- 노출된(미게시) 키는 **rotate가 충분조건** — 라이브로 게시된 적 없으면 유효해진 적도 없다.
- **리뷰가 분류 실수를 머지 전에 잡는다**는 프로세스 가치.

## 코드/설정 스니펫 (일반화)
```js
// Worker가 키 파일을 직접 서빙: 경로가 정확히 /<key>.txt면 secret을 반환.
// 인증 없음 — 검색엔진이 소유 검증용으로 fetch해야 하므로 (이게 의도된 공개).
if (env.OWNERSHIP_KEY) {
  const keyPath = `/${env.OWNERSHIP_KEY}.txt`;
  if (path === keyPath) {
    return new Response(env.OWNERSHIP_KEY, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
// 그 외 경로는 인증 게이트(운영자 전용 등).
```
```bash
# 키는 운영자가 직접 생성해 secret으로만 주입 — 값을 공유/커밋하지 않는다.
openssl rand -hex 16 | tr -d '\n' | wrangler secret put OWNERSHIP_KEY
# route(<host>/<key>.txt)는 키가 경로에 있으므로 설정 파일에 커밋하지 않고
# 대시보드/CLI로 out-of-band 설정한다.
# 검증도 키를 출력하지 말 것(준비밀):
test "$(curl -fsS "https://<host>/$KEY.txt")" = "$KEY" && echo ok
```

## 참고
- IndexNow documentation: https://www.indexnow.org/documentation
- Cloudflare Workers routes: https://developers.cloudflare.com/workers/configuration/routing/routes/
