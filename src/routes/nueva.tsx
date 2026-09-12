import { createFileRoute } from "@tanstack/react-router";
import { NuevaObra } from "@/components/obra/v2/NuevaObra";

export const Route = createFileRoute("/nueva")({
  component: NuevaObra,
});
