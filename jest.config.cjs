/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^\\./config/swagger\\.js$": "<rootDir>/src/test/mocks/swagger.ts",
    "^better-auth$": "<rootDir>/src/test/mocks/better-auth.ts",
    "^better-auth/node$": "<rootDir>/src/test/mocks/better-auth-node.ts",
    "^better-auth/adapters/prisma$":
      "<rootDir>/src/test/mocks/better-auth-adapter-prisma.ts",
    "^better-auth/plugins$": "<rootDir>/src/test/mocks/better-auth-plugins.ts",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFiles: ["<rootDir>/src/test/setupEnv.ts"],
};
