# Guia de Implantação e Operação — Konnexy PDV

Este documento descreve o procedimento completo para implantação, configuração do backend Supabase, publicação do PWA e configuração de hardware local no **Konnexy PDV**.

---

## 1. Visão Geral da Arquitetura

O **Konnexy PDV** adota uma arquitetura **Offline-First com Outbox Pattern**:
- **Frontend / Cliente**: PWA (Progressive Web App) desenvolvido em React 19, TypeScript strict, Vite 6 e Tailwind CSS v4.
- **Banco de Dados Local**: IndexedDB gerenciado via Dexie 4.x atuando como fonte única da verdade para operações de caixa e vendas locais.
- **Backend Remoto**: PostgreSQL no Supabase com Row Level Security (RLS) multi-inquilino estrito e RPC `process_sync_batch` para reconciliação atômica de lotes offline.
- **Camada de Hardware**: Impressão Não Fiscal térmica (58mm/80mm) via `window.print()` e leitor de código de barras USB (emulação de teclado HID). Abstração preparada para empacotamento desktop nativo (Tauri 2).

---

## 2. Configuração do Backend (Supabase)

### 2.1. Criação do Projeto
1. Acesse o painel do [Supabase](https://supabase.com) e crie um novo projeto (ex: `konnexy-pdv-prod`).
2. Defina uma senha forte para o banco de dados e selecione a região mais próxima dos seus clientes (ex: `sa-east-1` / São Paulo).

### 2.2. Execução da Migração SQL
No painel do Supabase, acesse **SQL Editor** e execute o conteúdo integral do arquivo:
`supabase/migrations/20261102000000_konnexy_schema_and_rls.sql`

Esta migração cria:
- Tabelas: `tenants`, `stores`, `users`, `categories`, `products`, `product_variants`, `inventory_movements`, `inventory_balances`, `cash_sessions`, `cash_movements`, `sales`, `sale_items`, `sale_payments`, `sync_events`.
- Índices otimizados para busca por estabelecimento, SKU e chave de idempotência.
- Políticas RLS (Row Level Security) garantindo isolamento total por `tenant_id`.
- Função RPC `process_sync_batch(p_events jsonb)` para ingestão e reconciliação atômica de lotes sincronizados.

---

## 3. Variáveis de Ambiente do Frontend

Crie um arquivo `.env` na raiz do projeto (ou configure as variáveis no painel da sua plataforma de hospedagem):

```env
# URL da API do projeto Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co

# Chave pública anônima do Supabase (anon key)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Atenção**: Nunca exponha a chave `service_role` no frontend. Todas as requisições autenticadas devem respeitar as políticas RLS do Supabase.

---

## 4. Compilação e Publicação do Frontend (PWA)

### 4.1. Build de Produção
Execute o comando de compilação:
```bash
npm run build
```
O diretório `dist/` gerado conterá:
- `index.html` otimizado
- Chunks JavaScript e CSS minificados
- Manifest da aplicação (`manifest.webmanifest`)
- Service Worker gerado pelo Workbox (`sw.js` e assets pré-cacheados para funcionamento offline)

### 4.2. Hospedagem Recomendada
O Konnexy PDV pode ser hospedado em qualquer serviço estático compatível com SPA e HTTPS:
- **Vercel**: Deploy automático via Git com rewrite de rotas:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
- **Netlify**: Arquivo `_redirects` na raiz:
  ```text
  /*    /index.html   200
  ```
- **Docker / Nginx**: Certifique-se de configurar SSL (HTTPS obrigatório para PWA) e desativar o cache HTTP para o arquivo `sw.js`:
  ```nginx
  location /sw.js {
      add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
  ```

---

## 5. Instalação do PWA nos Dispositivos

### 5.1. Desktop (Windows, macOS, Linux)
1. Abra o sistema no Google Chrome, Microsoft Edge ou Brave sob conexão HTTPS.
2. Clique no ícone de instalação na barra de endereços (Omnibox) ou vá em **Menu > Instalar Konnexy PDV**.
3. O sistema abrirá em janela dedicada sem barras do navegador, com suporte a atalhos de teclado e persistência offline.

### 5.2. Tablets e Celulares Android
1. Abra o endereço no Google Chrome.
2. Toque no aviso inferior "Adicionar Konnexy PDV à tela inicial" ou no menu de 3 pontos > **Instalar aplicativo**.
3. O ícone aparecerá na gaveta de aplicativos e na tela inicial, iniciando em modo tela cheia standalone.

### 5.3. Apple iOS (iPad / iPhone)
1. Abra o endereço no Safari.
2. Toque no botão **Compartilhar** (ícone do quadrado com seta para cima).
3. Selecione **Adicionar à Tela de Início** e confirme.

---

## 6. Configuração de Hardware e Periféricos

### 6.1. Leitor de Código de Barras USB
- Os leitores padrão de mercado (Honeywell, Elgin, Bematech, Zebra) operam como dispositivos HID (emulação de teclado USB).
- O Konnexy PDV possui interceptor global de leitor (`useBarcodeScanner`):
  - Qualquer leitura que termine com tecla `Enter` ou que ocorra com cadência rápida (< 50ms entre caracteres) é capturada automaticamente para pesquisa e inserção no carrinho, mesmo se o foco não estiver no campo de busca.

### 6.2. Impressoras Térmicas Não Fiscais (58mm e 80mm)
- O sistema emite comprovantes Não Fiscais formatados especificamente para bobinas térmicas de **58mm** ou **80mm**.
- O botão **Imprimir Comprovante** invoca `window.print()` com folhas de estilo `@media print` que ocultam barras de navegação e ajustam margens e tipografia monoespaçada legível.
- Nas configurações de impressão do sistema operacional:
  - Selecione a impressora térmica instalada.
  - Defina as margens como **Nenhuma** (None).
  - Desmarque "Cabeçalhos e rodapés" (Headers and footers).

### 6.3. Gaveta de Dinheiro e Balança Comercial (Roadmap Desktop)
- Para automações que exigem pulso elétrico RJ11 na impressora térmica (abertura de gaveta) ou leitura contínua da porta serial RS-232 / USB Virtual COM (balanças Toledo/Filizola), utilize o adaptador desktop em `src/lib/adapters/desktopAdapter.ts`.
- O adaptador detecta automaticamente se está executando em navegador ou dentro do runtime desktop Tauri 2 (`@tauri-apps/api`), enviando os comandos ESC/POS correspondentes de forma transparente.
