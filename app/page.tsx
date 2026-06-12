import Link from "next/link";
import { Camera, MapPin, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-background to-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Versión beta · Puerto Rico
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Ayuda a arreglar las{" "}
              <span className="text-primary">calles</span> de Puerto Rico
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
              Toma una foto del bache, confirma tu ubicación, y nuestro sistema
              lo clasifica automáticamente para que las autoridades sepan cuáles
              arreglar primero.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                render={<Link href="/mapa" />}
                className="w-full sm:w-auto"
              >
                <MapPin className="size-4" aria-hidden="true" />
                Ver el mapa
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/reportar" />}
                className="w-full sm:w-auto"
              >
                <Camera className="size-4" aria-hidden="true" />
                Reportar un bache
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Gratis · Sin anuncios · Tus datos se quedan en Puerto Rico
            </p>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-b border-border/40 bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Cómo funciona?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tres pasos. Menos de un minuto. Sin registros complicados.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Camera className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>1. Toma una foto</CardTitle>
                <CardDescription>
                  Usa la cámara de tu teléfono. No necesitas ser fotógrafo &mdash;
                  cualquier foto del bache sirve.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>2. Confirma tu ubicación</CardTitle>
                <CardDescription>
                  Tu teléfono detecta dónde estás. Solo tienes que confirmar.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>3. Nuestra IA lo clasifica</CardTitle>
                <CardDescription>
                  En menos de 5 segundos, el bache aparece en el mapa con una
                  puntuación de severidad del 1 al 10.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Por qué BoketePR */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Por qué BoketePR?
            </h2>
            <div className="mt-8 grid gap-8 text-left sm:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold">Visibilidad real</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Los baches no se arreglan solos. BoketePR pone los baches en
                  un mapa público para que las comunidades y las autoridades
                  vean dónde urge más la reparación.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Clasificación con IA</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No todos los baches son iguales. Nuestra IA analiza cada foto
                  y asigna una severidad del 1 al 10, para que los recursos se
                  usen donde más se necesitan.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Privacidad primero</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No vendemos datos. No mostramos anuncios. Tu información se
                  queda en Puerto Rico.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Hecho en Puerto Rico</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Construido por y para los residentes de Puerto Rico. En
                  español, con las palabras que usamos aquí.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/40 bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Viste un bache hoy?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Tu reporte puede ser el empujón que necesita esa calle para
              arreglarse. Empieza ahora.
            </p>
            <div className="mt-8">
              <Button size="lg" render={<Link href="/reportar" />}>
                <Camera className="size-4" aria-hidden="true" />
                Reportar un bache
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
