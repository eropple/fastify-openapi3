import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,

    include: ["src/test/*.spec.ts"],

    coverage: {
      enabled: false,
      reporter: ["json", "text", "html"],
      cleanOnRerun: true,
      extension: ["*.ts"],
      reportsDirectory: "../coverage",

      include: ["src/**/*.ts"], // Include all source files for coverage
    },
  },
});
