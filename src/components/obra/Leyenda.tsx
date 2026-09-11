import { useState } from "react";

/** 6 símbolos. Colapsable. No es un diccionario. */
export function Leyenda() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto max-w-[14rem] border border-ink/20 bg-paper/95 px-2 py-1 shadow-sheet">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="small-caps min-h-11 w-full text-left text-[0.52rem] tracking-[0.16em] text-ink"
      >
        {open ? "LEYENDA ▾" : "LEYENDA ▸"}
      </button>
      {open ? (
        <ul className="space-y-1 border-t border-rule/70 pb-1 pt-2 font-serif text-xs leading-snug text-ink">
          <li>CAMINO · PUENTE · MURO — frentes del pliego</li>
          <li>Bandera — frente abierto</li>
          <li>Círculos — cuadrilla en el frente</li>
          <li>Punteado → continuo → doble — etapa</li>
          <li>Cian ancho — zona de inundación</li>
          <li>Sello TURNO / SIEMPRE — régimen</li>
          <li>Óxido en ficha — cuello (lo que hoy frena el frente)</li>
        </ul>
      ) : null}
    </div>
  );
}
