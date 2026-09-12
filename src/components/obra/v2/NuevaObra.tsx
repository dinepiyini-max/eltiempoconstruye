import { useEffect } from "react";
import { ModeTabs } from "@/components/obra/ModeTabs";
import { formatInt } from "@/lib/obra/format";
import { presupuesto } from "@/lib/obra/v2/cost";
import { formatM2, formatMeters, muroLargo } from "@/lib/obra/v2/geometry";
import { takeoffAsCost, takeoffMuro, takeoffMuros } from "@/lib/obra/v2/quantity";
import { useNueva } from "@/lib/obra/v2/store";
import { NuevaCanvas } from "./NuevaCanvas";

const SEL_HINT = "SEL · elegir un muro";

export function NuevaObra() {
  const hydrate = useNueva((s) => s.hydrate);
  const flush = useNueva((s) => s.flush);
  const tool = useNueva((s) => s.tool);
  const setTool = useNueva((s) => s.setTool);
  const selectedId = useNueva((s) => s.selectedId);
  const walls = useNueva((s) => s.walls);
  const openings = useNueva((s) => s.openings);
  const draft = useNueva((s) => s.draft);
  const canUndo = useNueva((s) => s.canUndo);
  const canRedo = useNueva((s) => s.canRedo);
  const undo = useNueva((s) => s.undo);
  const redo = useNueva((s) => s.redo);
  const deleteSelected = useNueva((s) => s.deleteSelected);
  const setDraft = useNueva((s) => s.setDraft);
  const zoom = useNueva((s) => s.zoom);
  const hydrated = useNueva((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Escape") {
        setDraft(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === "+" || e.key === "=") zoom({ x: 200, y: 160 }, 1.15);
      if (e.key === "-" || e.key === "_") zoom({ x: 200, y: 160 }, 0.87);
      if (e.key === "m" || e.key === "M" || e.key === "1") setTool("muro");
      if (e.key === "s" || e.key === "S" || e.key === "2") setTool("seleccionar");
      if (e.key === "p" || e.key === "P" || e.key === "3") setTool("puerta");
      if (e.key === "v" || e.key === "V" || e.key === "4") setTool("ventana");
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("keydown", onKey);
    };
  }, [flush, undo, redo, deleteSelected, setDraft, zoom, setTool]);

  const selectedHueco = openings.find((h) => h.id === selectedId) ?? null;
  const selectedWall =
    walls.find((w) => w.id === selectedId) ??
    (selectedHueco ? (walls.find((w) => w.id === selectedHueco.wallId) ?? null) : null);
  const qty = selectedWall ? takeoffMuro(selectedWall, undefined, openings) : takeoffMuros(walls, undefined, openings);
  const cost = presupuesto(takeoffAsCost(qty));
  const cota = draft
    ? formatMeters(muroLargo(draft))
    : selectedHueco
      ? formatMeters(selectedHueco.ancho)
      : selectedWall
        ? formatMeters(muroLargo(selectedWall))
        : null;
  const snapLabel =
    draft?.kind === "horizontal" ? "HORZ" : draft?.kind === "vertical" ? "VERT" : draft?.kind === "esquina" ? "ESQ" : null;

  const hint =
    tool === "seleccionar"
      ? SEL_HINT
      : tool === "puerta"
        ? "Clic en un muro para la puerta."
        : tool === "ventana"
          ? "Clic en un muro para la ventana."
          : "Clic, clic — o arrastra. Snap: horz / vert / esquina.";

  const panelTitle = selectedHueco
    ? selectedHueco.id
    : selectedWall
      ? selectedWall.id
      : walls.length
        ? "MUROS"
        : "MURO";

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-paper text-ink" data-obra="nueva">
      <ModeTabs current="nueva" />
      <header className="relative z-20 border-b border-rule/80 bg-paper/90 px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-semibold tracking-[0.18em] text-ink sm:text-4xl">OBRA</h1>
              <span className="stamp stamp-flat shrink-0 px-2.5 py-1.5 text-[0.62rem] tracking-[0.14em]">
                NUEVA OBRA
              </span>
            </div>
            <p className="small-caps mt-0.5 text-[0.55rem] tracking-[0.12em] text-cyan">
              Terreno vacío · muros medidos · no es el Valle del Yuna
            </p>
            <p className="mt-0.5 max-w-xl font-serif text-sm italic text-ink-soft">
              El tiempo construye. Aquí se traza, se mide y se guarda.
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rule/60 pt-2">
          <ToolBtn on={tool === "muro"} onClick={() => setTool("muro")} label="MURO" />
          <ToolBtn
            on={tool === "seleccionar"}
            onClick={() => setTool("seleccionar")}
            label="SEL"
            title={SEL_HINT}
          />
          <ToolBtn
            on={tool === "puerta"}
            onClick={() => setTool("puerta")}
            label="PUERTA"
            title="Clic en un muro"
          />
          <ToolBtn
            on={tool === "ventana"}
            onClick={() => setTool("ventana")}
            label="VENTANA"
            title="Clic en un muro"
          />
          <ToolBtn on={false} onClick={deleteSelected} label="BORRAR" disabled={!selectedId} />
          <ToolBtn on={false} onClick={undo} label="DESHACER" disabled={!canUndo} />
          <ToolBtn on={false} onClick={redo} label="REHACER" disabled={!canRedo} />
          <ToolBtn on={false} onClick={() => zoom({ x: 240, y: 180 }, 1.15)} label="+" />
          <ToolBtn on={false} onClick={() => zoom({ x: 240, y: 180 }, 0.87)} label="−" />
          {cota ? (
            <span data-cota className="small-caps ml-2 text-[0.7rem] tabular-nums text-cyan">
              {cota}
              {snapLabel ? ` · ${snapLabel}` : ""}
            </span>
          ) : (
            <span className="font-serif text-xs italic text-ink-soft">{hint}</span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        <main className="relative min-h-[52vh] min-w-0 flex-1 overflow-hidden md:min-h-0">
          {hydrated ? <NuevaCanvas /> : <div className="h-full w-full bg-paper" />}
        </main>
        <aside className="shrink-0 border-t border-rule/80 bg-paper px-4 py-3 md:w-64 md:border-l md:border-t-0">
          <p className="small-caps text-[0.55rem] text-cyan">Cantidad</p>
          <h2 className="font-serif text-2xl text-ink">{panelTitle}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-1">
            <Qty k="Longitud" v={formatMeters(qty.largoM)} />
            <Qty k="Área" v={formatM2(qty.areaNetaM2)} />
            {qty.vanoM2 > 0 ? <Qty k="Vanos" v={formatM2(qty.vanoM2)} /> : null}
            <Qty k="Blocks est." v={String(qty.blocksEst)} />
            <Qty k="Hormigón" v={`${qty.hormigonM3.toFixed(2)} m³`} />
          </dl>
          <p className="mt-3 small-caps text-[0.55rem] text-ink-soft">Est. · una línea</p>
          <p className="font-sans text-sm tabular-nums text-ink" data-cost>
            {formatInt(cost.total)}
          </p>
          <p className="mt-4 font-serif text-xs italic leading-snug text-ink-soft">
            Geometría → cantidad. Sin pliego Q50. F5 conserva esta lámina en su propia caja.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ToolBtn({
  on,
  onClick,
  label,
  disabled,
  title,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`small-caps min-h-11 px-2 text-[0.62rem] ${
        on ? "border-b border-rust text-ink" : "text-ink-soft"
      } disabled:text-faint`}
    >
      {label}
    </button>
  );
}

function Qty({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="small-caps text-[0.55rem] text-ink-soft">{k}</dt>
      <dd className="tabular-nums text-ink">{v}</dd>
    </div>
  );
}
