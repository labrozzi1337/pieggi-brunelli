// Consultas a bases públicas para cadastrar sem digitar: CEP (ViaCEP) e CNPJ (OpenCNPJ).
// Passam pelo backend porque a CSP do frontend só permite a própria origem e para manter uma única regra de normalização.
import { ErroOperacao } from "@/dominios/operacao/http";
import { cnpjValido, soDigitos } from "@/dominios/equipe/regras-freelancer";

export interface Endereco { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; ibge: string }
export interface Empresa { cnpj: string; razaoSocial: string; nomeFantasia: string; situacao: string; email: string; telefone: string; endereco: Endereco }

const TEMPO_LIMITE_MS = 8000;

async function obterJson(url: string): Promise<unknown> {
  let resposta: Response;
  try { resposta = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS), headers: { Accept: "application/json" } }); }
  catch { throw new ErroOperacao("Serviço de consulta indisponível. Preencha manualmente ou tente de novo.", 502); }
  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new ErroOperacao("Serviço de consulta indisponível. Preencha manualmente ou tente de novo.", 502);
  return resposta.json().catch(() => null);
}

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** "SAO PAULO" → "Sao Paulo": OpenCNPJ devolve tudo em caixa alta. */
const titulo = (v: string) => v.toLocaleLowerCase("pt-BR").replace(/(^|[\s/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase("pt-BR"))
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (p) => p.toLowerCase());
export const formatarTelefone = (d: string) => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
export const formatarCep = (d: string) => d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;

export async function consultarCep(valor: string): Promise<Endereco> {
  const cep = soDigitos(valor);
  if (cep.length !== 8) throw new ErroOperacao("CEP deve ter 8 dígitos.", 400);
  const r = await obterJson(`https://viacep.com.br/ws/${cep}/json/`) as Record<string, unknown> | null;
  if (!r || r.erro) throw new ErroOperacao("CEP não encontrado.", 404);
  return { cep: formatarCep(cep), logradouro: txt(r.logradouro), numero: "", complemento: "", bairro: txt(r.bairro), cidade: txt(r.localidade), uf: txt(r.uf), ibge: txt(r.ibge) };
}

/** Converte a resposta do OpenCNPJ; o endereço é refinado pelo ViaCEP (grafia e código IBGE, que a NF-e exige). */
export function mapearEmpresa(r: Record<string, unknown>, viaCep: Endereco | null): Empresa {
  const cep = soDigitos(txt(r.cep));
  const telefones = Array.isArray(r.telefones) ? r.telefones as Array<Record<string, unknown>> : [];
  const fone = telefones.find((t) => !t.is_fax) ?? telefones[0];
  const rua = [txt(r.tipo_logradouro), txt(r.logradouro)].filter(Boolean).join(" ");
  return {
    cnpj: soDigitos(txt(r.cnpj)), razaoSocial: titulo(txt(r.razao_social)), nomeFantasia: titulo(txt(r.nome_fantasia)),
    situacao: txt(r.situacao_cadastral), email: txt(r.email).toLowerCase(), telefone: fone ? formatarTelefone(soDigitos(`${txt(fone.ddd)}${txt(fone.numero)}`)) : "",
    endereco: {
      cep: formatarCep(cep), logradouro: viaCep?.logradouro || titulo(rua), numero: txt(r.numero), complemento: titulo(txt(r.complemento)),
      bairro: viaCep?.bairro || titulo(txt(r.bairro)), cidade: viaCep?.cidade || titulo(txt(r.municipio)), uf: viaCep?.uf || txt(r.uf), ibge: viaCep?.ibge ?? ""
    }
  };
}

export async function consultarCnpj(valor: string): Promise<Empresa> {
  const cnpj = soDigitos(valor);
  if (!cnpjValido(cnpj)) throw new ErroOperacao("CNPJ inválido: confira os 14 dígitos.", 400);
  const r = await obterJson(`https://api.opencnpj.org/${cnpj}`) as Record<string, unknown> | null;
  if (!r || !r.razao_social) throw new ErroOperacao("CNPJ não encontrado na base pública.", 404);
  const viaCep = await consultarCep(txt(r.cep)).catch(() => null);
  return mapearEmpresa(r, viaCep);
}
