#!/usr/bin/env python3
"""
把 index.html 與 assets/ 打包成單一 HTML 檔（standalone.html）。

用途：單一檔案可以直接用 email 傳給同事、放進雲端硬碟，或用瀏覽器
      直接開啟，不需要架站也不需要保留 assets 資料夾。

用法：  python3 build-standalone.py
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'index.html'
OUT = ROOT / 'standalone.html'


def read(rel: str) -> str:
    p = ROOT / rel
    if not p.exists():
        sys.exit(f'找不到檔案：{p}')
    return p.read_text(encoding='utf-8')


def main() -> None:
    html = read('index.html')

    def inline_css(m: re.Match) -> str:
        href = m.group(1)
        return f'<style>\n/* ==== {href} ==== */\n{read(href)}\n</style>'

    def inline_js(m: re.Match) -> str:
        src = m.group(1)
        # </script> 出現在字串裡會提早關閉標籤，必須拆開
        code = read(src).replace('</script>', '<\\/script>')
        return f'<script>\n/* ==== {src} ==== */\n{code}\n</script>'

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

    leftovers = re.findall(r'(?:href|src)="(assets/[^"]+)"', html)
    if leftovers:
        sys.exit(f'仍有未內嵌的外部檔案：{leftovers}')

    OUT.write_text(html, encoding='utf-8')
    print(f'已產生 {OUT}（{len(html.encode("utf-8")) / 1024:.0f} KB）')


if __name__ == '__main__':
    main()
