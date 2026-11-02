# ADR 001: Arquitetura Offline-First, Outbox Pattern e Persistência Local

- **Status**: Aceito
- **Data**: 2026-11-02
- **Contexto**: O Konnexy PDV é destinado a micro e pequenos varejistas brasileiros que sofrem com instabilidade ou ausência de conexão à internet em pontos de venda. A operação primária de balcão (abertura de caixa, pesquisa instantânea de produtos, adição ao carrinho, concessão de descontos com alçada, registro de múltiplos pagamentos, movimentação de estoque, sangrias, suprimentos e fechamento de caixa) não pode ser interrompida por indisponibilidade de rede.

## Decisões Arquiteturais

### 1. IndexedDB como Fonte da Verdade Operacional Local (Dexie 4.x)
- Toda e qualquer operação de frente de caixa e movimentação ocorre primeiramente no banco local IndexedDB via Dexie.
- As operações são transacionais e atômicas: a gravação de uma venda insere os itens, os pagamentos, debita os saldos de estoque via movimentos imutáveis, registra a movimentação de caixa e gera um evento de sincronização na tabela `sync_events` (Outbox).
- IDs primários são UUIDv4 gerados no cliente, garantindo unicidade sem necessidade de roundtrip com o servidor.

### 2. Padrão Outbox Transacional (Outbox Pattern)
- Todas as mutações locais geram uma entrada correspondente em `sync_events` dentro da mesma transação do IndexedDB.
- Estrutura do evento: `event_id` (UUID), `tenant_id`, `store_id`, `device_id`, `aggregate_id`, `aggregate_version`, `operation_type`, `payload`, `created_at`, `sync_status` (`pending`, `synced`, `failed`, `conflict`), `retry_count`, `error_message`.
- Um Sync Engine em segundo plano monitora a conectividade (`navigator.onLine` e ping ativo) e despacha lotes de eventos via POST idempotente com backoff exponencial.

### 3. Moeda e Arredondamentos Financeiros
- Valores monetários são estritamente representados como inteiros em centavos (`integer`).
- Não se utiliza ponto flutuante (`float`/`double`) para cálculos de totais, troco, descontos ou rateios, eliminando erros de precisão decimal (ex: `19.99 * 3` -> `1999 * 3 = 5997 centavos` = `R$ 59,97`).

### 4. Modelo de Estoque Append-Only
- O estoque nunca é atualizado via mutação destrutiva cega (`UPDATE stock = stock - qty`).
- Toda alteração gera um registro em `inventory_movements` com motivo (`sale`, `purchase`, `adjustment`, `loss`, `transfer`), referência de documento e responsável.
- A tabela `inventory_balances` atua como uma projeção rápida local, recalculável a qualquer momento a partir dos movimentos.
- Concorrência offline: se dois dispositivos venderem offline o último item, ambas as vendas são preservadas (imutabilidade contábil) e um status de divergência de estoque negativo é sinalizado para auditoria e reposição física.

### 5. Multi-inquilino (Multi-tenant) e Isolamento
- Toda entidade possui `tenant_id` e, quando geográfica, `store_id`.
- Chaves compostas de unicidade (ex: SKU de produto) são únicas por loja/tenant (`[tenant_id+store_id+sku]`), permitindo repetição de códigos entre lojistas distintos.

### 6. PWA Instalável e Preparação para Tauri 2
- Cache de App Shell via Workbox com estratégia Cache-First para assets estáticos e Stale-While-Revalidate para fontes e ícones.
- O código do core de dados e serviços é desacoplado da interface gráfica por meio de adapters, possibilitando empacotamento desktop via Tauri 2 (com drivers de impressão direta ESC/POS) sem alterar as regras de negócio da PWA web.
