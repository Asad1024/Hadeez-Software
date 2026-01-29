module.exports = function initDb(db) {
  db.exec(`
    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Staff (Admin / Cashier)
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
      username TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL,
      phone TEXT,
      salary REAL DEFAULT 0,
      joining_date TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Menu Categories
    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Menu Items
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id),
      name TEXT NOT NULL,
      description TEXT,
      sale_price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      image TEXT,
      is_available INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Item Variants (e.g. Small/Medium/Large)
    CREATE TABLE IF NOT EXISTS item_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sale_price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    -- Credit Customers
    CREATE TABLE IF NOT EXISTS credit_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Stock Categories
    CREATE TABLE IF NOT EXISTS stock_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    -- Stock Items
    CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES stock_categories(id),
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_quantity REAL DEFAULT 0,
      min_quantity REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Stock Movements (in/out)
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment', 'wastage')),
      quantity REAL NOT NULL,
      reference TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES staff(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      daily_number INTEGER,
      order_type TEXT DEFAULT 'dine_in' CHECK(order_type IN ('dine_in', 'takeaway', 'delivery')),
      table_number TEXT,
      customer_id INTEGER REFERENCES credit_customers(id),
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_type TEXT CHECK(discount_type IS NULL OR discount_type IN ('percent', 'fixed')),
      tax_amount REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'credit', 'mixed')),
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'partial')),
      paid_amount REAL DEFAULT 0,
      created_by INTEGER REFERENCES staff(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    -- Closed days (day closed, no new orders)
    CREATE TABLE IF NOT EXISTS closed_days (
      closed_date TEXT PRIMARY KEY,
      closed_at TEXT DEFAULT (datetime('now'))
    );

    -- Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
      variant_id INTEGER REFERENCES item_variants(id),
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      notes TEXT
    );

    -- Credit Payments (when customer pays outstanding)
    CREATE TABLE IF NOT EXISTS credit_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES credit_customers(id),
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES staff(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Activity Log (optional, for audit)
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER REFERENCES staff(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Expenses (daily expense entries)
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      category TEXT,
      description TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES staff(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Cash in hand (one record per date, e.g. closing cash)
    CREATE TABLE IF NOT EXISTS daily_cash (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cash_date TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_daily_cash_date ON daily_cash(cash_date);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);
  `);

  // Seed default admin if no staff exists
  const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff').get();
  if (staffCount.c === 0) {
    db.prepare(`
      INSERT INTO staff (name, role, username, pin, status)
      VALUES ('Admin', 'admin', 'admin', 'Numan@0311!', 'active')
    `).run();
  }
  // Seed default cashier if none exists
  const cashierExists = db.prepare("SELECT 1 FROM staff WHERE username = 'cashier'").get();
  if (!cashierExists) {
    db.prepare(`
      INSERT INTO staff (name, role, username, pin, status)
      VALUES ('Cashier', 'cashier', 'cashier', '1234', 'active')
    `).run();
  }

  // Seed default settings
  const settings = [
    ['restaurant_name', 'Hadeez Restaurant'],
    ['restaurant_address', ''],
    ['restaurant_phone', ''],
    ['currency', 'Rs.'],
    ['tax_enabled', '0'],
    ['tax_percent', '0'],
    ['receipt_header', 'Thank you for dining with us!'],
    ['receipt_footer', 'Please visit again'],
  ];
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of settings) {
    insertSetting.run(k, v);
  }

  // Seed default menu category if empty
  const catCount = db.prepare('SELECT COUNT(*) as c FROM menu_categories').get();
  if (catCount.c === 0) {
    db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES ('General', 0)").run();
  }

  // Seed default stock category if empty
  const stockCatCount = db.prepare('SELECT COUNT(*) as c FROM stock_categories').get();
  if (stockCatCount.c === 0) {
    db.prepare("INSERT INTO stock_categories (name, sort_order) VALUES ('General', 0)").run();
  }
};
