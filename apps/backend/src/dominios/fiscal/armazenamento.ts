import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ArquivoFiscalGravado { caminho: string; nome: string; mimeType: string; tamanhoBytes: number; hashSha256: string; }

export interface ProvedorArmazenamentoFiscal {
  gravar(empresaId: string, segmentos: string[], nome: string, conteudo: Uint8Array, mimeType: string): Promise<ArquivoFiscalGravado>;
  ler(empresaId: string, caminho: string): Promise<Uint8Array>;
}

/** Armazena artefatos fiscais fora de public e recusa qualquer segmento de caminho inseguro. */
export class ProvedorArmazenamentoFiscalLocal implements ProvedorArmazenamentoFiscal {
  public constructor(private readonly diretorioBase: string) {}

  public async gravar(empresaId: string, segmentos: string[], nome: string, conteudo: Uint8Array, mimeType: string): Promise<ArquivoFiscalGravado> {
    const caminho = this.resolverCaminho(empresaId, [...segmentos, nome]);
    await mkdir(path.dirname(caminho), { recursive: true });
    const temporario = `${caminho}.${randomUUID()}.tmp`;
    await writeFile(temporario, conteudo, { flag: "wx" });
    await rename(temporario, caminho);
    const metadata = await stat(caminho);
    return { caminho: path.relative(path.join(this.diretorioBase, empresaId), caminho).replaceAll("\\", "/"), nome, mimeType, tamanhoBytes: metadata.size, hashSha256: createHash("sha256").update(conteudo).digest("hex") };
  }

  public async ler(empresaId: string, caminho: string): Promise<Uint8Array> {
    return readFile(this.resolverCaminho(empresaId, caminho.split("/")));
  }

  private resolverCaminho(empresaId: string, segmentos: string[]): string {
    const seguro = [empresaId, ...segmentos];
    if (seguro.some((segmento) => !segmento || segmento === "." || segmento === ".." || /[\\/]/.test(segmento))) throw new Error("Caminho fiscal inválido.");
    const raiz = path.resolve(this.diretorioBase);
    const destino = path.resolve(raiz, ...seguro);
    if (!destino.startsWith(`${raiz}${path.sep}`)) throw new Error("Acesso fora do armazenamento fiscal.");
    return destino;
  }
}
