import { z } from "zod";
import { Document, Footer, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { ErroOperacao, itemProgramacaoSchema, rotuloProgramacaoSchema, etapaCampoSchema } from "./http";

export const documentoFonteSchema = z.object({
  id: z.string().uuid(), evento_id: z.string().uuid(), empresa_id: z.string().uuid(),
  versao: z.number().int().positive(), status: z.literal("APROVADA"),
  saida_em: z.string(), aprovado_em: z.string(), alteracoes: z.string(),
  itens: z.array(itemProgramacaoSchema), rotulos: z.array(rotuloProgramacaoSchema),roteiro_campo:z.array(etapaCampoSchema).optional()
});
export type FonteDocumento = z.infer<typeof documentoFonteSchema>;
export const eventoDocumentoSchema = z.object({ titulo: z.string(), data_evento: z.string(), pax: z.number(), horario_inicio: z.string(), horario_fim: z.string() });
export type EventoDocumento = z.infer<typeof eventoDocumentoSchema>;
export const nomesSetores: Record<string,string> = { COZINHA_QUENTE:"Cozinha quente", COZINHA_FRIA:"Cozinha fria", CONFEITARIA:"Confeitaria", BEBIDAS:"Bebidas", ESTRUTURA:"Estrutura", FORNECEDOR:"Fornecedor" };
const data = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const paragrafo = (text: string) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 100 } });

export async function gerarWord(p: FonteDocumento, e: EventoDocumento, setor?: string) {
  const itens = p.itens.map((item, indice) => ({ item, indice })).filter(({item}) => !setor || item.setor === setor);
  if (!itens.length) throw new ErroOperacao("Este setor não tem itens nesta programação.", 409);
  const children = [new Paragraph({ text: setor ? `Comanda de ${nomesSetores[setor]}` : "Programação do evento", heading: HeadingLevel.TITLE }),
    paragrafo(e.titulo), paragrafo(`Evento: ${e.data_evento.split("-").reverse().join("/")} | ${e.pax} pessoas | ${e.horario_inicio.slice(0,5)} a ${e.horario_fim.slice(0,5)}`),
    paragrafo(`Versão ${p.versao} | Aprovada em ${data(p.aprovado_em)}`), paragrafo(`Saída prevista: ${data(p.saida_em)}`),
    new Paragraph({ text: "O que mudou nesta versão", heading: HeadingLevel.HEADING_1 }), paragrafo(p.alteracoes),
    paragrafo("Confira a versão vigente no sistema antes de produzir. Leia a ficha de cada item e confira todos os componentes e a finalização antes de entregar à expedição.")];
  for (const {item,indice} of itens) {
    children.push(new Paragraph({ text: `${item.quantidade} ${item.unidade} | ${item.nome}`, heading: HeadingLevel.HEADING_2, keepNext: true }),
      paragrafo(`${item.servico || "Serviço do evento"} | ${nomesSetores[item.setor] ?? item.setor} | Ficha: ${p.rotulos[indice]?.ficha || "não cadastrada"}`));
    for (const linha of item.receita.split(/\r?\n/)) children.push(paragrafo(linha));
  }
  if(!setor && p.roteiro_campo?.length){
    children.push(new Paragraph({text:"Roteiro de campo",heading:HeadingLevel.HEADING_1}));
    p.roteiro_campo.forEach((etapa,i)=>{children.push(paragrafo(`${i+1}. ${data(etapa.previstoEm)} | ${etapa.tipo} | ${etapa.titulo}`),paragrafo(etapa.orientacao));});
  }
  return Packer.toBuffer(new Document({ creator: "Pieggi", title: `${e.titulo} v${p.versao}`, styles: { default: { document: { run: { font: "Arial", size: 24, color: "000000" } }, title: { run: { font: "Arial", size: 24, color: "000000", bold: true } }, heading1: { run: { font: "Arial", size: 24, color: "000000", bold: true } }, heading2: { run: { font: "Arial", size: 24, color: "000000", bold: true } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 900, left: 720, right: 720 } } }, children,
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: `PIEGGI | ${p.id} | v${p.versao} | Confira a versão vigente no sistema`, size: 16 })] })] }) } }] }));
}

export function pendenciasPlaquinhas(p: FonteDocumento) {
  return p.itens.flatMap((item,i) => {
    if (["ESTRUTURA","FORNECEDOR"].includes(item.setor)) return [];
    const r = p.rotulos[i];
    if (!r || !r.confirmado) return [`${item.nome}: classificação e restrições não confirmadas`];
    if (!r.exibir) return [];
    return !r.nomeEn || !r.nomeEs || !r.descricaoPt || !r.descricaoEn || !r.descricaoEs ? [`${item.nome}: traduções ou descrições pendentes`] : [];
  });
}

function linhas(text: string, font: PDFFont, tamanho: number, largura: number) {
  const caracteres = new Set(font.getCharacterSet());
  if ([...text].some(c => !/\s/.test(c) && !caracteres.has(c.codePointAt(0) ?? 0))) throw new ErroOperacao("A plaquinha contém caracteres não suportados. Remova emojis ou símbolos especiais na programação.",409);
  const result: string[] = [];
  for (const paragrafo of text.split(/\r?\n/)) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(palavra,tamanho)>largura) throw new ErroOperacao("Há uma palavra longa demais na plaquinha. Revise o texto na programação.",409);
      const candidato = atual ? `${atual} ${palavra}` : palavra;
      if (font.widthOfTextAtSize(candidato,tamanho)>largura) { result.push(atual); atual=palavra; } else atual=candidato;
    }
    if (atual) result.push(atual);
  }
  return result;
}
const restricoes: Record<string,{codigo:string; nome:string}> = { SEM_GLUTEN:{codigo:"SG",nome:"Sem glúten"}, VEGANO:{codigo:"VG",nome:"Vegano"}, VEGETARIANO:{codigo:"VT",nome:"Vegetariano"}, SEM_LACTOSE:{codigo:"SL",nome:"Sem lactose"}, SEM_ACUCAR:{codigo:"SA",nome:"Sem açúcar"} };
export async function gerarPlaquinhas(p: FonteDocumento, e: EventoDocumento) {
  const pendencias=pendenciasPlaquinhas(p);
  if (pendencias.length) throw new ErroOperacao(`Revise as plaquinhas na programação: ${pendencias.join("; ")}`,409);
  const cards = p.itens.flatMap((item,i) => { const r=p.rotulos[i]; return r?.exibir && !["ESTRUTURA","FORNECEDOR"].includes(item.setor) ? [{item,r}] : []; });
  if (!cards.length) throw new ErroOperacao("Nenhum item foi selecionado para plaquinha.",409);
  const doc=await PDFDocument.create(); const regular=await doc.embedFont(StandardFonts.Helvetica); const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Plaquinhas ${e.titulo} v${p.versao}`); doc.setAuthor("Pieggi");
  for (let inicio=0; inicio<cards.length; inicio+=6) {
    const page=doc.addPage([595.28,841.89]);
    page.drawText(`PIEGGI | Versão ${p.versao} | ${e.data_evento} | Folha ${inicio/6+1}`,{x:28,y:817,size:9,font:bold});
    for (let i=0;i<6 && inicio+i<cards.length;i++) {
      const card=cards[inicio+i]; if(!card) break;
      const {item,r}=card; const x=28+(i%2)*273; const top=795-Math.floor(i/2)*251; const width=263;
      page.drawRectangle({x,y:top-240,width,height:240,borderWidth:0.5,borderColor:rgb(.75,.75,.75)});
      let y=top-21;
      for (const [titulo,descricao] of [[item.nome,r.descricaoPt],[r.nomeEn,r.descricaoEn],[r.nomeEs,r.descricaoEs]]) {
        const titleLines=linhas(titulo ?? "",bold,12,width-24); const descLines=linhas(descricao ?? "",regular,10,width-24);
        const height=titleLines.length*15+descLines.length*12+10;
        if (y-height<top-185) throw new ErroOperacao(`${item.nome}: texto excede o espaço da plaquinha. Encurte as descrições na programação.`,409);
        for (const line of titleLines) { page.drawText(line,{x:x+12,y,size:12,font:bold}); y-=15; }
        for (const line of descLines) { page.drawText(line,{x:x+12,y,size:10,font:regular}); y-=12; }
        y-=10;
      }
      r.restricoes.forEach((key,j) => { const icon=restricoes[key]; if(!icon) throw new ErroOperacao("Restrição desconhecida.",409); const cx=x+23+j*46;
        page.drawCircle({x:cx,y:top-204,size:10,borderWidth:1,borderColor:rgb(.15,.15,.15)});
        page.drawText(icon.codigo,{x:cx-regular.widthOfTextAtSize(icon.codigo,7)/2,y:top-206.5,size:7,font:bold});
      });
      page.drawText(`v${p.versao} | ${p.id.slice(0,8)}`,{x:x+12,y:top-229,size:7,font:regular,color:rgb(.4,.4,.4)});
    }
    page.drawText("SG Sem glúten | VG Vegano | VT Vegetariano | SL Sem lactose | SA Sem açúcar",{x:28,y:24,size:8,font:regular});
  }
  return doc.save();
}
