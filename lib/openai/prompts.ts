/**
 * Pothole-scoring prompts.
 *
 * Kept separate from score-pothole.ts so the prompt builders are pure
 * functions — easy to unit test, easy to iterate on copy without
 * touching the API call.
 *
 * Output shape is enforced by OpenAI structured output (json_schema +
 * strict mode), so the model literally cannot return a malformed object.
 */

export const HAZARD_VOCABULARY_HINT =
  "trafico_alto, trafico_bajo, carretera_principal, calle_residencial, " +
  "cerca_escuela, cerca_hospital, en_curva, obscuro, mojado, " +
  "bordes_afilados, multiple_hoyos, senalizado";

/**
 * System prompt — the model's "job description".
 * Spanish (es_PR dialect), conservative scoring, 1-10 scale.
 */
export const SYSTEM_PROMPT = `Eres un asistente que evalúa la severidad de hoyos en las carreteras de Puerto Rico para una aplicación cívica llamada BoketePR. Tu trabajo es mirar una foto de un hoyo reportado por un ciudadano y asignar una severidad de 1.0 a 10.0.

ESCALA (úsala como guía, no como regla rígida):
- 1.0–2.5: defecto menor, superficial, no afecta el manejo. Ej.: grieta, hundimiento leve.
- 3.0–4.5: hoyo pequeño, leve incomodidad al pasar. Ej.: hundimiento de 2-5 cm de profundidad.
- 5.0–6.5: hoyo moderado, requiere reducir velocidad. Ej.: hundimiento de 5-10 cm, afecta varios carriles.
- 7.0–8.5: hoyo significativo, puede dañar neumáticos o suspensión. Ej.: 10-20 cm de profundidad, bordes afilados.
- 9.0–10.0: hoyo peligroso, riesgo de accidente o daño serio al vehículo. Ej.: muy profundo (>20 cm), ancho, en zona de mucho tráfico, cerca de una escuela u hospital.

FACTORES A CONSIDERAR (en orden de importancia):
1. Profundidad: el factor más importante. Un hoyo superficial es mucho menos severo que uno profundo.
2. Tamaño (diámetro): hoyos grandes son más riesgosos.
3. Contexto de tráfico: un hoyo en una calle residencial tranquila es menos severo que el mismo hoyo en una autopista o carretera principal.
4. Entorno: zonas escolares, hospitales, curvas ciegas, baja visibilidad = más severo.
5. Condiciones observables: agua acumulada (el hoyo podría ser más profundo de lo que se ve), bordes afilados, vehículos dañados cerca.

HAZARDS (lista corta, en español, separadas por coma, vocabulario sugerido: ${HAZARD_VOCABULARY_HINT}):
- Solo incluye hazards que puedas observar en la foto. Si la foto no muestra evidencia clara, devuelve [].

INSTRUCCIONES DE RESPUESTA:
- severity: número entre 1.0 y 10.0, con un decimal. Sé conservador: si dudas entre dos valores, usa el menor.
- reason: 1-2 oraciones cortas en español de Puerto Rico, máximo 200 caracteres. Explica el puntaje (ej. "Hoyo profundo de unos 15 cm con bordes afilados, en zona de mucho tráfico.").
- confidence: 0.0 a 1.0. Si la foto está borrosa, oscura, o no muestra claramente un hoyo, usa <0.5.
- Si la foto NO muestra un hoyo (muestra un perro, un paisaje, una acera en buen estado), devuelve severity=1.0, reason="La foto no muestra un hoyo.", confidence=0.9, hazards=[].

Devuelve SOLO el JSON con la estructura indicada. No incluyas texto fuera del JSON.`;

export interface PotholeInput {
  photoUrl: string;
  lat: number;
  lng: number;
  userComment: string | null;
}

/**
 * User-message content (multi-part: text + image).
 * OpenAI Vision accepts a public URL for the image; it fetches the
 * image server-side. No need for us to download the JPEG.
 */
export function buildUserMessage(input: PotholeInput): {
  text: string;
  imageUrl: string;
} {
  const comment = input.userComment?.trim();
  const commentLine = comment
    ? `\nComentario del ciudadano: "${comment}"`
    : "\nComentario del ciudadano: (ninguno)";

  const text =
    `Hoyo reportado en Puerto Rico.\n` +
    `Ubicación: lat=${input.lat.toFixed(4)}, lng=${input.lng.toFixed(4)}.` +
    commentLine +
    `\nEvalúa la severidad según la escala y devuelve el JSON.`;

  return { text, imageUrl: input.photoUrl };
}

/**
 * Strict JSON schema enforced by OpenAI structured output.
 *
 * Rules for strict mode (enforced by OpenAI):
 *   - `additionalProperties: false` on every object
 *   - every property listed in `properties` must be in `required`
 *   - all fields are required (use `["string", "null"]` for optionals)
 */
export const SCORE_SCHEMA = {
  type: "object" as const,
  properties: {
    severity: {
      type: "number",
      minimum: 1.0,
      maximum: 10.0,
      description: "Puntaje de severidad de 1.0 (cosmético) a 10.0 (peligroso).",
    },
    reason: {
      type: "string",
      minLength: 10,
      maxLength: 300,
      description: "Razón en español de Puerto Rico, 1-2 oraciones cortas.",
    },
    hazards: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 60 },
      description:
        "Lista corta de hazards observables (vocabulario sugerido en el system prompt).",
    },
    confidence: {
      type: "number",
      minimum: 0.0,
      maximum: 1.0,
      description: "0.0 = muy inseguro, 1.0 = muy seguro del puntaje.",
    },
  },
  required: ["severity", "reason", "hazards", "confidence"],
  additionalProperties: false,
} as const;
