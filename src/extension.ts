import * as vscode from "vscode";
import * as path from "path";
import * as childProcess from "child_process";
import { TurboCompletionProvider } from "./providers/completionProvider";
import { TurboHoverProvider } from "./providers/hoverProvider";
import { TurboDiagnosticProvider } from "./providers/diagnosticProvider";
import { TurboCodeLensProvider } from "./providers/codeLensProvider";
import {
  TaskTreeProvider,
  PackageTreeProvider,
} from "./providers/taskTreeProvider";
import { PipelineViewProvider } from "./views/pipelineView";
import { findTaskPosition } from "./utils/turboParser";

const TURBO_JSON_SELECTOR: vscode.DocumentSelector = {
  language: "turbo-json",
};

export function activate(context: vscode.ExtensionContext): void {
  // Providers
  const diagnosticProvider = new TurboDiagnosticProvider();
  const codeLensProvider = new TurboCodeLensProvider();
  const taskTreeProvider = new TaskTreeProvider();
  const packageTreeProvider = new PackageTreeProvider();
  const pipelineView = new PipelineViewProvider(context.extensionUri);

  // Register completion provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      TURBO_JSON_SELECTOR,
      new TurboCompletionProvider(),
      '"',
      ":"
    )
  );

  // Register hover provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      TURBO_JSON_SELECTOR,
      new TurboHoverProvider()
    )
  );

  // Register CodeLens provider
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      TURBO_JSON_SELECTOR,
      codeLensProvider
    )
  );

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("turborepoTasks", taskTreeProvider)
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "turborepoPackages",
      packageTreeProvider
    )
  );

  // Diagnostics: update on open & save
  context.subscriptions.push(diagnosticProvider);

  // Run diagnostics on all open turbo.json files
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.fileName.endsWith("turbo.json")) {
      diagnosticProvider.update(doc);
    }
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.fileName.endsWith("turbo.json")) {
        diagnosticProvider.update(doc);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.fileName.endsWith("turbo.json")) {
        diagnosticProvider.update(event.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.fileName.endsWith("turbo.json")) {
        diagnosticProvider.clear(doc.uri);
      }
    })
  );

  // Watch for turbo.json changes to refresh tree views
  const turboWatcher = vscode.workspace.createFileSystemWatcher(
    "**/turbo.json"
  );
  turboWatcher.onDidChange(() => {
    taskTreeProvider.refresh();
    codeLensProvider.refresh();
  });
  turboWatcher.onDidCreate(() => {
    taskTreeProvider.refresh();
  });
  turboWatcher.onDidDelete(() => {
    taskTreeProvider.refresh();
  });
  context.subscriptions.push(turboWatcher);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "turborepo-toolkit.runTask",
      (taskName?: string) => {
        runTurboTask(taskName, false);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "turborepo-toolkit.runTaskForce",
      (taskName?: string) => {
        runTurboTask(taskName, true);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("turborepo-toolkit.showPipeline", () => {
      pipelineView.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("turborepo-toolkit.refreshTasks", () => {
      taskTreeProvider.refresh();
      packageTreeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "turborepo-toolkit.goToTaskDefinition",
      async (taskName: string) => {
        const workspaceRoot =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const turboJsonPath = path.join(workspaceRoot, "turbo.json");
        try {
          const doc =
            await vscode.workspace.openTextDocument(turboJsonPath);
          const editor = await vscode.window.showTextDocument(doc);
          const pos = findTaskPosition(doc, taskName);
          if (pos) {
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(
              new vscode.Range(pos, pos),
              vscode.TextEditorRevealType.InCenter
            );
          }
        } catch {
          vscode.window.showWarningMessage("turbo.json not found.");
        }
      }
    )
  );
}

async function runTurboTask(
  taskName: string | undefined,
  force: boolean
): Promise<void> {
  if (!taskName) {
    taskName = await vscode.window.showInputBox({
      prompt: "Enter task name to run",
      placeHolder: "build",
    });
  }

  if (!taskName) return;

  const args = ["run", taskName];
  if (force) {
    args.push("--force");
  }

  const terminal = vscode.window.createTerminal({
    name: `turbo run ${taskName}`,
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });

  // Use sendText to run the command in the terminal safely
  const command = ["turbo", ...args].join(" ");
  terminal.sendText(command);
  terminal.show();
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
