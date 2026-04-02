-- Supabase SQL Schema for ОфферДоктор
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id VARCHAR(64) UNIQUE NOT NULL,
  
  -- Scenario & Tariff
  scenario VARCHAR(32) DEFAULT 'marketplace',
  platform VARCHAR(32) DEFAULT '',
  tariff VARCHAR(32) DEFAULT 'main',
  
  -- User input (payload)
  product TEXT,
  audience TEXT,
  link TEXT,
  text TEXT,
  pain TEXT,
  
  -- Payment
  amount DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(32) DEFAULT 'pending',
  paid_amount DECIMAL(10,2),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Analysis
  analysis_status VARCHAR(32) DEFAULT 'pending',
  result JSONB,
  error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for order_id lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_analysis_status ON orders(analysis_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow public read access to orders (for payment status checks)
CREATE POLICY "Public read orders" ON orders
  FOR SELECT USING (true);

-- Allow service role full access (for backend)
CREATE POLICY "Service role full access" ON orders
  FOR ALL USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: If you want automatic updated_at, add column and trigger
-- ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();