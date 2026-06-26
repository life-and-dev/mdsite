import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
  name?: string;
  bin?: {
    mdsite?: string;
  };
  private?: boolean;
  publishConfig?: {
    access?: string;
  };
  repository?: {
    type?: string;
    url?: string;
  };
  files?: string[];
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(rootDir, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

const requiredFiles = [
  resolve(rootDir, "bin", "mdsite.js"),
  resolve(rootDir, "dist", "index.js"),
  resolve(rootDir, "dist", "index.d.ts"),
];

for (const filePath of requiredFiles) {
  await access(filePath);
}

if (packageJson.bin?.mdsite !== "./bin/mdsite.js") {
  throw new Error(`Expected bin.mdsite to be ./bin/mdsite.js, got ${packageJson.bin?.mdsite}`);
}

if (packageJson.name !== "@life-and-dev/mdsite") {
  throw new Error(`Expected package name to be @life-and-dev/mdsite, got ${packageJson.name}`);
}

if (packageJson.private !== false) {
  throw new Error("Expected package to be publishable with private set to false");
}

if (packageJson.publishConfig?.access !== "public") {
  throw new Error("Expected publishConfig.access to be public");
}

if (packageJson.repository?.type !== "git") {
  throw new Error(`Expected repository.type to be git, got ${packageJson.repository?.type}`);
}

if (packageJson.repository?.url !== "https://github.com/life-and-dev/mdsite") {
  throw new Error(`Expected repository.url to be https://github.com/life-and-dev/mdsite, got ${packageJson.repository?.url}`);
}

if (!Array.isArray(packageJson.files) || !includesPackagePath(packageJson.files, "dist")) {
  throw new Error("Expected package files to include dist/ or dist");
}

if (!Array.isArray(packageJson.files) || !includesPackagePath(packageJson.files, "bin")) {
  throw new Error("Expected package files to include bin/ or bin");
}

if (!Array.isArray(packageJson.files) || !includesPackagePath(packageJson.files, "mdsite-nuxt")) {
  throw new Error("Expected package files to include mdsite-nuxt/ or mdsite-nuxt");
}

function includesPackagePath(files: string[], packagePath: string): boolean {
  return files.includes(packagePath) || files.includes(`${packagePath}/`);
}
