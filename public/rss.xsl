<?xml version="1.0" encoding="UTF-8"?>
<!--
  RSS 피드를 브라우저에서 열었을 때 읽을 만하게 보여주는 스타일시트.

  왜 필요한가: 브라우저는 스타일 정보가 없는 XML을 만나면 "이 XML 파일에는
  스타일 정보가 없습니다"라는 안내와 함께 태그 트리를 그대로 보여준다. 피드
  자체는 정상이지만, 링크를 클릭한 사람에게는 고장난 페이지처럼 보인다.

  피드 리더는 이 처리 지시를 무시하고 XML만 읽으므로 구독에는 영향이 없다.
  디자인 토큰은 사이트(global.css)와 같은 값을 쓴다 — 별도 파일이라 CSS 변수를
  공유할 수 없어 값만 맞춘다.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="ko">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title><xsl:value-of select="/rss/channel/title"/> — RSS 피드</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #ffffff;
            --fg: #171717;
            --fg-soft: #404040;
            --surface: #fdf7f3;
            --accent: #b24709;
            --rule: #e8e0d9;
            --muted: #6f6660;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              color-scheme: dark;
              --bg: #121212;
              --fg: #f2f2f2;
              --fg-soft: #c8c8c8;
              --surface: #212121;
              --accent: #f3a169;
              --rule: #2e2e2e;
              --muted: #9a9a9a;
            }
          }
          * { box-sizing: border-box; }
          body {
            margin: 0 auto;
            max-width: 70ch;
            padding: 2.5rem 1.25rem 4rem;
            background: var(--bg);
            color: var(--fg);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
              "Helvetica Neue", "Apple SD Gothic Neo", "Pretendard", sans-serif;
            font-size: 1.0625rem;
            line-height: 1.7;
          }
          a { color: var(--accent); text-decoration: underline; text-underline-offset: 4px; }
          h1 { font-size: 1.75rem; margin: 0 0 .5rem; letter-spacing: -.01em; }
          .tagline { color: var(--muted); margin: 0 0 1.75rem; }
          .note {
            border: 1px solid var(--rule);
            background: var(--surface);
            border-radius: .5rem;
            padding: 1rem 1.15rem;
            font-size: .9375rem;
            margin: 0 0 2.5rem;
          }
          .note p { margin: 0 0 .5rem; }
          .note p:last-child { margin: 0; color: var(--muted); }
          code {
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
            font-size: .875em;
            word-break: break-all;
          }
          h2.count {
            font-size: .8125rem;
            text-transform: uppercase;
            letter-spacing: .06em;
            color: var(--muted);
            font-weight: 600;
            margin: 0 0 1rem;
          }
          ul { list-style: none; margin: 0; padding: 0; }
          li { border-top: 1px solid var(--rule); padding: 1.25rem 0; }
          .item-title { font-size: 1.125rem; font-weight: 600; display: block; margin-bottom: .3rem; }
          .item-date { font-size: .8125rem; color: var(--muted); }
          .item-desc { color: var(--fg-soft); font-size: .9375rem; margin: .5rem 0 0; }
          footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--rule); font-size: .875rem; color: var(--muted); }
        </style>
      </head>
      <body>
        <h1><xsl:value-of select="/rss/channel/title"/></h1>
        <p class="tagline"><xsl:value-of select="/rss/channel/description"/></p>

        <div class="note">
          <p><strong>이 페이지는 RSS 피드입니다.</strong> 지금 보고 있는 건 사람이 읽기 좋게 꾸민 모습이고, 피드 리더는 원래의 XML을 그대로 읽습니다.</p>
          <p>구독하려면 이 주소를 리더에 붙여 넣으세요 — <code><xsl:value-of select="/rss/channel/link"/>rss.xml</code></p>
        </div>

        <h2 class="count">최근 글 <xsl:value-of select="count(/rss/channel/item)"/>편</h2>

        <ul>
          <xsl:for-each select="/rss/channel/item">
            <li>
              <a class="item-title" href="{link}"><xsl:value-of select="title"/></a>
              <span class="item-date"><xsl:value-of select="substring(pubDate, 6, 11)"/></span>
              <p class="item-desc"><xsl:value-of select="description"/></p>
            </li>
          </xsl:for-each>
        </ul>

        <footer>
          <a href="{/rss/channel/link}">블로그로 돌아가기</a>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
