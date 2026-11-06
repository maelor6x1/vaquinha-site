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
