<?php
declare(strict_types=1);
date_default_timezone_set('America/Recife');

/* ========== CONFIG (Sua lógica permanece intacta) ========== */
$CONFIG = (object)[
  'API_BASE'   => 'https://app.sigilopay.com.br',
  'ENDPOINT'   => '/api/v1/gateway/pix/receive',
  'PUBLIC_KEY' => 'camilasoarespriv_5q3tf8jfoxpxbviv',
  'SECRET_KEY' => '80u1q8vaw9uofeau5lesf08sqdbi6nvnusiubcz039qgg11pzx255hkmnrqacw7w',
  'CLIENT' => (object)[ 'name' => 'Deposito', 'email' => 'deposito@deposito.com', 'phone' => '00000000000', 'document' => '37734576850' ],
];

function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

/**
 * Converte valores pt-BR (ex: "1.500,00") para float (1500.00)
 */
function parseBrl(string $input): float {
    $raw = preg_replace('/[^\d.,]/', '', $input);
    if (!$raw) return 0.0;

    // remove separador de milhar e troca separador decimal
    $raw = str_replace('.', '', $raw);
    $raw = str_replace(',', '.', $raw);

    return (float)$raw;
}
function createPix(object $cfg, float $val): array {
    $url = rtrim($cfg->API_BASE, '/') . $cfg->ENDPOINT;
    $payload = [
        'identifier' => 'nub_' . time(), 'amount' => $val,
        'client' => [ 'name' => $cfg->CLIENT->name, 'email' => $cfg->CLIENT->email, 'phone' => $cfg->CLIENT->phone, 'document' => $cfg->CLIENT->document ],
    ];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [ 'Content-Type: application/json', 'x-public-key: '.$cfg->PUBLIC_KEY, 'x-secret-key: '.$cfg->SECRET_KEY ],
    ]);
    $res = curl_exec($ch); $http = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $json = json_decode((string)$res, true);
    return ($http >= 200 && $http < 300) ? [true, $json['pix']['code']] : [false, $json['message'] ?? 'Erro'];
}

$step = 'input'; $error = null; $pixCode = null; $amountStr = $_POST['amount'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $val = parseBrl((string)$amountStr);
if ($val < 0.01) { $error = "Informe um valor para continuar."; }
    else { [$ok, $res] = createPix($CONFIG, $val); if ($ok) { $pixCode = $res; $step = 'pay'; } else { $error = $res; } }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Depositar | Nubank Style</title>
    <link href="https://fonts.googleapis.com/css2?family=Graphik:wght@400;500;600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        :root { --nu-purple:#820AD1; --nu-purple-dark:#6D09B1; --bg:#FFFFFF; --text-main:#111111; --text-muted:#767676; --input-line:#E5E5E5; --success:#1FB334; }
        * { margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
        body { font-family:'Inter', sans-serif; background-color:var(--bg); color:var(--text-main); line-height:1.4; }
        .app-container { width:100%; max-width:500px; min-height:100vh; margin:0 auto; display:flex; flex-direction:column; padding:24px; }
        header { display:flex; align-items:center; justify-content:space-between; margin-bottom:48px; }
        .back-btn { border:none; background:transparent; cursor:pointer; color:var(--text-main); padding:8px; margin-left:-8px; }
        h1 { font-size:32px; font-weight:700; letter-spacing:-1px; margin-bottom:12px; }
        .subtitle { font-size:16px; color:var(--text-muted); margin-bottom:40px; }
        .value-label { font-size:14px; font-weight:600; color:var(--nu-purple); margin-bottom:8px; display:block; }
        .input-group { display:flex; align-items:baseline; border-bottom:2px solid var(--input-line); padding-bottom:8px; transition:border-color .3s; }
        .input-group:focus-within { border-color:var(--nu-purple); }
        .currency-symbol { font-size:32px; font-weight:500; margin-right:8px; }
        .input-group input { border:none; outline:none; background:transparent; font-size:44px; font-weight:600; color:var(--text-main); width:100%; }
        .qr-card { background:#F5F5F5; border-radius:16px; padding:24px; display:flex; flex-direction:column; align-items:center; margin-bottom:32px; }
        .qr-card img { width:220px; height:220px; background:#fff; padding:10px; border-radius:8px; }
        .copy-box { width:100%; background:#F5F5F5; border-radius:12px; padding:16px; font-size:13px; color:var(--text-muted); word-break:break-all; text-align:center; margin-bottom:24px; border:1px solid #EDEDED; }
        .footer { margin-top:auto; padding-top:40px; }
        .btn-nu { width:100%; height:56px; background-color:var(--nu-purple); color:#fff; border:none; border-radius:100px; font-size:16px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s; }
        .btn-nu:hover { background-color:var(--nu-purple-dark); }
        .btn-nu:disabled { background-color:#F5F5F5; color:#BBBBBB; cursor:not-allowed; }
        .error-msg { color:#E53935; font-size:14px; margin-top:12px; font-weight:500; }
        @media (min-width:768px){ body{ background-color:#F4F4F4; padding:40px 0; } .app-container{ background-color:#fff; min-height:auto; border-radius:32px; box-shadow:0 20px 40px rgba(0,0,0,.05); padding:48px; } }
    </style>
</head>
<body>

<div class="app-container">
    <header>
        <button class="back-btn" onclick="window.location.href='?'">
            <i data-lucide="chevron-left" size="32"></i>
        </button>
    </header>

    <?php if ($step === 'input'): ?>
        <main>
            <h1>Quanto você quer<br>depositar?</h1>
            <p class="subtitle">Depósito irá entrar na sua conta da sigilopay.com</p>

            <form method="POST" id="depForm">
                <span class="value-label">Valor do depósito</span>
                <div class="input-group">
                    <span class="currency-symbol">R$</span>
                    <input type="tel" name="amount" id="amount" placeholder="0,00" required autofocus autocomplete="off">
                </div>
                <?php if ($error): ?>
                    <p class="error-msg"><?= e($error) ?></p>
                <?php endif; ?>

                <div class="footer">
                    <button type="submit" class="btn-nu" id="btnSubmit">Continuar</button>
                </div>
            </form>
        </main>

    <?php else: ?>
        <main>
            <h1>Pague o seu PIX</h1>
            <p class="subtitle">Use o QR Code ou copie o código abaixo para finalizar o depósito.</p>

            <div class="qr-card">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<?= rawurlencode($pixCode) ?>" alt="Pix">
            </div>

            <div class="copy-box" id="pixTxt"><?= e($pixCode) ?></div>

            <div class="footer">
                <button class="btn-nu" onclick="copyPix(this)">Copiar código</button>
                <button style="background:none; border:none; color:var(--nu-purple); width:100%; margin-top:16px; font-weight:600; cursor:pointer;" onclick="window.location.href='?'">Voltar</button>
            </div>
        </main>
    <?php endif; ?>
</div>

<script>
  lucide.createIcons();
  const input = document.getElementById('amount');
  if(input){
    input.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      v = (v/100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      e.target.value = v === '0,00' ? '' : v;
    });
  }
  function copyPix(btn){
    const code = document.getElementById('pixTxt').innerText;
    navigator.clipboard.writeText(code).then(() => {
      const originalText = btn.innerText;
      btn.innerText = 'Copiado!';
      btn.style.backgroundColor = '#1FB334';
      setTimeout(() => {
        btn.innerText = originalText;
        btn.style.backgroundColor = '#820AD1';
      }, 2000);
    });
  }
</script>
</body>
</html>
