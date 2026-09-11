
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Lock, Loader2, UserPlus, LogIn, ShieldCheck, Smartphone, Fingerprint } from 'lucide-react';
import { User as UserType, AppTab } from '../types';
import { dbService } from '../db';
import { 
  checkBiometricAvailability, 
  authenticateWithBiometrics, 
  getBiometricConfiguredUser, 
  setBiometricEnabled, 
  isBiometricAutoPromptEnabled 
} from '../biometricHelper';
import { Capacitor } from '@capacitor/core';

interface AuthProps {
  onLogin: (user: UserType) => void;
}

const DEFAULT_ADMIN = {
  id: 'local-admin-1',
  username: 'admin',
  password: 'admin123',
  role: 'admin' as const,
  name: 'Administrador',
  permissions: Object.values(AppTab)
};

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isBiometricPrompting, setIsBiometricPrompting] = useState(false);
  const hasAutoPromptedRef = useRef(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'seller' as 'admin' | 'seller'
  });

  const handleBiometricAuth = useCallback(async (isAuto = false) => {
    if (isBiometricPrompting) return;
    setIsBiometricPrompting(true);
    setError('');

    try {
      const res = await authenticateWithBiometrics("Toca el sensor de huella digital para ingresar a Gestor Pro");
      if (res.success) {
        // Encontrar el usuario para iniciar sesión
        let targetUser: UserType | null = null;
        
        let localUsers: any[] = [];
        const saved = localStorage.getItem('local_users');
        if (saved) {
          try {
            localUsers = JSON.parse(saved);
          } catch {
            localUsers = [];
          }
        }
        if (localUsers.length === 0) {
          localUsers = [DEFAULT_ADMIN];
          localStorage.setItem('local_users', JSON.stringify(localUsers));
        }

        const bioUser = getBiometricConfiguredUser();
        if (bioUser) {
          const matched = localUsers.find(u => u.username?.toLowerCase() === bioUser.toLowerCase());
          if (matched) targetUser = matched;
        }

        if (!targetUser) {
          const savedUserStr = localStorage.getItem('user_data');
          if (savedUserStr) {
            try {
              const parsed = JSON.parse(savedUserStr);
              const matched = localUsers.find(u => u.username?.toLowerCase() === parsed.username?.toLowerCase());
              if (matched) targetUser = matched;
              else targetUser = parsed;
            } catch {}
          }
        }

        if (!targetUser && localUsers.length > 0) {
          targetUser = localUsers[0];
        }

        if (!targetUser) {
          targetUser = DEFAULT_ADMIN;
        }

        const { password, ...safeUser } = (targetUser as any);
        const token = (targetUser as any).token || localStorage.getItem('auth_token') || 'local-offline-token';
        const userWithToken: UserType = { ...safeUser, token };

        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_data', JSON.stringify(safeUser));
        setBiometricEnabled(safeUser.username, true);
        dbService.setToken(token);
        onLogin(userWithToken);
      } else if (res.error && !res.error.toLowerCase().includes('cancel') && !isAuto) {
        setError(res.error);
      }
    } catch (err: any) {
      console.warn("Error en autenticación biométrica:", err);
      if (!isAuto) {
        setError("Error con el sensor de huella. Intente de nuevo o use contraseña.");
      }
    } finally {
      setIsBiometricPrompting(false);
    }
  }, [isBiometricPrompting, onLogin]);

  useEffect(() => {
    let isMounted = true;
    const initBiometrics = async () => {
      try {
        const bio = await checkBiometricAvailability();
        const isNative = Capacitor.isNativePlatform();
        if (!isMounted) return;

        if (bio.isAvailable || isNative) {
          setBiometricAvailable(true);

          // Disparar automáticamente la solicitud de huella al abrir la app si está en modo login
          if (!hasAutoPromptedRef.current && isBiometricAutoPromptEnabled()) {
            hasAutoPromptedRef.current = true;
            setTimeout(() => {
              if (isMounted) {
                handleBiometricAuth(true);
              }
            }, 350);
          }
        }
      } catch (err) {
        console.warn("Error verificando biometría:", err);
      }
    };

    initBiometrics();
    return () => { isMounted = false; };
  }, [handleBiometricAuth]);

  const handleLocalAuth = () => {
    try {
      let localUsers: any[] = [];
      const saved = localStorage.getItem('local_users');
      if (saved) {
        try {
          localUsers = JSON.parse(saved);
        } catch (e) {
          localUsers = [];
        }
      }

      // Si no hay ningún usuario local creado, incluimos el admin por defecto
      if (localUsers.length === 0) {
        localUsers = [DEFAULT_ADMIN];
        localStorage.setItem('local_users', JSON.stringify(localUsers));
      }

      if (isLogin) {
        const matched = localUsers.find(
          u => u.username.toLowerCase() === formData.username.trim().toLowerCase() && u.password === formData.password
        );

        if (matched) {
          const { password, ...safeUser } = matched;
          const userWithToken: UserType = { ...safeUser, token: 'local-offline-token' };
          localStorage.setItem('auth_token', 'local-offline-token');
          localStorage.setItem('user_data', JSON.stringify(safeUser));
          dbService.setToken('local-offline-token');
          onLogin(userWithToken);
          return true;
        } else {
          setError('Credenciales incorrectas (Modo local. Admin por defecto: admin / admin123)');
          return false;
        }
      } else {
        // Registro local
        const exists = localUsers.some(
          u => u.username.toLowerCase() === formData.username.trim().toLowerCase()
        );
        if (exists) {
          setError('El nombre de usuario ya está registrado en este dispositivo');
          return false;
        }

        const newUser = {
          id: crypto.randomUUID(),
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role,
          name: formData.name || formData.username,
          permissions: formData.role === 'admin'
            ? ["dashboard","inventory","sales","purchases","customers","suppliers","manufacturing","cxc","cxp","expenses","reports","settings"]
            : ["inventory","sales","customers"]
        };

        localUsers.push(newUser);
        localStorage.setItem('local_users', JSON.stringify(localUsers));
        alert('Usuario registrado exitosamente en el dispositivo. Ahora puedes iniciar sesión.');
        setIsLogin(true);
        return true;
      }
    } catch (e: any) {
      setError(e.message || 'Error en autenticación local');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    // Timeout corto de 2.5s para no hacer esperar al usuario si está en modo APK offline
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Error en la autenticación');
        }

        if (isLogin) {
          const userWithToken = { ...data.user, token: data.token };
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('user_data', JSON.stringify(data.user));
          
          // Guardar también una copia local para acceso offline futuro
          try {
            const saved = localStorage.getItem('local_users');
            let localUsers = saved ? JSON.parse(saved) : [];
            const idx = localUsers.findIndex((u: any) => u.username === data.user.username);
            const toSave = { ...data.user, password: formData.password };
            if (idx >= 0) localUsers[idx] = toSave;
            else localUsers.push(toSave);
            localStorage.setItem('local_users', JSON.stringify(localUsers));
          } catch (e) {}

          dbService.setToken(data.token);
          onLogin(userWithToken);
        } else {
          alert('Registro exitoso. Ahora puedes iniciar sesión.');
          setIsLogin(true);
        }
      } else {
        // Respuesta no válida del servidor, intentar localmente
        handleLocalAuth();
      }
    } catch (err: any) {
      // Si el servidor no está encendido o falló la red (modo APK autónomo)
      console.warn("Servidor no accesible, utilizando autenticación local:", err.message);
      handleLocalAuth();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e293b] rounded-[2.5rem] p-8 border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">GestorPro Auth</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            {isLogin ? 'Inicia sesión para continuar' : 'Crea una nueva cuenta'}
          </p>
        </div>

        {isLogin && (
          <div className="mb-6 space-y-3">
            <button
              type="button"
              onClick={() => handleBiometricAuth(false)}
              disabled={isBiometricPrompting}
              className="w-full relative overflow-hidden group bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black py-4 px-4 rounded-2xl shadow-xl shadow-orange-500/25 flex items-center justify-center gap-3.5 transition-all active:scale-[0.98] border border-orange-400/40 touch-manipulation"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0">
                <Fingerprint size={24} className={`text-white ${isBiometricPrompting ? 'animate-bounce' : 'group-hover:scale-110 transition-transform'}`} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  {isBiometricPrompting ? 'Sensor Activo...' : 'Ingresar con Huella Digital'}
                </div>
                <div className="text-[10px] text-white/90 font-semibold normal-case truncate">
                  {isBiometricPrompting ? 'Toca el sensor de tu teléfono' : 'Acceso instantáneo con tu sensor'}
                </div>
              </div>
            </button>

            <div className="relative flex items-center justify-center pt-1">
              <div className="border-t border-slate-700/80 w-full"></div>
              <span className="bg-[#1e293b] px-3 text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                o ingresa con tu contraseña
              </span>
              <div className="border-t border-slate-700/80 w-full"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold p-3 rounded-xl mb-6 text-center uppercase tracking-wider">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-orange-500/50 transition-all"
                    placeholder="Ej. Juan Pérez"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Rol de Usuario</label>
                <select 
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500/50 transition-all"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'seller' })}
                >
                  <option value="seller">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Usuario</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                required 
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-orange-500/50 transition-all"
                placeholder="nombre_usuario"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="password" 
                required 
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-orange-500/50 transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                {isLogin ? 'Iniciar Sesión' : 'Registrar Cuenta'}
              </>
            )}
          </button>
        </form>

        {isLogin && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setFormData({ username: 'admin', password: 'admin123', name: 'Administrador', role: 'admin' });
                setTimeout(() => handleLocalAuth(), 50);
              }}
              className="inline-flex items-center gap-1.5 text-[9px] font-bold text-slate-400 hover:text-orange-400 uppercase tracking-wider transition-colors py-1 px-3 rounded-lg hover:bg-slate-800"
            >
              <Smartphone size={13} className="text-orange-500" />
              Acceso Rápido Autónomo (admin / admin123)
            </button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[9px] font-black text-slate-500 hover:text-orange-500 uppercase tracking-widest transition-colors"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
