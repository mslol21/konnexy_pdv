# Roadmap e Backlog de Implementação — Konnexy PDV

## FASE 0: Arquitetura, Contratos e Governança
- [x] Inspeção do ambiente e diretório base.
- [x] ADR 001 — Offline-first, IndexedDB e Outbox Pattern.
- [x] Definição de Pronto (DoD) e padrões de codificação strict.
- [x] Mapa de rotas da aplicação PWA.
- [x] Modelo de dados conceitual e tipagem canônica (TypeScript/Zod).

## FASE 1: Fundação, Design System, PWA e Persistência Local
- [x] Configuração do Vite, TypeScript strict, Tailwind CSS v4, Lucide.
- [x] Configuração PWA (vite-plugin-pwa, Service Worker, Web Manifest, App Shell cache).
- [x] Banco Dexie 4.x com schema versionado e todas as tabelas (tenants, stores, products, sales, cash, outbox, etc.).
- [x] Camada de Seed de dados demonstrativos completos e rastreáveis ("Modo Demonstração").
- [x] Gerenciador de Sessão/Tenant/Dispositivo (Zustand) com suporte a PIN local e chave de dispositivo.
- [x] Layout responsivo multi-dispositivo (Desktop, Tablet e Mobile com BottomNav).
- [x] Utilitários de moeda (centavos para BRL) e datas pt-BR.
- [x] Testes de unidade da FASE 1 (Dexie inicialização, formatadores e isolamento).

## FASE 2: Operações de Venda, Catálogo, Caixa e Estoque Local
- [x] Catálogo de Produtos e Variantes (SKU único por estabelecimento, código de barras, estoque mínimo).
- [x] Motor de Movimentações de Estoque (append-only, cálculo de projeção de saldo).
- [x] Sessão de Caixa (Abertura, Suprimento, Sangria, Fechamento e Conferência cega com divergência).
- [x] Frente de Caixa (PDV):
  - [x] Pesquisa rápida por nome/código e captura de Leitor USB de código de barras.
  - [x] Carrinho com alteração de quantidade, subtotal e desconto com alçada por perfil.
  - [x] Pagamentos múltiplos (Dinheiro, Pix, Cartão Débito/Crédito) com cálculo automático de troco.
  - [x] Finalização atômica (Venda + Estoque + Caixa + Outbox).
  - [x] Emissão de comprovante Não Fiscal (window.print e layout térmico 58mm/80mm).
- [x] Estorno auditado de venda com devolução proporcional ao estoque e caixa.
- [x] Testes de integração da FASE 2 (Venda atômica, estorno, caixa, SKU único).

## FASE 3: Gestão Financeira, Relatórios e Administração
- [x] Contas a Pagar e a Receber (vencimentos, status, baixas parciais/totais).
- [x] Conciliação de Fluxo de Caixa e DRE Gerencial simplificado (CMV vs Faturamento Bruto vs Margem Bruta).
- [x] Relatórios analíticos com exportação CSV e visualização de faturamento por produto, pagamento e operador.
- [x] Controle de Acesso Baseado em Papéis (RBAC: Proprietário, Gerente, Caixa, Estoquista).
- [x] Gestão de Operadores com autenticação por PIN de 4 dígitos e Clientes/Fornecedores LGPD.

## FASE 4: Sincronização e Supabase Backend
- [x] Schema SQL Supabase com RLS (Row Level Security) completo por `tenant_id` e papéis.
- [x] Endpoint de ingestão em lote com resolução de idempotência por `idempotency_keys` (`process_sync_batch`).
- [x] Pull incremental por cursor (`last_synced_at` ou sequence).
- [x] Engine de Sincronização em background com fila outbox, retry exponencial e detecção de conflitos.

## FASE 5: Testes de Aceitação, Auditoria e Empacotamento
- [x] Bateria de testes de integração e estresse offline (20 vendas consecutivas desconectado).
- [x] Testes de isolamento multi-inquilino.
- [x] Validação de PWA auditada (Lighthouse PWA, acessibilidade WCAG AA, service worker precache).
- [x] Abstração de hardware desktop nativo (Tauri 2 ESC/POS, balança serial, gaveta RJ11).
- [x] Documentação completa de implantação e guia operacional (`docs/deployment-guide.md` e `docs/acceptance-checklist.md`).
