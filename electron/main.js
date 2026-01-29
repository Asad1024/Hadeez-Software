const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Database stored in AppData - survives reinstalls, not on C:\ root
const getDataPath = () => {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

let mainWindow;
let db;
let rawDb;
let dbPath;

// Wrap sql.js to match better-sqlite3-style API for init.js
function createAdapter(sqliteDb) {
  return {
    exec(sql) {
      sqliteDb.exec(sql);
    },
    prepare(sql) {
      return {
        run(...params) {
          if (params.length > 0) {
            sqliteDb.run(sql, params);
          } else {
            sqliteDb.run(sql);
          }
        },
        get(...params) {
          const stmt = sqliteDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          let row = null;
          if (stmt.step()) row = stmt.getAsObject();
          stmt.free();
          return row;
        },
        all(...params) {
          const stmt = sqliteDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      };
    },
    close() {
      sqliteDb.close();
    },
  };
}

function persistDb() {
  if (!rawDb || !dbPath) return;
  try {
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.error('Persist db error:', e);
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Hadeez Restaurant POS',
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    if (db) persistDb();
    if (rawDb) try { rawDb.close(); } catch (_) {}
    mainWindow = null;
  });
};

app.whenReady().then(async () => {
  const dataPath = getDataPath();
  dbPath = path.join(dataPath, 'hadeez_pos.sqlite');

  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({
      locateFile: (name) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', name),
    });

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      rawDb = new SQL.Database(buffer);
    } else {
      rawDb = new SQL.Database();
    }
    db = createAdapter(rawDb);
    require('./database/init')(db);
    // Ensure expense book tables exist (for DBs created before this feature)
    const runMigration = (sql) => {
      try {
        const stmt = rawDb.prepare(sql);
        stmt.step();
        stmt.free();
      } catch (e) {
        console.error('Expense migration:', e.message);
      }
    };
    runMigration("CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, expense_date TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, category TEXT, description TEXT, notes TEXT, created_by INTEGER REFERENCES staff(id), created_at TEXT DEFAULT (datetime('now')))");
    runMigration("CREATE TABLE IF NOT EXISTS daily_cash (id INTEGER PRIMARY KEY AUTOINCREMENT, cash_date TEXT NOT NULL UNIQUE, amount REAL NOT NULL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
    runMigration('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)');
    runMigration('CREATE INDEX IF NOT EXISTS idx_daily_cash_date ON daily_cash(cash_date)');
    try {
      db.exec('ALTER TABLE orders ADD COLUMN daily_number INTEGER');
    } catch (e) {
      if (!e.message || (!e.message.includes('duplicate column') && !e.message.includes('already exists'))) console.error('daily_number migration:', e.message);
    }
    runMigration('CREATE TABLE IF NOT EXISTS closed_days (closed_date TEXT PRIMARY KEY, closed_at TEXT DEFAULT (datetime(\'now\')))');

    try {
      rawDb.run("UPDATE staff SET pin = 'Numan@0311!' WHERE username = 'admin'");
    } catch (e) {
      console.error('Admin password update:', e);
    }
    persistDb();
  } catch (err) {
    console.error('Database init error:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) persistDb();
  if (rawDb) try { rawDb.close(); } catch (_) {}
  if (process.platform !== 'darwin') app.quit();
});

// IPC: expose safe API to renderer
ipcMain.handle('db:run', (_, sql, params = []) => {
  if (!db) return { error: 'Database not ready' };
  try {
    const stmt = rawDb.prepare(sql);
    if (params && params.length > 0) stmt.bind(params);
    stmt.step();
    stmt.free();
    persistDb();
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('db:get', (_, sql, params = []) => {
  if (!db) return { error: 'Database not ready' };
  try {
    const row = db.prepare(sql).get(...(params || []));
    return { data: row };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('db:all', (_, sql, params = []) => {
  if (!db) return { error: 'Database not ready' };
  try {
    const rows = db.prepare(sql).all(...(params || []));
    return { data: rows };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('app:getDataPath', () => getDataPath());
