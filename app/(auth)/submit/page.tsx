import { ReportForm } from "@/components/report/ReportForm";

/**
 * /submit — protected by middleware (auth required).
 *
 * A logged-in user reports a pothole by uploading a photo, confirming
 * location, optionally writing a one-line comment, and hitting submit.
 * The result row gets severity=5.0 (placeholder) until Goal 4 wires
 * up OpenAI gpt-4o Vision.
 */
export default function SubmitPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Reportar un hoyo
        </h1>
        <p className="mt-2 text-muted-foreground">
          Toma una foto, confirma dónde está, y nuestro sistema se encarga
          del resto. Tu reporte ayuda a que las autoridades prioricen las
          reparaciones.
        </p>
      </div>

      <ReportForm />
    </div>
  );
}
