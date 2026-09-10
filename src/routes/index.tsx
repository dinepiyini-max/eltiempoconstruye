import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/obra/AppShell";

type Search = { modo?: "visita" };

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    modo: raw.modo === "visita" ? "visita" : undefined,
  }),
  component: Home,
});

function Home() {
  const { modo } = Route.useSearch();
  return <AppShell slot={modo === "visita" ? "visita" : "jefe"} />;
}
