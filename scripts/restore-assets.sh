#!/bin/bash
# npm ci 이후에 실행: pdf.js 보조 파일(한글 cmap, 표준 글꼴, wasm)과 앱 아이콘을 복원합니다.
set -euo pipefail
mkdir -p public/pdfjs public/icons
cp -r node_modules/pdfjs-dist/cmaps public/pdfjs/cmaps
cp -r node_modules/pdfjs-dist/standard_fonts public/pdfjs/standard_fonts
cp -r node_modules/pdfjs-dist/wasm public/pdfjs/wasm
for f in icons-b64/*.b64; do base64 -d "$f" > "public/icons/$(basename "$f" .b64)"; done
