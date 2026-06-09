import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const mock = (file: string) => path.resolve(rootDir, "src/test/mocks", file);

export default defineConfig({
  plugins: [
    {
      // The source uses NodeNext-style ".js" extensions in its relative imports
      // (e.g. `import prisma from "../lib/prisma.js"`). Vite's resolver does not
      // map those to the real ".ts" files on disk, so strip the extension and
      // let Vite resolve to the TypeScript source.
      name: "resolve-js-to-ts",
      enforce: "pre",
      async resolveId(source, importer, options) {
        if (importer && source.startsWith(".") && source.endsWith(".js")) {
          const resolved = await this.resolve(source.slice(0, -3), importer, {
            ...options,
            skipSelf: true,
          });
          if (resolved) return resolved;
        }
        return null;
      },
    },
  ],
  resolve: {
    // Replace the real Better Auth / Swagger modules with lightweight test
    // doubles.
    alias: [
      { find: /^better-auth$/, replacement: mock("better-auth.ts") },
      { find: /^better-auth\/node$/, replacement: mock("better-auth-node.ts") },
      {
        find: /^better-auth\/adapters\/prisma$/,
        replacement: mock("better-auth-adapter-prisma.ts"),
      },
      {
        find: /^better-auth\/plugins$/,
        replacement: mock("better-auth-plugins.ts"),
      },
      { find: /^\.\/config\/swagger\.js$/, replacement: mock("swagger.ts") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setupEnv.ts", "./src/test/setupServices.ts"],
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // All suites share one Postgres database and wipe it in afterEach hooks, so
    // they must run sequentially in a single process (the Jest `--runInBand`
    // equivalent). Parallel files would clobber each other's data.
    // Vitest 4: single worker via maxWorkers/minWorkers (poolOptions removed).
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/test/**", "src/generated/**"],
    },
  },
});
