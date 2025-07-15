import { build } from "esbuild";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));

await build({
  entryPoints: ["index.mjs"],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: "dist/index.js",
  format: "cjs",
  minify: true,
  sourcemap: true,
  banner: {
    js: `// ${packageJson.name} v${packageJson.version}\n// Built with esbuild`,
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  conditions: ["node"],
  mainFields: ["module", "main"],
});

console.log("✅ Build completed successfully!");
