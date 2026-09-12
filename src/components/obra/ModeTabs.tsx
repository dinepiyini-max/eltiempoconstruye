import { Link } from "@tanstack/react-router";

/**
 * Pestañas de modo. Viven en este origen: / y /nueva.
 * Nunca href a otro host (ni *.grok.me).
 */
export function ModeTabs({ current }: { current: "yuna" | "nueva" }) {
  return (
    <nav
      aria-label="Modos"
      data-mode-tabs
      className="flex flex-wrap items-center gap-1 border-b border-rule/70 bg-paper px-3 py-1 sm:px-5"
    >
      <ModeTab to="/" on={current === "yuna"} label="VALLE DEL YUNA" />
      <ModeTab to="/nueva" on={current === "nueva"} label="NUEVA OBRA" />
    </nav>
  );
}

function ModeTab({
  to,
  on,
  label,
}: {
  to: "/" | "/nueva";
  on: boolean;
  label: string;
}) {
  const inner = (
    <span className={`border-b pb-1 ${on ? "border-rust" : "border-transparent"}`}>{label}</span>
  );
  if (on) {
    return (
      <span
        className="small-caps inline-flex min-h-11 items-center px-3 text-[0.7rem] text-ink"
        aria-current="page"
      >
        {inner}
      </span>
    );
  }
  return (
    <Link
      to={to}
      className="small-caps inline-flex min-h-11 items-center px-3 text-[0.7rem] text-ink-soft hover:text-ink"
    >
      {inner}
    </Link>
  );
}
