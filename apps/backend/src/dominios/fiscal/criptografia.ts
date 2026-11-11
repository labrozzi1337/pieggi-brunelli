import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Cifra segredos fiscais com AES-256-GCM antes de persistir qualquer senha. */
export function cifrarSegredoFiscal(segredo: string, chaveBase64: string): string {
  const chave = obterChave(chaveBase64);
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave, iv);
  const conteudo = Buffer.concat([cifra.update(segredo, "utf8"), cifra.final()]);
  return [iv.toString("base64"), cifra.getAuthTag().toString("base64"), conteudo.toString("base64")].join(".");
}

/** Decifra a senha somente no instante em que o serviço fiscal precisa assinar ou transmitir. */
export function decifrarSegredoFiscal(valor: string, chaveBase64: string): string {
  const [iv, autenticador, conteudo] = valor.split(".");
  if (!iv || !autenticador || !conteudo) throw new Error("Segredo fiscal cifrado inválido.");
  const cifra = createDecipheriv("aes-256-gcm", obterChave(chaveBase64), Buffer.from(iv, "base64"));
  cifra.setAuthTag(Buffer.from(autenticador, "base64"));
  return Buffer.concat([cifra.update(Buffer.from(conteudo, "base64")), cifra.final()]).toString("utf8");
}

function obterChave(chaveBase64: string): Buffer {
  const chave = Buffer.from(chaveBase64, "base64");
  if (chave.length !== 32) throw new Error("PIEGGI_CHAVE_CIFRAGEM_FISCAL deve ser uma chave Base64 de 32 bytes.");
  return chave;
}
