import Link from "next/link";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * /map — placeholder for Goal 5.
 *
 * The live Google Map with all reported potholes as colored pins will
 * land in Goal 5. For now, this page exists so the success state from
 * the submit form can link somewhere meaningful.
 */
export default function MapPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-20 sm:px-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <MapPin className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          El mapa llega pronto
        </h1>
        <p className="mt-2 text-muted-foreground">
          Aquí verás todos los hoyos reportados en Puerto Rico, coloreados
          por severidad. Estamos terminando de conectarlo con Google Maps.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            Mientras tanto, puedes:
          </p>
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            <li>Reportar un nuevo hoyo</li>
            <li>Volver a la página principal</li>
            <li>Ver tu perfil y tus reportes enviados</li>
          </ul>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" render={<Link href="/submit" />}>
              Reportar un hoyo
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              render={<Link href="/" />}
            >
              Inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
