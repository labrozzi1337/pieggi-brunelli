import { it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import { gerarPlaquinhas, gerarWord, pendenciasPlaquinhas, type FonteDocumento } from "./documentos";

it("gera derivados com versão, receita completa, seis plaquinhas por página e bloqueia classificação incompleta",async()=>{
  const item={nome:"Caprese",receita:"Monte tomate e queijo.\nFinalize com manjericão fresco.",quantidade:12,unidade:"UN" as const,setor:"COZINHA_FRIA" as const,servico:"Coffee"};
  const rotulo={nomeEn:"Caprese",nomeEs:"Caprese",descricaoPt:"Tomate e queijo",descricaoEn:"Tomato and cheese",descricaoEs:"Tomate y queso",ficha:"CAN01",restricoes:["VEGETARIANO" as const],confirmado:true,exibir:true};
  const p:FonteDocumento={id:"00000000-0000-4000-8000-000000000001",evento_id:"00000000-0000-4000-8000-000000000002",empresa_id:"00000000-0000-4000-8000-000000000003",versao:2,status:"APROVADA",saida_em:"2026-10-06T12:00:00Z",aprovado_em:"2026-10-06T09:00:00Z",alteracoes:"Quantidade revisada de dez para doze.",itens:Array.from({length:7},()=>({...item})),rotulos:Array.from({length:7},()=>({...rotulo}))};
  const evento={titulo:"Evento de teste",data_evento:"2026-10-06",pax:50,horario_inicio:"10:00",horario_fim:"12:00"};
  p.roteiro_campo=[{tipo:"MONTAGEM",titulo:"Montar mesa",orientacao:"Higienizar e conferir as louças.",previstoEm:"2026-10-06T12:30:00Z"}];
  const word=await gerarWord(p,evento,"COZINHA_FRIA");
  const zip=await JSZip.loadAsync(word); const xml=await zip.file("word/document.xml")?.async("string");
  expect(xml).toContain("Finalize com manjericão fresco."); expect(xml).toContain("Versão 2"); expect(xml).not.toContain("valor_venda");
  expect(xml).not.toContain("Higienizar e conferir as louças.");
  const programacao=await gerarWord(p,evento);
  const programacaoZip=await JSZip.loadAsync(programacao);
  expect(await programacaoZip.file("word/document.xml")?.async("string")).toContain("Higienizar e conferir as louças.");
  const pdf=await gerarPlaquinhas(p,evento); const doc=await PDFDocument.load(pdf);expect(doc.getPageCount()).toBe(2);
  expect(pendenciasPlaquinhas({...p,rotulos:[]})).toHaveLength(7);
  await expect(gerarPlaquinhas({...p,rotulos:[]},evento)).rejects.toThrow("Revise as plaquinhas");
  await expect(gerarPlaquinhas({...p,itens:[{...item,nome:"Caprese 🍅"}],rotulos:[rotulo]},evento)).rejects.toThrow("caracteres não suportados");
  if(process.env.PIEGGI_DOCUMENT_QA_DIR){mkdirSync(process.env.PIEGGI_DOCUMENT_QA_DIR,{recursive:true});writeFileSync(`${process.env.PIEGGI_DOCUMENT_QA_DIR}/plaquinhas.pdf`,pdf);writeFileSync(`${process.env.PIEGGI_DOCUMENT_QA_DIR}/comanda.docx`,word);writeFileSync(`${process.env.PIEGGI_DOCUMENT_QA_DIR}/programacao.docx`,programacao);}
});
