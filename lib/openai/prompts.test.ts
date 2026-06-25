/**
 * Pure-function tests for the prompt builders. No network calls.
 *
 * Run with:  node --test lib/openai/prompts.test.ts
 *
 * Uses node:test (built into Node 18+, no test framework dependency).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  HAZARD_VOCABULARY_HINT,
  SCORE_SCHEMA,
  buildUserMessage,
} from "./prompts.ts";

describe("buildUserMessage", () => {
  it("includes coordinates rounded to 4 decimals", () => {
    const { text } = buildUserMessage({
      photoUrl: "https://example.com/pothole.jpg",
      lat: 18.46549999,
      lng: -66.10571234,
      userComment: null,
    });
    assert.match(text, /lat=18\.4655/);
    assert.match(text, /lng=-66\.1057/);
  });

  it("omits comment section when none provided", () => {
    const { text } = buildUserMessage({
      photoUrl: "https://example.com/pothole.jpg",
      lat: 18.4655,
      lng: -66.1057,
      userComment: null,
    });
    assert.match(text, /\(ninguno\)/);
    assert.doesNotMatch(text, /Ciudadano: ""/);
  });

  it("includes comment in quotes when provided", () => {
    const { text } = buildUserMessage({
      photoUrl: "https://example.com/pothole.jpg",
      lat: 18.4655,
      lng: -66.1057,
      userComment: "Hoyo profundo en la curva.",
    });
    assert.match(text, /"Hoyo profundo en la curva\."/);
  });

  it("trims whitespace from comment", () => {
    const { text } = buildUserMessage({
      photoUrl: "https://example.com/pothole.jpg",
      lat: 18.4655,
      lng: -66.1057,
      userComment: "   trimmed   ",
    });
    assert.match(text, /"trimmed"/);
  });

  it("returns the photo URL as imageUrl", () => {
    const { imageUrl } = buildUserMessage({
      photoUrl: "https://boketepr.supabase.co/storage/v1/object/public/photos/abc/pothole.jpg",
      lat: 18.4655,
      lng: -66.1057,
      userComment: null,
    });
    assert.equal(
      imageUrl,
      "https://boketepr.supabase.co/storage/v1/object/public/photos/abc/pothole.jpg",
    );
  });
});

describe("SCORE_SCHEMA (OpenAI strict-mode rules)", () => {
  it("has additionalProperties: false on the root object", () => {
    assert.equal(SCORE_SCHEMA.additionalProperties, false);
  });

  it("lists every property as required", () => {
    const props = Object.keys(SCORE_SCHEMA.properties);
    const required = SCORE_SCHEMA.required as readonly string[];
    for (const p of props) {
      assert.ok(
        required.includes(p),
        `expected property "${p}" to be in required`,
      );
    }
  });

  it("has all 4 expected fields", () => {
    const props = Object.keys(SCORE_SCHEMA.properties).sort();
    assert.deepEqual(props, ["confidence", "hazards", "reason", "severity"]);
  });

  it("severity is bounded 1.0–10.0", () => {
    const sev = SCORE_SCHEMA.properties.severity as {
      minimum: number;
      maximum: number;
      type: string;
    };
    assert.equal(sev.type, "number");
    assert.equal(sev.minimum, 1.0);
    assert.equal(sev.maximum, 10.0);
  });

  it("confidence is bounded 0.0–1.0", () => {
    const c = SCORE_SCHEMA.properties.confidence as {
      minimum: number;
      maximum: number;
    };
    assert.equal(c.minimum, 0.0);
    assert.equal(c.maximum, 1.0);
  });
});

describe("HAZARD_VOCABULARY_HINT", () => {
  it("is a non-empty comma-separated string of Spanish phrases", () => {
    assert.ok(HAZARD_VOCABULARY_HINT.length > 50);
    // Spanish phrases — each comma-separated item starts with an uppercase
    // letter (some have accents). The list is a *suggestion* to the model,
    // not a closed enum, so we only assert shape, not membership.
    assert.match(HAZARD_VOCABULARY_HINT, /^[A-ZÁÉÍÓÚÑ]/);
    assert.ok(HAZARD_VOCABULARY_HINT.includes(","));
  });
});
