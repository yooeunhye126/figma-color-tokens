import { defineConfig } from "vite";
import { resolve } from "node:path";

// Figma의 메인 스레드(code.ts) 빌드 설정
// - DOM/네트워크 없이 Figma Plugin API만 사용하는 샌드박스 환경
// - 단일 IIFE 파일(dist/code.js)로 번들링
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/code.ts"),
      formats: ["iife"],
      name: "plugin",
      fileName: () => "code.js",
    },
    rollupOptions: {
      output: {
        dir: resolve(__dirname, "dist"),
      },
    },
    target: "es2017",
    minify: false,
  },
});
