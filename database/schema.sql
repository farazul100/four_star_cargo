-- ============================================================================
-- M/S FOUR STAR CARGO — HOSTINGER VPS SQL DATABASE SCHEMA
-- Target Engine: PostgreSQL / MySQL on Hostinger VPS
-- File: /database/schema.sql
-- ============================================================================

-- 1. WAREHOUSES TABLE
CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    is_final_destination BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- super_admin, operation_director, warehouse_incharge, accountant
    warehouse_id VARCHAR(36) REFERENCES warehouses(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. CARTONS TABLE
CREATE TABLE IF NOT EXISTS cartons (
    id VARCHAR(36) PRIMARY KEY,
    ctn_no VARCHAR(100) NOT NULL,
    shipping_mark VARCHAR(100) NOT NULL,
    tracking_number VARCHAR(100) NOT NULL,
    product_name_en VARCHAR(255) NOT NULL,
    product_name_cn VARCHAR(255),
    quantity INT NOT NULL DEFAULT 1,
    net_weight DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    gross_weight DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cbm DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    current_warehouse_id VARCHAR(36) NOT NULL REFERENCES warehouses(id),
    destination_warehouse_id VARCHAR(36) REFERENCES warehouses(id),
    status VARCHAR(50) NOT NULL DEFAULT 'booked', -- booked, proposed, in_transit, received, delivered
    flying_date DATE,
    booked_by VARCHAR(36) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. FLYING PROPOSALS TABLE
CREATE TABLE IF NOT EXISTS flying_proposals (
    id VARCHAR(36) PRIMARY KEY,
    warehouse_id VARCHAR(36) NOT NULL REFERENCES warehouses(id),
    proposed_by VARCHAR(36) NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, finalized, rejected
    finalized_by VARCHAR(36) REFERENCES users(id),
    finalized_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. FLYING PROPOSAL ITEMS TABLE
CREATE TABLE IF NOT EXISTS flying_proposal_items (
    id VARCHAR(36) PRIMARY KEY,
    proposal_id VARCHAR(36) NOT NULL REFERENCES flying_proposals(id) ON DELETE CASCADE,
    carton_id VARCHAR(36) NOT NULL REFERENCES cartons(id) ON DELETE CASCADE,
    destination_warehouse_id VARCHAR(36) NOT NULL REFERENCES warehouses(id)
);

-- 6. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. LEDGER ENTRIES TABLE
CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- charge, payment
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    note TEXT,
    source VARCHAR(50) NOT NULL DEFAULT 'manual', -- manual, auto_cash_collection
    entered_by VARCHAR(36) NOT NULL REFERENCES users(id),
    warehouse_id VARCHAR(36) REFERENCES warehouses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    meta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. CARTON STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS carton_status_history (
    id VARCHAR(36) PRIMARY KEY,
    carton_id VARCHAR(36) NOT NULL REFERENCES cartons(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL REFERENCES warehouses(id),
    changed_by VARCHAR(36) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- HIGH-PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX idx_cartons_ctn_no ON cartons(ctn_no);
CREATE INDEX idx_cartons_tracking_number ON cartons(tracking_number);
CREATE INDEX idx_cartons_current_warehouse ON cartons(current_warehouse_id);
CREATE INDEX idx_cartons_dest_warehouse ON cartons(destination_warehouse_id);
CREATE INDEX idx_cartons_status ON cartons(status);
CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_ledger_customer ON ledger_entries(customer_id);
