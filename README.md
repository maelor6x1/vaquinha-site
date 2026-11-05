# Vaquinha do Thor — integração Pix Black

Esta versão mantém a página da campanha, a foto original do Thor, o fluxo de contribuição e o resumo público. A criação de cobranças foi migrada da NexusPag para a Pix Black.

## Regras desta versão

- Valor mínimo por contribuição: **R$ 5,00**, conforme a documentação da Pix Black.
- Valor máximo: R$ 1.000.000,00, sujeito aos limites da conta.
- Nome do doador opcional; não solicitamos CPF, telefone ou e-mail.
- QR Code gerado no servidor a partir de `pix.copy_paste` e código Copia e Cola exibido no checkout.
- Cobranças registradas no Supabase como `pendente`; somente cobranças confirmadas na API da Pix Black passam para `pago`.
- Cobranças expiradas são marcadas como `cancelado`.
- Os registros antigos da NexusPag permanecem no banco. O webhook novo só atualiza linhas com `provedor = pixblack`.
- O resumo público continua somando os pagamentos aprovados e preserva a base histórica de R$ 467,51 e 137 apoiadores que já existia no site. Não importe esses valores novamente para o banco sem revisar a contagem para evitar duplicidade.

## Variáveis de ambiente na Vercel

Configure em **Project → Settings → Environment Variables** (Production e Preview, se usar ambos):

| Nome | Valor |
|---|---|
| `PIXBLACK_API_KEY` | Chave de API da Pix Black (`pxb_live_...`) |
| `PIXBLACK_WEBHOOK_SECRET` | Segredo de assinatura do webhook (`whsec_...`) |
| `SUPABASE_URL` | Project URL do seu projeto Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta do Supabase usada pelo backend |

Mantenha todas essas variáveis somente no servidor. Não as coloque em `app.js`, `index.html` ou em arquivos públicos. Não envie os valores secretos por mensagem.

`APP_BASE_URL`, `NEXUSPAG_API_KEY` e o antigo `WEBHOOK_SECRET` não são usados por esta integração.

## Configuração do webhook na Pix Black

1. No painel Pix Black, abra **Integrações → Webhooks**.
2. Cadastre a URL HTTPS final: `https://SEU-DOMINIO/api/webhook`.
3. Selecione os eventos `charge.paid` e `charge.expired`.
4. Copie o segredo `whsec_...` exibido uma única vez e salve em `PIXBLACK_WEBHOOK_SECRET` na Vercel.
5. Faça um novo deploy depois de configurar as variáveis.
6. Use o botão de teste do painel. O endpoint responde 2xx ao evento `ping` depois de validar a assinatura.

Não cadastre URL que redirecione para outro endereço. O webhook usa o corpo HTTP bruto para validar HMAC-SHA256 e rejeita assinaturas com mais de 5 minutos.

## Supabase

A integração usa a tabela `public.doacoes` existente, com as colunas `nome`, `valor_centavos`, `status`, `provedor`, `pagamento_id`, `criado_em` e `pago_em`. A versão anterior do projeto já utilizava essas colunas; não é necessária uma nova tabela ou migração para este código.

O endpoint `/api/pagar` registra a intenção com uma referência local temporária e, após criar a cobrança, substitui `pagamento_id` pelo ID da cobrança Pix Black. Se essa atualização falhar, o webhook também tenta localizar o registro pela `external_reference` local, para reduzir o risco de perder a associação.

## IPs autorizados e verificação da conta

A Pix Black exige KYC aprovado para liberar a API. Não cadastre uma lista fixa de IPs autorizados para a Vercel sem confirmar com o suporte quais IPs de saída devem ser liberados: funções serverless podem usar IPs variáveis. Uma lista incorreta pode bloquear a criação de cobranças e a consulta feita pelo webhook.

## Teste recomendado antes de divulgar

1. Confirme no painel Pix Black que a conta está verificada e a API está liberada.
2. Configure as quatro variáveis de ambiente e o webhook.
3. Faça deploy e teste a rota `/api/pagar` com uma contribuição de R$ 5,00.
4. Confira se o QR Code aparece e se o Copia e Cola pode ser copiado.
5. Pague uma cobrança de teste controlada e confirme que o webhook marcou somente aquela linha como `pago`.
6. Confira se `/api/resumo` atualizou o total e a lista de apoiadores.
7. Faça também um teste de expiração, se o painel/API oferecer um meio seguro de simular esse evento.

A API de saques não foi integrada ao site. Recomenda-se manter os saques pelo painel até validar por completo os recebimentos. A documentação fornecida não esclarece qual nome/documento aparece na confirmação Pix do pagador; confirme isso diretamente com a Pix Black antes de divulgar a campanha, caso a privacidade do titular seja essencial.
