import { VALLEY_NAME } from "@/lib/obra/catalog";
import { clockParts, formatInt } from "@/lib/obra/format";
import { MANDANTE, TESIS } from "@/lib/obra/pliego";
import { floodLine, v1Complete } from "@/lib/obra/sim";
import { useObra } from "@/lib/obra/store";
import { NuevaPartida } from "./NuevaPartida";

export function Archivo() {
  const archive = useObra((s) => s.game.archive);
  const prestigio = useObra((s) => s.game.prestigio);
  const floodStatus = useObra((s) => s.game.floodStatus);
  const game = useObra((s) => s.game);
  const climax = floodStatus !== "pendiente" || v1Complete(game);

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8">
      <header className="border-b border-ink/20 pb-4">
        <p className="small-caps text-[0.62rem] text-cyan">
          Museo · {VALLEY_NAME} · {MANDANTE}
        </p>
        <h2 className="font-serif text-3xl text-ink">Archivo</h2>
        <p className="mt-1 font-serif italic text-ink-soft">
          Lo que terminas aquí permanece. Prestigio {formatInt(prestigio)}.
        </p>
        <div className="mt-3">
          <NuevaPartida />
        </div>
      </header>

      {climax ? <Cierre /> : null}

      {archive.length === 0 ? (
        <p className="mt-24 text-center font-serif text-lg leading-snug text-ink">
          Aquí irán los frentes cerrados. Aún no hay ninguno.
        </p>
      ) : (
        <ol className="mt-8 grid gap-6 sm:grid-cols-2">
          {archive.map((p) => (
            <li key={p.id} className="border border-ink/20 bg-paper p-4">
              <div className="flex items-baseline justify-between">
                <p className="small-caps text-[0.58rem] text-cyan">Lámina {p.id}</p>
                <p className="small-caps text-[0.58rem] text-ink-soft">{p.completedClock}</p>
              </div>
              <h3 className="mt-2 font-serif text-2xl text-ink">{p.name}</h3>
              {p.seal ? (
                <p className="stamp mt-2 inline-block px-2 py-0.5 text-[0.5rem]">
                  {p.seal === "a-salvo" ? "OBRA A SALVO" : p.seal === "incumplido" ? "PLAZO INCUMPLIDO" : "TARDÍO"}
                </p>
              ) : null}
              <PlateSilhouette id={p.structureId} />
              <dl className="mt-3 space-y-1 text-sm">
                <Row k="Método" v={p.method} />
                <Row k="Materiales" v={p.materials} />
                <Row k="Mano de obra" v={p.workforce} />
                <Row k="Costo" v={formatInt(p.cost)} />
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Cierre() {
  const game = useObra((s) => s.game);
  const clock = clockParts(game.siteMinutes);
  const saved = game.floodStatus === "a-salvo";
  const failed = game.floodStatus === "incumplido";
  const flood = floodLine(game);

  return (
    <article className="mt-8 border border-ink/30 bg-paper p-5">
      <p className="small-caps text-[0.6rem] text-cyan">Lámina de cierre · {VALLEY_NAME}</p>
      <h3 className="mt-2 font-serif text-2xl text-ink">
        {saved ? "El pliego se cumplió." : failed ? "La crecida llegó antes." : "El valle aún espera."}
      </h3>
      <p className="mt-2 font-serif italic text-ink-soft">{TESIS}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Item k="Día de sitio" v={clock.label} />
        <Item k="Prestigio" v={formatInt(game.prestigio)} />
        <Item k="Hormigón vertido" v={`${formatInt(game.totals.hormigon)} m³`} />
        <Item k="Crecida" v={flood} />
      </dl>
      {saved ? (
        <p className="stamp mt-5 inline-block px-3 py-1 text-[0.62rem]">OBRA A SALVO</p>
      ) : failed ? (
        <p className="stamp mt-5 inline-block px-3 py-1 text-[0.62rem]">PLAZO INCUMPLIDO</p>
      ) : null}
      <div className="mt-6">
        <NuevaPartida />
      </div>
    </article>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="small-caps text-[0.55rem] text-ink-soft">{k}</dt>
      <dd className="tabular-nums text-ink">{v}</dd>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-rule/60 pb-1">
      <dt className="small-caps text-[0.55rem] text-ink-soft">{k}</dt>
      <dd className="text-right text-ink">{v}</dd>
    </div>
  );
}

function PlateSilhouette({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 64" className="mt-3 w-full text-ink" aria-hidden="true">
      {id === "camino" && (
        <path d="M8 48 C40 44 70 28 110 30 S170 48 192 40" fill="none" stroke="currentColor" strokeWidth="3" />
      )}
      {id === "puente" && (
        <>
          <rect x="20" y="28" width="160" height="6" fill="currentColor" />
          <rect x="50" y="34" width="6" height="18" fill="currentColor" />
          <rect x="144" y="34" width="6" height="18" fill="currentColor" />
        </>
      )}
      {id === "muro" && (
        <path d="M16 48 L60 28 L120 24 L184 32 L184 48 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
      {id === "cimentacion" && (
        <>
          <rect x="30" y="36" width="28" height="12" fill="currentColor" />
          <rect x="86" y="36" width="28" height="12" fill="currentColor" />
          <rect x="142" y="36" width="28" height="12" fill="currentColor" />
        </>
      )}
      {id === "planta" && (
        <>
          <rect x="40" y="24" width="80" height="28" fill="none" stroke="currentColor" />
          <circle cx="140" cy="38" r="12" fill="none" stroke="currentColor" />
          <circle cx="168" cy="38" r="8" fill="none" stroke="currentColor" />
        </>
      )}
      {id === "viaducto" && (
        <>
          <path d="M10 28 L190 28" stroke="currentColor" strokeWidth="3" />
          <rect x="40" y="28" width="4" height="24" fill="currentColor" />
          <rect x="98" y="28" width="4" height="24" fill="currentColor" />
          <rect x="156" y="28" width="4" height="24" fill="currentColor" />
        </>
      )}
      {(id === "ensayo" || id === "valle") && (
        <>
          <rect x="70" y="16" width="60" height="36" fill="none" stroke="currentColor" />
          <path d="M70 16 L100 4 L130 16" fill="none" stroke="currentColor" />
        </>
      )}
    </svg>
  );
}
