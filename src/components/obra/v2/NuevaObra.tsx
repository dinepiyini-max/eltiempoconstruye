import { useEffect, useState } from "react";
import { ModeTabs } from "@/components/obra/ModeTabs";
import { formatInt } from "@/lib/obra/format";
import { hojaPresupuesto } from "@/lib/obra/v2/cost";
import { formatM2, formatMeters, muroLargo, polygonArea, vigaLargo } from "@/lib/obra/v2/geometry";
import { takeoffColumna, takeoffLosa, takeoffMuro, takeoffScene, takeoffViga, takeoffZapata } from "@/lib/obra/v2/quantity";
import { useNueva, type V2Tool } from "@/lib/obra/v2/store";
import { NuevaCanvas } from "./NuevaCanvas";
import { PresupuestoV2 } from "./PresupuestoV2";
import { EjecucionV2 } from "./EjecucionV2";

const SEL_HINT = "SEL · elegir un muro";

export function NuevaObra() {
  const hydrate = useNueva((s) => s.hydrate);
  const flush = useNueva((s) => s.flush);
  const tool = useNueva((s) => s.tool);
  const setTool = useNueva((s) => s.setTool);
  const selectedId = useNueva((s) => s.selectedId);
  const walls = useNueva((s) => s.walls);
  const openings = useNueva((s) => s.openings);
  const columns = useNueva((s) => s.columns);
  const footings = useNueva((s) => s.footings);
  const beams = useNueva((s) => s.beams);
  const slabs = useNueva((s) => s.slabs);
  const draft = useNueva((s) => s.draft);
  const polyDraft = useNueva((s) => s.polyDraft);
  const canUndo = useNueva((s) => s.canUndo);
  const canRedo = useNueva((s) => s.canRedo);
  const undo = useNueva((s) => s.undo);
  const redo = useNueva((s) => s.redo);
  const deleteSelected = useNueva((s) => s.deleteSelected);
  const setDraft = useNueva((s) => s.setDraft);
  const setPolyDraft = useNueva((s) => s.setPolyDraft);
  const zoom = useNueva((s) => s.zoom);
  const hydrated = useNueva((s) => s.hydrated);
  const page = useNueva((s) => s.page);
  const setPage = useNueva((s) => s.setPage);
  const archive = useNueva((s) => s.archive);
  const nuevaLamina = useNueva((s) => s.nuevaLamina);
  const cerrarLamina = useNueva((s) => s.cerrarLamina);
  const clock = useNueva((s) => s.clock);
  const [confirmNueva, setConfirmNueva] = useState(false);

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
        setPolyDraft([]);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (mod) return;
      if (e.key === "+" || e.key === "=") zoom({ x: 200, y: 160 }, 1.15);
      if (e.key === "-" || e.key === "_") zoom({ x: 200, y: 160 }, 0.87);
      const keys: Record<string, V2Tool> = {
        m: "muro",
        1: "muro",
        s: "seleccionar",
        2: "seleccionar",
        p: "puerta",
        3: "puerta",
        v: "ventana",
        4: "ventana",
        c: "columna",
        5: "columna",
        z: "zapata",
        6: "zapata",
        g: "viga",
        7: "viga",
        l: "losa",
        8: "losa",
      };
      const next = keys[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("keydown", onKey);
    };
  }, [flush, undo, redo, deleteSelected, setDraft, setPolyDraft, zoom, setTool]);

  const selectedHueco = openings.find((h) => h.id === selectedId) ?? null;
  const selectedWall =
    walls.find((w) => w.id === selectedId) ??
    (selectedHueco ? (walls.find((w) => w.id === selectedHueco.wallId) ?? null) : null);
  const selectedCol = columns.find((c) => c.id === selectedId) ?? null;
  const selectedZap = footings.find((z) => z.id === selectedId) ?? null;
  const selectedViga = beams.find((v) => v.id === selectedId) ?? null;
  const selectedLosa = slabs.find((l) => l.id === selectedId) ?? null;

  const sceneQty = takeoffScene({ walls, openings, columns, footings, beams, slabs });
  const wallQty = selectedWall ? takeoffMuro(selectedWall, undefined, openings) : null;
  const hoja = hojaPresupuesto(sceneQty, { rework: clock.rework });
  const hasDrawing = walls.length + openings.length + columns.length + footings.length + beams.length + slabs.length > 0;

  const cota = draft
    ? formatMeters(muroLargo(draft))
    : polyDraft.length >= 3
      ? formatM2(polygonArea(polyDraft))
      : selectedHueco
        ? formatMeters(selectedHueco.ancho)
        : selectedWall
          ? formatMeters(muroLargo(selectedWall))
          : selectedViga
            ? formatMeters(vigaLargo(selectedViga))
            : selectedLosa
              ? formatM2(polygonArea(selectedLosa.poly))
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
          : tool === "columna"
            ? "Clic — columna 0.30 × 0.30 m."
            : tool === "zapata"
              ? "Clic — zapata 0.80 × 0.80 m. Cerca de columna, queda debajo."
              : tool === "viga"
                ? "Clic, clic o arrastra. Snap horz / vert."
                : tool === "losa"
                  ? "Arrastra un rectángulo, o 3+ clics y cierra en el primero."
                  : "Clic, clic — o arrastra. Snap: horz / vert / esquina.";

  const panelTitle = selectedHueco
    ? selectedHueco.id
    : selectedWall
      ? selectedWall.id
      : selectedCol
        ? selectedCol.id
        : selectedZap
          ? selectedZap.id
          : selectedViga
            ? selectedViga.id
            : selectedLosa
              ? selectedLosa.id
              : walls.length || columns.length || footings.length || beams.length || slabs.length
                ? "OBRA"
                : "MURO";

  const blocksNow = wallQty ? wallQty.blocksEst : sceneQty.blocksEst;
  const blocksDelta = wallQty && selectedWall
    ? wallQty.blocksEst - takeoffMuro(selectedWall, undefined, []).blocksEst
    : sceneQty.blocksDelta;
  const hormigon = selectedCol
    ? takeoffColumna(selectedCol).hormigonM3
    : selectedZap
      ? takeoffZapata(selectedZap).hormigonM3
      : selectedViga
        ? takeoffViga(selectedViga).hormigonM3
        : selectedLosa
          ? takeoffLosa(selectedLosa).hormigonM3
          : wallQty
            ? wallQty.hormigonM3
            : sceneQty.hormigonM3;
  const acero = selectedCol
    ? takeoffColumna(selectedCol).aceroT
    : selectedZap
      ? takeoffZapata(selectedZap).aceroT
      : selectedViga
        ? takeoffViga(selectedViga).aceroT
        : selectedLosa
          ? takeoffLosa(selectedLosa).aceroT
          : wallQty
            ? wallQty.aceroT
            : sceneQty.aceroT;
  const losaM2 = selectedLosa ? takeoffLosa(selectedLosa).areaM2 : sceneQty.losaM2;
  const largo = selectedViga ? takeoffViga(selectedViga).largoM : wallQty ? wallQty.largoM : sceneQty.largoM;
  const areaNeta = wallQty ? wallQty.areaNetaM2 : sceneQty.areaNetaM2;

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-paper text-ink" data-obra="nueva">
      <ModeTabs current="nueva" />
      <header className="relative z-20 shrink-0 border-b border-rule/80 bg-paper px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-semibold tracking-[0.18em] text-ink sm:text-4xl">OBRA</h1>
              <span className="stamp stamp-flat shrink-0 px-2.5 py-1.5 text-[0.62rem] tracking-[0.14em]">
                NUEVA OBRA
              </span>
            </div>
            <p className="small-caps mt-0.5 text-[0.55rem] tracking-[0.12em] text-cyan">
              Terreno vacío · estructura mínima · no es el Valle del Yuna
            </p>
            <p className="mt-0.5 max-w-xl font-serif text-sm italic text-ink-soft">
              El tiempo construye. Aquí se traza, se mide y se guarda.
            </p>
          </div>
        </div>
        <nav
          data-v2-nav
          className="mt-2 flex flex-wrap items-center gap-1 border-t border-rule/60 pt-2"
          aria-label="Hojas V2"
        >
          <ToolBtn on={page === "lamina"} onClick={() => setPage("lamina")} label="LÁMINA" />
          <ToolBtn on={page === "presupuesto"} onClick={() => setPage("presupuesto")} label="PRESUPUESTO" />
          <ToolBtn on={page === "ejecucion"} onClick={() => setPage("ejecucion")} label="EJECUCIÓN" />
          <span className="mx-1 hidden h-4 w-px bg-rule/80 sm:inline-block" />
          <ToolBtn on={false} onClick={() => setConfirmNueva(true)} label="NUEVA LÁMINA" />
          <ToolBtn on={false} onClick={() => cerrarLamina()} label="CERRAR LÁMINA" disabled={!hasDrawing} />
        </nav>
        {confirmNueva ? (
          <div
            data-confirm-nueva
            className="mt-2 flex flex-wrap items-center gap-2 border border-ink/30 bg-paper px-3 py-2"
          >
            <p className="font-serif text-sm italic text-ink">¿Borrar el plano V2? El Valle no se toca.</p>
            <ToolBtn
              on={false}
              onClick={() => {
                nuevaLamina();
                setConfirmNueva(false);
              }}
              label="BORRAR PLANO"
            />
            <ToolBtn on={false} onClick={() => setConfirmNueva(false)} label="NO" />
          </div>
        ) : null}
        {page === "lamina" ? (
          <>
            <div data-tools className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-rule/60 pt-2">
              <ToolBtn on={tool === "muro"} onClick={() => setTool("muro")} label="MURO" />
              <ToolBtn
                on={tool === "seleccionar"}
                onClick={() => setTool("seleccionar")}
                label="SEL · elegir un muro"
                title={SEL_HINT}
              />
              <ToolBtn on={tool === "puerta"} onClick={() => setTool("puerta")} label="PUERTA" title="Clic en un muro" />
              <ToolBtn on={tool === "ventana"} onClick={() => setTool("ventana")} label="VENTANA" title="Clic en un muro" />
            </div>
            <div data-tools-struct className="flex flex-wrap items-center gap-x-1 gap-y-1">
              <ToolBtn on={tool === "columna"} onClick={() => setTool("columna")} label="COLUMNA" />
              <ToolBtn on={tool === "zapata"} onClick={() => setTool("zapata")} label="ZAPATA" />
              <ToolBtn on={tool === "viga"} onClick={() => setTool("viga")} label="VIGA" />
              <ToolBtn on={tool === "losa"} onClick={() => setTool("losa")} label="LOSA" />
            </div>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
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
              ) : null}
            </div>
            <p data-hint className="mt-1 font-serif text-xs italic text-ink-soft">
              {hint}
            </p>
          </>
        ) : page === "ejecucion" ? (
          <p className="mt-2 font-serif text-xs italic text-ink-soft">
            Este reloj es de esta lámina. El río no corre aquí.
          </p>
        ) : (
          <p className="mt-2 font-serif text-xs italic text-ink-soft">El costo sigue al plano. Vuelve a LÁMINA para dibujar.</p>
        )}
      </header>

      {page === "presupuesto" ? (
        <PresupuestoV2
          hoja={hoja}
          archive={archive}
          abierta={
            hasDrawing
              ? {
                  id: "ABIERTA",
                  closedAt: "",
                  largoMuroM: walls.reduce((n, m) => n + muroLargo(m), 0),
                  losaM2: sceneQty.losaM2,
                  estimado: hoja.total,
                  estado: "abierta" as const,
                  recuento: {
                    muros: walls.length,
                    vanos: openings.length,
                    columnas: columns.length,
                    zapatas: footings.length,
                    vigas: beams.length,
                    losas: slabs.length,
                  },
                }
              : null
          }
        />
      ) : page === "ejecucion" ? (
        <EjecucionV2 />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
          <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            {hydrated ? <NuevaCanvas /> : <div className="h-full w-full bg-paper" />}
          </main>
          <aside className="max-h-[38vh] shrink-0 overflow-y-auto border-t border-rule/80 bg-paper px-4 py-3 md:max-h-none md:w-72 md:border-l md:border-t-0">
            <p className="small-caps text-[0.62rem] text-cyan">Cantidad</p>
            <h2 className="font-serif text-2xl text-ink">{panelTitle}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-1">
              <QtyBig k="Longitud" v={formatMeters(largo)} />
              <QtyBig k="Área neta" v={formatM2(areaNeta)} />
              <QtyBig
                k="Blocks"
                v={String(blocksNow)}
                sub={blocksDelta < 0 ? `−${-blocksDelta} blocks` : undefined}
              />
              <QtyBig k="Hormigón" v={`${hormigon.toFixed(2)} m³`} />
              <QtyBig k="Acero est." v={`${acero.toFixed(2)} t`} />
              {losaM2 > 0 ? <QtyBig k="Losa" v={formatM2(losaM2)} /> : null}
            </dl>
            <p className="mt-4 small-caps text-[0.55rem] text-ink-soft">Estimado RD$</p>
            <p className="font-sans text-3xl tabular-nums leading-none text-ink" data-cost>
              {formatInt(hoja.total)}
            </p>
            <p className="mt-1 font-serif text-xs italic text-ink-soft">simulación, no cotización</p>
          </aside>
        </div>
      )}
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
      data-tool={label.split(" · ")[0]?.toLowerCase()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`small-caps min-h-11 px-2.5 text-[0.68rem] tracking-[0.12em] ${
        on ? "border-b-2 border-rust text-ink" : "text-ink"
      } disabled:text-faint`}
    >
      {label}
    </button>
  );
}

function QtyBig({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <dt className="small-caps text-[0.62rem] text-ink-soft">{k}</dt>
      <dd className="font-sans text-3xl tabular-nums leading-none tracking-tight text-ink">{v}</dd>
      {sub ? (
        <p data-blocks-delta className="mt-1 text-base font-medium tabular-nums text-rust">
          {sub}
        </p>
      ) : null}
    </div>
  );
}