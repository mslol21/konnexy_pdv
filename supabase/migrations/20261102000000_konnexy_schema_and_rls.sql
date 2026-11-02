-- ==============================================================================
-- KONNEXY PDV - SCHEMA POSTGRESQL & POLÍTICAS ROW LEVEL SECURITY (RLS)
-- Multi-inquilino (Multi-tenant), Isolamento por Loja, Outbox Idempotente
-- Valores monetários estritamente em centavos inteiros (BIGINT)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Inquilinos (Tenants)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    document VARCHAR(30) NOT NULL UNIQUE,
    plan VARCHAR(50) NOT NULL DEFAULT 'pro',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Estabelecimentos / Lojas (Stores)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stores_tenant_code UNIQUE (tenant_id, code)
);

-- 3. Membros e Papéis (User Roles / Memberships)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- auth.users(id)
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'stockist')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles_tenant_user UNIQUE (tenant_id, user_id)
);

-- 4. Dispositivos e Terminais PDV
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(100) PRIMARY KEY, -- ID físico do dispositivo gerado no cliente
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    last_sync_at TIMESTAMPTZ,
    is_authorized BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Categorias
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Produtos
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    cost_cents BIGINT NOT NULL DEFAULT 0,
    price_cents BIGINT NOT NULL DEFAULT 0,
    promo_price_cents BIGINT,
    min_stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    has_variants BOOLEAN NOT NULL DEFAULT FALSE,
    image_url TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_products_tenant_store_sku UNIQUE (tenant_id, store_id, sku)
);

-- 7. Variantes de Produto
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    cost_cents BIGINT NOT NULL DEFAULT 0,
    price_cents BIGINT NOT NULL DEFAULT 0,
    min_stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_variants_store_sku UNIQUE (tenant_id, store_id, sku)
);

-- 8. Movimentações de Estoque (Append-Only / Imutável)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sale', 'sale_cancel', 'purchase', 'adjustment', 'loss', 'transfer')),
    quantity INT NOT NULL, -- positivo para entrada, negativo para saída
    unit_cost_cents BIGINT NOT NULL DEFAULT 0,
    reference_id UUID,
    reason TEXT NOT NULL,
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Projeção de Saldo de Estoque
CREATE TABLE IF NOT EXISTS inventory_balances (
    id VARCHAR(255) PRIMARY KEY, -- Composto: tenant_id_store_id_product_id
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    current_stock INT NOT NULL DEFAULT 0,
    reserved_stock INT NOT NULL DEFAULT 0,
    last_movement_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Sessões de Caixa
CREATE TABLE IF NOT EXISTS cash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL REFERENCES devices(id),
    opened_by_user_id UUID NOT NULL,
    opened_by_user_name VARCHAR(255) NOT NULL,
    closed_by_user_id UUID,
    closed_by_user_name VARCHAR(255),
    initial_amount_cents BIGINT NOT NULL DEFAULT 0,
    final_amount_cents BIGINT,
    expected_amount_cents BIGINT,
    difference_cents BIGINT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'closed')),
    notes TEXT
);

-- 11. Movimentações de Caixa
CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('opening', 'supply', 'bleed', 'sale', 'refund', 'closing')),
    amount_cents BIGINT NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Vendas
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL,
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(id),
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    customer_id UUID,
    customer_name VARCHAR(255),
    customer_document VARCHAR(30),
    sale_number INT NOT NULL,
    subtotal_cents BIGINT NOT NULL,
    discount_cents BIGINT NOT NULL DEFAULT 0,
    addition_cents BIGINT NOT NULL DEFAULT 0,
    total_cents BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('completed', 'canceled', 'pending')),
    notes TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canceled_at TIMESTAMPTZ,
    cancel_reason TEXT
);

-- 13. Itens de Venda
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    unit_price_cents BIGINT NOT NULL,
    unit_cost_cents BIGINT NOT NULL,
    discount_cents BIGINT NOT NULL DEFAULT 0,
    total_cents BIGINT NOT NULL
);

-- 14. Pagamentos da Venda
CREATE TABLE IF NOT EXISTS sale_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount_cents BIGINT NOT NULL,
    change_cents BIGINT NOT NULL DEFAULT 0,
    received_cents BIGINT NOT NULL,
    installments INT DEFAULT 1,
    card_brand VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Estornos Auditados
CREATE TABLE IF NOT EXISTS sale_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    refunded_by_user_id UUID NOT NULL,
    refunded_by_user_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Clientes e Fornecedores
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(30),
    email VARCHAR(255),
    phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(30),
    contact_name VARCHAR(255),
    phone VARCHAR(30),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Lançamentos Financeiros
CREATE TABLE IF NOT EXISTS financial_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('payable', 'receivable')),
    category VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount_cents BIGINT NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'canceled')),
    customer_id UUID REFERENCES customers(id),
    supplier_id UUID REFERENCES suppliers(id),
    sale_id UUID REFERENCES sales(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Chaves de Idempotência e Log de Eventos de Sincronização
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_summary TEXT
);

CREATE TABLE IF NOT EXISTS sync_events (
    event_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_version INT NOT NULL DEFAULT 1,
    operation_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS)
-- Isolamento absoluto por tenant e permissão de leitura/escrita autenticada
-- ==============================================================================

-- Função auxiliar que retorna o tenant_id do usuário autenticado atual
CREATE OR REPLACE FUNCTION get_current_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Ativa RLS em todas as tabelas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

-- Políticas de Isolamento Multi-tenant
CREATE POLICY tenant_isolation_stores ON stores
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_products ON products
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_sales ON sales
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_cash_sessions ON cash_sessions
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_financial ON financial_entries
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

-- ==============================================================================
-- FUNÇÃO RPC: INGESTÃO EM LOTE IDEMPOTENTE (process_sync_batch)
-- ==============================================================================

CREATE OR REPLACE FUNCTION process_sync_batch(
    p_device_id VARCHAR,
    p_events JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_event JSONB;
    v_event_id UUID;
    v_confirmed_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        v_event_id := (v_event->>'event_id')::UUID;

        -- Verifica se o evento já foi processado anteriormente (Idempotência)
        IF NOT EXISTS (SELECT 1 FROM sync_events WHERE event_id = v_event_id) THEN
            INSERT INTO sync_events (
                event_id,
                tenant_id,
                store_id,
                device_id,
                aggregate_id,
                aggregate_type,
                aggregate_version,
                operation_type,
                payload,
                created_at,
                synced_at
            ) VALUES (
                v_event_id,
                (v_event->>'tenant_id')::UUID,
                (v_event->>'store_id')::UUID,
                p_device_id,
                v_event->>'aggregate_id',
                v_event->>'aggregate_type',
                COALESCE((v_event->>'aggregate_version')::INT, 1),
                v_event->>'operation_type',
                (v_event->'payload'),
                (v_event->>'created_at')::TIMESTAMPTZ,
                NOW()
            );
        END IF;

        v_confirmed_ids := array_append(v_confirmed_ids, v_event_id);
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'confirmed_event_ids', to_jsonb(v_confirmed_ids),
        'server_timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
