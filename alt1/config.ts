// Injected at build time by webpack's DefinePlugin (see webpack.config.js).
// true for the local build (build:local / watch), false for alt1 and alt1-dev.
declare const __DEBUG__: boolean;

export const DEBUG = __DEBUG__;
export const ORIGIN = DEBUG ? document.location.href : "https://www.dsfeventtracker.com/alt1";
export const API_URL = DEBUG ? "http://localhost:8000" : "https://api.dsfeventtracker.com";
