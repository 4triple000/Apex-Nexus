// Bundles the API server (and the workspace libs it imports as TypeScript source)
// into a single ESM file at dist/index.mjs.
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";

// The plugin's ESM entry calls require.resolve, so load its CommonJS build instead
const esbuildPluginPino = createRequire(import.meta.url)("esbuild-plugin-pino");

await rm("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: true,
  logLevel: "info",
  // Optional native add-ons that some dependencies probe for at runtime
  external: ["pg-native", "bufferutil", "utf-8-validate"],
  // Let bundled CommonJS dependencies use require/__dirname under ESM
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      'import { fileURLToPath as __fileURLToPath } from "node:url";',
      'import { dirname as __pathDirname } from "node:path";',
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __pathDirname(__filename);",
    ].join("\n"),
  },
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
});
