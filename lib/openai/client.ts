import OpenAI from "openai";

/**
 * Lazy OpenAI client.
 *
 * The first call to `getOpenAIClient()` reads `OPENAI_API_KEY` from the
 * environment and constructs a singleton client. Subsequent calls reuse it.
 *
 * Throws a clear error if the key is missing — better than failing deep
 * inside a 10s-deep fetch chain.
 *
 * Server-only: importing this file in a client component will bundle the
 * OpenAI SDK into the browser. We never do that — only /api/reports and
 * scripts/ import from this folder.
 */
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local (local dev) and " +
        "Vercel project → Settings → Environment Variables (deployment).",
    );
  }

  client = new OpenAI({ apiKey });
  return client;
}

/**
 * Test if the client can be constructed (env var present) without making
 * a network call. Useful for boot-time sanity checks in API routes.
 */
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
