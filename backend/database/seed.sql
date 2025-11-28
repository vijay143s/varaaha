-- Optional seed data for quick testing. Run after schema.sql.

INSERT INTO users (email, password_hash, full_name, role, email_verified_at)
VALUES
  (
    'admin@varaaha.com',
    '$2a$10$hQG0xv9GJE0x9K/AYsNX2O3SUxFuPFBmp7V6zJ58BX/yQnw72Mj4W', -- bcrypt hash for Admin@123
    'Varaaha Admin',
    'admin',
    NOW()
  ),
  (
    'customer@varaaha.com',
    '$2a$10$hQG0xv9GJE0x9K/AYsNX2O3SUxFuPFBmp7V6zJ58BX/yQnw72Mj4W',
    'Sample Customer',
    'customer',
    NULL
  );

INSERT INTO products (slug, name, short_description, description, price, unit)
VALUES
  ('organic-whole-milk', 'Organic Whole Milk', 'Fresh whole milk from grass-fed cows', 'Slow-pasteurized whole milk with rich flavor suitable for households.', 65.00, 'liter'),
  ('organic-curd', 'Organic Curd', 'Thick, creamy curd from farm fresh milk', 'Perfectly fermented creamy curd ideal for daily consumption.', 80.00, 'kilogram');

INSERT INTO inventory_movements (product_id, change_type, quantity, note)
VALUES
  (1, 'stock_in', 100, 'Initial stock'),
  (2, 'stock_in', 75, 'Initial stock');
