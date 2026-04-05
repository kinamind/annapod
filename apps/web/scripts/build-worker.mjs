import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, "out");

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [resolve(root, "cloudflare/worker.ts")],
  outfile: resolve(outdir, "_worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  logLevel: "info",
});
