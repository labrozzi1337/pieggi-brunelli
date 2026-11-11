<?php

declare(strict_types=1);

use Pieggi\Fiscal\ControladorNfe;

require dirname(__DIR__) . '/vendor/autoload.php';

$origem = $argv[1] ?? '';
$destino = $argv[2] ?? '';
$xml = is_file($origem) ? file_get_contents($origem) : false;
if ($xml === false) {
    throw new RuntimeException('Informe o caminho de um XML autorizado.');
}
$resposta = (new ControladorNfe())->gerarDanfe(['xmlBase64' => base64_encode($xml)]);
$pdf = base64_decode($resposta['pdfBase64'], true);
assert(is_string($pdf) && str_starts_with($pdf, '%PDF-'));
if ($destino !== '') {
    file_put_contents($destino, $pdf);
}
echo "DANFE PDF: OK\n";
