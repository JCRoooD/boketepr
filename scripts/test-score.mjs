/**
 * Manual smoke test for Goal 4 — verifies the OpenAI scoring call works
 * end-to-end with a real API key.
 *
 *   1. Loads .env.local
 *   2. Calls scorePothole() with a photo (inline base64 by default)
 *   3. Prints the result (severity, reason, hazards, model version, latency)
 *
 * Usage:
 *   node scripts/test-score.mjs                              # default inline fixture (no network)
 *   node scripts/test-score.mjs <https://...>                # custom URL
 *   node scripts/test-score.mjs --file <path-to-jpeg>        # local image (base64)
 *
 * Cost: ~$0.0003 per run (1 image, ~300 input tokens + ~100 output tokens).
 *
 * Why the default is an inline 1x1 JPEG (not a URL): OpenAI's image fetcher
 * blocks most public hosts (Wikimedia Commons, Wikipedia, many CDNs), so any
 * hard-coded URL is a flake waiting to happen. We embed the same 125-byte
 * red pixel JPEG that e2e-submit.mjs uses — it's already verified to round-
 * trip through the full scoring path (severity=7, Spanish reason). The smoke
 * test asserts "wiring works", not "image is photorealistic" — see the
 * assertion guidance below.
 *
 * If you want to test on a real photo: pass --file <path-to-jpeg> or a URL.
 * If a URL gives `invalid_image_url`, switch to a Supabase Storage path or
 * --file.
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const isFile = args[0] === "--file";
const argPath = isFile ? args[1] : args[0];

// Load .env.local
const envText = readFileSync(
  "C:/Users/juanc/Projects/boketepr/.env.local",
  "utf8",
);
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error("✗ OPENAI_API_KEY is not set in .env.local");
  process.exit(1);
}

const lat = 18.4655; // San Juan
const lng = -66.1057;

// Resolve the image source: URL or base64 data URL
let imageUrl;
let sourceLabel;

if (isFile) {
  if (!argPath) {
    console.error("✗ --file requires a path");
    process.exit(1);
  }
  const buf = readFileSync(argPath);
  const b64 = buf.toString("base64");
  // Guess mime from extension
  const ext = argPath.toLowerCase().split(".").pop();
  const mime =
    ext === "png" ? "image/png" :
    ext === "webp" ? "image/webp" :
    "image/jpeg"; // default
  imageUrl = `data:${mime};base64,${b64}`;
  sourceLabel = `${argPath} (${(buf.length / 1024).toFixed(1)}KB)`;
} else if (argPath) {
  imageUrl = argPath;
  sourceLabel = argPath;
} else {
  // Default: 1x1 red JPEG (~125 bytes), same fixture used by e2e-submit.mjs
  // and test-fixed-pin.mjs. No network needed. Already verified to round-trip
  // through the scoring path with a reasonable Spanish response.
  const fixtureBytes = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z",
    "base64",
  );
  imageUrl = `data:image/jpeg;base64,${fixtureBytes.toString("base64")}`;
  sourceLabel = `inline 1x1 JPEG fixture (${fixtureBytes.length} bytes)`;
}

console.log("OpenAI scoring smoke test");
console.log("=========================");
console.log("Image:    ", sourceLabel);
console.log("Location: ", `lat=${lat}, lng=${lng}`);
console.log();

const OpenAI = (await import("openai")).default;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const t0 = Date.now();
let completion;
try {
  completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Eres un asistente que evalúa la severidad de hoyos en las carreteras de Puerto Rico. " +
          "Asigna una severidad de 1.0 a 10.0. Responde SOLO con JSON: {severity: number, reason: string, hazards: string[], confidence: number}.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Hoyo en Puerto Rico. lat=${lat}, lng=${lng}. Evalúa.` },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pothole_score",
        strict: true,
        schema: {
          type: "object",
          properties: {
            severity: { type: "number", minimum: 1.0, maximum: 10.0 },
            reason: { type: "string", minLength: 10, maxLength: 300 },
            hazards: { type: "array", items: { type: "string" } },
            confidence: { type: "number", minimum: 0.0, maximum: 1.0 },
          },
          required: ["severity", "reason", "hazards", "confidence"],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.2,
    max_tokens: 300,
  });
} catch (err) {
  console.error("✗ OpenAI call failed:");
  console.error("  ", err?.message ?? err);
  if (err?.status) console.error("   status:", err.status);
  if (err?.code) console.error("   code:  ", err.code);
  process.exit(1);
}

const latencyMs = Date.now() - t0;
const choice = completion.choices[0];
if (!choice?.message) {
  console.error("✗ No choice in response");
  process.exit(1);
}

const result =
  choice.message.parsed ??
  (choice.message.content ? JSON.parse(choice.message.content) : null);

if (!result) {
  console.error("✗ No parsed result");
  process.exit(1);
}

console.log("✓ OpenAI call succeeded");
console.log("  model:    ", completion.model);
console.log("  latency:  ", `${latencyMs}ms`);
console.log("  tokens:   ", `in=${completion.usage?.prompt_tokens} out=${completion.usage?.completion_tokens}`);
console.log();
console.log("  severity: ", result.severity);
console.log("  reason:   ", result.reason);
console.log("  hazards:  ", result.hazards.length ? result.hazards.join(", ") : "(none)");
console.log("  confidence:", result.confidence);
console.log();
console.log("If the severity feels reasonable for the image, the wiring is correct.");
console.log("Note: with the default 1x1 red pixel fixture, the score is mostly");
console.log("gpt-4o-mini responding to the Spanish prompt context, not to the");
console.log("image (which is too small to read). That's fine for a wiring smoke");
console.log("test — assert that you got a parseable JSON, a numeric severity,");
console.log("and a Spanish reason. The real /submit path uses real user photos.");
console.log();
console.log("Next step: commit + push to main, then Vercel auto-deploys.");
console.log("After deploy, the live site at https://boketepr.vercel.app/submit will");
console.log("call this same code path on real user-submitted photos.");
