import * as vscode from "vscode";
import { parseTurboJson, findTaskRange } from "../utils/turboParser";

export class TurboCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (!document.fileName.endsWith("turbo.json")) {
      return [];
    }

    const text = document.getText();
    const turboJson = parseTurboJson(text);
    if (!turboJson || !turboJson.tasks) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    for (const [taskName, taskConfig] of Object.entries(turboJson.tasks)) {
      const range = findTaskRange(document, taskName);
      if (!range) continue;

      // "Run Task" lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: "$(play) Run Task",
          command: "turborepo-toolkit.runTask",
          arguments: [taskName],
          tooltip: `Run: turbo run ${taskName}`,
        })
      );

      // "Run Task (Force)" lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: "$(debug-restart) Run (Force)",
          command: "turborepo-toolkit.runTaskForce",
          arguments: [taskName],
          tooltip: `Run: turbo run ${taskName} --force`,
        })
      );

      // Dependency count
      const deps = taskConfig.dependsOn;
      if (deps && deps.length > 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(git-merge) ${deps.length} ${deps.length === 1 ? "dependency" : "dependencies"}`,
            command: "",
            tooltip: deps.join(", "),
          })
        );
      }
    }

    return lenses;
  }
}
