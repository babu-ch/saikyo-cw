import { defineConfig, type UserConfig } from "vite";
import { resolve } from "path";

// Chrome拡張のcontent scriptはESM importが使えないため、
// content/backgroundとoptionsを別々のビルドとして実行する
export default defineConfig(({ mode }) => {
  const target = process.env.BUILD_TARGET;
  const isDev = mode === "development";

  const commonDefine = {
    __DEV__: JSON.stringify(isDev),
  };

  if (target === "options") {
    return {
      base: "/",
      define: commonDefine,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        rollupOptions: {
          input: {
            options: resolve(__dirname, "src/options/index.html"),
          },
          output: {
            entryFileNames: "[name].js",
            assetFileNames: "[name].[ext]",
          },
        },
      },
      experimental: {
        renderBuiltUrl(filename) {
          // Chrome拡張ではルート相対パスを使う
          return "/" + filename;
        },
      },
    } satisfies UserConfig;
  }

  // content + background: IIFEで個別ビルド
  return {
    define: commonDefine,
    build: {
      outDir: "dist",
      emptyOutDir: !target, // 最初のビルドのみクリア
      lib: {
        entry: target === "background"
          ? resolve(__dirname, "src/background/index.ts")
          : resolve(__dirname, "src/content/index.ts"),
        formats: ["iife"],
        name: target === "background" ? "scwBg" : "scwContent",
        fileName: () => target === "background" ? "background.js" : "content.js",
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  } satisfies UserConfig;
});
