import { NextResponse } from "next/server";
import { z } from "zod";
import {
  alterarSituacaoFreelancer, consultarTabela, criarFreelancer, editarFreelancer, freelancerEntrada, listarFreelancers,
  PAPEIS_ESCALA, PAPEIS_FREELANCERS, PAPEIS_PAGAMENTO
} from "@/dominios/equipe/freelancers";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { transacao } from "@/integrations/banco";

const semCache = { "Cache-Control": "private, no-store" };
const entrada = z.object({
  empresaId: z.string().uuid(), comando: z.discriminatedUnion("acao", [
    z.object({ acao: z.literal("CRIAR"), dados: freelancerEntrada }),
    z.object({ acao: z.literal("EDITAR"), dados: freelancerEntrada.extend({ id: z.string().uuid() }) }),
    z.object({ acao: z.enum(["INATIVAR", "REATIVAR", "ANONIMIZAR"]), dados: z.object({ id: z.string().uuid(), motivo: z.string().trim().min(5).max(500) }).strict() })
  ])
}).strict();

export async function GET(request: Request) {
  try {
    const empresaId = z.string().uuid().parse(new URL(request.url).searchParams.get("empresaId"));
    const { usuario, sql } = await contexto(request, PAPEIS_FREELANCERS);
    const [freelancers, tabela] = await Promise.all([listarFreelancers(sql, usuario, empresaId), consultarTabela()]);
    const tem = (p: readonly string[]) => usuario.papeis.some((x) => p.includes(x));
    return NextResponse.json({ data: { freelancers, tabela, podeEditar: tem(PAPEIS_ESCALA), podePagar: tem(PAPEIS_PAGAMENTO), podeAnonimizar: tem(["ADMIN"]) } }, { headers: semCache });
  } catch (error) { return erroOperacao(error); }
}

export async function POST(request: Request) {
  try {
    const { usuario } = await contexto(request, PAPEIS_ESCALA);
    const { empresaId, comando } = entrada.parse(await request.json());
    const data = await transacao((tx) => {
      if (comando.acao === "CRIAR") return criarFreelancer(tx, usuario, empresaId, comando.dados);
      if (comando.acao === "EDITAR") { const { id, ...dados } = comando.dados; return editarFreelancer(tx, usuario, id, dados); }
      return alterarSituacaoFreelancer(tx, usuario, comando.dados.id, comando.acao, comando.dados.motivo);
    });
    return NextResponse.json({ data }, { headers: semCache });
  } catch (error) { return erroOperacao(error); }
}
