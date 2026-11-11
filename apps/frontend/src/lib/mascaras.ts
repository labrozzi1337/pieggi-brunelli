// Máscaras de digitação. O backend sempre normaliza (só dígitos) — aqui é só conforto visual.
import { api } from "./api";

export const digitos = (v: string) => v.replace(/\D/g, "");

const aplicar = (v: string, padrao: string) => {
  const d = digitos(v);
  let i = 0, saida = "";
  for (const c of padrao) {
    if (i >= d.length) break;
    saida += c === "9" ? d[i++] : c;
  }
  return saida;
};

export const mascaraCpf = (v: string) => aplicar(v, "999.999.999-99");
export const mascaraCnpj = (v: string) => aplicar(v, "99.999.999/9999-99");
/** CPF até 11 dígitos, CNPJ a partir do 12º. */
export const mascaraCpfCnpj = (v: string) => (digitos(v).length > 11 ? mascaraCnpj(v) : mascaraCpf(v));
export const mascaraCep = (v: string) => aplicar(v, "99999-999");
/** Fixo (10 dígitos) ou celular (11); o DDI 55 colado de outro lugar é descartado. */
export const mascaraTelefone = (v: string) => {
  const d = digitos(v).length > 11 && digitos(v).startsWith("55") ? digitos(v).slice(2) : digitos(v);
  return aplicar(d, d.length > 10 ? "(99) 99999-9999" : "(99) 9999-9999");
};

export interface Endereco { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; ibge: string }
export interface Empresa { cnpj: string; razaoSocial: string; nomeFantasia: string; situacao: string; email: string; telefone: string; endereco: Endereco }

export const buscarCep = (cep: string) => api<Endereco>(`/api/v1/consultas?cep=${digitos(cep)}`);
export const buscarCnpj = (cnpj: string) => api<Empresa>(`/api/v1/consultas?cnpj=${digitos(cnpj)}`);
