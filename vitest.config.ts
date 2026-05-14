import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration tests live alongside unit tests but hit live edge functions.
    // Exclude them from the default `vitest run` so unit runs stay hermetic;
    // they're run explicitly via `bun run test:integration`.
    exclude: ["src/test/integration/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Allow-list of files with test coverage. ADD a file here once it has a
      // matching *.test.ts so the >80% gate applies to it. Files outside this
      // list are not measured (yet) — see TODO at bottom for the backlog.
      include: [
        "src/utils/idGenerators.ts",
        "src/utils/dateTime.ts",
        "src/utils/matterTypeClaimPhrase.ts",
        "src/utils/caseStatusMapping.ts",
        "src/utils/expertTypeMapping.ts",
        "src/utils/assessmentUpdateAccess.ts",
        "src/utils/pdfBranding.ts",
      ],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
      // TODO: extend `include` to cover src/hooks/* and remaining src/utils/*
      // as tests are written. The 80% gate then applies automatically.
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
