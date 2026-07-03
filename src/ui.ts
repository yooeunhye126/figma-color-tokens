import type { PluginToUiMessage, UiToPluginMessage } from "./types";

const generateBtn = document.getElementById("generate") as HTMLButtonElement;
const downloadBtn = document.getElementById("download") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const previewEl = document.getElementById("preview") as HTMLPreElement;

// 가장 최근에 생성된 tokens.json 내용을 보관 (다운로드에 사용)
let latestJson: string | null = null;

/** 메인 스레드로 메시지 전송 (타입 안전 래퍼) */
function postToPlugin(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function setStatus(text: string, isError = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

/** 문자열을 tokens.json 파일로 다운로드 */
function downloadJson(json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "tokens.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

generateBtn.addEventListener("click", () => {
  setStatus("Color Style을 읽는 중...");
  postToPlugin({ type: "generate-tokens" });
});

downloadBtn.addEventListener("click", () => {
  if (latestJson) downloadJson(latestJson);
});

// 메인 스레드에서 오는 메시지 수신
window.onmessage = (event: MessageEvent) => {
  const message = event.data.pluginMessage as PluginToUiMessage | undefined;
  if (!message) return;

  if (message.type === "tokens-generated") {
    latestJson = message.json;
    previewEl.textContent = message.json;
    downloadBtn.disabled = false;
    setStatus(`${message.count}개의 Color Style을 변환했습니다.`);
    return;
  }

  if (message.type === "error") {
    latestJson = null;
    downloadBtn.disabled = true;
    previewEl.textContent = "// 오류가 발생했습니다.";
    setStatus(message.message, true);
  }
};
