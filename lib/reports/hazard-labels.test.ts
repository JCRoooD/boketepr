/**
 * Unit tests for the hazard label map.
 *
 *   - Canonical tokens → their user-facing Spanish label
 *   - Legacy snake_case tokens (from old AI prompt) still render correctly
 *   - Free-form Spanish phrases get the prettify fallback
 *   - Empty / whitespace tokens get filtered out (defensive)
 *
 * Run with:  node --test lib/reports/hazard-labels.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { hazardLabel, hazardLabels } from "./hazard-labels.ts";

describe("hazardLabel", () => {
  it("returns the canonical Spanish label for known tokens", () => {
    assert.equal(hazardLabel("trafico_alto"), "Tráfico alto");
    assert.equal(hazardLabel("carretera_principal"), "Carretera principal");
    assert.equal(hazardLabel("cerca_escuela"), "Cerca de escuela");
    assert.equal(hazardLabel("bordes_afilados"), "Bordes afilados");
    assert.equal(hazardLabel("senalizado"), "Señalizado");
  });

  it("prettifies unknown snake_case tokens as a fallback", () => {
    // Future hazard the model emits before we add a canonical label
    assert.equal(hazardLabel("senal_de_stop"), "Senal de stop");
    assert.equal(hazardLabel("al lado de un poste"), "Al lado de un poste");
  });

  it("handles a single-word token without underscores", () => {
    assert.equal(hazardLabel("mojado"), "Mojado");
    assert.equal(hazardLabel("grieta"), "Grieta");
  });

  it("returns empty string for empty or whitespace input", () => {
    assert.equal(hazardLabel(""), "");
    assert.equal(hazardLabel("   "), "");
  });

  it("trims surrounding whitespace before looking up", () => {
    assert.equal(hazardLabel("  trafico_alto  "), "Tráfico alto");
  });
});

describe("hazardLabels", () => {
  it("maps a list of tokens to a list of labels", () => {
    assert.deepEqual(
      hazardLabels(["trafico_alto", "carretera_principal"]),
      ["Tráfico alto", "Carretera principal"],
    );
  });

  it("filters out empty / whitespace tokens", () => {
    assert.deepEqual(
      hazardLabels(["trafico_alto", "", "  ", "mojado"]),
      ["Tráfico alto", "Mojado"],
    );
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(hazardLabels([]), []);
  });

  it("handles a mix of canonical tokens and free-form Spanish", () => {
    // The AI sometimes emits a phrase instead of the canonical vocab.
    // We still want it to render as readable Spanish, not raw input.
    assert.deepEqual(
      hazardLabels(["trafico_alto", "hueco profundo con agua"]),
      ["Tráfico alto", "Hueco profundo con agua"],
    );
  });
});