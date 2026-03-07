declare module "*.html" {
  const content: string;
  export default content;
}
declare module "*.wasm?url" {
  const url: string;
  export default url;
}
declare module "esbuild-wasm/*.wasm?url" {
  const url: string;
  export default url;
}
