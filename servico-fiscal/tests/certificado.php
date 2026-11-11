<?php

declare(strict_types=1);

use Pieggi\Fiscal\ControladorNfe;

require dirname(__DIR__) . '/vendor/autoload.php';

try {
    (new ControladorNfe())->validarCertificado([
        'conteudoBase64' => base64_encode('isto não é um PFX'),
        'senha' => 'incorreta',
        'cnpjEsperado' => '30744595000150',
    ]);
} catch (InvalidArgumentException $erro) {
    if (str_contains($erro->getMessage(), 'abrir o PFX')) {
        echo "ok\n";
        exit(0);
    }
}

throw new RuntimeException('Um arquivo inválido não pode ser aceito como certificado.');
