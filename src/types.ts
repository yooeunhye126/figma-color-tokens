// 메인 스레드(code.ts) <-> UI(ui.ts) 간 postMessage로 주고받는 메시지 타입

/** W3C 디자인 토큰 형식의 단일 토큰 값 ($type / $value) */
export interface DesignToken {
  $type: string;
  $value: unknown;
}

/** "/" 구분 경로 이름과 토큰 값의 쌍 */
export interface TokenEntry {
  /** 원본 이름 (예: "Brand/Primary", "Heading/H1") */
  name: string;
  token: DesignToken;
}

/** UI -> 메인: 액션 요청 */
export type UiToPluginMessage =
  | { type: "generate-tokens" }
  | { type: "close" };

/** 메인 -> UI: 결과 전달 */
export type PluginToUiMessage =
  | { type: "tokens-generated"; count: number; json: string }
  | { type: "error"; message: string };
