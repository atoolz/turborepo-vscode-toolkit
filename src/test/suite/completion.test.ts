import * as assert from "assert";
import * as vscode from "vscode";
import { createTurboDocument, sleep } from "./helper";

suite("Completion Provider", () => {
  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("should provide top-level key completions", async () => {
    const content = '{\n  \n}';
    const doc = await createTurboDocument(content);
    // Position cursor on the empty line between braces
    const position = new vscode.Position(1, 2);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      position
    );

    assert.ok(completions, "Should return completions");
    const labels = completions.items.map((item) =>
      typeof item.label === "string" ? item.label : item.label.label
    );

    assert.ok(labels.includes("tasks"), 'Should include "tasks" completion');
    assert.ok(labels.includes("globalDependencies"), 'Should include "globalDependencies"');
    assert.ok(labels.includes("globalEnv"), 'Should include "globalEnv"');
    assert.ok(labels.includes("ui"), 'Should include "ui"');
  });

  test("should provide task config key completions inside a task", async () => {
    const content = '{\n  "tasks": {\n    "build": {\n      \n    }\n  }\n}';
    const doc = await createTurboDocument(content);
    // Position inside the task config object
    const position = new vscode.Position(3, 6);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      position
    );

    assert.ok(completions, "Should return completions");
    const labels = completions.items.map((item) =>
      typeof item.label === "string" ? item.label : item.label.label
    );

    assert.ok(labels.includes("dependsOn"), 'Should include "dependsOn"');
    assert.ok(labels.includes("inputs"), 'Should include "inputs"');
    assert.ok(labels.includes("outputs"), 'Should include "outputs"');
    assert.ok(labels.includes("cache"), 'Should include "cache"');
    assert.ok(labels.includes("outputLogs"), 'Should include "outputLogs"');
    assert.ok(labels.includes("persistent"), 'Should include "persistent"');
  });

  test("should provide outputLogs enum value completions", async () => {
    const content = '{\n  "tasks": {\n    "build": {\n      "outputLogs": ""\n    }\n  }\n}';
    const doc = await createTurboDocument(content);

    // The completion provider uses SnippetString with choices for outputLogs,
    // so we verify the task option completion includes the values
    const position = new vscode.Position(3, 6);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      position
    );

    assert.ok(completions, "Should return completions");

    // Find the outputLogs completion item
    const outputLogsItem = completions.items.find((item) => {
      const label = typeof item.label === "string" ? item.label : item.label.label;
      return label === "outputLogs";
    });

    assert.ok(outputLogsItem, "Should have outputLogs completion");
    // The insertText should contain the valid enum values as a snippet choice
    const insertText = outputLogsItem.insertText;
    if (insertText instanceof vscode.SnippetString) {
      assert.ok(insertText.value.includes("full"), 'Should include "full"');
      assert.ok(insertText.value.includes("hash-only"), 'Should include "hash-only"');
      assert.ok(insertText.value.includes("new-only"), 'Should include "new-only"');
      assert.ok(insertText.value.includes("errors-only"), 'Should include "errors-only"');
      assert.ok(insertText.value.includes("none"), 'Should include "none"');
    }
  });

  test("should include documentation in completions", async () => {
    const content = '{\n  \n}';
    const doc = await createTurboDocument(content);
    const position = new vscode.Position(1, 2);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      position
    );

    assert.ok(completions, "Should return completions");

    const tasksItem = completions.items.find((item) => {
      const label = typeof item.label === "string" ? item.label : item.label.label;
      return label === "tasks";
    });

    assert.ok(tasksItem, "Should have tasks completion");
    assert.ok(tasksItem.documentation, "tasks completion should have documentation");
  });

  test("should provide boolean completions for cache/persistent", async () => {
    const content = '{\n  "tasks": {\n    "build": {\n      \n    }\n  }\n}';
    const doc = await createTurboDocument(content);
    const position = new vscode.Position(3, 6);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      position
    );

    assert.ok(completions, "Should return completions");

    const cacheItem = completions.items.find((item) => {
      const label = typeof item.label === "string" ? item.label : item.label.label;
      return label === "cache";
    });

    assert.ok(cacheItem, "Should have cache completion");
    if (cacheItem.insertText instanceof vscode.SnippetString) {
      assert.ok(
        cacheItem.insertText.value.includes("true") &&
          cacheItem.insertText.value.includes("false"),
        "cache snippet should offer true/false"
      );
    }

    const persistentItem = completions.items.find((item) => {
      const label = typeof item.label === "string" ? item.label : item.label.label;
      return label === "persistent";
    });

    assert.ok(persistentItem, "Should have persistent completion");
    if (persistentItem.insertText instanceof vscode.SnippetString) {
      assert.ok(
        persistentItem.insertText.value.includes("true") &&
          persistentItem.insertText.value.includes("false"),
        "persistent snippet should offer true/false"
      );
    }
  });
});
