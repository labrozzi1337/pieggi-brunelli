import { describe, expect, it } from "vitest";
import { periodo } from "./periodo";

describe("período do relatório de freelancers", () => {
  it("semana de segunda a domingo, quinzena e mês", () => {
    expect(periodo("SEMANA", "2026-11-08")).toEqual(["2026-11-02", "2026-11-08"]);
    expect(periodo("SEMANA", "2026-11-09")).toEqual(["2026-11-09", "2026-11-15"]);
    expect(periodo("QUINZENA", "2026-11-15")).toEqual(["2026-11-01", "2026-11-15"]);
    expect(periodo("QUINZENA", "2026-02-20")).toEqual(["2026-02-16", "2026-02-28"]);
    expect(periodo("MES", "2028-02-10")).toEqual(["2028-02-01", "2028-02-29"]);
  });
});
