# Konnexy PDV — Ponto de Venda Offline-First

Sistema moderno de frente de caixa (PDV), controle de estoque imutável e gestão financeira para o varejo brasileiro (pt-BR, R$ BRL, fuso horário local).

Projetado com arquitetura **Offline-First**, utilizando IndexedDB via Dexie 4.x como fonte de verdade local e padrão **Outbox Pattern** para sincronização idempotente e resiliente.

---

## 🚀 Stack Tecnológica

- **Core & Runtime**: React 19, TypeScript strict, Vite 6
- **Estilização & UI**: Tailwind CSS v4, Lucide Icons, design responsivo touch-friendly (alvos >= 44px)
- **Persistência Local**: IndexedDB via Dexie 4.x
- **PWA & Offline**: `vite-plugin-pwa` + Workbox com cache de App Shell
- **Estado Global**: Zustand com persistência em storage
- **Consultas & Cache**: TanStack React Query v5
- **Validação & Tipos**: Zod, TypeScript strict
- **Testes Automatizados**: Vitest, React Testing Library, fake-indexeddb
- **Backend & Nuvem**: Supabase (Postgres, RLS por tenant/loja, Auth)

---

## 🛠️ Comandos Disponíveis

```bash
# Instalação das dependências
npm install

# Execução em ambiente de desenvolvimento
npm run dev

# Validação de tipos e build de produção PWA
npm run build

# Execução dos testes automatizados com Vitest
npm test

# Testes em modo contínuo (watch)
npm run test:watch
```

---

## 📦 Estrutura de Diretórios

```
konnexy-pdv/
├── docs/                      # Documentação de arquitetura, ADRs e guias operacionais
│   ├── adr/
│   │   └── 001-arquitetura-offline-first.md
│   ├── dod.md                 # Critérios de aceitação e Definition of Done
│   ├── roadmap-backlog.md     # Fases de execução 0 a 5 rastreadas e concluídas
│   ├── deployment-guide.md    # Guia completo de implantação Supabase, PWA e Hardware
│   └── acceptance-checklist.md# Checklist de aceitação e testes de estresse
├── public/                    # Manifest PWA, ícones e assets estáticos
├── supabase/
│   └── migrations/            # Schema PostgreSQL, RLS multi-tenant e RPC process_sync_batch
├── src/
│   ├── app/                   # Roteamento e providers principais
│   ├── components/            # Design system, layout responsivo e banners offline
│   │   ├── layout/            # Header, Sidebar, BottomNav e AppLayout
│   │   └── ui/                # Botões, Inputs, Cards, Badges, Indicadores
│   ├── features/              # Módulos de negócio da aplicação
│   │   ├── auth/              # Sessão local, autenticação e PIN de 4 dígitos
│   │   ├── dashboard/         # Métricas em tempo real locais e alertas de estoque
│   │   ├── pdv/               # Frente de caixa touch, leitor de código de barras e recibo térmico
│   │   ├── products/          # Catálogo com SKU único por loja, busca e exportação CSV
│   │   ├── inventory/         # Movimentação append-only de estoque e auditoria
│   │   ├── cash/              # Abertura, fechamento cego, sangria e suprimento de caixa
│   │   ├── financial/         # Contas a pagar/receber e DRE gerencial simplificado
│   │   ├── reports/           # Relatórios analíticos por produto, pagamento e operador
│   │   ├── customers/         # Cadastro de clientes/fornecedores com LGPD e compras
│   │   └── settings/          # Gerenciamento de operadores (PIN), backup e reset
│   ├── lib/
│   │   ├── adapters/          # Abstração de hardware desktop nativo (Tauri 2 ESC/POS, balança, gaveta)
│   │   ├── db/                # Schema Dexie 4.x, índices compostos e seed de demonstração
│   │   ├── services/          # Camada de serviços atômicos (saleService, cashService, etc.)
│   │   ├── sync/              # Fila outbox e engine de sincronização com retry exponencial
│   │   └── utils/             # Formatadores BRL (centavos inteiros), datas pt-BR e IDs
│   ├── store/                 # Gerenciamento de estado (Auth, UI)
│   ├── types/                 # Modelos canônicos de 21 entidades do domínio
│   └── test/                  # Testes automatizados com Vitest e fake-indexeddb
└── vite.config.ts             # Configuração do Vite, Tailwind e Service Worker PWA
```

---

## 🔒 Princípios de Segurança e Integridade

1. **Moeda em Centavos Inteiros**: Nenhum cálculo financeiro utiliza ponto flutuante (`float`). Todos os preços, custos, subtotais e trocos utilizam números inteiros (`price_cents`, `total_cents`).
2. **Estoque Append-Only**: O saldo em estoque é fruto de movimentações imutáveis (`inventory_movements`), garantindo rastreabilidade e auditoria.
3. **Outbox Pattern e Idempotência**: Mutações locais geram registros em `sync_events` na mesma transação atômica do IndexedDB com chaves UUID determinísticas.
4. **Alvará Offline e RBAC**: O terminal autoriza operadores cadastrados localmente através de PIN de 4 dígitos mesmo quando sem rede, aplicando limites de desconto de acordo com o papel.
5. **Comprovante Não Fiscal**: Emissão de recibos térmicos (58mm/80mm) via `window.print()` e adapter para impressoras ESC/POS, sempre com a indicação legal "DOCUMENTO NÃO FISCAL".
