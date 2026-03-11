-- TechMold POS Database Schema
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'manager', 'cashier')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#0ea5e9',
  icon TEXT DEFAULT 'Package',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'General',
  brand TEXT NOT NULL DEFAULT 'Generic',
  description TEXT,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  visit_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'mobile_money', 'bank_transfer', 'split')),
  payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'refunded', 'partial')),
  cash_received DECIMAL(12,2),
  change_amount DECIMAL(12,2),
  notes TEXT,
  cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cashier_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 15,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'return', 'transfer')),
  quantity INTEGER NOT NULL,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('low_stock', 'new_sale', 'system', 'alert')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipt_number ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);

-- Products policies (all authenticated users)
CREATE POLICY "Authenticated users can view products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON products FOR UPDATE TO authenticated USING (true);

-- Customers policies
CREATE POLICY "Authenticated users can manage customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sales policies
CREATE POLICY "Authenticated users can manage sales" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sale items policies
CREATE POLICY "Authenticated users can manage sale items" ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock movements policies
CREATE POLICY "Authenticated users can manage stock" ON stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Categories policies
CREATE POLICY "Authenticated users can manage categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 'cashier');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Decrease stock on sale
CREATE OR REPLACE FUNCTION decrease_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Create stock movement record
  INSERT INTO stock_movements (product_id, type, quantity, reference)
  VALUES (NEW.product_id, 'sale', -NEW.quantity, NEW.sale_id::TEXT);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sale_item_created
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION decrease_stock_on_sale();

-- Generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := 'TM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('receipt_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1;
CREATE TRIGGER before_sale_insert BEFORE INSERT ON sales FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();

-- Update customer stats on sale
CREATE OR REPLACE FUNCTION update_customer_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.payment_status = 'completed' THEN
    UPDATE customers
    SET 
      total_spent = total_spent + NEW.total_amount,
      visit_count = visit_count + 1,
      loyalty_points = loyalty_points + FLOOR(NEW.total_amount / 10)::INTEGER,
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sale_completed
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION update_customer_on_sale();

-- Low stock alert function
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_quantity <= NEW.min_stock_level AND NEW.stock_quantity != OLD.stock_quantity THEN
    INSERT INTO notifications (type, title, message)
    VALUES (
      'low_stock',
      'Low Stock Alert',
      NEW.name || ' is running low. Current stock: ' || NEW.stock_quantity || ' units.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_product_stock_update
  AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION check_low_stock();

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO categories (name, description, color, icon) VALUES
  ('Laptops', 'Portable computers and notebooks', '#0ea5e9', 'Laptop'),
  ('Smartphones', 'Mobile phones and accessories', '#8b5cf6', 'Smartphone'),
  ('Tablets', 'Tablet computers and e-readers', '#06b6d4', 'Tablet'),
  ('Accessories', 'Tech accessories and peripherals', '#f59e0b', 'Headphones'),
  ('Storage', 'Hard drives, SSDs, and memory', '#10b981', 'HardDrive'),
  ('Networking', 'Routers, switches and network gear', '#ef4444', 'Wifi'),
  ('Gaming', 'Gaming peripherals and accessories', '#ec4899', 'Gamepad2'),
  ('Displays', 'Monitors and display accessories', '#6366f1', 'Monitor')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku, barcode, category, brand, description, price, cost_price, stock_quantity, min_stock_level, tax_rate) VALUES
  ('MacBook Pro 14" M3', 'MBP-M3-14', '0194253893578', 'Laptops', 'Apple', '14-inch MacBook Pro with M3 chip, 8GB RAM, 512GB SSD', 1999.99, 1600.00, 15, 3, 15),
  ('Dell XPS 15', 'DELL-XPS15-2024', '0884116404514', 'Laptops', 'Dell', '15.6" OLED, Intel Core i7, 16GB RAM, 512GB SSD', 1599.99, 1200.00, 8, 3, 15),
  ('iPhone 15 Pro', 'APL-IP15P-256', '0194253716045', 'Smartphones', 'Apple', 'iPhone 15 Pro 256GB, Titanium finish', 999.99, 750.00, 25, 5, 15),
  ('Samsung Galaxy S24 Ultra', 'SAM-S24U-256', '8806095112411', 'Smartphones', 'Samsung', 'Galaxy S24 Ultra 256GB, Titanium Gray', 1199.99, 900.00, 18, 5, 15),
  ('iPad Pro 12.9"', 'APL-IPADPRO-12', '0194253886389', 'Tablets', 'Apple', 'iPad Pro 12.9" M2 chip, 256GB WiFi', 1099.99, 850.00, 12, 3, 15),
  ('Sony WH-1000XM5', 'SNY-WH1000XM5', '4548736132177', 'Accessories', 'Sony', 'Wireless Noise-Canceling Headphones', 349.99, 250.00, 30, 8, 15),
  ('Samsung 1TB SSD', 'SAM-SSD-1TB-870', '8806090696374', 'Storage', 'Samsung', '870 EVO 1TB 2.5" SATA SSD', 89.99, 60.00, 45, 10, 15),
  ('TP-Link AX6000 Router', 'TPL-AX6000', '6935364010942', 'Networking', 'TP-Link', 'WiFi 6 Router, 8-Stream, 6000Mbps', 199.99, 130.00, 20, 5, 15),
  ('Logitech MX Master 3S', 'LOG-MXM3S', '5099206097186', 'Accessories', 'Logitech', 'Advanced Wireless Mouse for Mac', 99.99, 65.00, 35, 10, 15),
  ('LG 27" 4K Monitor', 'LG-27UK850', '8806098764617', 'Displays', 'LG', '27" 4K UHD IPS Monitor with USB-C', 449.99, 320.00, 10, 3, 15),
  ('Razer DeathAdder V3', 'RZR-DAV3', '8886419349113', 'Gaming', 'Razer', 'Ergonomic Wired Gaming Mouse', 79.99, 50.00, 22, 5, 15),
  ('Anker 65W GaN Charger', 'ANK-65W-GAN', '0194644147495', 'Accessories', 'Anker', '65W Fast Charging GaN Charger', 39.99, 22.00, 60, 15, 15),
  ('Samsung T7 500GB SSD', 'SAM-T7-500', '8806090312458', 'Storage', 'Samsung', 'Portable SSD T7 500GB USB 3.2', 59.99, 38.00, 40, 10, 15),
  ('Apple AirPods Pro 2', 'APL-APP2', '194253714056', 'Accessories', 'Apple', 'AirPods Pro 2nd generation with MagSafe', 249.99, 180.00, 28, 8, 15),
  ('Keychron K2 Keyboard', 'KEY-K2-RGB', '6975217630139', 'Accessories', 'Keychron', 'Wireless Mechanical Keyboard, RGB Backlight', 89.99, 55.00, 18, 5, 15)
ON CONFLICT DO NOTHING;

INSERT INTO customers (name, email, phone, address, loyalty_points, total_spent, visit_count) VALUES
  ('John Moyo', 'john.moyo@gmail.com', '+263 77 123 4567', '15 Samora Machel Ave, Harare', 250, 2500.00, 8),
  ('Sarah Ndlovu', 'sarah.ndlovu@yahoo.com', '+263 71 987 6543', '42 Nelson Mandela Ave, Bulawayo', 180, 1800.00, 6),
  ('TechCorp Zimbabwe', 'procurement@techcorp.co.zw', '+263 242 123456', '7th Floor, Beverly Court, Harare CBD', 500, 15000.00, 25),
  ('Michael Dube', 'mdube@outlook.com', '+263 73 555 0101', '8 Churchill Ave, Harare', 75, 750.00, 3),
  ('Grace Mutasa', 'grace.m@gmail.com', '+263 77 444 8888', '22 Simon Muzenda St, Harare', 320, 3200.00, 12)
ON CONFLICT DO NOTHING;
