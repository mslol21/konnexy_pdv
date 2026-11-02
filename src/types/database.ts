/**
 * Konnexy PDV - Definições de Tipos e Entidades do Banco de Dados
 * Todos os valores monetários são estritamente inteiros em centavos (cents).
 */

export type RoleName = 'owner' | 'manager' | 'cashier' | 'stockist';

export type SyncStatus = 'pending' | 'synced' | 'failed' | 'conflict';

export type OperationType = 
  | 'INSERT' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'SALE_CREATE' 
  | 'SALE_REFUND' 
  | 'CASH_OPEN' 
  | 'CASH_CLOSE' 
  | 'CASH_MOVEMENT' 
  | 'INVENTORY_ADJUST';

export type PaymentMethod = 'money' | 'pix' | 'credit_card' | 'debit_card' | 'voucher' | 'other';

export type SaleStatus = 'completed' | 'canceled' | 'pending';

export type MovementType = 'sale' | 'sale_cancel' | 'purchase' | 'adjustment' | 'loss' | 'transfer';

export type CashMovementType = 'opening' | 'supply' | 'bleed' | 'sale' | 'refund' | 'closing';

export type FinancialType = 'receivable' | 'payable';

export type FinancialStatus = 'pending' | 'paid' | 'overdue' | 'canceled';

// 1. Inquilino (Tenant)
export interface Tenant {
  id: string; // UUID
  name: string;
  document: string; // CNPJ ou CPF
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// 2. Estabelecimento (Store / Filial)
export interface Store {
  id: string; // UUID
  tenant_id: string;
  name: string;
  code: string; // Ex: 'MATRIZ', 'FILIAL-01'
  address?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

// 3. Usuário e Vinculação (Membership / User)
export interface UserRole {
  id: string;
  tenant_id: string;
  user_id: string;
  store_id?: string | null; // Nulo se for acesso global a todas as lojas
  role: RoleName;
  name: string;
  email: string;
  pin_hash?: string; // Hash seguro de PIN de 4 a 6 dígitos para troca rápida de operador
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 4. Dispositivo (Device)
export interface Device {
  id: string; // UUID persistido no cliente
  tenant_id: string;
  store_id: string;
  name: string; // Ex: 'PDV Balcão 1'
  last_sync_at?: string;
  is_authorized: boolean;
  created_at: string;
}

// 5. Categoria de Produto
export interface Category {
  id: string;
  tenant_id: string;
  store_id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

// 6. Produto
export interface Product {
  id: string;
  tenant_id: string;
  store_id: string;
  category_id?: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  unit: string; // 'UN', 'KG', 'L', 'CX'
  cost_cents: number; // Custo em centavos
  price_cents: number; // Preço de venda padrão
  promo_price_cents?: number | null; // Preço promocional se ativo
  min_stock: number;
  is_active: boolean;
  has_variants: boolean;
  image_url?: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// 7. Variante de Produto (Tamanho / Cor / etc.)
export interface ProductVariant {
  id: string;
  product_id: string;
  tenant_id: string;
  store_id: string;
  sku: string;
  barcode?: string;
  name: string; // Ex: 'Tamanho G / Azul'
  cost_cents: number;
  price_cents: number;
  min_stock: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

// 8. Movimentações de Estoque (Imutável / Append-only)
export interface InventoryMovement {
  id: string; // UUID
  tenant_id: string;
  store_id: string;
  product_id: string;
  variant_id?: string | null;
  type: MovementType;
  quantity: number; // Positivo para entrada, negativo para saída
  unit_cost_cents: number;
  reference_id?: string; // ID da venda, compra ou ajuste
  reason: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

// 9. Saldo de Estoque (Projeção local rápida)
export interface InventoryBalance {
  id: string; // Composto: tenant_id + store_id + product_id (+ variant_id)
  tenant_id: string;
  store_id: string;
  product_id: string;
  variant_id?: string | null;
  current_stock: number;
  reserved_stock: number;
  last_movement_at: string;
  updated_at: string;
}

// 10. Sessão de Caixa
export interface CashSession {
  id: string; // UUID
  tenant_id: string;
  store_id: string;
  device_id: string;
  opened_by_user_id: string;
  opened_by_user_name: string;
  closed_by_user_id?: string;
  closed_by_user_name?: string;
  initial_amount_cents: number; // Valor de abertura (suprimento inicial)
  final_amount_cents?: number; // Valor declarado no fechamento
  expected_amount_cents?: number; // Valor calculado pelo sistema
  difference_cents?: number; // Diferença (quebra/sobra)
  opened_at: string;
  closed_at?: string;
  status: 'open' | 'closed';
  notes?: string;
}

// 11. Movimentações de Caixa (Sangria, Suprimento)
export interface CashMovement {
  id: string;
  cash_session_id: string;
  tenant_id: string;
  store_id: string;
  type: CashMovementType;
  amount_cents: number;
  payment_method: PaymentMethod;
  reason: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

// 12. Venda
export interface Sale {
  id: string; // UUID
  tenant_id: string;
  store_id: string;
  device_id: string;
  cash_session_id: string;
  user_id: string;
  user_name: string;
  customer_id?: string | null;
  customer_name?: string;
  customer_document?: string;
  sale_number: number; // Sequencial local do dispositivo ou global
  subtotal_cents: number;
  discount_cents: number;
  addition_cents: number;
  total_cents: number;
  status: SaleStatus;
  notes?: string;
  sync_status: SyncStatus;
  version: number;
  created_at: string;
  canceled_at?: string;
  cancel_reason?: string;
}

// 13. Itens da Venda
export interface SaleItem {
  id: string; // UUID
  sale_id: string;
  product_id: string;
  variant_id?: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
  unit_cost_cents: number;
  discount_cents: number;
  total_cents: number;
}

// 14. Pagamentos da Venda (Multi-pagamento)
export interface SalePayment {
  id: string; // UUID
  sale_id: string;
  payment_method: PaymentMethod;
  amount_cents: number;
  change_cents: number; // Troco retornado ao cliente
  received_cents: number; // Valor entregue pelo cliente
  installments?: number;
  card_brand?: string;
  created_at: string;
}

// 15. Estorno de Venda (Auditoria)
export interface SaleRefund {
  id: string;
  sale_id: string;
  tenant_id: string;
  store_id: string;
  reason: string;
  amount_cents: number;
  refunded_by_user_id: string;
  refunded_by_user_name: string;
  created_at: string;
}

// 16. Cliente
export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  document?: string; // CPF ou CNPJ
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

// 17. Fornecedor
export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  document?: string; // CNPJ
  contact_name?: string;
  phone?: string;
  email?: string;
  created_at: string;
}

// 18. Lançamento Financeiro (Contas a Pagar / Receber)
export interface FinancialEntry {
  id: string;
  tenant_id: string;
  store_id: string;
  type: FinancialType;
  category: string;
  description: string;
  amount_cents: number;
  due_date: string;
  paid_date?: string;
  status: FinancialStatus;
  customer_id?: string;
  supplier_id?: string;
  sale_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 19. Evento Outbox para Sincronização (Crítico para Offline-First)
export interface SyncEvent {
  event_id: string; // UUIDv4
  tenant_id: string;
  store_id: string;
  device_id: string;
  aggregate_id: string; // ID da entidade (ex: sale.id, inventory.id)
  aggregate_type: string; // 'sale', 'cash_session', 'inventory_movement', etc.
  aggregate_version: number;
  operation_type: OperationType;
  payload: Record<string, unknown>; // JSON com todos os dados da mutação
  created_at: string;
  sync_status: SyncStatus;
  retry_count: number;
  error_message?: string;
  synced_at?: string;
}

// 20. Log de Auditoria Local e Remoto
export interface AuditLog {
  id: string;
  tenant_id: string;
  store_id?: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details?: string;
  created_at: string;
}

// 21. Chave de Idempotência
export interface IdempotencyKey {
  key: string;
  created_at: string;
  response_summary?: string;
}
