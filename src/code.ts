/// <reference types="@figma/plugin-typings" />
import type {
  ColorToken,
  PluginToUiMessage,
  UiToPluginMessage,
} from "./types";

// UI 창 표시 (dist/ui.html이 __html__로 주입됨)
figma.showUI(__html__, { width: 360, height: 480 });

/** 0~1 채널 값을 2자리 HEX로 변환 */
function channelToHex(channel: number): string {
  const value = Math.round(channel * 255);
  return value.toString(16).padStart(2, "0");
}

/** RGB(A) -> #RRGGBB 또는 #RRGGBBAA */
function rgbToHex(r: number, g: number, b: number, a: number): string {
  const hex = `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
  return a < 1 ? `${hex}${channelToHex(a)}` : hex;
}

/**
 * 문서의 Color Style(로컬 Paint Style) 중
 * SOLID 채색을 가진 것만 읽어 ColorToken 배열로 변환한다.
 */
async function readColorStyles(): Promise<ColorToken[]> {
  const styles = await figma.getLocalPaintStylesAsync();
  const tokens: ColorToken[] = [];

  for (const style of styles) {
    const paint = style.paints[0];
    if (!paint || paint.type !== "SOLID") continue;

    const { r, g, b } = paint.color;
    const a = paint.opacity ?? 1;

    tokens.push({
      name: style.name,
      hex: rgbToHex(r, g, b, a).toUpperCase(),
      rgba: { r, g, b, a },
    });
  }

  return tokens;
}

/**
 * ColorToken 배열을 "/" 구분 기준으로 중첩된
 * 디자인 토큰(W3C 형식: $type / $value) 객체로 변환한다.
 *
 * 예) "Brand/Primary" ->
 *   { "Brand": { "Primary": { "$type": "color", "$value": "#..." } } }
 */
function buildTokensJson(tokens: ColorToken[]): string {
  const root: Record<string, unknown> = {};

  for (const token of tokens) {
    const path = token.name.split("/").map((segment) => segment.trim());
    let cursor = root;

    path.forEach((segment, index) => {
      if (index === path.length - 1) {
        cursor[segment] = { $type: "color", $value: token.hex };
      } else {
        if (typeof cursor[segment] !== "object" || cursor[segment] === null) {
          cursor[segment] = {};
        }
        cursor = cursor[segment] as Record<string, unknown>;
      }
    });
  }

  return JSON.stringify(root, null, 2);
}

/** UI로 메시지 전송 (타입 안전 래퍼) */
function postToUi(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

// UI에서 오는 메시지 처리
figma.ui.onmessage = async (message: UiToPluginMessage) => {
  if (message.type === "generate-tokens") {
    try {
      const tokens = await readColorStyles();

      if (tokens.length === 0) {
        postToUi({
          type: "error",
          message:
            "읽을 수 있는 Color Style이 없습니다. 문서에 Solid 색상 스타일을 추가해 주세요.",
        });
        return;
      }

      const json = buildTokensJson(tokens);
      postToUi({ type: "tokens-generated", count: tokens.length, json });
    } catch (error) {
      postToUi({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (message.type === "close") {
    figma.closePlugin();
  }
};
