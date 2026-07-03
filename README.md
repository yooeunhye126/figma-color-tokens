# Color Tokens Exporter

문서의 **Color Style**을 읽어 **tokens.json**으로 내보내는 Figma 플러그인입니다.
TypeScript + Vite + Figma Plugin API로 구성되어 있습니다.

## 기능

- 문서의 Color Style(로컬 Paint Style) 읽기
- W3C 디자인 토큰 형식(`$type` / `$value`)의 `tokens.json` 생성
- 스타일 이름의 `/`를 기준으로 중첩 구조 자동 생성 (예: `Brand/Primary`)
- `tokens.json` 다운로드 버튼 제공

## 폴더 구조

```
figma-color-tokens/
├── manifest.json          # Figma 플러그인 매니페스트 (dist 산출물 참조)
├── package.json
├── tsconfig.json
├── vite.config.code.ts    # 메인 스레드(code.ts) 빌드 설정 (IIFE)
├── vite.config.ui.ts      # UI(iframe) 빌드 설정 (singlefile)
├── src/
│   ├── code.ts            # 메인 스레드: Figma API로 Color Style 읽기 + 토큰 변환
│   ├── ui.html            # UI 마크업/스타일
│   ├── ui.ts              # UI 로직: 버튼 이벤트, 다운로드
│   └── types.ts           # 메인 <-> UI 공유 메시지 타입
└── dist/                  # 빌드 산출물 (code.js, ui.html)
```

## 설치 & 빌드

```bash
npm install
npm run build        # dist/code.js, dist/ui.html 생성
```

개발 중 자동 재빌드:

```bash
npm run dev          # code / ui 동시 watch
```

타입 검사:

```bash
npm run typecheck
```

## Figma에 불러오기

1. `npm run build`로 `dist/`를 생성합니다.
2. Figma 데스크톱 앱 → **Plugins → Development → Import plugin from manifest…**
3. 이 프로젝트의 `manifest.json`을 선택합니다.
4. **Plugins → Development → Color Tokens Exporter** 실행 → **토큰 생성** → **다운로드**.

## tokens.json 예시

```json
{
  "Brand": {
    "Primary": { "$type": "color", "$value": "#3366FF" },
    "Secondary": { "$type": "color", "$value": "#00C2A8" }
  }
}
```

> 참고: 반투명 색상은 `#RRGGBBAA` 8자리 HEX로 출력됩니다.
