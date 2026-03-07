export { editor, languages, Range, typescript, Uri } from "monaco-editor";
export const version = "0.55.1";
const baseUrl = "https://esm.spike.land/monaco-editor@0.55.1/min/vs";

const MonacoEnvironment = {
  baseUrl,

  getWorkerUrl: (_moduleId: string, label: string) => {
    let path = `${baseUrl}/editor/editor.worker.js`;
    if (label === "typescript" || label === "javascript") {
      path = `${baseUrl}/language/typescript/ts.worker.js`;
    } else if (label === "json") {
      path = `${baseUrl}/language/json/json.worker.js`;
    } else if (label === "css" || label === "scss" || label === "less") {
      path = `${baseUrl}/language/css/css.worker.js`;
    } else if (label === "html" || label === "handlebars" || label === "razor") {
      path = `${baseUrl}/language/html/html.worker.js`;
    }
    const blob = new Blob([`importScripts('${path}');`], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  },
};

Object.assign(globalThis, { MonacoEnvironment });
