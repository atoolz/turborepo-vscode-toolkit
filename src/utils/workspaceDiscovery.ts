import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface WorkspacePackage {
  name: string;
  location: string;
  scripts: string[];
  packageJsonPath: string;
}

/**
 * Discover all workspace packages in a monorepo.
 * Supports npm/yarn workspaces (from package.json) and pnpm (from pnpm-workspace.yaml).
 */
export async function discoverWorkspacePackages(): Promise<WorkspacePackage[]> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return [];
  }

  const globs = await getWorkspaceGlobs(workspaceRoot);
  if (globs.length === 0) {
    return [];
  }

  const packages: WorkspacePackage[] = [];

  for (const glob of globs) {
    // Convert workspace glob to a VS Code file search pattern
    const pattern = new vscode.RelativePattern(
      workspaceRoot,
      `${glob}/package.json`
    );
    const files = await vscode.workspace.findFiles(pattern, "**/node_modules/**");

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file.fsPath, "utf-8");
        const pkg = JSON.parse(content);
        const scripts = pkg.scripts ? Object.keys(pkg.scripts) : [];
        packages.push({
          name: pkg.name || path.basename(path.dirname(file.fsPath)),
          location: path.dirname(file.fsPath),
          scripts,
          packageJsonPath: file.fsPath,
        });
      } catch {
        // Skip packages that can't be parsed
      }
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

async function getWorkspaceGlobs(root: string): Promise<string[]> {
  // Try package.json workspaces first
  const packageJsonPath = path.join(root, "package.json");
  try {
    const content = await fs.promises.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    if (pkg.workspaces) {
      if (Array.isArray(pkg.workspaces)) {
        return pkg.workspaces;
      }
      if (pkg.workspaces.packages && Array.isArray(pkg.workspaces.packages)) {
        return pkg.workspaces.packages;
      }
    }
  } catch {
    // No package.json or not parseable
  }

  // Try pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(root, "pnpm-workspace.yaml");
  try {
    const content = await fs.promises.readFile(pnpmWorkspacePath, "utf-8");
    // Simple yaml parsing for the packages array
    const packages: string[] = [];
    let inPackages = false;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "packages:") {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        if (trimmed.startsWith("- ")) {
          // Remove quotes if present
          let value = trimmed.slice(2).trim();
          value = value.replace(/^['"]|['"]$/g, "");
          packages.push(value);
        } else if (trimmed && !trimmed.startsWith("#")) {
          break;
        }
      }
    }
    if (packages.length > 0) {
      return packages;
    }
  } catch {
    // No pnpm-workspace.yaml
  }

  return [];
}

/**
 * Find the root turbo.json file in the workspace.
 */
export async function findTurboJson(): Promise<vscode.Uri | undefined> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return undefined;
  }

  const turboJsonPath = path.join(workspaceRoot, "turbo.json");
  try {
    await fs.promises.access(turboJsonPath);
    return vscode.Uri.file(turboJsonPath);
  } catch {
    return undefined;
  }
}

/**
 * Read and parse the root turbo.json.
 */
export async function readTurboJson(): Promise<Record<string, unknown> | null> {
  const uri = await findTurboJson();
  if (!uri) {
    return null;
  }

  try {
    const content = await fs.promises.readFile(uri.fsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
