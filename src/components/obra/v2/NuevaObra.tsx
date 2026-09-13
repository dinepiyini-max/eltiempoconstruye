import { useEffect, useState } from "react";
import { ModeTabs } from "@/components/obra/ModeTabs";
import { formatInt } from "@/lib/obra/format";
import { hojaPresupuesto, piezasDeEscena } from "@/lib/obra/v2/cost";
import { formatM2, formatMeters, muroLargo, parseMeters, polygonArea, vigaLargo } from "@/lib/obra/v2/geometry";
import { laminaAbierta } from "@/lib/obra/v2/clock";
import { panelCantidad, type PanelCantidad } from "@/lib/obra/v2/panel";
import { takeoffScene } from "@/lib/obra/v2/quantity";
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
  const actualizarPlaca = useNueva((s) => s.actualizarPlaca);
  const reabrirPlaca = useNueva((s) => s.reabrirPlaca);
  const select = useNueva((s) => s.select);
  const setMuroLargo = useNueva((s) => s.setMuroLargo);
  const setLosaArea = useNueva((s) => s.setLosaArea);
  const clock = useNueva((s) => s.clock);
  const [confirmNueva, setConfirmNueva] = useState(false);
  const [confirmAbrir, setConfirmAbrir] = useState<string | null>(null);
  const [largoTxt, setLargoTxt] = useState("");
  const [areaTxt, setAreaTxt] = useState("");

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
        setConfirmNueva(false);
        setConfirmAbrir(null);
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
  const selectedViga = beams.find((v) => v.id === selectedId) ?? null;
  const selectedLosa = slabs.find((l) => l.id === selectedId) ?? null;

  const sceneQty = takeoffScene({ walls, openings, columns, footings, beams, slabs });
  const panel = panelCantidad({ walls, openings, columns, footings, beams, slabs }, selectedId);
  const hoja = hojaPresupuesto(sceneQty, { rework: clock.rework });
  const piezas = piezasDeEscena({ walls, openings, columns, footings, beams, slabs });
  const hasDrawing = walls.length + openings.length + columns.length + footings.length + beams.length + slabs.length > 0;
  const enCurso = laminaAbierta(clock);
  const canCerrar = hasDrawing && enCurso;
  const canActualizar = hasDrawing && !enCurso && !!clock.placaId;

  useEffect(() => {
    if (panel.kind === "muro" && panel.largo != null) setLargoTxt(panel.largo.toFixed(2));
    if (panel.kind === "losa" && panel.losaM2 != null) setAreaTxt(panel.losaM2.toFixed(2));
  }, [panel.kind, panel.title, panel.largo, panel.losaM2]);

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

  const tryAbrir = (id: string) => {
    const r = reabrirPlaca(id);
    if (r === "confirm") setConfirmAbrir(id);
  };

  const commitLargo = () => {
    if (panel.kind !== "muro" || !selectedId) return;
    const n = parseMeters(largoTxt);
    if (n == null) {
      if (panel.largo != null) setLargoTxt(panel.largo.toFixed(2));
      return;
    }
    setMuroLargo(selectedId, n);
  };

  const commitArea = () => {
    if (panel.kind !== "losa" || !selectedId) return;
    const n = parseMeters(areaTxt);
    if (n == null) {
      if (panel.losaM2 != null) setAreaTxt(panel.losaM2.toFixed(2));
      return;
    }
    setLosaArea(selectedId, n);
  };

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
          data-lamina={enCurso ? "abierta" : "cerrada"}
          className="mt-2 flex flex-wrap items-center gap-1 border-t border-rule/60 pt-2"
          aria-label="Hojas V2"
        >
          <ToolBtn on={page === "lamina"} onClick={() => setPage("lamina")} label="LÁMINA" />
          <ToolBtn on={page === "presupuesto"} onClick={() => setPage("presupuesto")} label="PRESUPUESTO" />
          <ToolBtn on={page === "ejecucion"} onClick={() => setPage("ejecucion")} label="EJECUCIÓN" />
          <span className="mx-1 hidden h-4 w-px bg-rule/80 sm:inline-block" />
          <ToolBtn on={false} onClick={() => setConfirmNueva(true)} label="NUEVA LÁMINA" />
          <ToolBtn on={false} onClick={() => cerrarLamina()} label="CERRAR LÁMINA" disabled={!canCerrar} />
          <ToolBtn
            on={false}
            onClick={() => actualizarPlaca()}
            label="ACTUALIZAR PLACA"
            disabled={!canActualizar}
          />
        </nav>
        {confirmNueva ? (
          <div
            data-confirm-nueva
            className="mt-2 flex flex-col gap-2 border border-ink/30 bg-paper px-3 py-2"
          >
            <p className="font-serif text-sm text-ink">¿Empezar lámina nueva?</p>
            <p className="font-serif text-sm italic text-ink-soft">
              Se limpia el tablero. Las placas ya cerradas se quedan en Archivo.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ToolBtn on={false} onClick={() => setConfirmNueva(false)} label="Seguir aquí" />
              <ToolBtn
                on={false}
                onClick={() => {
                  nuevaLamina();
                  setConfirmNueva(false);
                }}
                label="Nueva lámina"
              />
            </div>
          </div>
        ) : null}
        {confirmAbrir ? (
          <div
            data-confirm-abrir
            className="mt-2 flex flex-col gap-2 border border-ink/30 bg-paper px-3 py-2"
          >
            <p className="font-serif text-sm text-ink">¿Abrir {confirmAbrir}? Hay un dibujo sin cerrar.</p>
            <p className="font-serif text-sm italic text-ink-soft">
              Se limpia el tablero en curso. Las placas se quedan en Archivo.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ToolBtn on={false} onClick={() => setConfirmAbrir(null)} label="Seguir aquí" />
              <ToolBtn
                on={false}
                onClick={() => {
                  reabrirPlaca(confirmAbrir, { force: true });
                  setConfirmAbrir(null);
                }}
                label="Abrir placa"
              />
            </div>
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
          piezas={piezas}
          archive={archive}
          enCurso={enCurso}
          onAbrir={tryAbrir}
          onPieza={(id) => {
            select(id);
            setTool("seleccionar");
            setPage("lamina");
          }}
        />
      ) : page === "ejecucion" ? (
        <EjecucionV2 />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
          <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            {hydrated ? <NuevaCanvas /> : <div className="h-full w-full bg-paper" />}
          </main>
          <aside
            className="max-h-[38vh] shrink-0 overflow-y-auto border-t border-rule/80 bg-paper px-4 py-3 md:max-h-none md:w-72 md:border-l md:border-t-0"
            data-cantidad
            data-kind={panel.kind}
          >
            <p className="small-caps text-[0.62rem] text-cyan">Cantidad</p>
            <h2 className="font-serif text-2xl text-ink">{panel.title}</h2>
            <dl key={`${panel.kind}:${panel.title}`} className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-1">
              <PanelFields
                panel={panel}
                largoTxt={largoTxt}
                onLargoTxt={setLargoTxt}
                onLargoCommit={commitLargo}
                areaTxt={areaTxt}
                onAreaTxt={setAreaTxt}
                onAreaCommit={commitArea}
              />
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

function PanelFields({
  panel,
  largoTxt,
  onLargoTxt,
  onLargoCommit,
  areaTxt,
  onAreaTxt,
  onAreaCommit,
}: {
  panel: PanelCantidad;
  largoTxt: string;
  onLargoTxt: (v: string) => void;
  onLargoCommit: () => void;
  areaTxt: string;
  onAreaTxt: (v: string) => void;
  onAreaCommit: () => void;
}) {
  if (panel.kind === "muro") {
    return (
      <>
        <MedidaEdit
          k="Longitud"
          unit="m"
          value={largoTxt}
          onChange={onLargoTxt}
          onCommit={onLargoCommit}
          dataAttr="data-largo-edit"
          ariaLabel="Largo del muro en metros"
        />
        <QtyBig k="Alto" v={dash(panel.alto, formatMeters)} />
        <QtyBig k="Hiladas" v={panel.hiladas == null ? "—" : String(panel.hiladas)} />
        <QtyBig k="Área neta" v={dash(panel.areaNeta, formatM2)} />
        <QtyBig
          k="Blocks"
          v={panel.blocks == null ? "—" : String(panel.blocks)}
          sub={panel.blocks != null && panel.blocksDelta < 0 ? `−${-panel.blocksDelta} blocks` : undefined}
        />
        <QtyBig k="Vanos" v={panel.vanos == null ? "—" : String(panel.vanos)} />
        <QtyBig k="Hormigón" v={dash(panel.hormigonM3, (n) => `${n.toFixed(2)} m³`)} />
        <QtyBig k="Acero est." v={dash(panel.aceroT, (n) => `${n.toFixed(2)} t`)} />
      </>
    );
  }
  if (panel.kind === "losa") {
    return (
      <>
        <QtyBig k="Longitud" v="—" />
        <QtyBig k="Blocks" v="—" />
        <MedidaEdit
          k="Losa"
          unit="m²"
          value={areaTxt}
          onChange={onAreaTxt}
          onCommit={onAreaCommit}
          dataAttr="data-area-edit"
          ariaLabel="Área de la losa en metros cuadrados"
        />
        <QtyBig k="Espesor" v={dash(panel.espesor, formatMeters)} />
        <QtyBig k="Hormigón" v={dash(panel.hormigonM3, (n) => `${n.toFixed(2)} m³`)} />
        <QtyBig k="Acero est." v={dash(panel.aceroT, (n) => `${n.toFixed(2)} t`)} />
      </>
    );
  }
  if (panel.kind === "hueco") {
    return (
      <>
        <QtyBig k="Ancho" v={dash(panel.huecoAncho, formatMeters)} />
        <QtyBig k="Muro padre" v={panel.parentWallId ?? "—"} />
        {panel.blocksDelta < 0 ? (
          <QtyBig k="−blocks" v={`−${-panel.blocksDelta}`} />
        ) : null}
      </>
    );
  }
  if (panel.kind === "columna" || panel.kind === "zapata") {
    return (
      <>
        <QtyBig k="Sección" v={panel.seccion ?? "—"} />
        <QtyBig k="Hormigón" v={dash(panel.hormigonM3, (n) => `${n.toFixed(2)} m³`)} />
        <QtyBig k="Acero est." v={dash(panel.aceroT, (n) => `${n.toFixed(2)} t`)} />
      </>
    );
  }
  if (panel.kind === "viga") {
    return (
      <>
        <QtyBig k="Longitud" v={dash(panel.largo, formatMeters)} />
        <QtyBig k="Sección" v={panel.seccion ?? "—"} />
        <QtyBig k="Hormigón" v={dash(panel.hormigonM3, (n) => `${n.toFixed(2)} m³`)} />
        <QtyBig k="Acero est." v={dash(panel.aceroT, (n) => `${n.toFixed(2)} t`)} />
      </>
    );
  }
  return (
    <>
      <QtyBig k="Longitud" v={dash(panel.largo, formatMeters)} />
      <QtyBig k="Área neta" v={dash(panel.areaNeta, formatM2)} />
      <QtyBig
        k="Blocks"
        v={panel.blocks == null ? "—" : String(panel.blocks)}
        sub={panel.blocks != null && panel.blocksDelta < 0 ? `−${-panel.blocksDelta} blocks` : undefined}
      />
      <QtyBig k="Hormigón" v={dash(panel.hormigonM3, (n) => `${n.toFixed(2)} m³`)} />
      <QtyBig k="Acero est." v={dash(panel.aceroT, (n) => `${n.toFixed(2)} t`)} />
      {panel.losaM2 != null && panel.losaM2 > 0 ? <QtyBig k="Losa" v={formatM2(panel.losaM2)} /> : null}
    </>
  );
}

function MedidaEdit({
  k,
  unit,
  value,
  onChange,
  onCommit,
  dataAttr,
  ariaLabel,
}: {
  k: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  dataAttr: string;
  ariaLabel: string;
}) {
  return (
    <div className="col-span-2 md:col-span-1">
      <dt className="small-caps text-[0.62rem] text-ink-soft">{k}</dt>
      <dd className="mt-1 flex items-end gap-2">
        <input
          data-largo-edit={dataAttr === "data-largo-edit" ? "" : undefined}
          data-area-edit={dataAttr === "data-area-edit" ? "" : undefined}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          pattern="[0-9]*[.,]?[0-9]*"
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="min-h-11 min-w-0 flex-1 border-b border-ink/50 bg-transparent font-sans text-3xl tabular-nums leading-none tracking-tight text-ink outline-none"
        />
        <span className="small-caps mb-1 shrink-0 text-[0.7rem] text-ink-soft">{unit}</span>
        <button
          type="button"
          data-medida-ok
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCommit}
          className="small-caps min-h-11 shrink-0 border border-ink/40 px-3 text-[0.68rem] tracking-[0.12em] text-ink"
        >
          OK
        </button>
      </dd>
    </div>
  );
}

function dash(n: number | null, fmt: (n: number) => string): string {
  return n == null ? "—" : fmt(n);
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
