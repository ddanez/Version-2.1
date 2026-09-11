// db.ts - Implementación Ultra-Rápida con Soporte Nativo para APK y Termux
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'GestorProDB';
const DB_VERSION = 9;
const STORES = [
  'products', 'customers', 'suppliers', 'sales', 'purchases', 
  'settings', 'sellers', 'payments', 'authenticators', 'expenses', 
  'movements', 'ingredients', 'recipes', 'promotions', 'customer_promotions', 'users'
];

export class DBService {
  private db: IDBDatabase | null = null;
  private token: string | null = null;
  private onSessionExpired: (() => void) | null = null;
  private isHandlingSessionExpired = false;

  // Control de conectividad con el servidor backend
  private isServerOnline: boolean = false;
  private serverChecked: boolean = false;
  private lastCheckTime: number = 0;

  setToken(token: string | null) {
    this.token = token;
    // Si el token cambia, invalidar caché de conexión
    this.serverChecked = false;
  }

  isLocalMode(): boolean {
    return !this.token || this.token === 'local-offline-token';
  }

  getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const isNative = Capacitor.isNativePlatform() || window.location.protocol === 'capacitor:';
      if (isNative) {
        // Si hay una URL personalizada configurada, usarla; de lo contrario apuntar al loopback de Termux
        const savedUrl = localStorage.getItem('api_server_url');
        return savedUrl ? savedUrl.replace(/\/$/, '') : 'http://127.0.0.1:3000';
      }
    }
    return '';
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  setOnSessionExpired(callback: () => void) {
    this.onSessionExpired = callback;
  }

  private handleSessionExpired() {
    if (this.isHandlingSessionExpired) return;
    this.isHandlingSessionExpired = true;
    if (this.onSessionExpired) {
      this.onSessionExpired();
    }
    setTimeout(() => {
      this.isHandlingSessionExpired = false;
    }, 3000);
  }

  /**
   * Comprobación ultra-rápida de salud del servidor (máximo 400ms).
   * Si el servidor no responde de inmediato, la app continúa 100% en modo local sin demoras.
   */
  async checkServerConnection(force = false): Promise<boolean> {
    if (this.isLocalMode()) {
      this.isServerOnline = false;
      return false;
    }

    const now = Date.now();
    if (!force && this.serverChecked && (now - this.lastCheckTime < 25000)) {
      return this.isServerOnline;
    }

    this.lastCheckTime = now;
    this.serverChecked = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 400); // 400ms límite estricto

      const res = await fetch(`${this.getBaseUrl()}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      this.isServerOnline = res.ok;
      return res.ok;
    } catch {
      this.isServerOnline = false;
      return false;
    }
  }

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn("⚠️ IndexedDB tardando en responder...");
        resolve();
      }, 3000);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        STORES.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = (event) => {
        clearTimeout(timeout);
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        clearTimeout(timeout);
        console.error("❌ Error al abrir IndexedDB");
        reject(request.error);
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) throw new Error("Base de datos no inicializada");
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * Obtiene datos exclusivamente de la base de datos local (IndexedDB) en milisegundos.
   */
  async getLocal<T>(storeName: string): Promise<T[]> {
    return new Promise<T[]>(async (resolve) => {
      try {
        const store = await this.getStore(storeName, 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as T[]) || []);
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Carga instantánea de bootstrap si el servidor está online.
   * Si está offline o en modo APK autónomo, retorna null de inmediato (0ms) sin bloquear.
   */
  async bootstrap(): Promise<Record<string, any[]> | null> {
    if (this.isLocalMode()) return null;

    const isOnline = await this.checkServerConnection();
    if (!isOnline) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const response = await fetch(`${this.getBaseUrl()}/api/bootstrap`, { 
        headers: this.getHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        this.handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      if (response.ok) {
        const data = await response.json();
        // Guardar en IndexedDB en segundo plano sin congelar la UI
        setTimeout(async () => {
          try {
            await this.init();
            if (!this.db) return;
            Object.entries(data).forEach(([storeName, items]: [string, any]) => {
              if (this.db?.objectStoreNames.contains(storeName) && Array.isArray(items) && items.length > 0) {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                items.forEach(item => store.put(item));
              }
            });
          } catch (e) {}
        }, 10);
        return data;
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") throw err;
      this.isServerOnline = false;
    }
    return null;
  }

  /**
   * Obtiene todos los registros.
   * En modo local o cuando el servidor está inaccesible, responde al instante desde IndexedDB.
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    // 1. Si no hay conexión al servidor o es modo local, leer directamente de IndexedDB
    if (this.isLocalMode() || !this.isServerOnline) {
      return this.getLocal<T>(storeName);
    }

    // 2. Si el servidor está activo, intentar petición con timeout estricto de 1.2s
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const response = await fetch(`${this.getBaseUrl()}/api/${storeName}`, { 
        headers: this.getHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        this.handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          // Sincronizar con IndexedDB en segundo plano
          setTimeout(async () => {
            try {
              if (Array.isArray(data) && data.length > 0) {
                const store = await this.getStore(storeName, 'readwrite');
                data.forEach((item: any) => store.put(item));
              }
            } catch (e) {}
          }, 10);
          return data;
        }
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") throw err;
      this.isServerOnline = false;
    }

    // 3. Fallback instantáneo a IndexedDB
    return this.getLocal<T>(storeName);
  }

  async put<T extends { id?: string }>(storeName: string, item: T): Promise<void> {
    // 1. Guardar localmente primero SIEMPRE (inmediato, < 1ms)
    try {
      const store = await this.getStore(storeName, 'readwrite');
      await new Promise<void>((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`Error guardando localmente en ${storeName}:`, e);
    }

    // 2. Sincronizar en segundo plano si el servidor está online
    if (!this.isLocalMode() && this.isServerOnline) {
      fetch(`${this.getBaseUrl()}/api/${storeName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(item)
      }).catch(() => {
        // En segundo plano, no bloquea
      });
    }
  }

  async putMany<T extends { id?: string }>(storeName: string, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;

    // Guardar en IndexedDB localmente de forma atómica
    try {
      await this.init();
      if (this.db && this.db.objectStoreNames.contains(storeName)) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of items) {
          store.put(item);
        }
      }
    } catch (e) {
      console.warn(`Error guardando lote en ${storeName}:`, e);
    }

    // Sincronizar en segundo plano si hay servidor
    if (!this.isLocalMode() && this.isServerOnline) {
      fetch(`${this.getBaseUrl()}/api/${storeName}/bulk`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(items)
      }).catch(() => {});
    }
  }

  async batch(operations: Array<{ store: string; items: any[] }>): Promise<void> {
    if (!operations || operations.length === 0) return;

    // Guardar localmente
    try {
      await this.init();
      if (this.db) {
        operations.forEach(op => {
          if (this.db?.objectStoreNames.contains(op.store) && Array.isArray(op.items)) {
            const tx = this.db.transaction(op.store, 'readwrite');
            const store = tx.objectStore(op.store);
            op.items.forEach(item => store.put(item));
          }
        });
      }
    } catch (e) {
      console.warn("Error guardando lote local:", e);
    }

    // Enviar en segundo plano al backend
    if (!this.isLocalMode() && this.isServerOnline) {
      fetch(`${this.getBaseUrl()}/api/batch`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(operations)
      }).catch(() => {});
    }
  }

  async delete(storeName: string, id: string): Promise<void> {
    // Eliminar localmente primero
    try {
      const store = await this.getStore(storeName, 'readwrite');
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`Error eliminando localmente de ${storeName}:`, e);
    }

    // Sincronizar eliminación en segundo plano
    if (!this.isLocalMode() && this.isServerOnline) {
      fetch(`${this.getBaseUrl()}/api/${storeName}/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      }).catch(() => {});
    }
  }

  async clearAllData(): Promise<void> {
    await this.init();
    if (!this.db) return;

    if (!this.isLocalMode() && this.isServerOnline) {
      fetch(`${this.getBaseUrl()}/api/system/reset`, { 
        method: 'POST', 
        headers: this.getHeaders() 
      }).catch(() => {});
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(STORES, 'readwrite');
        STORES.forEach(storeName => {
          transaction.objectStore(storeName).clear();
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async exportBackup(): Promise<string> {
    const backup: Record<string, any[]> = {};
    for (const storeName of STORES) {
      backup[storeName] = await this.getLocal(storeName);
    }
    return JSON.stringify(backup);
  }

  async importBackup(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);
    await this.init();
    if (!this.db) throw new Error("Base de datos no inicializada");

    for (const storeName of STORES) {
      if (Array.isArray(data[storeName])) {
        await new Promise<void>((resolve) => {
          try {
            const transaction = this.db!.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            store.clear();
            for (const item of data[storeName]) {
              store.put(item);
            }
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
          } catch (err) {
            resolve();
          }
        });
      }
    }
  }
}

export const dbService = new DBService();
