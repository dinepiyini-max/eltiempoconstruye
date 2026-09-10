import { createFileRoute } from "@tanstack/react-router";
import { ObraApp } from "@/components/obra/shell";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({
    modo: s.modo === "visita" ? ("visita" as const) : undefined,
  }),
  component: Home,
});

function Home() {
  const { modo } = Route.useSearch();
  return <ObraApp slot={modo === "visita" ? "visita" : "jefe"} />;
}
