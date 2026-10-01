import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 text-center">
      <div>
        <p className="font-display text-4xl font-semibold">404</p>
        <p className="mt-2 text-sm text-muted-foreground">A página solicitada não existe.</p>
        <Link className="mt-4 inline-block text-sm text-primary underline" to="/dashboard">Voltar à visão geral</Link>
      </div>
    </main>
  );
}
