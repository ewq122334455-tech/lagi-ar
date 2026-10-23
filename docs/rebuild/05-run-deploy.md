# 실행 · 배포

## 로컬 실행
```bash
npm ci
npm run dev        # http://localhost:5173
npm run build && npm run preview   # 배포본 확인 http://localhost:4173
```

## 배포
`main` 브랜치에 병합되면 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages로 자동 배포합니다.
주소: https://ewq122334455-tech.github.io/lagi-ar/

## 서버 (AI 피팅·회원)
`server/tryon-worker/README.md` 참고 (`npx wrangler deploy`).

## 이전 사이트
삭제하지 않았습니다. `https://ewq122334455-tech.github.io/lagi-ar/#/classic` 에서 그대로 열립니다.
