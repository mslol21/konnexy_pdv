# Checklist de Aceitação e Homologação — Konnexy PDV

Este checklist consolida todos os critérios de aceitação exigidos pelo projeto **Konnexy PDV** para homologação técnica e operacional.

---

## 1. Persistência Local e Offline-First
- [x] **IndexedDB como Fonte Única da Verdade**: Todas as consultas e gravações de venda, caixa e produtos utilizam o Dexie 4.x localmente.
- [x] **Operação Completa sem Conexão**: O sistema permite abrir caixa, lançar produtos, aplicar descontos, receber em múltiplos métodos e fechar vendas com o cabo de rede desconectado ou em modo avião.
- [x] **Fila de Saída Durável (Outbox Pattern)**: Cada transação de venda e movimentação gera registro imutável em `sync_events` com chave de idempotência única (`idempotency_key = client_generated_uuid`).
- [x] **Reconciliação e Idempotência**: A sincronização com o Supabase é idempotente (`ON CONFLICT (idempotency_key) DO NOTHING`) e mantém integridade após reconexão.
- [x] **Bateria de 20 Vendas Offline**: Teste de estresse automatizado valida 20 vendas consecutivas offline sem falha de persistência (`src/test/offline_stress.test.ts`).

---

## 2. Frente de Caixa (PDV)
- [x] **Catálogo e Busca Rápida**: Busca instantânea por descrição, SKU ou código de barras EAN-13 com debounce.
- [x] **Leitor de Código de Barras USB**: Interceptação automática de leitores HID via teclado sem perda de caracteres (`useBarcodeScanner`).
- [x] **Carrinho de Compras Interativo**: Adição rápida, incremento, decremento e remoção de itens em tempo real.
- [x] **Descontos com Alçada por Papel (RBAC)**:
  - Operador de Caixa: Desconto limitado a no máximo 10%.
  - Gerente / Proprietário: Desconto de até 100%.
- [x] **Pagamento Misto / Dividido**: Divisão de uma mesma venda entre Dinheiro, Pix e Cartão de Débito/Crédito.
- [x] **Cálculo Preciso de Troco**: Cálculo exato em centavos inteiros (sem imprecisão de ponto flutuante).
- [x] **Impressão Não Fiscal**: Visualização e impressão térmica em formatos 58mm e 80mm com aviso explícito "DOCUMENTO NÃO FISCAL".

---

## 3. Gestão de Caixa
- [x] **Abertura de Turno**: Registro de valor inicial (fundo de troco / suprimento inicial).
- [x] **Suprimento e Sangria**: Registro de entradas e retiradas avulsas com motivo/observação e impacto imediato no saldo em dinheiro.
- [x] **Conferência Cega (Blind Close)**: O operador informa a contagem física de dinheiro sem visualizar previamente o valor teórico do sistema.
- [x] **Auditoria de Divergência**: Registro automático de falta ou sobra de caixa para prestação de contas gerencial.

---

## 4. Estoque e Auditoria
- [x] **Modelo Append-Only**: O saldo não é editado de forma direta ou destrutiva; decorre da agregação de movimentações imutáveis (`inventory_movements`).
- [x] **Projeção de Saldo Otimizada**: Tabela `inventory_balances` mantém o saldo atualizado para consultas rápidas, com suporte a recálculo total a partir do histórico (`recalculateInventoryBalance`).
- [x] **Tratamento de Estoque Negativo**: Quando dois terminais vendem simultaneamente o último item offline, ambas as vendas são mantidas no banco de dados e uma anotação de divergência/alerta de estoque negativo é gerada para conferência física.
- [x] **Alerta de Estoque Mínimo**: Destaque visual em crachá/badge vermelho para itens cujo saldo é menor ou igual ao estoque mínimo configurado.

---

## 5. Financeiro e DRE Gerencial
- [x] **Contas a Pagar e a Receber**: Cadastro de lançamentos com data de vencimento, categoria, valor em centavos e baixa com data de pagamento.
- [x] **DRE Gerencial Simplificado**:
  - Receita Bruta
  - (-) Descontos Concedidos
  - (=) Receita Líquida
  - (-) CMV (Custo das Mercadorias Vendidas baseado no custo cadastral dos produtos)
  - (=) Margem Bruta
  - (-) Despesas Operacionais Baixadas
  - (=) Resultado Operacional Estimado
- [x] **Relatórios com Exportação CSV**: Relatórios de vendas por produto, por forma de pagamento e por operador com download em CSV formatado em pt-BR.

---

## 6. Usuários, Segurança e LGPD
- [x] **Controle de Acesso RBAC**: Matriz de permissões estrita para papéis `owner`, `manager`, `cashier` e `stockist`.
- [x] **Bloqueio Rápido por PIN**: Modal de desbloqueio com PIN de 4 dígitos para troca rápida de operador ou pausa de terminal sem expor a senha principal.
- [x] **Clientes e Fornecedores**: Cadastro com opção de CPF/CNPJ opcional e consentimento de comunicação (LGPD).
- [x] **Histórico de Compras**: Visualização das compras anteriores do cliente diretamente no PDV.

---

## 7. PWA, Usabilidade e Acessibilidade
- [x] **Instalação PWA**: Manifest com cores corporativas (`#0284c7`), ícones SVG/PNG e modo de exibição `standalone`.
- [x] **Service Worker e Cache Workbox**: Estratégias de cache para fontes, scripts e folhas de estilo garantem carregamento instantâneo offline.
- [x] **Acessibilidade Touch**: Todos os botões e áreas de toque interativas possuem dimensão mínima de 44x44px.
- [x] **Responsividade**: Layout adaptável para telas desktop, tablets e smartphones (com menu inferior `BottomNav`).
- [x] **Indicadores de Estado**: Badge animado informando status de conectividade (`Online` / `Offline`) e fila de eventos pendentes de sincronização.

---

## 8. Backend Supabase e Isolamento Multi-Inquilino
- [x] **Políticas RLS**: Todas as tabelas possuem `ENABLE ROW LEVEL SECURITY` e políticas `USING (tenant_id = get_current_user_tenant_id())`.
- [x] **RPC Idempotente**: Função `process_sync_batch` processa vendas, movimentações de estoque e eventos de caixa sem duplicar registros em cenários de reenvio de rede.
