import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// 빌드 식별자. 앱이 version.json과 비교해서 새 버전이면 스스로 새로고침한다.
const BUILD = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "-" + Math.random().toString(36).slice(2, 6);

function versionFile(): Plugin {
  return { name: "version-json", generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD }) }); } };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  base: "./",
  define: { __BUILD__: JSON.stringify(BUILD) },
  // 파일명에 해시를 넣는다. 옛 index.html이 새 JS를 잘못 물거나, 브라우저가 옛 JS를 계속 쓰는 걸 막는다.
  build: { rollupOptions: { output: { entryFileNames: "assets/app-[hash].js", chunkFileNames: "assets/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" } } },
});
