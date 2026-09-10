
import express from "express";
import { createServer as createViteServer } from "vite";
import sqlite3Lib from 'sqlite3';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite3 = sqlite3Lib.verbose();
const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Middleware de Logging para ver peticiones en la consola de Termux
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    console.log(`${new Date().toLocaleTimeString()} | ${req.method} ${req.url}`);
  }
  next();
});

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('❌ Error DB:', err);
  else console.log('🗄️ SQLite conectado en:', DB_PATH);
});

const VALID_STORES = ['products', 'customers', 'suppliers', 'sales', 'purchases', 'settings', 'sellers', 'payments', 'users', 'authenticators', 'expenses', 'movements', 'ingredients', 'recipes', 'promotions', 'customer_promotions'];

db.serialize(() => {
  VALID_STORES.forEach(store => {
    if (store === 'users') {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, 
        username TEXT UNIQUE, 
        password TEXT, 
        role TEXT, 
        name TEXT,
        permissions TEXT
      )`);
    } else if (store === 'authenticators') {
      db.run(`CREATE TABLE IF NOT EXISTS authenticators (
        id TEXT PRIMARY KEY,
        userId TEXT,
        credentialID TEXT,
        publicKey TEXT,
        counter INTEGER,
        FOREIGN KEY(userId) REFERENCES users(id)
      )`);
    } else {
      db.run(`CREATE TABLE IF NOT EXISTS ${store} (id TEXT PRIMARY KEY, data TEXT)`);
    }
  });

  // Create default admin if not exists
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO users (id, username, password, role, name, permissions) VALUES (?, ?, ?, ?, ?, ?)", 
        [crypto.randomUUID(), 'admin', hashedPassword, 'admin', 'Administrador', '["dashboard","inventory","sales","purchases","customers","suppliers","manufacturing","cxc","cxp","expenses","reports","settings"]']);
      console.log("👤 Usuario admin por defecto creado: admin / admin123");
    }
  });

  // Migration: Add permissions column if not exists
  db.all("PRAGMA table_info(users)", (err, columns: any[]) => {
    if (columns && !columns.find(c => c.name === 'permissions')) {
      db.run("ALTER TABLE users ADD COLUMN permissions TEXT", (err) => {
        if (!err) {
          // Grant all permissions to existing admin
          db.run("UPDATE users SET permissions = '[\"dashboard\",\"inventory\",\"sales\",\"purchases\",\"customers\",\"suppliers\",\"manufacturing\",\"cxc\",\"cxp\",\"expenses\",\"reports\",\"settings\"]' WHERE role = 'admin'");
        }
      });
    }
  });
});

// --- AUTH ROUTES ---

app.post('/api/auth/register', (req: any, res: any) => {
  const { username, password, role, name, permissions } = req.body;
  if (!username || !password || !role || !name) {
    return res.status(400).json({ message: 'Todos los campos son requeridos' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const id = crypto.randomUUID();
  const perms = permissions ? JSON.stringify(permissions) : (role === 'admin' ? '["dashboard","inventory","sales","purchases","customers","suppliers","manufacturing","cxc","cxp","expenses","reports","settings"]' : '["dashboard","sales","customers","cxc"]');

  db.run("INSERT INTO users (id, username, password, role, name, permissions) VALUES (?, ?, ?, ?, ?, ?)", 
    [id, username, hashedPassword, role, name, perms], (err) => {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'El nombre de usuario ya existe' });
        }
        return res.status(500).json({ message: err.message });
      }
      res.json({ success: true, message: 'Usuario registrado correctamente' });
    });
});

// Middleware to verify token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
};

app.post('/api/auth/login', (req: any, res: any) => {
  const { username, password } = req.body;
  console.log(`🔑 Intento de login para usuario: ${username}`);
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user: any) => {
    if (err) {
      console.error(`❌ Error DB en login: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
    
    if (!user) {
      console.warn(`⚠️ Usuario no encontrado: ${username}`);
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    console.log(`✅ Usuario encontrado, verificando contraseña...`);
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    
    if (!isPasswordValid) {
      console.warn(`❌ Contraseña incorrecta para: ${username}`);
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    console.log(`🎉 Login exitoso para: ${username}`);
    const permissions = user.permissions ? JSON.parse(user.permissions) : [];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name, permissions }, JWT_SECRET, { expiresIn: '90d' });
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role, name: user.name, permissions } 
    });
  });
});

app.post('/api/auth/change-password', authenticateToken, (req: any, res: any) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  db.get("SELECT password FROM users WHERE id = ?", [userId], (err, user: any) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Contraseña actual incorrecta' });

    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ message: updateErr.message });
      res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    });
  });
});

// --- API: RUTAS DE SISTEMA ---

app.post('/api/system/reset', authenticateToken, (req: any, res: any) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado: Se requieren privilegios de administrador' });
  }
  
  console.log(`🧹 Iniciando reset de base de datos por: ${req.user.username}`);
  
  const storesToClear = VALID_STORES.filter(s => s !== 'users');
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    try {
      storesToClear.forEach(store => {
        db.run(`DELETE FROM ${store}`);
      });
      
      db.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ Error al confirmar reset:', err.message);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error al confirmar el reset' });
        }
        console.log('✅ Base de datos reseteada correctamente');
        res.json({ success: true, message: 'Sistema reseteado correctamente' });
      });
    } catch (err: any) {
      console.error('❌ Error durante el proceso de reset:', err.message);
      db.run('ROLLBACK');
      res.status(500).json({ message: 'Error interno durante el reset' });
    }
  });
});

// --- API: RUTAS GENÉRICAS ---

app.get('/api/:store', authenticateToken, (req: any, res: any) => {
  const { store } = req.params;
  if (!VALID_STORES.includes(store)) {
    return res.status(404).json({ message: `Almacén '${store}' no válido` });
  }
  
  if (store === 'users' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  db.all(`SELECT * FROM ${store}`, [], (err, rows: any[]) => {
    if (err) return res.status(500).json({ message: err.message });
    try {
      if (store === 'users') {
        res.json(rows.map((row: any) => ({ 
          id: row.id, 
          username: row.username, 
          role: row.role, 
          name: row.name,
          permissions: row.permissions ? JSON.parse(row.permissions) : []
        })));
      } else {
        res.json(rows.map((row: any) => JSON.parse(row.data)));
      }
    } catch (parseErr) {
      res.status(500).json({ message: 'Error de integridad en datos guardados' });
    }
  });
});

app.post('/api/:store', authenticateToken, (req: any, res: any) => {
  const { store } = req.params;
  const item = req.body;
  if (!VALID_STORES.includes(store)) return res.status(404).json({ message: 'Almacén no válido' });
  
  if (store === 'users') {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'No autorizado' });
    // Update user (role/permissions)
    const { role, permissions, name } = item;
    db.run("UPDATE users SET role = ?, permissions = ?, name = ? WHERE id = ?", 
      [role, JSON.stringify(permissions), name, item.id], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
      });
    return;
  }

  if (!item.id) return res.status(400).json({ message: 'ID requerido' });
  
  db.run(`INSERT OR REPLACE INTO ${store} (id, data) VALUES (?, ?)`, [item.id, JSON.stringify(item)], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/:store/:id', authenticateToken, (req: any, res: any) => {
  const { store, id } = req.params;
  if (!VALID_STORES.includes(store)) return res.status(404).json({ message: 'Almacén no válido' });
  if (store === 'users' && req.user.role !== 'admin') return res.status(403).json({ message: 'No autorizado' });
  
  db.run(`DELETE FROM ${store} WHERE id = ?`, [id], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ success: true });
  });
});

// --- API: AI ANALYSIS ---

app.post('/api/ai/analyze', authenticateToken, async (req: any, res: any) => {
  const { prompt, data } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt es requerido' });
  }

  let aiProvider = 'gemini';
  let geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
  let geminiModel = "gemini-3-flash-preview";
  let deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  let deepseekModel = "deepseek-chat";
  let openaiApiKey = process.env.OPENAI_API_KEY;
  let openaiModel = "gpt-4o-mini";
  
  // Fetch settings from database
  try {
    const settingsRow: any = await new Promise((resolve, reject) => {
      db.get("SELECT data FROM settings WHERE id = 'app_settings'", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (settingsRow && settingsRow.data) {
      const settings = JSON.parse(settingsRow.data);
      if (settings.aiProvider) aiProvider = settings.aiProvider;
      
      if (settings.geminiApiKey) geminiApiKey = settings.geminiApiKey;
      if (settings.geminiModel) geminiModel = settings.geminiModel;
      
      if (settings.deepseekApiKey) deepseekApiKey = settings.deepseekApiKey;
      if (settings.deepseekModel) deepseekModel = settings.deepseekModel;

      if (settings.openaiApiKey) openaiApiKey = settings.openaiApiKey;
      if (settings.openaiModel) openaiModel = settings.openaiModel;
    }
  } catch (dbErr) {
    console.error('⚠️ Error al buscar configuración en la DB:', dbErr);
  }

  if (aiProvider === 'openai') {
    if (!openaiApiKey) {
      return res.status(500).json({ 
        message: 'La llave de OpenAI no está configurada. Por favor, ve a AJUSTES y configúrala.' 
      });
    }

    try {
      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });

      const response = await openai.chat.completions.create({
        model: openaiModel,
        messages: [
          { role: "system", content: "Eres un experto analista financiero y de inventarios para pequeños negocios." },
          { role: "user", content: `${prompt}\n\nDATOS PARA ANALIZAR:\n${JSON.stringify(data || {}, null, 2)}` }
        ],
        temperature: 0.7,
      });

      res.json({ text: response.choices[0].message.content });
    } catch (error: any) {
      console.error('❌ Error en análisis de OpenAI:', error);
      res.status(500).json({ 
        message: 'Error al procesar el análisis con OpenAI: ' + (error.message || 'Error desconocido')
      });
    }
  } else if (aiProvider === 'deepseek') {
    if (!deepseekApiKey) {
      return res.status(500).json({ 
        message: 'La llave de DeepSeek no está configurada. Por favor, ve a AJUSTES y configúrala.' 
      });
    }

    try {
      const openai = new OpenAI({
        apiKey: deepseekApiKey,
        baseURL: "https://api.deepseek.com",
      });

      const response = await openai.chat.completions.create({
        model: deepseekModel,
        messages: [
          { role: "system", content: "Eres un experto analista financiero y de inventarios para pequeños negocios." },
          { role: "user", content: `${prompt}\n\nDATOS PARA ANALIZAR:\n${JSON.stringify(data || {}, null, 2)}` }
        ],
        temperature: 0.7,
      });

      res.json({ text: response.choices[0].message.content });
    } catch (error: any) {
      console.error('❌ Error en análisis de DeepSeek:', error);
      res.status(500).json({ 
        message: 'Error al procesar el análisis con DeepSeek: ' + (error.message || 'Error desconocido')
      });
    }
  } else {
    // Default to Gemini
    if (!geminiApiKey) {
      return res.status(500).json({ 
        message: 'La llave de Gemini no está configurada. Por favor, ve a AJUSTES y configúrala.' 
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

      while (attempts < maxAttempts) {
        try {
          const model = ai.models.generateContent({
            model: geminiModel,
            contents: `${prompt}\n\nDATOS PARA ANALIZAR:\n${JSON.stringify(data || {}, null, 2)}`,
            config: {
              temperature: 0.7,
              topP: 0.95,
              topK: 64,
            }
          });
          response = await model;
          break;
        } catch (error: any) {
          attempts++;
          if (error.status === 503 && attempts < maxAttempts) {
            console.warn(`⚠️ Gemini está saturado (Intento ${attempts}/${maxAttempts}). Reintentando en ${attempts * 2}s...`);
            await delay(attempts * 2000);
            continue;
          }
          throw error;
        }
      }

      if (!response) throw new Error('No se recibió respuesta de Gemini');
      res.json({ text: response.text });
    } catch (error: any) {
      console.error('❌ Error en análisis de Gemini:', error);
      if (error.status === 503 || (error.message && error.message.includes("high demand"))) {
        return res.status(503).json({ 
          message: 'El servicio de Inteligencia Artificial está experimentando una alta demanda. Por favor, intenta de nuevo en unos segundos.' 
        });
      }
      res.status(500).json({ 
        message: 'Error al procesar el análisis con la IA: ' + (error.message || 'Error desconocido')
      });
    }
  }
});

// Deprecated endpoint for backward compatibility
app.post('/api/gemini/analyze', authenticateToken, async (req: any, res: any) => {
  console.log('⚠️ Redirigiendo petición de /api/gemini/analyze a /api/ai/analyze');
  req.url = '/api/ai/analyze';
  return app._router.handle(req, res, () => {});
});

// --- API: 404 HANDLER ---
app.all('/api/*', (req, res) => {
  res.status(404).json({ 
    message: `Endpoint de API no encontrado: ${req.method} ${req.originalUrl}` 
  });
});

// --- VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        if (!req.url.startsWith('/api/')) {
          res.sendFile(path.join(distPath, 'index.html'));
        } else {
          res.status(404).json({ message: `API endpoint no encontrado: ${req.method} ${req.url}` });
        }
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVIDOR GESTORPRO INICIADO`);
    console.log(`🌐 API disponible en: http://localhost:${PORT}/api`);
    console.log(`📡 Escuchando en todas las interfaces de red.`);
    console.log(`🔑 Gemini API Key presente: ${process.env.GEMINI_API_KEY ? 'SÍ' : 'NO'}`);
  });
}

startServer();
