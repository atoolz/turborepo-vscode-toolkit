import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parseTurboJson, TaskConfig } from "../utils/turboParser";
import {
  discoverWorkspacePackages,
  WorkspacePackage,
} from "../utils/workspaceDiscovery";

type TreeItemType =
  | TaskTreeItem
  | TaskDetailItem
  | PackageTreeItem
  | PackageScriptItem;

export class TaskTreeProvider
  implements vscode.TreeDataProvider<TreeItemType>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItemType | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private turboJsonPath: string | undefined;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItemType): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
    if (!element) {
      return this.getTaskItems();
    }

    if (element instanceof TaskTreeItem) {
      return this.getTaskDetails(element.taskName, element.config);
    }

    return [];
  }

  private async getTaskItems(): Promise<TaskTreeItem[]> {
    const turboJson = await this.readTurboJson();
    if (!turboJson || !turboJson.tasks) {
      return [];
    }

    return Object.entries(turboJson.tasks).map(
      ([name, config]) => new TaskTreeItem(name, config)
    );
  }

  private getTaskDetails(
    taskName: string,
    config: TaskConfig
  ): TaskDetailItem[] {
    const items: TaskDetailItem[] = [];

    if (config.dependsOn && config.dependsOn.length > 0) {
      items.push(
        new TaskDetailItem(
          `dependsOn: ${config.dependsOn.join(", ")}`,
          "dependencies",
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    if (config.inputs && config.inputs.length > 0) {
      items.push(
        new TaskDetailItem(
          `inputs: ${config.inputs.join(", ")}`,
          "inputs",
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    if (config.outputs && config.outputs.length > 0) {
      items.push(
        new TaskDetailItem(
          `outputs: ${config.outputs.join(", ")}`,
          "outputs",
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    const cached = config.cache !== false;
    items.push(
      new TaskDetailItem(
        `cache: ${cached ? "enabled" : "disabled"}`,
        "cache",
        vscode.TreeItemCollapsibleState.None
      )
    );

    if (config.persistent) {
      items.push(
        new TaskDetailItem(
          "persistent: true",
          "persistent",
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    if (config.outputLogs) {
      items.push(
        new TaskDetailItem(
          `outputLogs: ${config.outputLogs}`,
          "logs",
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    if (config.env && config.env.length > 0) {
      items.push(
        new TaskDetailItem(
          `env: ${config.env.join(", ")}`,
          "env",
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    return items;
  }

  private async readTurboJson(): Promise<{
    tasks?: Record<string, TaskConfig>;
  } | null> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return null;

    const turboJsonPath = path.join(workspaceRoot, "turbo.json");
    this.turboJsonPath = turboJsonPath;

    try {
      const content = await fs.promises.readFile(turboJsonPath, "utf-8");
      return parseTurboJson(content);
    } catch {
      return null;
    }
  }

  private getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return undefined;
    return folders[0].uri.fsPath;
  }
}

export class PackageTreeProvider
  implements vscode.TreeDataProvider<TreeItemType>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItemType | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItemType): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
    if (!element) {
      return this.getPackageItems();
    }

    if (element instanceof PackageTreeItem) {
      return element.scripts.map(
        (script) => new PackageScriptItem(script, element.packageName)
      );
    }

    return [];
  }

  private async getPackageItems(): Promise<PackageTreeItem[]> {
    const packages = await discoverWorkspacePackages();
    return packages.map((pkg) => new PackageTreeItem(pkg));
  }
}

class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly taskName: string,
    public readonly config: TaskConfig
  ) {
    super(taskName, vscode.TreeItemCollapsibleState.Collapsed);

    const cached = config.cache !== false;
    const persistent = config.persistent === true;

    let description = "";
    if (persistent) description += "persistent";
    if (!cached) description += description ? ", no-cache" : "no-cache";
    if (config.dependsOn && config.dependsOn.length > 0) {
      const depCount = config.dependsOn.length;
      description += description ? `, ${depCount} deps` : `${depCount} deps`;
    }

    this.description = description;
    this.contextValue = "task";
    this.iconPath = new vscode.ThemeIcon(
      persistent ? "server-process" : cached ? "package" : "play-circle"
    );
    this.tooltip = this.buildTooltip();

    this.command = {
      command: "turborepo-toolkit.goToTaskDefinition",
      title: "Go to Definition",
      arguments: [taskName],
    };
  }

  private buildTooltip(): string {
    const lines = [`Task: ${this.taskName}`];
    if (this.config.dependsOn) {
      lines.push(`Dependencies: ${this.config.dependsOn.join(", ")}`);
    }
    if (this.config.outputs) {
      lines.push(`Outputs: ${this.config.outputs.join(", ")}`);
    }
    lines.push(`Cache: ${this.config.cache !== false}`);
    return lines.join("\n");
  }
}

class TaskDetailItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly detailType: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    const icons: Record<string, string> = {
      dependencies: "git-merge",
      inputs: "file-code",
      outputs: "output",
      cache: "database",
      persistent: "server-process",
      logs: "output",
      env: "symbol-variable",
    };

    this.iconPath = new vscode.ThemeIcon(icons[detailType] || "info");
  }
}

class PackageTreeItem extends vscode.TreeItem {
  public readonly scripts: string[];
  public readonly packageName: string;

  constructor(pkg: WorkspacePackage) {
    super(
      pkg.name,
      pkg.scripts.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.packageName = pkg.name;
    this.scripts = pkg.scripts;
    this.description = path.relative(
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
      pkg.location
    );
    this.iconPath = new vscode.ThemeIcon("package");
    this.tooltip = `${pkg.name}\n${pkg.location}\nScripts: ${pkg.scripts.join(", ") || "none"}`;

    this.command = {
      command: "vscode.open",
      title: "Open package.json",
      arguments: [vscode.Uri.file(pkg.packageJsonPath)],
    };
  }
}

class PackageScriptItem extends vscode.TreeItem {
  constructor(
    public readonly scriptName: string,
    public readonly packageName: string
  ) {
    super(scriptName, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("play");
    this.contextValue = "packageScript";
    this.tooltip = `${packageName} > ${scriptName}`;
  }
}
