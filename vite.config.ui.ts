import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

// Figma의 UI(iframe) 빌드 설정
// - HTML/CSS/JS를 하나의 dist/ui.html 파일로 인라인(singlefile)
//   Figma 플러그인 UI는 외부 리소스를 로드할 수 없어 단일 파일이어야 함
export default defineConfig({
  root: resolve(__dirname, "src"),
  plugins: [viteSingleFile()],
  build: {
    emptyOutDir: false,
    outDir: resolve(__dirname, "dist"),
    rollupOptions: {
      input: resolve(__dirname, "src/ui.html"),
    },
  },
});
