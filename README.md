# HM 전자계약 (hm-esign)

허니미디어 모바일 전자계약(전자서명) 웹앱. React + TypeScript + Vite PWA, 백엔드는 Supabase(무료), 호스팅은 GitHub Pages(무료).

- 관리자: 계약서 양식 업로드/다운로드/이름변경/삭제 → 계약 생성(서명 위치 지정) → 링크를 카카오톡으로 전송 → 서명본 확인/다운로드
- 서명자: 링크 열기(로그인 없음) → 계약서 보기 → 동의·이름·손가락 서명 → 제출 → 서명본 PDF 자동 생성
- 서명 방식: 간편 전자서명(공인전자서명 아님). 서명본 마지막 쪽에 전자서명 확인서(계약 ID, 서명 시각 KST, IP, 접속 환경, 해시) 포함.

개발: `npm ci && bash scripts/restore-assets.sh && npm run dev`  · 테스트: `npm test`
배포: main 에 push 하면 GitHub Actions 가 gh-pages 에 빌드해 올립니다.
`supabase/` 에는 적용된 DB 설정과 서명자용 엣지 함수 소스가 참고용으로 들어 있습니다(비밀키 없음).
