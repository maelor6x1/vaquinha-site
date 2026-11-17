# Vaquinha do Thor

## Campanha mensal
- Meta pública: R$ 1.000,00 por mês.
- A arrecadação e o número de apoiadores são calculados com base nos pagamentos confirmados no mês vigente, no fuso de São Paulo.
- A nova fase começa em 15/11/2026. Nos meses seguintes, a contagem começa automaticamente no primeiro dia de cada mês.
- A lista pública de últimos apoiadores começa vazia e mostra somente contribuições pagas no mês atual.
- O histórico anterior permanece no Supabase; não é apagado nem somado à nova meta mensal.
- A foto original do Thor foi preservada.

## Pagamentos — NexusPag
O endpoint `/api/pagar` cria novas cobranças exclusivamente na NexusPag e registra cada contribuição como pendente no Supabase antes de solicitar o PIX. O nome do doador é opcional; quando não informado, a contribuição aparece como anônima. A mensagem do apoiador também é opcional e só aparece publicamente após a confirmação do pagamento. O site mantém QR Code e PIX copia e cola.

Variáveis necessárias no Vercel:
- `NEXUSPAG_API_KEY`: chave da NexusPag.
- `WEBHOOK_SECRET`: segredo HMAC configurado para o webhook da NexusPag.
- `APP_BASE_URL`: URL pública principal, por exemplo `https://vaquinha-site.vercel.app`.
- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SECRET_KEY`: chave secreta do Supabase, somente no servidor.

Webhook: `https://vaquinha-site.vercel.app/api/webhook`. A integração da vaquinha utiliza somente a NexusPag. As variáveis e os endpoints PixBlack não fazem parte do fluxo do site; mantenha as credenciais da PixBlack exclusivamente no projeto NovaPay. Cobranças PixBlack antigas que ainda estejam pendentes não serão confirmadas por este webhook.

## Transparência sobre o tratamento
O texto público descreve somente o que foi informado: o Thor foi diagnosticado com câncer e precisa de tratamento e cirurgia. Não foram incluídos tipo, estágio, prognóstico, laudo ou custos específicos porque esses dados precisam vir de documentação veterinária confirmada.
