const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// Store active jobs in memory
const jobs = new Map();

// ============= Database Setup =============
// Supports both SQLite (default) and SQL Server
const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'sqlite' or 'sqlserver'

let db = null;
let dbReady = false;

// SQL Server configuration
const sqlServerConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'GIS_Hub',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Initialize database based on type
async function initDatabase() {
  if (DB_TYPE === 'sqlserver') {
    try {
      const sql = require('mssql');
      db = await sql.connect(sqlServerConfig);
      
      // Create tables if they don't exist
      await db.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
        CREATE TABLE users (
          id NVARCHAR(36) PRIMARY KEY,
          email NVARCHAR(255) UNIQUE NOT NULL,
          password_hash NVARCHAR(255) NOT NULL,
          full_name NVARCHAR(255),
          created_at DATETIME DEFAULT GETDATE()
        );
        
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='configurations' AND xtype='U')
        CREATE TABLE configurations (
          id NVARCHAR(36) PRIMARY KEY,
          user_id NVARCHAR(36) NOT NULL,
          name NVARCHAR(255) NOT NULL,
          job_type NVARCHAR(50) NOT NULL,
          config NVARCHAR(MAX) NOT NULL,
          is_default BIT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='job_history' AND xtype='U')
        CREATE TABLE job_history (
          id NVARCHAR(36) PRIMARY KEY,
          user_id NVARCHAR(36) NOT NULL,
          job_type NVARCHAR(50) NOT NULL,
          config NVARCHAR(MAX) NOT NULL,
          status NVARCHAR(20) DEFAULT 'pending',
          logs NVARCHAR(MAX) DEFAULT '[]',
          result NVARCHAR(MAX),
          started_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);
      
      console.log(`📦 Connected to SQL Server: ${sqlServerConfig.server}/${sqlServerConfig.database}`);
      dbReady = true;
    } catch (error) {
      console.error('❌ SQL Server connection failed:', error.message);
      console.log('💡 Falling back to SQLite...');
      await initSQLite();
    }
  } else {
    await initSQLite();
  }
}

async function initSQLite() {
  let initSqlJs;
  try {
    initSqlJs = require('sql.js');
  } catch (error) {
    console.error('❌ SQLite initialization failed: missing dependency "sql.js".');
    console.error('💡 Fix: run "npm install" inside public/node-backend.');
    console.error('💡 Alternative: set DB_TYPE=sqlserver to use SQL Server instead of SQLite.');
    console.error('   Details:', error.message);
    dbReady = false;
    db = null;
    return;
  }

  try {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'gis_hub.db');
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    let data = null;
    if (fs.existsSync(dbPath)) {
      data = fs.readFileSync(dbPath);
    }
    db = new SQL.Database(data);
    
    // Store path for saving
    db._dbPath = dbPath;

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS configurations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        job_type TEXT NOT NULL,
        config TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS job_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        config TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        logs TEXT DEFAULT '[]',
        result TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Save database to file
    saveDatabase();

    console.log(`📦 SQLite database initialized at: ${dbPath}`);
    dbReady = true;
  } catch (error) {
    console.error('❌ SQLite database error:', error.message);
    dbReady = false;
    db = null;
  }
}

// Helper to save SQLite database to file
function saveDatabase() {
  if (db && db._dbPath && DB_TYPE !== 'sqlserver') {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(db._dbPath, buffer);
  }
}

// Database helper functions for both SQLite (sql.js) and SQL Server
async function dbQuery(query, params = []) {
  if (DB_TYPE === 'sqlserver' && db && db.request) {
    const request = db.request();
    params.forEach((param, index) => {
      request.input(`p${index}`, param);
    });
    // Replace ? placeholders with @p0, @p1, etc.
    let sqlQuery = query;
    let paramIndex = 0;
    sqlQuery = sqlQuery.replace(/\?/g, () => `@p${paramIndex++}`);
    const result = await request.query(sqlQuery);
    return result.recordset;
  } else {
    // sql.js uses a different API
    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

async function dbGet(query, params = []) {
  const results = await dbQuery(query, params);
  return results[0] || null;
}

async function dbRun(query, params = []) {
  if (DB_TYPE === 'sqlserver' && db && db.request) {
    const request = db.request();
    params.forEach((param, index) => {
      request.input(`p${index}`, param);
    });
    let sqlQuery = query;
    let paramIndex = 0;
    sqlQuery = sqlQuery.replace(/\?/g, () => `@p${paramIndex++}`);
    await request.query(sqlQuery);
  } else {
    // sql.js uses run() for inserts/updates
    db.run(query, params);
    saveDatabase(); // Persist changes to file
  }
}

// ============= Auth Helpers =============
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function createToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ 
    sub: userId, 
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    if (signature !== expectedSig) return null;
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    
    return decoded;
  } catch {
    return null;
  }
}

// Database-required middleware
function requireDatabase(req, res, next) {
  if (!dbReady || !db) {
    return res.status(503).json({
      detail:
        'Database is not ready. If you are using SQLite, run "npm install" in public/node-backend (to install better-sqlite3). If you are using SQL Server, set DB_TYPE=sqlserver and configure DB_* env vars.'
    });
  }
  next();
}

// Auth middleware
async function authMiddleware(req, res, next) {
  if (!dbReady || !db) {
    return res.status(503).json({ detail: 'Database is not ready' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }

  const user = await dbGet('SELECT id, email, full_name, created_at FROM users WHERE id = ?', [decoded.sub]);
  if (!user) {
    return res.status(401).json({ detail: 'User not found' });
  }

  req.user = user;
  next();
}

// Middleware
app.use(cors());
app.use(express.json());

// Runtime python path override
let runtimePythonPath = null;

// Health check endpoint
app.get('/health', (req, res) => {
  const pythonPath = runtimePythonPath || process.env.ARCPY_PYTHON_PATH || 'python';
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pythonPath: pythonPath,
    platform: process.platform,
    database: {
      type: DB_TYPE,
      connected: dbReady,
      server: DB_TYPE === 'sqlserver' ? sqlServerConfig.server : 'local'
    }
  });
});

// Database configuration endpoint
app.post('/configure-database', async (req, res) => {
  const { type, server, database, user, password, encrypt, trustCert } = req.body;
  
  if (type === 'sqlserver') {
    try {
      const sql = require('mssql');
      const testConfig = {
        server: server || 'localhost',
        database: database || 'GIS_Hub',
        user: user || '',
        password: password || '',
        options: {
          encrypt: encrypt || false,
          trustServerCertificate: trustCert !== false,
          enableArithAbort: true
        }
      };
      
      const testPool = await sql.connect(testConfig);
      await testPool.close();
      
      res.json({ 
        success: true, 
        message: 'SQL Server connection successful',
        config: { server, database, user: user ? '***' : '' }
      });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  } else {
    res.json({ 
      success: true, 
      message: 'SQLite is the default database',
      config: { type: 'sqlite' }
    });
  }
});

// Common ArcGIS Pro Python installation paths
const COMMON_PYTHON_PATHS = {
  win32: [
    'C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\envs\\arcgispro-py3\\python.exe',
    'C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\python3.exe',
    'C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\envs\\arcgispro-py3\\Scripts\\python.exe',
    'C:\\Program Files (x86)\\ArcGIS\\Pro\\bin\\Python\\envs\\arcgispro-py3\\python.exe',
    'C:\\Python312\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python310\\python.exe',
    'C:\\Python39\\python.exe',
    'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
    'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
    'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',
  ],
  linux: [
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    '/opt/arcgis/python/bin/python3',
  ],
  darwin: [
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    '/opt/homebrew/bin/python3',
  ]
};

// Detect Python installations endpoint
app.get('/detect-python', async (req, res) => {
  const platform = process.platform;
  const pathsToCheck = COMMON_PYTHON_PATHS[platform] || COMMON_PYTHON_PATHS.linux;
  const detectedPythons = [];

  for (const pythonPath of pathsToCheck) {
    try {
      if (fs.existsSync(pythonPath)) {
        // Try to get Python version and check for ArcPy
        const result = await checkPythonInstallation(pythonPath);
        detectedPythons.push({
          path: pythonPath,
          version: result.version,
          hasArcpy: result.hasArcpy,
          isDefault: pythonPath === (runtimePythonPath || process.env.ARCPY_PYTHON_PATH)
        });
      }
    } catch (error) {
      // Path doesn't exist or can't be accessed, skip it
    }
  }

  // Sort: ArcPy-enabled first, then by path
  detectedPythons.sort((a, b) => {
    if (a.hasArcpy && !b.hasArcpy) return -1;
    if (!a.hasArcpy && b.hasArcpy) return 1;
    return a.path.localeCompare(b.path);
  });

  res.json({ pythonInstallations: detectedPythons });
});

// Helper function to check Python installation
function checkPythonInstallation(pythonPath) {
  return new Promise((resolve) => {
    const checkScript = `
import sys
print(f"VERSION:{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
try:
    import arcpy
    print("ARCPY:true")
except ImportError:
    print("ARCPY:false")
`;
    
    const pythonProcess = spawn(pythonPath, ['-c', checkScript]);
    let stdout = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.on('close', (code) => {
      const versionMatch = stdout.match(/VERSION:(\d+\.\d+\.\d+)/);
      const arcpyMatch = stdout.match(/ARCPY:(true|false)/);
      
      resolve({
        version: versionMatch ? versionMatch[1] : null,
        hasArcpy: arcpyMatch ? arcpyMatch[1] === 'true' : false
      });
    });

    pythonProcess.on('error', () => {
      resolve({ version: null, hasArcpy: false });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      pythonProcess.kill();
      resolve({ version: null, hasArcpy: false });
    }, 5000);
  });
}

// Set Python path at runtime
app.post('/set-python-path', (req, res) => {
  const { pythonPath } = req.body;
  
  if (!pythonPath) {
    return res.status(400).json({ error: 'pythonPath is required' });
  }

  if (!fs.existsSync(pythonPath)) {
    return res.status(400).json({ error: 'Python path does not exist' });
  }

  runtimePythonPath = pythonPath;
  res.json({ 
    success: true, 
    message: 'Python path updated',
    pythonPath: runtimePythonPath
  });
});

// Browse filesystem endpoint
app.post('/browse', (req, res) => {
  const { path: browsePath, type } = req.body;
  const targetPath = browsePath || (process.platform === 'win32' ? 'C:\\' : '/');

  try {
    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    const result = [];

    for (const item of items) {
      const fullPath = path.join(targetPath, item.name);
      const isDirectory = item.isDirectory();
      const isGdb = item.name.endsWith('.gdb');
      const isSde = item.name.endsWith('.sde');

      // Filter based on type
      if (type === 'gdb' && !isDirectory && !isGdb) continue;
      if (type === 'sde' && !isSde) continue;
      if (type === 'folder' && !isDirectory) continue;

      result.push({
        name: item.name,
        path: fullPath,
        type: isGdb ? 'gdb' : isSde ? 'sde' : isDirectory ? 'folder' : 'file'
      });
    }

    // Sort: folders first, then files
    result.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ items: result, currentPath: targetPath });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List feature classes endpoint
app.post('/list-feature-classes', (req, res) => {
  const { gdbPath } = req.body;

  if (!gdbPath) {
    return res.status(400).json({ error: 'gdbPath is required' });
  }

  const pythonPath = runtimePythonPath || process.env.ARCPY_PYTHON_PATH || 'python';
  const scriptPath = path.join(__dirname, 'scripts', 'list_feature_classes.py');

  const pythonProcess = spawn(pythonPath, [scriptPath, gdbPath]);

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: stderr || 'Failed to list feature classes' });
    }

    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse Python output' });
    }
  });
});

// Execute job endpoint
app.post('/execute', (req, res) => {
  const { jobId, jobType, config, callbackUrl } = req.body;

  if (!jobType || !config) {
    return res.status(400).json({ error: 'jobType and config are required' });
  }

  const id = jobId || uuidv4();
  const job = {
    id,
    jobType,
    config,
    status: 'running',
    logs: [{ timestamp: new Date().toISOString(), type: 'info', message: 'Job started' }],
    startedAt: new Date().toISOString()
  };

  jobs.set(id, job);

  // Start the Python script asynchronously
  setImmediate(() => runPythonJob(id, jobType, config, callbackUrl));

  res.json({ jobId: id, status: 'running', message: 'Job started' });
});

// Get job status endpoint
app.get('/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Run Python job
async function runPythonJob(jobId, jobType, config, callbackUrl) {
  const job = jobs.get(jobId);
  if (!job) return;

  const pythonPath = runtimePythonPath || process.env.ARCPY_PYTHON_PATH || 'python';
  const scriptMap = {
    'gdb_extraction': 'gdb_extraction.py',
    'sde_conversion': 'sde_conversion.py',
    'comparison': 'comparison.py'
  };

  const scriptName = scriptMap[jobType];
  if (!scriptName) {
    job.status = 'failed';
    job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: `Unknown job type: ${jobType}` });
    await sendCallback(callbackUrl, jobId, 'failed', job.logs);
    return;
  }

  const scriptPath = path.join(__dirname, 'scripts', scriptName);

  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    job.status = 'failed';
    job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: `Script not found: ${scriptPath}` });
    await sendCallback(callbackUrl, jobId, 'failed', job.logs);
    return;
  }

  job.logs.push({ timestamp: new Date().toISOString(), type: 'info', message: `Executing ${scriptName}...` });

  const pythonProcess = spawn(pythonPath, [scriptPath, JSON.stringify(config)]);

  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const logEntry = JSON.parse(line);
        job.logs.push(logEntry);
      } catch {
        job.logs.push({ timestamp: new Date().toISOString(), type: 'info', message: line });
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: data.toString() });
  });

  pythonProcess.on('close', async (code) => {
    job.completedAt = new Date().toISOString();
    
    if (code === 0) {
      job.status = 'success';
      job.logs.push({ timestamp: new Date().toISOString(), type: 'info', message: 'Job completed successfully' });
    } else {
      job.status = 'failed';
      job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: `Job failed with exit code ${code}` });
    }

    await sendCallback(callbackUrl, jobId, job.status, job.logs, job.result);
  });
}

// Send callback to Supabase
async function sendCallback(callbackUrl, jobId, status, logs, result) {
  if (!callbackUrl) return;

  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, status, logs, result })
    });
  } catch (error) {
    console.error('Failed to send callback:', error);
  }
}

// ============= Auth Endpoints =============
app.post('/auth/signup', requireDatabase, async (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  try {
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ detail: 'Email already registered' });
    }

    const id = uuidv4();
    const passwordHash = hashPassword(password);

    await dbRun('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)', [
      id,
      email,
      passwordHash,
      full_name || null,
    ]);

    const user = { id, email, full_name: full_name || null, created_at: new Date().toISOString() };
    const token = createToken(id);

    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/auth/signin', requireDatabase, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }

  const token = createToken(user.id);

  res.json({
    user: { id: user.id, email: user.email, full_name: user.full_name, created_at: user.created_at },
    token,
  });
});

app.get('/auth/me', requireDatabase, authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post('/auth/signout', (req, res) => {
  res.json({ message: 'Signed out successfully' });
});

// ============= Configuration Endpoints =============
app.get('/configurations', requireDatabase, authMiddleware, async (req, res) => {
  const configs = await dbQuery('SELECT * FROM configurations WHERE user_id = ?', [req.user.id]);
  res.json(configs.map((c) => ({ ...c, config: JSON.parse(c.config) })));
});

app.post('/configurations', requireDatabase, authMiddleware, async (req, res) => {
  const { name, job_type, config, is_default } = req.body;
  const id = uuidv4();

  await dbRun('INSERT INTO configurations (id, user_id, name, job_type, config, is_default) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    req.user.id,
    name,
    job_type,
    JSON.stringify(config),
    is_default ? 1 : 0,
  ]);

  res.json({ id, name, job_type, config, is_default: !!is_default });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'GIS Automation Hub - Node.js Backend',
    version: '1.0.0',
    database: DB_TYPE,
    endpoints: {
      health: 'GET /health',
      configureDb: 'POST /configure-database',
      browse: 'POST /browse',
      listFeatureClasses: 'POST /list-feature-classes',
      execute: 'POST /execute',
      jobStatus: 'GET /jobs/:jobId',
      authSignup: 'POST /auth/signup',
      authSignin: 'POST /auth/signin',
      authMe: 'GET /auth/me',
      configurations: 'GET/POST /configurations'
    }
  });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 GIS Automation Hub Backend running on http://localhost:${PORT}`);
    console.log(`📦 Database Type: ${DB_TYPE}`);
    if (DB_TYPE === 'sqlserver') {
      console.log(`   Server: ${sqlServerConfig.server}`);
      console.log(`   Database: ${sqlServerConfig.database}`);
    }
    console.log(`\n📋 Endpoints:`);
    console.log(`   GET  /health               - Health check`);
    console.log(`   POST /configure-database   - Test database connection`);
    console.log(`   POST /auth/signup          - Create account`);
    console.log(`   POST /auth/signin          - Sign in`);
    console.log(`   GET  /auth/me              - Get current user`);
    console.log(`   POST /browse               - Browse filesystem`);
    console.log(`   POST /list-feature-classes - List feature classes in GDB`);
    console.log(`   POST /execute              - Execute GIS job`);
    console.log(`   GET  /jobs/:jobId          - Get job status`);
    console.log(`   GET  /configurations       - List saved configurations`);
    console.log(`   POST /configurations       - Save configuration\n`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
