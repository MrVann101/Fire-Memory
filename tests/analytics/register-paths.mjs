import { registerHooks } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function isExistingFile(candidatePath) {
  try {
    return existsSync(candidatePath) && statSync(candidatePath).isFile();
  } catch {
    return false;
  }
}

function resolveFileCandidate(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.json`,
    resolve(basePath, "index.ts"),
  ];
  for (const c of candidates) {
    if (isExistingFile(c)) {
      return c;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    if (specifier.startsWith("@/")) {
      const target = resolve(repoRoot, "src", specifier.slice(2));
      const resolved = resolveFileCandidate(target);
      if (resolved) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      context.parentURL.startsWith("file:")
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      if (!parentPath.includes("node_modules")) {
        const target = resolve(dirname(parentPath), specifier);
        const resolved = resolveFileCandidate(target);
        if (resolved) {
          return { url: pathToFileURL(resolved).href, shortCircuit: true };
        }
      }
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".json")) {
      const filePath = fileURLToPath(url);
      if (!filePath.includes("node_modules")) {
        const raw = readFileSync(filePath, "utf8");
        return {
          format: "module",
          source: `export default ${raw};`,
          shortCircuit: true,
        };
      }
    }
    return nextLoad(url, context);
  },
});
