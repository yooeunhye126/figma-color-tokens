// 메인 스레드(code.ts) <-> UI(ui.ts) 간 postMessage로 주고받는 메시지 타입

/** 개별 Color Token */
export interface ColorToken {
  /** 원본 Figma 스타일 이름 (예: "Brand/Primary") */
  name: string;
  /** HEX 값 (예: "#3366FF") */
  hex: string;
  /** RGBA 값 */
  rgba: { r: number; g: number; b: number; a: number };
}

/** UI -> 메인: 액션 요청 */
export type UiToPluginMessage =
  | { type: "generate-tokens" }
  | { type: "close" };

/** 메인 -> UI: 결과 전달 */
export type PluginToUiMessage =
  | { type: "tokens-generated"; count: number; json: string }
  | { type: "error"; message: string };
