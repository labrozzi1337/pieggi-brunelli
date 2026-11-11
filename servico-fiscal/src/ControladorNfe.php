<?php

declare(strict_types=1);

namespace Pieggi\Fiscal;

use InvalidArgumentException;
use NFePHP\Common\Certificate;
use NFePHP\DA\NFe\Danfe;
use NFePHP\NFe\Common\Standardize;
use NFePHP\NFe\Complements;
use NFePHP\NFe\Make;
use NFePHP\NFe\Tools;
use stdClass;

/** Faz a ponte técnica entre o contrato interno e o motor NFePHP. */
final class ControladorNfe
{
    /**
     * Abre o A1 e confirma titularidade e vigência antes de ativá-lo no sistema.
     *
     * @return array{titular:string,cnpjTitular:string,emissor:string,validoDe:string,validoAte:string}
     */
    public function validarCertificado(array $entrada): array
    {
        $conteudoBase64 = $entrada['conteudoBase64'] ?? null;
        $senha = $entrada['senha'] ?? null;
        $cnpjEsperado = preg_replace('/\D/', '', (string) ($entrada['cnpjEsperado'] ?? ''));
        if (!is_string($conteudoBase64) || !is_string($senha) || strlen($cnpjEsperado) !== 14) {
            throw new InvalidArgumentException('Dados do certificado inválidos.');
        }

        $conteudo = base64_decode($conteudoBase64, true);
        if ($conteudo === false || $conteudo === '') {
            throw new InvalidArgumentException('Arquivo PFX inválido.');
        }

        try {
            $certificado = Certificate::readPfx($conteudo, $senha);
        } catch (\Throwable) {
            throw new InvalidArgumentException('Não foi possível abrir o PFX. Confira o arquivo e a senha.');
        }

        $cnpjTitular = preg_replace('/\D/', '', (string) $certificado->getCnpj());
        if (strlen($cnpjTitular) !== 14) {
            throw new InvalidArgumentException('O certificado não possui um CNPJ de titular válido.');
        }
        if (!hash_equals($cnpjEsperado, $cnpjTitular)) {
            throw new InvalidArgumentException('O CNPJ do certificado não pertence à empresa selecionada.');
        }

        $validoDe = $certificado->getValidFrom();
        $validoAte = $certificado->getValidTo();
        if (!$validoDe instanceof \DateTimeInterface || !$validoAte instanceof \DateTimeInterface) {
            throw new InvalidArgumentException('O certificado não informa um período de validade reconhecível.');
        }
        $agora = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        if ($agora < $validoDe) {
            throw new InvalidArgumentException('O certificado ainda não está vigente.');
        }
        if ($agora > $validoAte) {
            throw new InvalidArgumentException('O certificado está vencido.');
        }

        return [
            'titular' => (string) $certificado->getCompanyName(),
            'cnpjTitular' => $cnpjTitular,
            'emissor' => (string) ($certificado->publicKey->cspName ?? $certificado->getICP()),
            'validoDe' => $validoDe->format(DATE_ATOM),
            'validoAte' => $validoAte->format(DATE_ATOM),
        ];
    }

    /**
     * Verifica os requisitos técnicos que precedem a montagem de XML.
     * Não cria respostas SEFAZ, assinaturas nem protocolos artificiais.
     *
     * @return list<array{nivel:string,campo:string,mensagem:string}>
     */
    public function validar(array $documento): array
    {
        $resultados = [];
        $emitente = $documento['emitente'] ?? [];
        $destinatario = $documento['destinatario'] ?? [];
        if (!isset($emitente['cnpj'], $emitente['razao_social'], $emitente['uf'], $emitente['codigo_municipio_ibge'])) {
            $resultados[] = ['nivel' => 'ERRO', 'campo' => 'emitente', 'mensagem' => 'Emitente sem os dados mínimos exigidos pela NF-e.'];
        }
        if (!isset($destinatario['cpfCnpj']) && !isset($destinatario['cpf_cnpj'])) {
            $resultados[] = ['nivel' => 'ERRO', 'campo' => 'destinatario.cpfCnpj', 'mensagem' => 'CPF ou CNPJ do destinatário é obrigatório.'];
        }
        foreach ([['nome', 'razaoSocial', 'razao_social'], ['logradouro'], ['numero', 'numeroEndereco', 'numero_endereco'], ['bairro'], ['codigoMunicipioIbge', 'codigo_municipio_ibge', 'cMun'], ['municipio', 'xMun'], ['uf', 'UF']] as $chaves) {
            if (self::campo($destinatario, $chaves) === null) {
                $resultados[] = ['nivel' => 'ERRO', 'campo' => 'destinatario', 'mensagem' => 'Destinatário sem endereço completo para NF-e modelo 55.'];
                break;
            }
        }
        foreach (($documento['itens'] ?? []) as $indice => $item) {
            if (empty($item['cst']) && empty($item['csosn'])) {
                $resultados[] = ['nivel' => 'ERRO', 'campo' => "itens.$indice.tributacao", 'mensagem' => 'Cada item precisa de CST ou CSOSN antes da geração do XML.'];
            }
            if ((int) ($emitente['crt'] ?? 0) === 3 && (int) date('Y') >= 2026
                && (empty($item['cClassTrib']) || !is_array($item['ibs'] ?? null) || !is_array($item['cbs'] ?? null))) {
                $resultados[] = ['nivel' => 'ERRO', 'campo' => "itens.$indice.ibsCbs", 'mensagem' => 'Informe CST, cClassTrib e alíquotas do IBS/CBS para emissão em 2026.'];
            }
        }
        return $resultados;
    }

    /**
     * Monta o XML pré-assinatura com NFePHP. A transmissão exige certificado e ocorre em endpoint próprio.
     *
     * @return array{xml:string,avisos:list<array{nivel:string,campo:string,mensagem:string}>}
     */
    public function gerar(array $documento): array
    {
        $erros = array_filter($this->validar($documento), static fn (array $resultado): bool => $resultado['nivel'] === 'ERRO');
        if ($erros) {
            throw new InvalidArgumentException($erros[0]['mensagem']);
        }
        if (!isset($documento['numero']) || !is_int($documento['numero'])) {
            throw new InvalidArgumentException('Número fiscal não reservado.');
        }

        $emitente = $documento['emitente'];
        $destinatario = $documento['destinatario'];
        $make = new Make('PL_010_V1.30');
        $infNfe = new stdClass();
        $infNfe->versao = '4.00';
        $infNfe->Id = null;
        $infNfe->pk_nItem = '';
        $make->taginfNFe($infNfe);

        $ide = new stdClass();
        $ide->cUF = (int) ($emitente['codigo_uf_ibge'] ?? 35);
        $ide->cNF = str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT);
        $ide->natOp = (string) $documento['naturezaOperacao'];
        $ide->mod = 55;
        $ide->serie = (int) $documento['serie'];
        $ide->nNF = $documento['numero'];
        $ide->dhEmi = date('c');
        $ide->tpNF = 1;
        $ide->idDest = (int) $documento['destinoOperacao'];
        $ide->cMunFG = (int) $emitente['codigo_municipio_ibge'];
        $ide->tpImp = 1;
        $ide->tpEmis = 1;
        $ide->cDV = 0;
        $ide->tpAmb = $documento['ambiente'] === 'PRODUCAO' ? 1 : 2;
        $ide->finNFe = 1;
        $ide->indFinal = (int) $documento['consumidorFinal'];
        $ide->indPres = (int) $documento['indicadorPresenca'];
        $ide->procEmi = 0;
        $ide->verProc = 'Pieggi';
        $make->tagide($ide);

        $emit = new stdClass();
        $emit->xNome = $emitente['razao_social'];
        $emit->xFant = $emitente['nome_fantasia'] ?? null;
        $emit->IE = $emitente['inscricao_estadual'] ?? null;
        $emit->CRT = (int) $emitente['crt'];
        $emit->CNPJ = $emitente['cnpj'];
        $make->tagemit($emit);

        $enderEmit = new stdClass();
        $enderEmit->xLgr = $emitente['logradouro'];
        $enderEmit->nro = $emitente['numero_endereco'];
        $enderEmit->xBairro = $emitente['bairro'];
        $enderEmit->cMun = $emitente['codigo_municipio_ibge'];
        $enderEmit->xMun = $emitente['municipio'];
        $enderEmit->UF = $emitente['uf'];
        $enderEmit->CEP = $emitente['cep'];
        $enderEmit->cPais = '1058';
        $enderEmit->xPais = 'BRASIL';
        $enderEmit->xCpl = $emitente['complemento'] ?? null;
        $enderEmit->fone = $emitente['telefone'] ?? null;
        $make->tagenderEmit($enderEmit);

        $dest = new stdClass();
        $documentoDestinatario = preg_replace('/\D/', '', (string) self::campo($destinatario, ['cpfCnpj', 'cpf_cnpj']));
        if (strlen($documentoDestinatario) === 14) {
            $dest->CNPJ = $documentoDestinatario;
        } elseif (strlen($documentoDestinatario) === 11) {
            $dest->CPF = $documentoDestinatario;
        } else {
            throw new InvalidArgumentException('CPF ou CNPJ do destinatário inválido.');
        }
        $dest->xNome = (string) self::campo($destinatario, ['nome', 'razaoSocial', 'razao_social']);
        $dest->indIEDest = (int) self::campo($destinatario, ['indicadorIe', 'indicador_ie', 'indIEDest'], 9);
        $dest->IE = self::campo($destinatario, ['ie', 'inscricaoEstadual', 'inscricao_estadual']);
        $dest->email = self::campo($destinatario, ['email']);
        $make->tagdest($dest);

        $enderDest = new stdClass();
        $enderDest->xLgr = self::campo($destinatario, ['logradouro']);
        $enderDest->nro = self::campo($destinatario, ['numero', 'numeroEndereco', 'numero_endereco']);
        $enderDest->xCpl = self::campo($destinatario, ['complemento']);
        $enderDest->xBairro = self::campo($destinatario, ['bairro']);
        $enderDest->cMun = self::campo($destinatario, ['codigoMunicipioIbge', 'codigo_municipio_ibge', 'cMun']);
        $enderDest->xMun = self::campo($destinatario, ['municipio', 'xMun']);
        $enderDest->UF = self::campo($destinatario, ['uf', 'UF']);
        $enderDest->CEP = preg_replace('/\D/', '', (string) self::campo($destinatario, ['cep', 'CEP']));
        $enderDest->cPais = self::campo($destinatario, ['codigoPais', 'codigo_pais', 'cPais'], '1058');
        $enderDest->xPais = self::campo($destinatario, ['pais', 'xPais'], 'BRASIL');
        $enderDest->fone = self::campo($destinatario, ['telefone', 'fone']);
        $make->tagenderDest($enderDest);

        foreach ($documento['itens'] as $indice => $item) {
            $numeroItem = $indice + 1;
            $valorProdutos = round((float) $item['quantidade'] * (float) $item['valorUnitario'], 2);
            $base = max(0, $valorProdutos - (float) ($item['desconto'] ?? 0));
            $icmsEntrada = is_array($item['icms'] ?? null) ? $item['icms'] : [];
            $prod = new stdClass();
            $prod->item = $numeroItem;
            $prod->cProd = $item['sku'] ?? (string) $numeroItem;
            $prod->cEAN = $item['gtin'] ?? 'SEM GTIN';
            $prod->xProd = $item['descricao'];
            $prod->NCM = $item['ncm'];
            $prod->CEST = $item['cest'] ?? null;
            $prod->CFOP = $item['cfop'];
            $prod->uCom = $item['unidade'];
            $prod->qCom = number_format((float) $item['quantidade'], 4, '.', '');
            $prod->vUnCom = number_format((float) $item['valorUnitario'], 10, '.', '');
            $prod->vProd = self::dinheiro($valorProdutos);
            $prod->cEANTrib = $prod->cEAN;
            $prod->uTrib = $prod->uCom;
            $prod->qTrib = $prod->qCom;
            $prod->vUnTrib = $prod->vUnCom;
            $prod->vDesc = self::dinheiroOpcional((float) ($item['desconto'] ?? 0));
            $prod->vFrete = self::dinheiroOpcional((float) ($item['frete'] ?? 0));
            $prod->vSeg = self::dinheiroOpcional((float) ($item['seguro'] ?? 0));
            $prod->vOutro = self::dinheiroOpcional((float) ($item['outrasDespesas'] ?? 0));
            $prod->cBenef = self::campo($icmsEntrada, ['cBenef', 'codigoBeneficioFiscal']);
            $prod->indTot = 1;
            $make->tagprod($prod);

            $imposto = new stdClass();
            $imposto->item = $numeroItem;
            $make->tagimposto($imposto);

            $aliquotaIcms = (float) self::campo($icmsEntrada, ['aliquota', 'pICMS'], 0);
            $icms = new stdClass();
            $icms->item = $numeroItem;
            $icms->orig = $item['origem'];
            $icms->modBC = (int) self::campo($icmsEntrada, ['modalidadeBase', 'modBC'], 3);
            $icms->vBC = self::dinheiro($base);
            $icms->pICMS = self::percentual($aliquotaIcms);
            $icms->vICMS = self::dinheiro($base * $aliquotaIcms / 100);
            if (!empty($item['csosn'])) {
                $icms->CSOSN = (string) $item['csosn'];
                $make->tagICMSSN($icms);
            } else {
                $icms->CST = substr(str_pad((string) $item['cst'], 2, '0', STR_PAD_LEFT), -2);
                $make->tagICMS($icms);
            }

            $pisEntrada = is_array($item['pis'] ?? null) ? $item['pis'] : [];
            $aliquotaPis = (float) self::campo($pisEntrada, ['aliquota', 'pPIS'], 0);
            $pis = new stdClass();
            $pis->item = $numeroItem;
            $pis->CST = (string) self::campo($pisEntrada, ['cst', 'CST'], '99');
            $pis->vBC = self::dinheiro($base);
            $pis->pPIS = self::percentual($aliquotaPis);
            $pis->vPIS = self::dinheiro($base * $aliquotaPis / 100);
            $make->tagPIS($pis);

            $cofinsEntrada = is_array($item['cofins'] ?? null) ? $item['cofins'] : [];
            $aliquotaCofins = (float) self::campo($cofinsEntrada, ['aliquota', 'pCOFINS'], 0);
            $cofins = new stdClass();
            $cofins->item = $numeroItem;
            $cofins->CST = (string) self::campo($cofinsEntrada, ['cst', 'CST'], '99');
            $cofins->vBC = self::dinheiro($base);
            $cofins->pCOFINS = self::percentual($aliquotaCofins);
            $cofins->vCOFINS = self::dinheiro($base * $aliquotaCofins / 100);
            $make->tagCOFINS($cofins);

            if (!empty($item['cClassTrib'])) {
                $ibsEntrada = is_array($item['ibs'] ?? null) ? $item['ibs'] : [];
                $cbsEntrada = is_array($item['cbs'] ?? null) ? $item['cbs'] : [];
                $aliquotaIbsUf = (float) self::campo($ibsEntrada, ['aliquotaUf', 'pIBSUF'], 0);
                $aliquotaIbsMunicipio = (float) self::campo($ibsEntrada, ['aliquotaMunicipio', 'pIBSMun'], 0);
                $aliquotaCbs = (float) self::campo($cbsEntrada, ['aliquota', 'pCBS'], 0);
                $ibsCbs = new stdClass();
                $ibsCbs->item = $numeroItem;
                $ibsCbs->CST = (string) self::campo($ibsEntrada, ['cst', 'CST'], '000');
                $ibsCbs->cClassTrib = (string) $item['cClassTrib'];
                $ibsCbs->vBC = self::dinheiro($base);
                $ibsCbs->gIBSUF_pIBSUF = self::percentual($aliquotaIbsUf);
                $ibsCbs->gIBSUF_vIBSUF = self::dinheiro($base * $aliquotaIbsUf / 100);
                $ibsCbs->gIBSMun_pIBSMun = self::percentual($aliquotaIbsMunicipio);
                $ibsCbs->gIBSMun_vIBSMun = self::dinheiro($base * $aliquotaIbsMunicipio / 100);
                $ibsCbs->gCBS_pCBS = self::percentual($aliquotaCbs);
                $ibsCbs->gCBS_vCBS = self::dinheiro($base * $aliquotaCbs / 100);
                $make->tagIBSCBS($ibsCbs);
            }
        }
        $make->tagICMSTot(new stdClass());
        $transporte = is_array($documento['transporte'] ?? null) ? $documento['transporte'] : [];
        $transp = new stdClass();
        $transp->modFrete = (int) self::campo($transporte, ['modFrete', 'modalidadeFrete'], 9);
        $make->tagtransp($transp);

        $pagamento = is_array($documento['pagamento'] ?? null) ? $documento['pagamento'] : [];
        $pag = new stdClass();
        $make->tagpag($pag);
        $detPag = new stdClass();
        $detPag->indPag = (int) self::campo($pagamento, ['indPag', 'indicadorPagamento'], 0);
        $detPag->tPag = (string) self::campo($pagamento, ['tPag', 'formaPagamento'], '01');
        $detPag->vPag = self::dinheiro((float) self::campo($pagamento, ['vPag', 'valorPagamento'], $documento['totais']['notaFiscal'] ?? 0));
        $make->tagdetPag($detPag);

        if (!empty($documento['informacoesAdicionais'])) {
            $adicionais = new stdClass();
            $adicionais->infCpl = $documento['informacoesAdicionais'];
            $make->taginfAdic($adicionais);
        }
        $xml = $make->getXML();
        if (!$xml) {
            throw new InvalidArgumentException('NFePHP não conseguiu montar o XML; complete os dados tributários do item.');
        }
        return ['xml' => $xml, 'avisos' => []];
    }

    /** Assina e envia uma NF-e para o autorizador da UF configurada. */
    public function transmitir(array $entrada): array
    {
        $documento = $entrada['documento'] ?? null;
        $conteudo = base64_decode((string) ($entrada['conteudoBase64'] ?? ''), true);
        $senha = $entrada['senha'] ?? null;
        if (!is_array($documento) || $conteudo === false || $conteudo === '' || !is_string($senha)) {
            throw new InvalidArgumentException('Documento ou certificado inválido para transmissão.');
        }
        $geracao = $this->gerar($documento);
        $emitente = $documento['emitente'];
        $configuracao = json_encode([
            'atualizacao' => date('Y-m-d H:i:s'),
            'tpAmb' => $documento['ambiente'] === 'PRODUCAO' ? 1 : 2,
            'razaosocial' => (string) $emitente['razao_social'],
            'cnpj' => preg_replace('/\D/', '', (string) $emitente['cnpj']),
            'siglaUF' => strtoupper((string) $emitente['uf']),
            'schemes' => 'PL_010_V1.30',
            'versao' => '4.00',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $tools = new Tools($configuracao, Certificate::readPfx($conteudo, $senha));
        $tools->model(55);
        $xmlAssinado = $tools->signNFe($geracao['xml']);
        $respostaXml = $tools->sefazEnviaLote([$xmlAssinado], (string) random_int(1, 999999999999999), 1);
        $resposta = (new Standardize($respostaXml))->toStd();
        $protocolo = $resposta->protNFe->infProt ?? null;
        $codigo = (string) ($protocolo->cStat ?? $resposta->cStat ?? '');
        $mensagem = (string) ($protocolo->xMotivo ?? $resposta->xMotivo ?? 'Retorno SEFAZ sem motivo.');
        preg_match('/Id="NFe(\d{44})"/', $xmlAssinado, $chaveXml);
        $chave = (string) ($protocolo->chNFe ?? ($chaveXml[1] ?? ''));
        $autorizado = $codigo === '100';
        return [
            'xmlAssinado' => $xmlAssinado,
            'xmlAutorizado' => $autorizado ? Complements::toAuthorize($xmlAssinado, $respostaXml) : null,
            'autorizado' => $autorizado,
            'codigoStatusSefaz' => $codigo,
            'mensagemSefaz' => $mensagem,
            'chaveAcesso' => $chave,
            'protocolo' => isset($protocolo->nProt) ? (string) $protocolo->nProt : null,
        ];
    }

    /** Gera o DANFE a partir do XML autorizado e protocolado. */
    public function gerarDanfe(array $entrada): array
    {
        $xml = base64_decode((string) ($entrada['xmlBase64'] ?? ''), true);
        if ($xml === false || $xml === '' || !str_contains($xml, '<nfeProc')) {
            throw new InvalidArgumentException('XML autorizado inválido para geração do DANFE.');
        }
        $danfe = new Danfe($xml);
        $danfe->setDefaultFont('helvetica');
        $pdf = $danfe->render();
        if (!str_starts_with($pdf, '%PDF-')) {
            throw new InvalidArgumentException('Não foi possível gerar um DANFE válido.');
        }
        return ['pdfBase64' => base64_encode($pdf)];
    }

    private static function campo(array $dados, array $chaves, mixed $padrao = null): mixed
    {
        foreach ($chaves as $chave) {
            if (array_key_exists($chave, $dados) && $dados[$chave] !== '') {
                return $dados[$chave];
            }
        }
        return $padrao;
    }

    private static function dinheiro(float $valor): string
    {
        return number_format(round($valor, 2), 2, '.', '');
    }

    private static function dinheiroOpcional(float $valor): ?string
    {
        return $valor > 0 ? self::dinheiro($valor) : null;
    }

    private static function percentual(float $valor): string
    {
        return number_format($valor, 4, '.', '');
    }
}
