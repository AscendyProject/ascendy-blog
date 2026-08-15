<?xml version="1.0" encoding="UTF-8"?>
<!--
  Stylesheet that makes the RSS feed readable when opened in a browser.
  The English counterpart of public/rss.xsl — see that file for the rationale.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title><xsl:value-of select="/rss/channel/title"/> — RSS feed</title>
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
          <p><strong>This page is an RSS feed.</strong> What you are looking at is a human-readable rendering; feed readers read the underlying XML as-is.</p>
          <p>To subscribe, paste this address into your reader — <code><xsl:value-of select="/rss/channel/link"/>en/rss.xml</code></p>
        </div>

        <h2 class="count"><xsl:value-of select="count(/rss/channel/item)"/> recent posts</h2>

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
          <a href="{/rss/channel/link}">Back to the blog</a>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
