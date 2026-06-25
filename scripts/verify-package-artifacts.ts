import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
  bin?: {
    mdsite?: string;
  };
  private?: boolean;
  publishConfig?: {
    access?: string;
  };
  files?: string[];
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(rootDir, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

const requiredFiles = [
  resolve(rootDir, "dist", "index.js"),
  resolve(rootDir, "dist", "index.d.ts"),
];

for (const filePath of requiredFiles) {
  await access(filePath);
}

if (packageJson.bin?.mdsite !== "./dist/index.js") {
  throw new Error(`Expected bin.mdsite to be ./dist/index.js, got ${packageJson.bin?.mdsite}`);
}

if (packageJson.private !== false) {
  throw new Error("Expected package to be publishable with private set to false");
}

if (packageJson.publishConfig?.access !== "public") {
  throw new Error("Expected publishConfig.access to be public");
}

if (!Array.isArray(packageJson.files) || !includesPackagePath(packageJson.files, "dist")) {
  throw new Error("Expected package files to include dist/ or dist");
}

if (!Array.isArray(packageJson.files) || !includesPackagePath(packageJson.files, "mdsite-nuxt")) {
  throw new Error("Expected package files to include mdsite-nuxt/ or mdsite-nuxt");
}

function includesPackagePath(files: string[], packagePath: string): boolean {
  return files.includes(packagePath) || files.includes(`${packagePath}/`);
}
