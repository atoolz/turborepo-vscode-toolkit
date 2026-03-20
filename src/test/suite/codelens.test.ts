import * as assert from "assert";
import * as vscode from "vscode";
import { openTurboFixture, sleep } from "./helper";

suite("CodeLens Provider", () => {
  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("should provide CodeLens above task definitions", async () => {
    const doc = await openTurboFixture("turbo.json");
    await sleep(1000);

    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri
    );

    assert.ok(codeLenses, "Should return CodeLens items");
    assert.ok(codeLenses.length > 0, "Should have at least one CodeLens");
  });

  test('should have "Run Task" and "Run (Force)" CodeLens titles', async () => {
    const doc = await openTurboFixture("turbo.json");
    await sleep(1000);

    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri,
      100 // resolve up to 100 code lenses
    );

    assert.ok(codeLenses && codeLenses.length > 0, "Should have CodeLens items");

    const titles = codeLenses
      .filter((cl) => cl.command)
      .map((cl) => cl.command!.title);

    const hasRunTask = titles.some((t) => t.includes("Run Task"));
    const hasRunForce = titles.some((t) => t.includes("Run (Force)"));

    assert.ok(hasRunTask, 'Should have a "Run Task" CodeLens');
    assert.ok(hasRunForce, 'Should have a "Run (Force)" CodeLens');
  });

  test("should have CodeLens groups for multiple tasks", async () => {
    const doc = await openTurboFixture("turbo.json");
    await sleep(1000);

    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri,
      100
    );

    assert.ok(codeLenses, "Should return CodeLens items");

    // turbo.json has 7 tasks (build, lint, test, dev, deploy, typecheck, clean)
    // Each task gets at least 2 CodeLenses (Run Task + Run Force)
    // Tasks with dependsOn get a third (dependency count)
    // Minimum: 7 tasks * 2 = 14
    assert.ok(
      codeLenses.length >= 14,
      `Should have at least 14 CodeLens items for 7 tasks, got ${codeLenses.length}`
    );

    // Check that CodeLenses appear at different lines (multiple tasks)
    const uniqueLines = new Set(codeLenses.map((cl) => cl.range.start.line));
    assert.ok(
      uniqueLines.size >= 5,
      `CodeLens should span at least 5 different line ranges, got ${uniqueLines.size}`
    );
  });
});
