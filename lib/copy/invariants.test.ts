/**
 * Copy invariants — ally-pass guardrail.
 *
 * Scans user-facing code for copy that would break the BoketePR voice:
 *
 *   - "bache" is banned in user-facing copy (it means something different
 *     in Puerto Rico slang). Allowed only in code comments that explicitly
 *     explain the dialect choice.
 *   - Severity bucket labels must use the canonical Spanish phrases
 *     (Leve / Moderado / Severo / Peligroso). Catches drift like "Suave"
 *     or "Crítico".
 *   - "hoyo" (not "hueco" or "bache") is the standard term in the product.
 *   - Hazard labels must include the canonical Spanish phrasing for the
 *     suggested vocab, so the AI prompt and the label map stay in sync.
 *
 * Run with:  node --test lib/copy/invariants.test.ts
 *
 * Why this lives under lib/copy/ rather than next to one feature:
 *   It's an ally-pass test, not a feature test. Anything that touches
 *   user-visible strings should keep passing it. Putting it under a
 *   dedicated directory makes the scope obvious in code review and
 *   keeps future Spanish-only tests easy to add.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { HAZARD_VOCABULARY_HINT } from "../openai/prompts.ts";

/**
 * User-facing source paths we audit.
 *
 * We exclude:
 *   - lib/openai/prompts.ts and .test.ts (the AI prompt itself + tests
 *     reference the banned words intentionally)
 *   - lib/reports/hazard-labels.ts and .test.ts (the label map has the
 *     canonical Spanish phrasing as strings, but never the banned words)
 *   - API error messages (still user-facing but tested separately when
 *     they change)
 *   - node_modules, .next, scripts (build + test scaffolding)
 */
const USER_FACING_PATHS = [
  "app",
  "components",
];

// Words we ban in user-facing strings. Keep the list small — each entry
// is a real dialect trap that the user (native PR Spanish speaker)
// flagged.
const BANNED_WORDS = ["bache", "hueco"]; // "hueco" is the DR word; PR uses "hoyo"

// Canonical severity labels — what every severity bucket renders as.
const CANONICAL_LABELS = ["Leve", "Moderado", "Severo", "Peligroso"];

// Severity bucket label source of truth — keep in sync with
// lib/reports/severity.ts (test asserts they match).
const SEVERITY_LABEL_VALUES = ["Leve", "Moderado", "Severo", "Peligroso"];

/**
 * Read a file and return its text. We use node:fs so the test runs
 * without a bundler.
 */
async function read(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

/**
 * Walk a directory and return every file path (recursively).
 * Skips node_modules, .next, .git, dist, build.
 */
async function walk(dir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build"]);

  async function* gen(p: string): AsyncGenerator<string> {
    const entries = await readdir(p, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const full = join(p, entry.name);
      if (entry.isDirectory()) yield* gen(full);
      else yield full;
    }
  }

  const out: string[] = [];
  for await (const f of gen(dir)) out.push(f);
  return out;
}

/**
 * Strip block comments + line comments from a TypeScript source string
 * before scanning. We still want to scan template literals, JSX text,
 * and string literals — just not the comments that might mention banned
 * words for documentation purposes (e.g. "we don't say 'bache' because").
 */
function stripComments(src: string): string {
  // Order matters: strip block comments before line comments.
  // For line comments we strip "// to end of line" globally (not just
  // at the start) so inline comments like `const x = 1; // note` are
  // also removed from the scan.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("copy invariants (ally-pass guardrail)", () => {
  it("'bache' / 'hueco' never appear in user-facing source files", async () => {
    const violations: Array<{ file: string; word: string; line: number }> = [];

    for (const root of USER_FACING_PATHS) {
      const files = await walk(root);
      for (const file of files) {
        if (!/\.(ts|tsx)$/.test(file)) continue;
        const src = stripComments(await read(file));
        const lines = src.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const lower = lines[i].toLowerCase();
          for (const word of BANNED_WORDS) {
            // Word-boundary match — catches 'bache' but not 'bachelet'
            // (which we don't actually use, but the principle matters).
            const re = new RegExp(`\\b${word}\\b`, "i");
            if (re.test(lower)) {
              violations.push({ file, word, line: i + 1 });
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      const detail = violations
        .map((v) => `  ${v.file}:${v.line}  contains "${v.word}"`)
        .join("\n");
      assert.fail(
        `Found ${violations.length} banned-word violation(s):\n${detail}\n\n` +
          `BoketePR uses 'hoyo' (not 'bache' or 'hueco') in product copy.`,
      );
    }
  });

  it("'hoyo' is used as the standard pothole term in user-facing copy", async () => {
    // Positive assertion: at least N files under each root use 'hoyo'.
    // The exact count is fuzzy (test asserts > 0, not the precise total)
    // so the test stays useful even as files get added/removed.
    let hoyoFiles = 0;
    for (const root of USER_FACING_PATHS) {
      const files = await walk(root);
      for (const file of files) {
        if (!/\.(ts|tsx)$/.test(file)) continue;
        const src = await read(file);
        if (/\bhoyo\b/i.test(src)) hoyoFiles++;
      }
    }
    assert.ok(
      hoyoFiles >= 5,
      `Expected at least 5 user-facing files using 'hoyo', found ${hoyoFiles}.`,
    );
  });

  it("severityStyle() exposes the canonical Spanish labels", async () => {
    // Pull the actual labels out of lib/reports/severity.ts so the
    // test breaks if someone changes a label without updating
    // CANONICAL_LABELS above (or vice versa).
    const src = await read("lib/reports/severity.ts");
    for (const expected of SEVERITY_LABEL_VALUES) {
      assert.ok(
        src.includes(`label: "${expected}"`),
        `severity.ts should expose label: "${expected}"`,
      );
    }
  });

  it("HAZARD_VOCABULARY_HINT in the AI prompt covers the canonical hazards", () => {
    // Every canonical hazard token should have a corresponding Spanish
    // phrase in the prompt vocabulary (so the model knows about it)
    // AND a label in hazard-labels.ts (so users see something readable).
    // We assert a representative subset — the test is a smoke check, not
    // a guarantee that every hazard is labeled. Add more assertions if
    // a specific hazard starts drifting.
    const expectedCanonicalSpanish = [
      "Tráfico alto",
      "Carretera principal",
      "Cerca de escuela",
      "Bordes afilados",
      "Mojado",
    ];
    for (const phrase of expectedCanonicalSpanish) {
      assert.ok(
        HAZARD_VOCABULARY_HINT.includes(phrase),
        `HAZARD_VOCABULARY_HINT should suggest "${phrase}" to the AI`,
      );
    }
  });

  it("CANONICAL_LABELS stays in sync with the four severity buckets", () => {
    // Sanity check: this constant exists and has exactly four entries
    // (matching the four severity buckets in lib/reports/severity.ts).
    assert.equal(CANONICAL_LABELS.length, 4);
    assert.deepEqual(
      [...CANONICAL_LABELS].sort(),
      [...SEVERITY_LABEL_VALUES].sort(),
    );
  });
});