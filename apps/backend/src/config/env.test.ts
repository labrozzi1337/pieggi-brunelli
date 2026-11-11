import { afterEach, describe, expect, it } from "vitest";
import { getAllowedOrigins, getServerEnv } from "@/config/env";

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
});

describe("configuração do servidor", () => {
  it("rejeita credenciais ausentes", () => {
    process.env = { ...originalEnv };
    delete process.env.PIEGGI_SUPABASE_URL;
    delete process.env.PIEGGI_SUPABASE_SERVICE_ROLE_KEY;

    expect(getServerEnv().ok).toBe(false);
  });

  it("normaliza a lista de origens", () => {
    process.env = {
      ...originalEnv,
      PIEGGI_ALLOWED_ORIGINS: "http://localhost:5173, https://app.example.com "
    };

    expect(getAllowedOrigins()).toEqual(["http://localhost:5173", "https://app.example.com"]);
  });
});

