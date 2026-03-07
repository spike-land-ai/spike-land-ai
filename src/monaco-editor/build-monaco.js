var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// build/utils.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var glob = __toESM(require("glob"));

// build/fs.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var REPO_ROOT = path.join(__dirname, "../");
var existingDirCache = /* @__PURE__ */ new Set();
function ensureDir(dirname3) {
  const dirs = [];
  while (dirname3.length > REPO_ROOT.length) {
    dirs.push(dirname3);
    dirname3 = path.dirname(dirname3);
  }
  dirs.reverse();
  dirs.forEach((dir) => {
    if (!existingDirCache.has(dir)) {
      try {
        fs.mkdirSync(dir);
      } catch (err) {
      }
      existingDirCache.add(dir);
    }
  });
}

// build/utils.ts
var REPO_ROOT2 = path2.join(__dirname, "../");
function readFiles(pattern, options) {
  let files = glob.sync(pattern, { cwd: REPO_ROOT2, ignore: options.ignore, dot: options.dot });
  files = files.filter((file) => {
    const fullPath = path2.join(REPO_ROOT2, file);
    const stats = fs2.statSync(fullPath);
    return stats.isFile();
  });
  const base = options.base;
  return files.map((file) => readFile(file, base));
}
function readFile(file, base = "") {
  const baseLength = base === "" ? 0 : base.endsWith("/") ? base.length : base.length + 1;
  const fullPath = path2.join(REPO_ROOT2, file);
  const contents = fs2.readFileSync(fullPath);
  const relativePath = file.substring(baseLength);
  return {
    path: relativePath,
    contents
  };
}
function writeFiles(files, dest) {
  for (const file of files) {
    const fullPath = path2.join(REPO_ROOT2, dest, file.path);
    ensureDir(path2.dirname(fullPath));
    fs2.writeFileSync(fullPath, file.contents);
  }
}

// build/releaseMetadata.ts
var glob2 = require("glob");
var path3 = require("path");
var fs3 = require("fs");
function getBasicLanguages() {
  const files = glob2.sync("./out/monaco-editor/esm/vs/languages/definitions/*/register.js", {
    cwd: path3.dirname(__dirname)
  });
  return files.map((file) => {
    const label = file.substring("./out/monaco-editor/esm/vs/languages/definitions/".length).replace("/register.js", "");
    const entry = `vs/languages/definitions/${label}/register`;
    return {
      label,
      entry
    };
  });
}
function readAdvancedLanguages() {
  return new Promise((resolve, reject) => {
    glob2(
      "./out/monaco-editor/esm/vs/languages/features/*/register.js",
      { cwd: path3.dirname(__dirname) },
      (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(
          files.map(
            (file) => file.substring("./out/monaco-editor/esm/vs/languages/features/".length)
          ).map((file) => file.substring(0, file.length - "/register.js".length))
        );
      }
    );
  });
}
function getAdvancedLanguages() {
  return readAdvancedLanguages().then((languages) => {
    let result = [];
    for (const lang of languages) {
      let shortLang = lang === "typescript" ? "ts" : lang;
      const entry = `vs/languages/features/${lang}/register`;
      checkFileExists(entry);
      const workerId = `vs/languages/features/${lang}/${shortLang}Worker`;
      const workerEntry = `vs/languages/features/${lang}/${shortLang}.worker`;
      checkFileExists(workerEntry);
      result.push({
        label: lang,
        entry,
        worker: {
          id: workerId,
          entry: workerEntry
        }
      });
    }
    return result;
  });
  function checkFileExists(moduleName) {
    const filePath = path3.join(REPO_ROOT2, "out/monaco-editor/esm", `${moduleName}.js`);
    if (!fs3.existsSync(filePath)) {
      console.error(`Could not find ${filePath}.`);
      process.exit(1);
    }
  }
}
function generateEsmMetadataJsAndDTs() {
  return Promise.all([getBasicLanguages(), getAdvancedLanguages()]).then(
    ([basicLanguages, advancedLanguages]) => {
      basicLanguages.sort((a, b) => strcmp(a.entry, b.entry));
      advancedLanguages.sort((a, b) => strcmp(a.entry, b.entry));
      let i = 0, len = basicLanguages.length;
      let j = 0, lenJ = advancedLanguages.length;
      let languages = [];
      while (i < len || j < lenJ) {
        if (i < len && j < lenJ) {
          if (basicLanguages[i].label === advancedLanguages[j].label) {
            let entry = [];
            entry.push(basicLanguages[i].entry);
            entry.push(advancedLanguages[j].entry);
            languages.push({
              label: basicLanguages[i].label,
              entry,
              worker: advancedLanguages[j].worker
            });
            i++;
            j++;
          } else if (basicLanguages[i].label < advancedLanguages[j].label) {
            languages.push(basicLanguages[i]);
            i++;
          } else {
            languages.push(advancedLanguages[j]);
            j++;
          }
        } else if (i < len) {
          languages.push(basicLanguages[i]);
          i++;
        } else {
          languages.push(advancedLanguages[j]);
          j++;
        }
      }
      const features = getFeatures();
      const dtsContents = `
/*!----------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Released under the MIT license
 * https://github.com/microsoft/monaco-editor/blob/main/LICENSE.txt
 *----------------------------------------------------------------*/

export interface IWorkerDefinition {
	id: string;
	entry: string;
}

export interface IFeatureDefinition {
	label: string;
	entry: string | string[] | undefined;
	worker?: IWorkerDefinition;
}

export const features: IFeatureDefinition[];

export const languages: IFeatureDefinition[];

export type EditorLanguage = ${languages.map((el) => `'${el.label}'`).join(" | ")};

export type EditorFeature = ${features.map((el) => `'${el.label}'`).join(" | ")};

export type NegatedEditorFeature = ${features.map((el) => `'!${el.label}'`).join(" | ")};

`;
      const dtsDestination = path3.join(REPO_ROOT2, "out/monaco-editor/esm/metadata.d.ts");
      ensureDir(path3.dirname(dtsDestination));
      fs3.writeFileSync(dtsDestination, dtsContents.replace(/\r\n/g, "\n"));
      const jsContents = `
exports.features = ${JSON.stringify(features, null, "  ")};
exports.languages = ${JSON.stringify(languages, null, "  ")};
`;
      const jsDestination = path3.join(REPO_ROOT2, "out/monaco-editor/esm/metadata.js");
      ensureDir(path3.dirname(jsDestination));
      fs3.writeFileSync(jsDestination, jsContents.replace(/\r\n/g, "\n"));
      for (const feature of [...features, ...languages]) {
        const entries = [].concat(feature.entry);
        for (const entry of entries) {
          const dtsDestination2 = path3.join(REPO_ROOT2, "out/monaco-editor/esm", entry) + ".d.ts";
          ensureDir(path3.dirname(dtsDestination2));
          if (!fs3.existsSync(dtsDestination2)) {
            fs3.writeFileSync(dtsDestination2, "export {}\n");
          }
        }
      }
    }
  );
}
function strcmp(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
function getFeatures() {
  const featureFiles = glob2.sync("./out/monaco-editor/esm/vs/features/*/register.js", {
    cwd: path3.dirname(__dirname)
  });
  return featureFiles.map((file) => {
    const featureName = file.substring("./out/monaco-editor/esm/vs/features/".length).replace("/register.js", "");
    const entry = `vs/features/${featureName}/register`;
    return {
      label: featureName,
      entry
    };
  });
}

// scripts/lib/index.ts
var import_child_process = require("child_process");
async function run(command, options) {
  console.log(`Running ${command} in ${options.cwd}`);
  const process2 = (0, import_child_process.spawn)(command, { shell: true, cwd: options.cwd, stdio: "inherit" });
  return new Promise((resolve, reject) => {
    process2.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Command ${command} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

// build/esm/build.script.ts
async function buildESM() {
  const rootPath = __dirname;
  await run("npx rollup -c rollup.config.mjs", { cwd: rootPath });
  await run("npx rollup -c rollup-types.config.mjs", { cwd: rootPath });
}

// build/amd/build.script.ts
async function buildAmdMinDev() {
  const rootPath = __dirname;
  await run("npx vite build --mode development", { cwd: rootPath });
  await run("npx vite build", { cwd: rootPath });
  await run("npx rollup -c rollup-types.config.mjs", { cwd: rootPath });
}

// build/build-monaco-editor.ts
var import_promises = require("fs/promises");
var path4 = require("path");
var fs4 = require("fs");
async function run2() {
  await (0, import_promises.rm)(path4.join(REPO_ROOT2, "./out/monaco-editor"), { recursive: true, force: true });
  await buildESM();
  await buildAmdMinDev();
  (() => {
    let contents = fs4.readFileSync("build/amd/out/types.d.ts", { encoding: "utf8" });
    contents += "\n\ndeclare global { export import monaco = editor_main; }\n";
    fs4.writeFileSync("out/monaco-editor/monaco.d.ts", contents);
  })();
  createThirdPartyNoticesDotTxt();
  generateEsmMetadataJsAndDTs();
  (() => {
    const packageJSON = readFiles("package.json", { base: "" })[0];
    const json = JSON.parse(packageJSON.contents.toString());
    json.private = false;
    delete json.scripts["postinstall"];
    packageJSON.contents = Buffer.from(JSON.stringify(json, null, "  "));
    writeFiles([packageJSON], `out/monaco-editor`);
  })();
  (() => {
    let otherFiles = [];
    otherFiles = otherFiles.concat(readFiles("README.md", { base: "" }));
    otherFiles = otherFiles.concat(readFiles("CHANGELOG.md", { base: "" }));
    otherFiles = otherFiles.concat(
      readFiles("node_modules/monaco-editor-core/LICENSE", {
        base: "node_modules/monaco-editor-core/"
      })
    );
    writeFiles(otherFiles, `out/monaco-editor`);
  })();
}
function createThirdPartyNoticesDotTxt() {
  const tpn = readFiles("node_modules/monaco-editor-core/ThirdPartyNotices.txt", {
    base: "node_modules/monaco-editor-core"
  })[0];
  let contents = tpn.contents.toString();
  console.log("ADDING ThirdPartyNotices from ./ThirdPartyNotices.txt");
  let thirdPartyNoticeContent = fs4.readFileSync(path4.join(REPO_ROOT2, "ThirdPartyNotices.txt")).toString();
  thirdPartyNoticeContent = thirdPartyNoticeContent.split("\n").slice(8).join("\n");
  contents += "\n" + thirdPartyNoticeContent;
  tpn.contents = Buffer.from(contents);
  writeFiles([tpn], `out/monaco-editor`);
}
run2();
