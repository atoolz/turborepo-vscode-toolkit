import * as assert from "assert";
import * as vscode from "vscode";
import { openTurboFixture, createJsonDocument, findKeyPosition, sleep } from "./helper";

suite("Hover Provider", () => {
  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("should show hover for top-level keys", async () => {
    const doc = await openTurboFixture("turbo.json");
    const position = findKeyPosition(doc, "tasks");

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      position
    );

    assert.ok(hovers && hovers.length > 0, "Should return hover for 'tasks'");
    const hoverText = hovers
      .flatMap((h) => h.contents)
      .map((c) => (c instanceof vscode.MarkdownString ? c.value : String(c)))
      .join("\n");
    assert.ok(
      hoverText.includes("tasks"),
      "Hover should mention the key name"
    );
  });

  test("should show hover for task config keys", async () => {
    const doc = await openTurboFixture("turbo.json");
    const position = findKeyPosition(doc, "dependsOn");

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      position
    );

    assert.ok(hovers && hovers.length > 0, "Should return hover for 'dependsOn'");
    const hoverText = hovers
      .flatMap((h) => h.contents)
      .map((c) => (c instanceof vscode.MarkdownString ? c.value : String(c)))
      .join("\n");
    assert.ok(
      hoverText.includes("dependsOn"),
      "Hover should describe dependsOn"
    );
  });

  test("should show hover for $TURBO_DEFAULT$ special value", async () => {
    const doc = await openTurboFixture("turbo.json");
    const position = findKeyPosition(doc, "$TURBO_DEFAULT$");

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      position
    );

    assert.ok(hovers && hovers.length > 0, "Should return hover for $TURBO_DEFAULT$");
    const hoverText = hovers
      .flatMap((h) => h.contents)
      .map((c) => (c instanceof vscode.MarkdownString ? c.value : String(c)))
      .join("\n");
    assert.ok(
      hoverText.includes("TURBO_DEFAULT"),
      "Hover should explain $TURBO_DEFAULT$"
    );
  });

  test("should NOT show turbo-specific hover on plain JSON files", async () => {
    const content = '{\n  "tasks": {\n    "build": {}\n  }\n}';
    const doc = await createJsonDocument(content);

    const text = doc.getText();
    const idx = text.indexOf('"tasks"');
    const position = doc.positionAt(idx + 2);

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      position
    );

    // The turbo hover provider is only registered for turbo-json language,
    // so plain json should not get turbo hovers
    const turboHover = (hovers || []).filter((h) =>
      h.contents.some((c) => {
        const text = c instanceof vscode.MarkdownString ? c.value : String(c);
        return text.includes("turbo.build");
      })
    );

    assert.strictEqual(
      turboHover.length,
      0,
      "Plain JSON should not get turbo-specific hovers"
    );
  });
});
