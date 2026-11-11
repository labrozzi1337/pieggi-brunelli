<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Pieggi\Fiscal\ControladorNfe;

$documento = [
    'ambiente' => 'HOMOLOGACAO', 'serie' => 1, 'numero' => 1, 'naturezaOperacao' => 'VENDA DE MERCADORIA',
    'destinoOperacao' => '1', 'consumidorFinal' => '0', 'indicadorPresenca' => '1',
    'emitente' => ['cnpj' => '30744595000150', 'razao_social' => 'Pieggi Eventos LTDA', 'nome_fantasia' => 'Mondi', 'inscricao_estadual' => '159425310119', 'crt' => 3, 'logradouro' => 'Rua Dr Jose Aureo Bustamante', 'numero_endereco' => '22', 'bairro' => 'Santo Amaro', 'codigo_municipio_ibge' => '3550308', 'municipio' => 'Sao Paulo', 'uf' => 'SP', 'cep' => '04710090', 'codigo_uf_ibge' => 35],
    'destinatario' => ['cpfCnpj' => '30744595000150', 'nome' => 'Pieggi Eventos LTDA', 'indicadorIe' => 1, 'ie' => '159425310119', 'logradouro' => 'Rua Dr Jose Aureo Bustamante', 'numero' => '22', 'bairro' => 'Santo Amaro', 'codigoMunicipioIbge' => '3550308', 'municipio' => 'Sao Paulo', 'uf' => 'SP', 'cep' => '04710090'],
    'itens' => [['sku' => 'COF-001', 'descricao' => 'Peito de Frango Defumado', 'ncm' => '19059090', 'cfop' => '5102', 'unidade' => 'UN', 'quantidade' => 1, 'valorUnitario' => 11.50, 'origem' => '0', 'cst' => '90', 'icms' => ['aliquota' => 4, 'cBenef' => 'SP040100'], 'pis' => ['cst' => '01', 'aliquota' => 0.65], 'cofins' => ['cst' => '01', 'aliquota' => 3], 'cClassTrib' => '000001', 'ibs' => ['cst' => '000', 'aliquotaUf' => 0.1, 'aliquotaMunicipio' => 0], 'cbs' => ['aliquota' => 0.9]]],
    'totais' => ['notaFiscal' => 11.50], 'transporte' => ['modFrete' => 9], 'pagamento' => ['tPag' => '01', 'vPag' => 11.50],
];

$xml = (new ControladorNfe())->gerar($documento)['xml'];
foreach (['<cBenef>SP040100</cBenef>', '<IBSCBS>', '<cClassTrib>000001</cClassTrib>', '<pIBSUF>0.1000</pIBSUF>', '<pCBS>0.9000</pCBS>'] as $trecho) {
    if (!str_contains($xml, $trecho)) throw new RuntimeException("XML sem $trecho");
}
echo "XML NF-e com cBenef e IBS/CBS: OK\n";
