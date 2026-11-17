import { defineConfig } from "vite";

// Horizon needs cross-origin isolation (SharedArrayBuffer / wasm threads).
// `credentialless` rather than `require-corp`: IGN tiles (data.geopf.fr) do not
// send Cross-Origin-Resource-Policy and would be blocked.
const crossOriginIsolationHeaders = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
    // Relative asset URLs: the build works under any subpath.
    base: "./",
    // horizon-core spawns its pthread workers from `new URL(..., import.meta.url)`:
    // pre-bundling would move it into .vite/deps and break those URLs.
    optimizeDeps: { exclude: ["@siradel-oss/horizon-core"] },
    worker: { format: "es" },
    build: { target: "es2022" },
    server: { headers: crossOriginIsolationHeaders },
    preview: { headers: crossOriginIsolationHeaders },
});
