<?php

declare(strict_types=1);

use Pieggi\Fiscal\ControladorNfe;

require dirname(__DIR__) . '/vendor/autoload.php';

/** Responde a API interna sem expor o serviço fiscal diretamente à internet. */
function responder(int $status, array $corpo): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$tokenEsperado = getenv('SERVICO_FISCAL_TOKEN');
if (!$tokenEsperado || !hash_equals($tokenEsperado, (string) ($_SERVER['HTTP_X_SERVICO_FISCAL_TOKEN'] ?? ''))) {
    responder(401, ['erro' => 'Não autorizado.']);
}

$caminho = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $caminho === '/saude') {
    responder(200, ['data' => ['status' => 'ok', 'motor' => 'nfephp-org/sped-nfe']]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !in_array($caminho, ['/certificados/validar', '/nfe/validar', '/nfe/gerar', '/nfe/transmitir', '/nfe/danfe'], true)) {
    responder(404, ['erro' => 'Rota não encontrada.']);
}

$dados = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($dados)) {
    responder(400, ['erro' => 'JSON inválido.']);
}

try {
    $controlador = new ControladorNfe();
    if ($caminho === '/certificados/validar') {
        responder(200, ['data' => $controlador->validarCertificado($dados)]);
    }
    if ($caminho === '/nfe/validar') {
        responder(200, ['data' => ['resultados' => $controlador->validar($dados)]]);
    }
    if ($caminho === '/nfe/transmitir') {
        responder(200, ['data' => $controlador->transmitir($dados)]);
    }
    if ($caminho === '/nfe/danfe') {
        responder(200, ['data' => $controlador->gerarDanfe($dados)]);
    }
    responder(200, ['data' => $controlador->gerar($dados)]);
} catch (InvalidArgumentException $erro) {
    responder(422, ['erro' => $erro->getMessage()]);
} catch (Throwable $erro) {
    error_log('Erro técnico do serviço fiscal: ' . $erro->getMessage());
    responder(500, ['erro' => 'Não foi possível processar a NF-e.']);
}
