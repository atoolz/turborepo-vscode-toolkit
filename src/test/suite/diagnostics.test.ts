import * as assert from "assert";
import * as vscode from "vscode";
import { openTurboFixture, sleep } from "./helper";

suite("Diagnostic Provider", () => {
  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("valid turbo.json should produce zero diagnostics", async () => {
    const doc = await openTurboFixture("turbo.json");
    // Wait extra time for diagnostics to be computed
    await sleep(2000);

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const turboDiags = diagnostics.filter(
      (d) => d.source === undefined || d.source === "turborepo"
    );

    // The valid fixture should not produce turborepo-specific errors/warnings
    // (it may have some from JSON schema validation, but not from our provider)
    const turboErrors = turboDiags.filter((d) =>
      d.message.includes("Unknown task configuration key") ||
      d.message.includes("Invalid outputLogs") ||
      d.message.includes("deprecated") ||
      d.message.includes("persistent:true")
    );
    assert.strictEqual(
      turboErrors.length,
      0,
      `Valid turbo.json should have no turbo diagnostics, got: ${turboErrors.map((d) => d.message).join(", ")}`
    );
  });

  test("should detect unknown task config keys", async () => {
    const doc = await openTurboFixture("invalid-turbo.json");
    await sleep(2000);

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const unknownKey = diagnostics.find((d) =>
      d.message.includes('Unknown task configuration key "unknownKey"')
    );

    assert.ok(unknownKey, "Should report unknown task config key 'unknownKey'");
    assert.strictEqual(
      unknownKey.severity,
      vscode.DiagnosticSeverity.Warning,
      "Unknown key should be a warning"
    );
  });

  test("should detect invalid outputLogs values", async () => {
    const doc = await openTurboFixture("invalid-turbo.json");
    await sleep(2000);

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const invalidOutputLogs = diagnostics.find((d) =>
      d.message.includes('Invalid outputLogs value "invalid-value"')
    );

    assert.ok(invalidOutputLogs, "Should report invalid outputLogs value");
    assert.strictEqual(
      invalidOutputLogs.severity,
      vscode.DiagnosticSeverity.Error,
      "Invalid outputLogs should be an error"
    );
  });

  test("should detect deprecated experimentalUI", async () => {
    const doc = await openTurboFixture("invalid-turbo.json");
    await sleep(2000);

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const deprecated = diagnostics.find((d) =>
      d.message.includes("experimentalUI") && d.message.includes("deprecated")
    );

    assert.ok(deprecated, "Should report deprecated experimentalUI");
    assert.strictEqual(
      deprecated.severity,
      vscode.DiagnosticSeverity.Warning,
      "Deprecated key should be a warning"
    );
    assert.ok(
      deprecated.tags?.includes(vscode.DiagnosticTag.Deprecated),
      "Should have Deprecated diagnostic tag"
    );
  });

  test("should detect cache:true + persistent:true conflict", async () => {
    const doc = await openTurboFixture("invalid-turbo.json");
    await sleep(2000);

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const conflict = diagnostics.filter((d) =>
      d.message.includes("cache:true") && d.message.includes("persistent:true")
    );

    // The invalid fixture has two tasks with this conflict: build and dev
    assert.ok(
      conflict.length >= 2,
      `Should detect cache+persistent conflict in at least 2 tasks, found ${conflict.length}`
    );
    assert.strictEqual(
      conflict[0].severity,
      vscode.DiagnosticSeverity.Error,
      "Conflict should be an error"
    );
  });

  test("should report multiple errors in one file", async () => {
    const doc = await openTurboFixture("invalid-turbo.json");
    await sleep(2000);

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    // We expect at least:
    // 1. unknownKey warning
    // 2. invalid outputLogs error
    // 3. deprecated experimentalUI warning
    // 4. cache+persistent conflict for "build"
    // 5. cache+persistent conflict for "dev"
    assert.ok(
      diagnostics.length >= 5,
      `Should have at least 5 diagnostics, got ${diagnostics.length}: ${diagnostics.map((d) => d.message).join(" | ")}`
    );
  });
});
