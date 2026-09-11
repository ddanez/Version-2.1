// db.ts - Implementación con Backend API y Fallback a IndexedDB
const DB_NAME = 'GestorProDB';
const DB_VERSION = 8;
const STORES = ['products', 'customers', 'suppliers', 'sales', 'purchases', 'settings', 'sellers', 'payments', 'authenticators', 'expenses', 'movements', 'ingredients', 'recipes', 'promotions', 'customer_promotions'];

export class DBService {
  private db: IDBDatabase | null = null;
  private token: string | null = null;
  private onSessionExpired: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private isHandlingSessionExpired = false;

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

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      // Timeout de seguridad para la inicialización de DB
      const timeout = setTimeout(() => {
        console.warn("⚠️ IndexedDB tardando demasiado en responder...");
        resolve(); // Resolvemos de todos modos para no bloquear la app
      }, 5000);

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
        console.log("🗄️ IndexedDB inicializada correctamente");
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

  // Carga instantánea de todas las entidades en 1 sola llamada HTTP
  async bootstrap(): Promise<Record<string, any[]> | null> {
    if (!this.token) return null;
    try {
      const response = await fetch('/api/bootstrap', { headers: this.getHeaders() });
      if (response.status === 401 || response.status === 403) {
        this.handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }
      if (response.ok) {
        const data = await response.json();
        // Sincronizar con IndexedDB en segundo plano sin congelar la interfaz
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
          } catch (e) {
            // No bloqueante
          }
        }, 50);
        return data;
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") throw err;
      console.warn("Error en bootstrap, recurriendo a carga local:", err);
    }
    return null;
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    // Si tenemos token, hacemos la petición directa para máxima velocidad
    if (this.token) {
      try {
        const response = await fetch(`/api/${storeName}`, { headers: this.getHeaders() });
        if (response.status === 401 || response.status === 403) {
          this.handleSessionExpired();
          throw new Error("SESSION_EXPIRED");
        }
        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            // Sincronizar en segundo plano
            setTimeout(async () => {
              try {
                if (data && data.length > 0) {
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
        console.warn(`Error al obtener ${storeName} del backend, usando local:`, err);
      }
    }

    // Fallback a IndexedDB si no hay conexión o falla el backend
    return new Promise<T[]>(async (resolve) => {
      try {
        const store = await this.getStore(storeName, 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async putMany<T extends { id?: string }>(storeName: string, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;

    // Guardar en IndexedDB localmente
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
      console.warn(`Error guardando localmente en ${storeName}:`, e);
    }

    // Enviar en lote al backend
    if (this.token) {
      try {
        const response = await fetch(`/api/${storeName}/bulk`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(items)
        });
        if (response.status === 401 || response.status === 403) {
          this.handleSessionExpired();
          throw new Error("SESSION_EXPIRED");
        }
      } catch (err: any) {
        if (err.message === "SESSION_EXPIRED") throw err;
        console.warn(`Error al guardar lote en ${storeName}:`, err);
      }
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

    // Enviar al backend en 1 sola llamada
    if (this.token) {
      try {
        const response = await fetch('/api/batch', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(operations)
        });
        if (response.status === 401 || response.status === 403) {
          this.handleSessionExpired();
          throw new Error("SESSION_EXPIRED");
        }
      } catch (err: any) {
        if (err.message === "SESSION_EXPIRED") throw err;
        console.warn("Error en /api/batch:", err);
      }
    }
  }

  async put<T>(storeName: string, item: T): Promise<void> {
    // Guardar localmente primero
    const store = await this.getStore(storeName, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Intentar guardar en el backend
    if (this.token) {
      try {
        const response = await fetch(`/api/${storeName}`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(item)
        });
        
        if (response.status === 401 || response.status === 403) {
          this.handleSessionExpired();
          throw new Error("SESSION_EXPIRED");
        }
      } catch (err: any) {
        if (err.message === "SESSION_EXPIRED") throw err;
        console.warn(`Error al guardar ${storeName} en el backend:`, err);
      }
    }
  }

  async delete(storeName: string, id: string): Promise<void> {
    // Eliminar localmente
    const store = await this.getStore(storeName, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Intentar eliminar en el backend
    if (this.token) {
      try {
        const response = await fetch(`/api/${storeName}/${id}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        if (response.status === 401 || response.status === 403) {
          this.handleSessionExpired();
          throw new Error("SESSION_EXPIRED");
        }
      } catch (err: any) {
        if (err.message === "SESSION_EXPIRED") throw err;
        console.warn(`Error al eliminar ${storeName} en el backend:`, err);
      }
    }
  }

  async clearAllData(): Promise<void> {
    console.log("🧹 Iniciando limpieza total de datos...");
    await this.init();
    if (!this.db) {
      console.error("❌ No se pudo limpiar: IndexedDB no inicializada");
      return;
    }
    
    // 1. Limpiar Backend primero si hay token
    if (this.token) {
      try {
        console.log("📡 Reseteando backend...");
        const response = await fetch('/api/system/reset', { 
          method: 'POST', 
          headers: this.getHeaders() 
        });
        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await response.json();
            console.warn("⚠️ El backend devolvió error al resetear:", errorData.message);
          } else {
            const text = await response.text();
            console.warn("⚠️ El backend devolvió una respuesta no JSON:", text);
          }
        } else {
          console.log("✅ Backend reseteado correctamente");
        }
      } catch (err) {
        console.error("❌ Error de red al resetear backend:", err);
      }
    }

    // 2. Limpiar IndexedDB
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(STORES, 'readwrite');
        STORES.forEach(storeName => {
          transaction.objectStore(storeName).clear();
        });

        transaction.oncomplete = () => {
          console.log("✅ IndexedDB limpiada correctamente");
          resolve();
        };
        transaction.onerror = () => {
          console.error("❌ Error en transacción de IndexedDB:", transaction.error);
          reject(transaction.error);
        };
      } catch (err) {
        console.error("❌ Error al crear transacción de limpieza:", err);
        reject(err);
      }
    });
  }

  async exportBackup(): Promise<string> {
    const backup: Record<string, any[]> = {};
    for (const storeName of STORES) {
      backup[storeName] = await this.getAll(storeName);
    }
    return JSON.stringify(backup);
  }

  async importBackup(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);
    await this.init();
    if (!this.db) throw new Error("Base de datos no inicializada");

    // Normalizar compatibilidad si hay registros de clientes en promociones
    if (Array.isArray(data.promotions)) {
      if (!Array.isArray(data.customer_promotions)) {
        data.customer_promotions = [];
      }
      const cleanPromos: any[] = [];
      for (const item of data.promotions) {
        if (item && item.customerId && item.promotionId) {
          data.customer_promotions.push(item);
        } else {
          cleanPromos.push(item);
        }
      }
      data.promotions = cleanPromos;

      // Si hay progreso de clientes asociado a promociones que no tienen cabecera de campaña,
      // generamos automáticamente la campaña para no perder la visibilidad
      const promoIdsInPromos = new Set(cleanPromos.map(p => p.id));
      for (const cp of data.customer_promotions) {
        if (cp && cp.promotionId && !promoIdsInPromos.has(cp.promotionId)) {
          cleanPromos.push({
            id: cp.promotionId,
            name: 'Promoción Recuperada',
            description: 'Restaurada automáticamente desde el progreso de clientes del respaldo',
            type: 'docena_13',
            enrollmentType: 'manual',
            requiredQuantity: 12,
            rewardQuantity: 1,
            isActive: true,
            excludedPromotionIds: []
          });
          promoIdsInPromos.add(cp.promotionId);
        }
      }
    }
    
    for (const storeName of STORES) {
      if (Array.isArray(data[storeName])) {
        // Garantizar que la transacción de IndexedDB se complete de forma atómica
        await new Promise<void>((resolve, reject) => {
          try {
            const transaction = this.db!.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            store.clear();
            for (const item of data[storeName]) {
              store.put(item);
            }
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(new Error(`Transacción abortada para ${storeName}`));
          } catch (err) {
            console.error(`Error restaurando tabla ${storeName}:`, err);
            resolve();
          }
        });

        // Sincronizar en el servidor si hay sesión activa
        if (this.token && data[storeName].length > 0) {
          try {
            await Promise.all(
              data[storeName].map((item: any) =>
                fetch(`/api/${storeName}`, {
                  method: 'POST',
                  headers: this.getHeaders(),
                  body: JSON.stringify(item)
                }).catch(e => console.error(`Error sincronizando backup de ${storeName}:`, e))
              )
            );
          } catch (err) {
            console.error(`Error en sincronización remota de ${storeName}:`, err);
          }
        }
      }
    }
  }
}

export const dbService = new DBService();
