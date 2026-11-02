# PROMPT MESTRE — KONNEXY PDV

Atue como arquiteto de software sênior, engenheiro full-stack, especialista em sistemas POS offline-first e designer de produto. Implemente no repositório um sistema real, não apenas telas demonstrativas, denominado provisoriamente Konnexy PDV. Público: micro e pequenos varejistas brasileiros. Idioma pt-BR, moeda BRL, fuso configurável, datas locais.

## Objetivo e entregáveis
Crie PWA responsiva instalável em desktop, Android e dispositivos iOS compatíveis, com PDV rápido, catálogo/variantes, estoque, caixa, contas a pagar/receber, relatórios e configurações. A operação essencial (abrir caixa previamente autorizado, pesquisar produtos locais, vender, receber, movimentar estoque, registrar despesas e fechar caixa) deve funcionar sem internet. Backend Supabase para autenticação, multiempresa, backup e sincronização. Não alegar suporte a NFC-e, TEF, impressão nativa ou sincronização instantânea offline sem implementação real.

## Stack
React + Vite + TypeScript strict, Tailwind CSS v4, shadcn/ui, React Router, Zustand, TanStack Query, Zod, Dexie/IndexedDB, vite-plugin-pwa/Workbox, Supabase Postgres/Auth/RLS, Vitest, Playwright. Não usar Next.js neste MVP sem justificativa técnica. Preparar adaptador Tauri 2 para desktop nativo futuro, sem bloquear a PWA.

## Design
Interface profissional, clara e comercial, sem estética futurista/IA. Desktop com menu lateral, PDV com pesquisa e carrinho lado a lado; tablet com layout touch; smartphone com navegação inferior e carrinho acessível por painel. Alvos touch >=44px, contraste WCAG AA, acessibilidade por teclado, estados loading/empty/error/offline/sync. Modo claro e escuro. Valores monetários sempre em centavos inteiros; não usar float para cálculos financeiros.

## Módulos e fluxos
1. Onboarding: criar empresa, estabelecimento, usuário administrador, preferências, importar produtos CSV, primeiro caixa. Autenticação inicial online; sessões locais limitadas e vinculadas a dispositivo, PIN opcional com hash seguro e prazo configurável; nunca armazenar senha em claro.
2. Dashboard: vendas do dia, faturamento, ticket médio, despesas, saldo de caixa, produtos com estoque baixo, margem estimada. Indicadores distinguem dados locais, sincronizados e pendentes.
3. Produtos: SKU, código de barras, nome, categoria, unidade, custo, preço, preço promocional, estoque mínimo, ativo, imagem opcional, variações (cor/tamanho), preço por variante, importação/exportação CSV. Impedir SKU duplicado por estabelecimento. Código de barras por leitor USB que emula teclado; câmera somente com permissão e fallback.
4. PDV: pesquisa instantânea local, leitor, carrinho, alteração de quantidade, desconto com limite por perfil, cliente opcional, observações, pagamento dinheiro/Pix/cartão/outros como registro de forma de pagamento (sem processamento integrado), múltiplos meios, troco, venda pendente/concluída/cancelada, comprovante não fiscal, reimpressão e devolução auditada. Transação local atômica: venda + itens + pagamentos + movimentos de estoque + lançamento financeiro + evento outbox.
5. Estoque: entrada, saída, ajuste, inventário, transferências apenas entre estabelecimentos habilitados, histórico imutável, motivo e responsável; não atualizar quantidade sem gerar movimento. Política configurável para estoque negativo; sinalizar risco de concorrência offline.
6. Caixa: abertura, suprimento, sangria, vendas, fechamento, divergência e conferência por meio de pagamento. Despesas vinculadas ao caixa quando aplicável. Cada operação tem autor e timestamp.
7. Financeiro: contas a pagar/receber, categorias, vencimento, baixa parcial/total, despesas, receitas, visão de fluxo de caixa realizado e previsto, conciliação manual e exportação CSV. Separar faturamento de lucro; margem bruta estimada = receita líquida de vendas menos CMV, não confundir com lucro líquido.
8. Clientes e fornecedores: cadastro simples, histórico e pesquisa local; dados mínimos e práticas LGPD.
9. Relatórios: vendas por período, produto, categoria, operador e pagamento; CMV/margem, estoque baixo, movimentações, contas em atraso, fechamento de caixa. Exportação CSV e impressão via navegador.
10. Administração: usuários, papéis (proprietário, gerente, caixa, estoque), permissões por ação, múltiplos estabelecimentos, logs, backup/sync e configurações.

## Modelo de dados
Todas as tabelas de negócio no servidor devem ter tenant_id e, quando aplicável, store_id. Tabelas: tenants, stores, memberships, user_roles, devices, products, product_variants, categories, customers, suppliers, inventory_movements, inventory_balances (projeção), sales, sale_items, sale_payments, sale_refunds, cash_sessions, cash_movements, financial_entries, receivables, payables, sync_events, audit_logs, idempotency_keys. UUIDs gerados no cliente para operações offline. Campos created_at, updated_at, deleted_at quando cabível; version para concorrência otimista. Vendas e movimentos finalizados são imutáveis: corrigir por estorno/evento compensatório. Criar migrações SQL, índices e políticas RLS por tenant/loja/papel, com testes de isolamento. Nunca usar service_role no front-end.

## Sincronização offline-first — requisito crítico
IndexedDB é a fonte operacional local enquanto offline. Todas as mutações passam por um único serviço transacional local e criam evento outbox durável com event_id UUID, tenant_id, store_id, device_id, aggregate_id, aggregate_version, operation_type, payload validado, created_at, sync_status e retry_count. Ao reconectar, sincronizar em lotes pequenos com backoff exponencial, idempotência no servidor e confirmação por evento. Servidor valida permissões, versões e integridade, aplica eventos em transação e devolve cursor para pull incremental. Nunca duplicar vendas ou baixar estoque duas vezes. Mostrar status 'Neste dispositivo', 'Pendente', 'Sincronizado' e 'Conflito'. Conflitos de cadastro: versionamento e resolução explícita; vendas finalizadas: preservar eventos e sinalizar divergência; estoque: movimentos append-only, projeção recalculável, aviso de saldo negativo por concorrência. Não prometer bloqueio global de estoque sem conexão. Operações offline devem continuar após refresh/reabertura. Proteger contra perda de dados por limpeza do navegador: aviso, exportação local e recomendação de sincronização/backup. Não armazenar dados de cartão sensíveis.

## Segurança e conformidade
Supabase Auth online no primeiro acesso; política documentada de autorização offline por sessão/dispositivo e expiração; RLS em todas as tabelas; validação server-side; auditoria; criptografia em trânsito; proteção contra XSS; CSP; mínimo de dados pessoais; exclusão/exportação de dados conforme políticas. A aplicação NÃO emite documento fiscal no MVP. Comprovante deve indicar 'NÃO FISCAL'. NFC-e/SAT/TEF apenas fase posterior com integração certificada e revisão contábil/fiscal brasileira.

## Impressão e dispositivos
Primeira versão: impressão de comprovante não fiscal com window.print e CSS de impressão 58/80mm, onde suportado. Leitor USB tipo teclado. Deixar interfaces de adaptadores para impressoras ESC/POS, gaveta e balança na versão Tauri; não declarar funcionamento universal via navegador.

## Plano de execução obrigatório
FASE 0: inspecionar repositório, criar ADR de arquitetura, mapa de rotas, backlog e definição de pronto. Não sobrescrever código existente sem analisar.
FASE 1: scaffold, design system, PWA com cache seguro de app shell, banco Dexie versionado, dados demo claramente identificados, autenticação/tenant, layout.
FASE 2: produtos, variantes, estoque por movimento, PDV, caixa e pagamentos registrados; fluxos totalmente funcionais offline.
FASE 3: financeiro, relatórios, importação/exportação, usuários/permissões.
FASE 4: Supabase SQL/RLS, endpoint de sincronização idempotente, pull incremental, resolução de conflitos, auditoria.
FASE 5: testes automatizados, acessibilidade, responsividade, PWA install, backup e documentação de implantação.
Entregar código completo de cada fase, migrações, .env.example sem segredos, README, scripts, seed demo, testes e checklist. Não criar botões fictícios, mocks permanentes ou fluxos sem persistência. Antes de prosseguir de fase, rodar lint, typecheck, testes e build, corrigindo erros.

## Testes de aceitação mínimos
- Instalar PWA em navegador compatível; abrir após desconectar a rede.
- Criar produto, abrir caixa, realizar 20 vendas offline, atualizar/reabrir aplicativo e preservar tudo.
- Vender com pagamento misto, desconto, troco e estorno, sem erro de arredondamento.
- Reconciliar 20 vendas após retorno da rede; reenviar lote e provar zero duplicação.
- Dois dispositivos vendem o último item offline: preservar ambas vendas e gerar alerta de divergência.
- Usuário de tenant A não acessa tenant B mesmo alterando requisição.
- Operador caixa não muda preço além do limite nem altera permissões.
- Simular falha no meio da transação: nenhum registro parcial.
- Testar Chrome desktop/Android, Edge e Safari iOS conforme limitações reais.

## Primeira resposta esperada do agente
1. Resumir arquitetura e riscos técnicos em até 20 linhas.
2. Mostrar árvore de diretórios e esquema de dados proposto.
3. Implementar FASE 1 no repositório, sem parar em planejamento.
4. Executar verificações e relatar resultados reais, pendências e próximos passos.
