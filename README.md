# Vaquinha do Thor

## Campanha mensal
- Meta pública: R$ 1.000,00 por mês.
- A arrecadação e o número de apoiadores são calculados com base nos pagamentos confirmados no mês vigente, no fuso de São Paulo.
- A nova fase começa em 15/11/2026. Nos meses seguintes, a contagem começa automaticamente no primeiro dia de cada mês.
- A lista pública de últimos apoiadores começa vazia e mostra somente contribuições pagas no mês atual.
- O histórico anterior permanece no Supabase; não é apagado nem somado à nova meta mensal.
- A foto original do Thor foi preservada.

## Pagamentos — NexusPag
O endpoint `/api/pagar` cria novas cobranças exclusivamente na NexusPag e registra cada contribuição como pendente no Supabase antes de solicitar o PIX. O nome do doador é obrigatório. O site mantém QR Code e PIX copia e cola.

Variáveis necessárias no Vercel:
- `NEXUSPAG_API_KEY`: chave da NexusPag.
- `WEBHOOK_SECRET`: segredo HMAC configurado para o webhook da NexusPag.
- `APP_BASE_URL`: URL pública principal, por exemplo `https://vaquinha-site.vercel.app`.
- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SECRET_KEY`: chave secreta do Supabase, somente no servidor.

Webhook: `https://vaquinha-site.vercel.app/api/webhook`. O handler mantém compatibilidade com notificações PixBlack antigas que eventualmente ainda estejam pendentes, mas a criação de novas cobranças PixBlack foi removida do fluxo da vaquinha. Não remova as variáveis antigas até verificar que não existem cobranças PixBlack pendentes; a NovaPay deve manter suas próprias credenciais separadas.

## Transparência sobre o tratamento
O texto público descreve somente o que foi informado: o Thor foi diagnosticado com câncer e precisa de tratamento e cirurgia. Não foram incluídos tipo, estágio, prognóstico, laudo ou custos específicos porque esses dados precisam vir de documentação veterinária confirmada.
