# Dollar Float

Pagina de produto unico com Express, Firestore e checkout hospedado AbacatePay API v2.

## Desenvolvimento

Use Node.js 24. Execute `npm ci`, copie `.env.example` para `.env` e preencha as variaveis locais. Execute `npm start` e abra http://localhost:3000. O Go Live nao executa o backend.

`PAYMENT_PROVIDER=disabled` deixa as vendas desligadas. O modo local usa dados em `server/data/`, ignorados pelo Git. Nunca publique `.env`, credenciais JSON ou dados locais.

## Cadastro inicial

Configure Firebase e `DATA_PROVIDER=firebase`. Defina `ADMIN_EMAIL`, uma `ADMIN_PASSWORD` unica com pelo menos 16 caracteres e `INITIAL_STOCK`. Execute `npm run seed`. O comando preserva produto e administrador existentes. Para trocar explicitamente a senha e revogar sessoes, execute `npm run seed -- --reset-password`.

## Hospedagem Vercel

Configure Node.js 24 e use `vercel.json`. Configure no servidor: `NODE_ENV=production`, `APP_URL` (origem HTTPS), `DATA_PROVIDER=firebase`, `JWT_SECRET` aleatorio com pelo menos 48 caracteres, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` e `PAYMENT_PROVIDER=disabled`.

As credenciais administrativas usadas no seed nao precisam ser enviadas para a hospedagem. Publique as regras `firestore.rules` no projeto Firebase correspondente. O frontend nao acessa o banco diretamente; o Admin SDK usa IAM. Restrinja o acesso da conta de servico e ative a politica TTL para `rate_limits.expiresAt`.

## AbacatePay

Cadastre um produto avulso ativo por R$ 119,90 na AbacatePay e use `ABACATEPAY_PRODUCT_ID`. Configure `ABACATEPAY_API_KEY`, `ABACATEPAY_ENV=sandbox` e `ABACATEPAY_WEBHOOK_SECRET` aleatorio com pelo menos 32 caracteres. Permissoes da chave: PRODUCT:READ, CHECKOUT:CREATE, CHECKOUT:READ.

Cadastre o webhook HTTPS `/webhook/payment` com o mesmo secret e eventos `checkout.completed`, `checkout.refunded`, `checkout.disputed`. O provedor envia `webhookSecret` na query; nao registre URLs completas do webhook em logs. Configure a plataforma de logs para ocultar esse parametro.

Apos configurar o webhook, use `PAYMENT_PROVIDER=abacatepay` e valide o fluxo completo em sandbox. A confirmacao de pagamento exige secret, assinatura, consulta autenticada da cobranca e transacao no banco. O retorno ao site nao confirma pagamento sozinho. Cupons locais nao sao aceitos nesta oferta.

No Firebase, ABACATEPAY_ENV=sandbox usa colecoes com prefixo sandbox_ e preserva o estoque operacional. Execute o seed nesse ambiente antes de testar. Na hospedagem, apenas administradores autenticados podem iniciar compras sandbox; abra /?teste=1 apos entrar no painel. Visitantes ficam com compras bloqueadas. Antes das vendas reais, configure chaves e produto reais, webhook de producao, dominio final, estoque, identificacao do vendedor, atendimento e textos definitivos de termos e privacidade. O frete anunciado e gratis para todo o Brasil, com entrega em ate 7 dias apos confirmar o pagamento.

## Reconciliacao

`npm run reconcile` consulta ate 100 pedidos por estado sem altera-los. `npm run reconcile -- --apply` aplica pagamentos verificados e libera reservas de cobrancas expiradas/canceladas. Timeout na criacao de cobranca mantem a reserva; investigue pedidos nao localizados no gateway antes de qualquer liberacao manual. Configure uma rotina operacional de reconciliacao antes das vendas reais.

## Verificacao

`npm test` executa testes isolados, sem pagamentos reais, usando uma API simulada e banco temporario. `npm audit` verifica vulnerabilidades conhecidas nas dependencias. Esses testes nao substituem a verificacao da integracao externa, regras/IAM reais, navegador e hospedagem.

A conta atual permite Pix. O checkout solicita apenas PIX; nao anunciar cartao antes da habilitacao na AbacatePay e da atualizacao do provider.
