# Vaquinha do Thor — versão reformulada

## O que mudou
- Página da campanha separada da tela de contribuição.
- Compartilhamento usando o menu nativo do celular (`navigator.share`) e alternativa para copiar o link.
- Doação exclusivamente via PIX.
- Valor inicial selecionado de R$ 10,00 e validação de mínimo R$ 1,00 no navegador e na API.
- Nome opcional; o formulário não pede CPF, telefone nem e-mail.
- A criação de PIX não aumenta artificialmente o total arrecadado no navegador.
- Mantida a foto `IMG_1531.jpeg` e os valores/lista de apoiadores que estavam no projeto enviado.

## Antes de publicar
1. Substitua os arquivos no GitHub e faça o deploy no Vercel.
2. Em Vercel → Settings → Environment Variables, configure `NEXUSPAG_API_KEY` com sua chave atual. Não coloque a chave no código nem a envie em chats.
3. Faça um teste controlado com valor baixo e confirme se o formato de resposta atual da NexusPag corresponde aos campos lidos em `api/pagar.js`.
4. O código atual **ainda não está conectado a um banco de dados**. Não altere nem remova o mecanismo atual de gateway até configurar a persistência e os webhooks. A arrecadação inicial e a lista de apoiadores são exibidas como os valores existentes no site enviado, não são importadas para uma base persistente por este pacote.

## Banco de dados e confirmação de pagamentos
Para automatizar com segurança, ainda é necessário configurar um banco (por exemplo, Supabase), tabela de doações, endpoint de webhook da NexusPag e validação da autenticidade da notificação. O webhook deve localizar a cobrança por `external_id`, verificar a confirmação no provedor e atualizar a doação de forma idempotente. Nunca confie apenas no status enviado pelo navegador. Até essa configuração existir, o pacote não sincroniza novos pagamentos nem atualiza a arrecadação com base em pagamentos confirmados.

Não configure um webhook sem antes confirmar na documentação da NexusPag o formato exato da notificação e o mecanismo de autenticação/assinatura. Não use valores fictícios para CPF, telefone ou e-mail; se o provedor tornar esses campos obrigatórios, será necessário confirmar a possibilidade de cobrança sem eles com a NexusPag.

## Valores iniciais preservados
- Meta: R$ 30.000,00
- Arrecadação exibida: R$ 467,51
- Apoiadores exibidos: 137
- Últimos nomes e valores: conforme a lista do site enviado.

Observação: os dados históricos acima são preservados visualmente, mas não foram migrados para um banco. Confirme o total correto antes de ativar qualquer automação para evitar duplicidade.

## Integração Supabase + NexusPag (versão atual)
Variáveis de ambiente necessárias no Vercel:
- `SUPABASE_URL`: Project URL do Supabase.
- `SUPABASE_SECRET_KEY`: chave secreta do Supabase, somente no servidor.
- `NEXUSPAG_API_KEY`: chave atual da NexusPag.
- `WEBHOOK_SECRET`: segredo HMAC criado/configurado em NexusPag → Dashboard → Integrações → Webhooks.
- `APP_BASE_URL`: URL pública principal do site, por exemplo `https://vaquinha-site.vercel.app`.

O endpoint `/api/pagar` registra a contribuição como pendente antes de criar o PIX e envia `/api/webhook` como URL de webhook. O endpoint `/api/webhook` só aceita evento `payment.confirmed` assinado, com status `paid`, external_id correspondente e valor igual ao registro. `/api/resumo` publica apenas doações pagas. O resumo mantém como base histórica os R$ 467,51 e 137 apoiadores que já eram exibidos no site; esses números antigos ainda não foram importados para a tabela e não devem ser somados novamente se forem migrados depois.

Depois de substituir os arquivos e fazer deploy, configure `APP_BASE_URL` e `WEBHOOK_SECRET` no Vercel e faça novo deploy. No painel NexusPag, ative a assinatura HMAC do webhook e use o mesmo segredo em `WEBHOOK_SECRET`. Configure também o endpoint global `https://vaquinha-site.vercel.app/api/webhook` se a integração da NexusPag exigir registro global; o código também envia a URL no campo `webhook_url` de cada cobrança.
