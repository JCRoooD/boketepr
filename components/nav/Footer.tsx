import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} BoketePR. Hecho con cariño para
          Puerto Rico.
        </p>
        <nav className="flex items-center gap-6">
          <Link
            href="/acerca-de"
            className="hover:text-foreground transition-colors"
          >
            Acerca de
          </Link>
          <Link
            href="/privacidad"
            className="hover:text-foreground transition-colors"
          >
            Privacidad
          </Link>
          <a
            href="https://github.com/JCRoooD/boketepr"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
