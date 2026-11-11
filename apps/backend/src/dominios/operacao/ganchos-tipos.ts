// Efeitos colaterais que antes eram triggers no banco. Quem muda o estado (eventos/programação) chama
// os ganchos dos outros módulos DENTRO da mesma transação. Cada módulo implementa o seu arquivo ganchos.ts.
export interface ProgramacaoLinha {
  id: string; evento_id: string; empresa_id: string; versao: number; status: "RASCUNHO" | "APROVADA" | "INVALIDADA";
  itens: unknown[]; rotulos: unknown[]; roteiro_campo: unknown[]; saida_em: string;
}
