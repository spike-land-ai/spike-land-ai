// Vite needs the `?url` query for third-party WASM assets. We only need the
// resolved asset URL so the browser-side esbuild initializer can fetch it.
import wasmUrl from "esbuild-wasm/esbuild.wasm?url";
export { wasmUrl as wasmFile };
