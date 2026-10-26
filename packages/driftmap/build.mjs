// Builds the npm CLI by bundling the frontend/ source of bin/driftmap.ts.
// Engine code is never duplicated into packages/: the bundle resolves the
// "@/*" TypeScript path alias to frontend/ and emits one plain-Node JS file.
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, "..", "..", "frontend");

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
  tsconfig: join(frontend, "tsconfig.json"),
  legalComments: "none",
});

console.log("built packages/driftmap/dist/cli.js");
