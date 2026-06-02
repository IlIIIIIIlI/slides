const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

function collectTests(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTests(full);
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

if (!process.env.TS_TEST_CHILD) {
  const tests = [
    ...collectTests(path.join(root, "lib")),
    ...collectTests(path.join(root, "core")),
  ];
  if (tests.length === 0) {
    console.error("No unit tests found.");
    process.exit(1);
  }

  const result = spawnSync(process.execPath, ["--require", __filename, "--test", ...tests], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TS_TEST_CHILD: "1" },
  });

  process.exit(result.status ?? 1);
}
