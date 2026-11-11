/** Semana (seg–dom), quinzena (1–15 / 16–fim) ou mês que contém a data de referência. */
export function periodo(tipo: "SEMANA" | "QUINZENA" | "MES", referencia: string): [string, string] {
  const d = new Date(`${referencia}T12:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const dia = (n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), n, 12));
  if (tipo === "SEMANA") {
    const inicio = new Date(d); inicio.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const fim = new Date(inicio); fim.setUTCDate(inicio.getUTCDate() + 6);
    return [iso(inicio), iso(fim)];
  }
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();
  if (tipo === "QUINZENA") return d.getUTCDate() <= 15 ? [iso(dia(1)), iso(dia(15))] : [iso(dia(16)), iso(dia(ultimo))];
  return [iso(dia(1)), iso(dia(ultimo))];
}
