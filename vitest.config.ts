import { defineConfig } from "vitest/config";

/**
 * `config.ts` reads globals that webpack's DefinePlugin injects at build time,
 * so tests have to supply them too — otherwise importing anything that reaches
 * config.ts fails with "__DEBUG__ is not defined".
 *
 * DEBUG is false so tests exercise the production API_URL branch; individual
 * tests that care about the URL mock ../config instead.
 */
export default defineConfig({
    define: {
        __DEBUG__: false,
        __APP_VERSION__: JSON.stringify("test"),
    },
    test: {
        include: ["alt1/**/*.test.ts"],
    },
});
