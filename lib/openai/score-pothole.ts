import { z } from "zod";

import { getOpenAIClient } from "./client";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  SCORE_SCHEMA,
} from "./prompts";

/**
 * gpt-4o-mini: ~10x cheaper than gpt-4o, ~90-95% as good for this task.
 * Change this single constant to upgrade to gpt-4o or another model.
 */
const MODEL = "gpt-4o-mini";

/**
 * Zod schema for the model's response. Same shape as SCORE_SCHEMA but
 * with zod's runtime validation, so we catch any contract drift between
 * the prompt and our consumer code.
 */
const ScoreResponse = z.object({
  severity: z.number().min(1.0).max(10.0),
  reason: z.string().min(10).max(300),
  hazards: z.array(z.string()).max(10),
  confidence: z.number().min(0.0).max(1.0),
});

export type PotholeScore = z.infer<typeof ScoreResponse> & {
  /** The exact model snapshot the API returned (e.g. "gpt-4o-mini-2024-07-18"). */
  modelVersion: string;
  /** Wall-clock time for the call, useful for monitoring. */
  latencyMs: number;
};

/**
 * Score a pothole photo. Pure server-side call. Throws on any failure
 * (env missing, network error, schema mismatch). Caller should catch
 * and decide whether to fall back to a placeholder.
 */
export async function scorePothole(input: {
  photoUrl: string;
  lat: number;
  lng: number;
  userComment: string | null;
}): Promise<PotholeScore> {
  const client = getOpenAIClient();
  const { text, imageUrl } = buildUserMessage(input);

  const t0 = Date.now();

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pothole_score",
        schema: SCORE_SCHEMA,
        strict: true,
      },
    },
    // Low temperature: we want consistent, conservative scores,
    // not creative variation. 0.2 leaves a tiny bit of room for
    // the model to interpret ambiguous photos.
    temperature: 0.2,
    // Cap the response — the JSON we want is small. This also gives
    // a small cost savings on output tokens.
    max_tokens: 300,
  });

  const latencyMs = Date.now() - t0;

  const choice = completion.choices[0];
  if (!choice?.message) {
    throw new Error("OpenAI returned no choices");
  }

  // With strict json_schema, OpenAI gives us a pre-parsed object in
  // `message.parsed`. Fall back to parsing `content` defensively.
  const raw =
    (choice.message as { parsed?: unknown }).parsed ??
    (choice.message.content ? JSON.parse(choice.message.content) : null);

  if (!raw) {
    throw new Error("OpenAI response had no content and no parsed object");
  }

  // Defensive runtime validation
  const parsed = ScoreResponse.parse(raw);

  // Round severity to 1 decimal (matches the DB column: numeric(3,1))
  const severity = Math.round(parsed.severity * 10) / 10;

  return {
    severity,
    reason: parsed.reason,
    hazards: parsed.hazards,
    confidence: parsed.confidence,
    modelVersion: completion.model,
    latencyMs,
  };
}
