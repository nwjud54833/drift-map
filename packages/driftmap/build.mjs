// Builds the npm CLI by bundling the frontend/ source of bin/driftmap.ts.
// Engine code is never duplicated into packages/: the bundle resolves the
// "@/*" TypeScript path alias to frontend/ and emits one plain-Node JS file.
import { build } from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, "..", "..", "frontend");

// The CLI prints this in its header. Reading it from the manifest here (and
// from the same file in frontend/vitest.config.ts) is what keeps the published
// bundle, the tests, and package.json from disagreeing about the version.
const { version } = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));

mkdirSync(join(here, "dist"), { recursive: true });

await build({
  entryPoints: [join(frontend, "bin", "driftmap.ts")],
  outfile: join(here, "dist", "cli.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  alias: {
    "@": frontend,
  },
  nodePaths: [join(here, "node_modules")],
  tsconfig: join(frontend, "tsconfig.json"),
  define: { __DRIFTMAP_VERSION__: JSON.stringify(version) },
  legalComments: "none",
});

console.log("built packages/driftmap/dist/cli.js");
