import { useEffect, useRef, useState } from "react";
import { digitos } from "./mascaras";

/**
 * Consulta automática quando o campo atinge o tamanho (CEP = 8, CNPJ = 14). O valor que já veio preenchido
 * não é consultado de novo; `aoEncontrar` deve preencher só o que estiver vazio para não apagar o que foi digitado.
 */
export function useAutoBusca<T>(valor: string, tamanho: number, buscar: (v: string) => Promise<T>, aoEncontrar: (r: T) => void) {
  const d = digitos(valor);
  const [inicial] = useState(d);
  const [feito, setFeito] = useState({ chave: inicial, erro: "" });
  const retorno = useRef(aoEncontrar);
  useEffect(() => { retorno.current = aoEncontrar; });
  useEffect(() => {
    if (d.length !== tamanho || d === inicial) return;
    let ativo = true;
    buscar(d)
      .then((r) => { if (ativo) { retorno.current(r); setFeito({ chave: d, erro: "" }); } })
      .catch((e: unknown) => { if (ativo) setFeito({ chave: d, erro: e instanceof Error ? e.message : "Falha na consulta." }); });
    return () => { ativo = false; };
  }, [d, tamanho, buscar, inicial]);
  const consultavel = d.length === tamanho && d !== inicial;
  return { buscando: consultavel && feito.chave !== d, erro: consultavel && feito.chave === d ? feito.erro : "" };
}
