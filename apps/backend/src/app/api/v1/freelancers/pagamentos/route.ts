import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { dataLonga, moeda } from "@/dominios/documentos/comum";
import { gerarPdfTabela } from "@/dominios/documentos/pdf-tabela";
import { gerarXlsx } from "@/dominios/documentos/planilha-xlsx";
import { fechamentoEntrada, fecharPeriodo, filtroRelatorio, PAPEIS_FREELANCERS, PAPEIS_PAGAMENTO, registrarComprovante, relatorioPagamento } from "@/dominios/equipe/freelancers";
import { arquivoPix, rotuloFuncao } from "@/dominios/equipe/regras-freelancer";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { transacao } from "@/integrations/banco";

const semCache = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const entrada = z.object({
  empresaId: z.string().uuid(), comando: z.discriminatedUnion("acao", [
    z.object({ acao: z.literal("FECHAR"), dados: fechamentoEntrada }),
    z.object({ acao: z.literal("COMPROVANTE"), dados: z.object({ pagamentoId: z.string().uuid(), comprovantePath: z.string().trim().min(2).max(500) }).strict() })
  ])
}).strict();

const COLUNAS = ["Freelancer", "CNPJ", "Chave PIX", "Função", "Diárias", "Valor da diária", "Total a pagar", "Status"];
const situacao = (s: string, pagoEm: string | null) => s === "PAGO" ? `Pago${pagoEm ? ` em ${dataLonga(pagoEm)}` : ""}` : "Pendente";

/** ?empresaId&inicio&fim[&eventoId][&situacao][&formato=json|xlsx|pdf|pix] */
export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { empresaId, formato = "json", ...resto } = z.object({ empresaId: z.string().uuid(), formato: z.enum(["json", "xlsx", "pdf", "pix"]).optional() }).passthrough().parse(params);
    const filtro = filtroRelatorio.parse(resto);
    const { usuario, sql } = await contexto(request, PAPEIS_FREELANCERS);
    autorizarEmpresa(usuario, empresaId);
    const r = await relatorioPagamento(sql, usuario, empresaId, filtro);
    if (formato === "json") return NextResponse.json({ data: r }, { headers: semCache });

    const periodo = `${dataLonga(filtro.inicio)} a ${dataLonga(filtro.fim)}`;
    const nome = `Pieggi Freelancers - ${filtro.inicio.split("-").reverse().join("-")} a ${filtro.fim.split("-").reverse().join("-")}`;
    const arquivo = (corpo: Buffer | string, tipo: string, ext: string) =>
      new Response(typeof corpo === "string" ? corpo : new Uint8Array(corpo), { headers: { ...semCache, "Content-Type": tipo, "Content-Disposition": `attachment; filename="${nome}.${ext}"` } });

    if (formato === "pix") return arquivo("﻿" + arquivoPix(r.linhas, `PIEGGI-${filtro.inicio.replaceAll("-", "")}-${filtro.fim.replaceAll("-", "")}`), "text/csv; charset=utf-8", "csv");
    if (formato === "pdf") {
      const linhas = r.linhas.map((l) => [l.nome, l.cnpj, l.pix, rotuloFuncao(l.funcao), l.diarias, moeda(l.valorDiariaCentavos), moeda(l.totalCentavos), situacao(l.status, l.pagoEm)]);
      const totais = ["Total do período", "", "", "", r.totais.diarias, "", moeda(r.totais.geralCentavos), r.totais.pendenteCentavos ? `Pendente ${moeda(r.totais.pendenteCentavos)}` : "Pago"];
      return arquivo(await gerarPdfTabela(`Pagamento de freelancers — ${periodo}`, COLUNAS, linhas, totais), "application/pdf", "pdf");
    }
    const reais = (c: number) => c / 100;
    return arquivo(await gerarXlsx([
      { nome: "Pagamento", colunas: [...COLUNAS, "Data do pagamento", "Comprovante"], linhas: [
        ...r.linhas.map((l) => [l.nome, l.cnpj, l.pix, rotuloFuncao(l.funcao), l.diarias, reais(l.valorDiariaCentavos), reais(l.totalCentavos), l.status === "PAGO" ? "Pago" : "Pendente", l.pagoEm ? dataLonga(l.pagoEm) : null, l.comprovante]),
        ["Total do período", null, null, null, r.totais.diarias, null, reais(r.totais.geralCentavos), null, null, null]] },
      { nome: "Diárias", colunas: ["Freelancer", "Evento", "Data", "Local", "Função", "Valor", "Status"],
        linhas: r.detalhes.map((d) => [d.nome, d.evento, dataLonga(d.data), d.local, rotuloFuncao(d.funcao), reais(d.valorCentavos), d.status === "PAGO" ? "Pago" : "Pendente"]) },
      { nome: "Por função", colunas: ["Função", "Diárias", "Total"], linhas: r.totais.porFuncao.map((f) => [rotuloFuncao(f.funcao), f.diarias, reais(f.totalCentavos)]) },
      { nome: "Por evento", colunas: ["Evento", "Diárias", "Total"], linhas: r.totais.porEvento.map((e) => [e.evento, e.diarias, reais(e.totalCentavos)]) }
    ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
  } catch (error) { return erroOperacao(error); }
}

export async function POST(request: Request) {
  try {
    const { usuario } = await contexto(request, PAPEIS_PAGAMENTO);
    const { empresaId, comando } = entrada.parse(await request.json());
    const data = await transacao((tx) => comando.acao === "FECHAR"
      ? fecharPeriodo(tx, usuario, empresaId, comando.dados)
      : registrarComprovante(tx, usuario, comando.dados.pagamentoId, comando.dados.comprovantePath));
    return NextResponse.json({ data }, { headers: semCache });
  } catch (error) { return erroOperacao(error); }
}
