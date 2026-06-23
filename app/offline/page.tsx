import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WifiOff } from "lucide-react";

/**
 * Offline fallback page — served by the service worker when the user is
 * disconnected AND the requested page isn't in the cache.
 *
 * Static (no DB calls, no server-side auth) so the SW can always serve it
 * directly from the cache.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="size-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Sin conexión</h1>
      <p className="mt-3 text-balance text-sm text-muted-foreground">
        No tenemos internet ahora mismo. Si ya abriste el mapa antes, puedes
        intentar la última versión en caché. Para reportar un hoyo nuevo
        necesitas conexión.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button render={<Link href="/map" />}>Ver mapa en caché</Button>
        <Button variant="outline" render={<Link href="/" />}>
          Volver al inicio
        </Button>
      </div>
    </section>
  );
}