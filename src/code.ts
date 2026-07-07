/// <reference types="@figma/plugin-typings" />
import type {
  DesignToken,
  PluginToUiMessage,
  TokenEntry,
  UiToPluginMessage,
} from "./types";

// UI 창 표시 (dist/ui.html이 __html__로 주입됨)
figma.showUI(__html__, { width: 360, height: 480 });

/** 소수점 긴 값 정리 (최대 3자리) */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** 0~1 채널 값을 2자리 HEX로 변환 */
function channelToHex(channel: number): string {
  const value = Math.round(channel * 255);
  return value.toString(16).padStart(2, "0");
}

/** RGB(A) -> #RRGGBB 또는 #RRGGBBAA */
function rgbToHex(r: number, g: number, b: number, a: number): string {
  const hex = `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
  return (a < 1 ? `${hex}${channelToHex(a)}` : hex).toUpperCase();
}

// ────────────────────────────────────────────────────────────
// Color Style
// ────────────────────────────────────────────────────────────

/** 문서의 Color Style(로컬 Paint Style, SOLID)을 TokenEntry로 변환 */
async function readColorStyles(): Promise<TokenEntry[]> {
  const styles = await figma.getLocalPaintStylesAsync();
  const entries: TokenEntry[] = [];

  for (const style of styles) {
    const paint = style.paints[0];
    if (!paint || paint.type !== "SOLID") continue;

    const { r, g, b } = paint.color;
    const a = paint.opacity ?? 1;

    entries.push({
      name: style.name,
      token: { $type: "color", $value: rgbToHex(r, g, b, a) },
    });
  }

  return entries;
}

// ────────────────────────────────────────────────────────────
// Color Variable
// ────────────────────────────────────────────────────────────

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
 * 문서의 Color Variable(로컬 색상 변수)을 TokenEntry로 변환.
 * 컬렉션에 모드가 2개 이상이면(라이트/다크 등) 경로 끝에 모드 이름을 붙인다.
 */
async function readColorVariables(): Promise<TokenEntry[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const modeNameById = new Map<string, string>();
  for (const collection of collections) {
    for (const mode of collection.modes) modeNameById.set(mode.modeId, mode.name);
  }

  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  const entries: TokenEntry[] = [];

  for (const variable of variables) {
    const collection = collectionById.get(variable.variableCollectionId);
    const isMultiMode = (collection?.modes.length ?? 1) > 1;

    for (const modeId of Object.keys(variable.valuesByMode)) {
      const rgba = await resolveColorValue(variable.valuesByMode[modeId]);
      if (!rgba) continue;

      const name = isMultiMode
        ? `${variable.name}/${modeNameById.get(modeId) ?? modeId}`
        : variable.name;

      entries.push({
        name,
        token: { $type: "color", $value: rgbToHex(rgba.r, rgba.g, rgba.b, rgba.a) },
      });
    }
  }

  return entries;
}

// ────────────────────────────────────────────────────────────
// Text Style (Typography)
// ────────────────────────────────────────────────────────────

/** 폰트 스타일 이름("Bold", "Semi Bold" 등)을 숫자 weight로 매핑 (best-effort) */
const FONT_WEIGHT_MAP: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  book: 350,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

function resolveFontWeight(fontStyle: string): number {
  const normalized = fontStyle
    .toLowerCase()
    .replace(/italic|oblique/g, "")
    .replace(/[^a-z]/g, "");
  return FONT_WEIGHT_MAP[normalized] ?? 400;
}

/** lineHeight를 문자열/숫자로 표현 (AUTO / px / %) */
function formatLineHeight(lineHeight: LineHeight): string {
  if (lineHeight.unit === "AUTO") return "AUTO";
  if (lineHeight.unit === "PERCENT") return `${round(lineHeight.value)}%`;
  return `${round(lineHeight.value)}px`;
}

/** letterSpacing을 문자열로 표현 (px / %) */
function formatLetterSpacing(letterSpacing: LetterSpacing): string {
  if (letterSpacing.unit === "PERCENT") return `${round(letterSpacing.value)}%`;
  return `${round(letterSpacing.value)}px`;
}

/**
 * 문서의 Text Style(로컬 텍스트 스타일)을 typography 합성 토큰으로 변환.
 * DTCG typography 형식: fontFamily / fontWeight / fontSize / lineHeight / letterSpacing
 */
async function readTextStyles(): Promise<TokenEntry[]> {
  const styles = await figma.getLocalTextStylesAsync();

  return styles.map((style) => {
    const token: DesignToken = {
      $type: "typography",
      $value: {
        fontFamily: style.fontName.family,
        fontStyle: style.fontName.style,
        fontWeight: resolveFontWeight(style.fontName.style),
        fontSize: `${round(style.fontSize)}px`,
        lineHeight: formatLineHeight(style.lineHeight),
        letterSpacing: formatLetterSpacing(style.letterSpacing),
      },
    };
    return { name: style.name, token };
  });
}

// ────────────────────────────────────────────────────────────
// 집계 & 직렬화
// ────────────────────────────────────────────────────────────

/** Color Style + Color Variable + Text Style을 모두 읽어 합친다. */
async function readAllTokens(): Promise<TokenEntry[]> {
  const [colorStyles, colorVariables, textStyles] = await Promise.all([
    readColorStyles(),
    readColorVariables(),
    readTextStyles(),
  ]);
  return [...colorStyles, ...colorVariables, ...textStyles];
}

/**
 * TokenEntry 배열을 "/" 구분 기준으로 중첩된
 * 디자인 토큰(W3C 형식: $type / $value) 객체로 변환한다.
 *
 * 예) "Brand/Primary" ->
 *   { "Brand": { "Primary": { "$type": "color", "$value": "#..." } } }
 */
function buildTokensJson(entries: TokenEntry[]): string {
  const root: Record<string, unknown> = {};

  for (const entry of entries) {
    const path = entry.name.split("/").map((segment) => segment.trim());
    let cursor = root;

    path.forEach((segment, index) => {
      if (index === path.length - 1) {
        cursor[segment] = entry.token;
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
      const entries = await readAllTokens();

      if (entries.length === 0) {
        postToUi({
          type: "error",
          message:
            "읽을 수 있는 Color / Text Style·Variable이 없습니다. 색상·텍스트가 이 파일에 로컬로 있는지 확인하세요. (팀 라이브러리의 스타일·변수는 읽을 수 없습니다)",
        });
        return;
      }

      const json = buildTokensJson(entries);
      postToUi({ type: "tokens-generated", count: entries.length, json });
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
