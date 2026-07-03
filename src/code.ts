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

/** 문서의 Color Style(로컬 Paint Style, SOLID)을 ColorToken으로 변환 */
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
 * 변수 값(RGBA 또는 다른 변수를 가리키는 별칭)을 최종 RGBA 색상으로 해석.
 * 별칭이면 참조 대상을 따라가며(순환 방지 depth 제한) 실제 색을 찾는다.
 */
async function resolveColorValue(
  value: VariableValue,
  depth = 0,
): Promise<RGBA | null> {
  if (depth > 10 || value == null) return null;

  // 다른 변수를 가리키는 별칭
  if (typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
    const ref = await figma.variables.getVariableByIdAsync(value.id);
    if (!ref) return null;
    const firstModeId = Object.keys(ref.valuesByMode)[0];
    if (!firstModeId) return null;
    return resolveColorValue(ref.valuesByMode[firstModeId], depth + 1);
  }

  // RGB / RGBA 색상 값
  if (typeof value === "object" && "r" in value) {
    return { r: value.r, g: value.g, b: value.b, a: "a" in value ? value.a : 1 };
  }

  return null;
}

/**
 * 문서의 Color Variable(로컬 색상 변수)을 ColorToken으로 변환.
 * 컬렉션에 모드가 2개 이상이면(라이트/다크 등) 경로 끝에 모드 이름을 붙인다.
 */
async function readColorVariables(): Promise<ColorToken[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const modeNameById = new Map<string, string>();
  for (const collection of collections) {
    for (const mode of collection.modes) modeNameById.set(mode.modeId, mode.name);
  }

  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  const tokens: ColorToken[] = [];

  for (const variable of variables) {
    const collection = collectionById.get(variable.variableCollectionId);
    const isMultiMode = (collection?.modes.length ?? 1) > 1;

    for (const modeId of Object.keys(variable.valuesByMode)) {
      const rgba = await resolveColorValue(variable.valuesByMode[modeId]);
      if (!rgba) continue;

      const name = isMultiMode
        ? `${variable.name}/${modeNameById.get(modeId) ?? modeId}`
        : variable.name;

      tokens.push({
        name,
        hex: rgbToHex(rgba.r, rgba.g, rgba.b, rgba.a).toUpperCase(),
        rgba,
      });
    }
  }

  return tokens;
}

/** Color Style + Color Variable을 모두 읽어 합친다. */
async function readColorTokens(): Promise<ColorToken[]> {
  const [styles, variables] = await Promise.all([
    readColorStyles(),
    readColorVariables(),
  ]);
  return [...styles, ...variables];
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
      const tokens = await readColorTokens();

      if (tokens.length === 0) {
        postToUi({
          type: "error",
          message:
            "읽을 수 있는 Color Style / Color Variable이 없습니다. 색상이 이 파일에 로컬로 있는지 확인하세요. (팀 라이브러리의 스타일·변수는 읽을 수 없습니다)",
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
