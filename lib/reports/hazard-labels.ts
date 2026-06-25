/**
 * Hazard label map — turns the snake_case tokens the AI emits
 * (`trafico_alto`, `carretera_principal`, …) into the Spanish phrases
 * we show to users (`Tráfico alto`, `Carretera principal`, …).
 *
 * Why this lives in its own module:
 *   - The AI returns canonical tokens from HAZARD_VOCABULARY_HINT, but
 *     those tokens are for structure, not user-facing copy. Displaying
 *     `trafico_alto` to a resident would be wrong on every page that
 *     shows hazards (ReportForm success card, PinDetailPanel,
 *     /report/[id], ReportListItem).
 *   - The four render sites all use the same prettify function so the
 *     UX stays consistent. Adding a new hazard = adding one line here
 *     (and one line to HAZARD_VOCABULARY_HINT so the AI knows about it).
 *
 * Coverage: any token not in HAZARD_LABELS falls through to the
 * prettify fallback (turns underscores into spaces, capitalizes words).
 * That keeps the system forward-compatible if the model emits a new
 * token we haven't cataloged yet — users still see something readable.
 *
 * es_PR notes:
 *   - "Tráfico" (with accent) — standard Spanish spelling
 *   - "Múltiples hoyos" (plural) — the hazard describes the situation
 *     around the hoyo, not the hoyo itself
 *   - "Bordes afilados" — describes a property of the hoyo
 *   - "Obscuro / poca luz" — slash is fine in es_PR (and reads more
 *     clearly than "poca iluminación")
 */

const HAZARD_LABELS: Record<string, string> = {
  trafico_alto: "Tráfico alto",
  trafico_bajo: "Tráfico bajo",
  carretera_principal: "Carretera principal",
  calle_residencial: "Calle residencial",
  cerca_escuela: "Cerca de escuela",
  cerca_hospital: "Cerca de hospital",
  en_curva: "En curva",
  obscuro: "Obscuro / poca luz",
  mojado: "Mojado",
  bordes_afilados: "Bordes afilados",
  multiple_hoyos: "Múltiples hoyos",
  senalizado: "Señalizado",
};

/**
 * Prettify a snake_case token into Spanish as a last-resort fallback.
 * Used for hazards the model emits that aren't in the canonical label
 * map (e.g. a new hazard we haven't added yet).
 *
 * Examples:
 *   "trafico_alto" → "Trafico alto"
 *   "senal_de_stop" → "Senal de stop"
 *   "obscuro"       → "Obscuro"
 *   "al_lado_de_un_poste" → "Al lado de un poste"
 *
 * Spanish title-case convention: only the first word is capitalized
 * (proper-noun exceptions aside). This is the opposite of English
 * title case ("Senal De Stop" looks wrong to Spanish readers).
 *
 * Note: this doesn't insert accents (it'd need a Spanish dictionary
 * to know "tráfico" vs "trafico"). For canonical hazards we use
 * HAZARD_LABELS so the user always sees the correctly-accented form.
 */
function prettifyToken(token: string): string {
  const parts = token.split("_").filter((w) => w.length > 0);
  if (parts.length === 0) return "";
  const [first, ...rest] = parts;
  return (
    first[0].toUpperCase() + first.slice(1).toLowerCase() + " " +
    rest.map((w) => w.toLowerCase()).join(" ")
  ).trim();
}

/**
 * Render a hazard token (or free-form Spanish phrase) as user-facing
 * Spanish copy. Always returns a non-empty string.
 *
 * The AI sometimes emits phrases instead of canonical tokens (despite
 * the prompt asking for the vocab list — strict-mode schemas can't
 * constrain *string* content). This function handles both: known
 * tokens get their canonical label, anything else gets the prettify
 * fallback.
 */
export function hazardLabel(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length === 0) return "";
  return HAZARD_LABELS[trimmed] ?? prettifyToken(trimmed);
}

/**
 * Render an array of hazard tokens as a list of labels.
 *   ["trafico_alto", "carretera_principal"] → ["Tráfico alto", "Carretera principal"]
 *
 * Drops empty tokens defensively (the AI shouldn't emit them, but the
 * schema is `minLength: 1` not strict — better to filter at display
 * time than crash a render).
 */
export function hazardLabels(tokens: readonly string[]): string[] {
  return tokens
    .map(hazardLabel)
    .filter((s) => s.length > 0);
}