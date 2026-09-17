
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, Lock, Loader2, UserPlus, LogIn, ShieldCheck, ShieldAlert, Smartphone, 
  Fingerprint, HelpCircle, KeyRound, CheckCircle2, X, AlertTriangle, 
  ArrowRight, Users
} from 'lucide-react';
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

  // Estado para Solución de Usuario / Contraseña Olvidada
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState<'seller' | 'admin'>('seller');
  const [isResettingAdmin, setIsResettingAdmin] = useState(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState('');
  const [knownUsers, setKnownUsers] = useState<Array<{ username: string; name: string; role: string }>>([]);

  const openRecoveryModal = () => {
    let localUsers: any[] = [];
    const saved = localStorage.getItem('local_users');
    if (saved) {
      try { localUsers = JSON.parse(saved); } catch { localUsers = []; }
    }
    const cleanList = localUsers.map((u: any) => ({
      username: u.username || '',
      name: u.name || u.username || '',
      role: u.role || 'seller'
    })).filter(u => u.username);
    setKnownUsers(cleanList);
    setRecoverySuccessMessage('');
    setShowRecoveryModal(true);
  };

  const handleEmergencyAdminReset = async () => {
    setIsResettingAdmin(true);
    setRecoverySuccessMessage('');
    try {
      // 1. Reset en localStorage
      let localUsers: any[] = [];
      const saved = localStorage.getItem('local_users');
      if (saved) {
        try { localUsers = JSON.parse(saved); } catch { localUsers = []; }
      }

      const adminIdx = localUsers.findIndex((u: any) => u.username?.toLowerCase() === 'admin');
      if (adminIdx >= 0) {
        localUsers[adminIdx].password = 'admin123';
        localUsers[adminIdx].role = 'admin';
        localUsers[adminIdx].permissions = Object.values(AppTab);
      } else {
        localUsers.unshift({
          id: 'admin-local',
          username: 'admin',
          password: 'admin123',
          role: 'admin',
          name: 'Administrador',
          permissions: Object.values(AppTab)
        });
      }
      localStorage.setItem('local_users', JSON.stringify(localUsers));

      // 2. Si hay conexión con backend (Termux / SQLite), llamar a /api/auth/reset-admin-emergency
      try {
        const baseUrl = dbService.getBaseUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch(`${baseUrl}/api/auth/reset-admin-emergency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: 'admin123' }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (e) {
        console.warn("Backend no disponible para reset de emergencia, aplicado en local.");
      }

      // 3. Auto-rellenar formulario de login
      setFormData(prev => ({
        ...prev,
        username: 'admin',
        password: 'admin123'
      }));

      setRecoverySuccessMessage('✅ Administrador restablecido: Usuario: admin | Clave: admin123');
      setTimeout(() => {
        setShowRecoveryModal(false);
        setRecoverySuccessMessage('');
      }, 3500);
    } catch (err: any) {
      alert("Error al restablecer administrador: " + (err.message || 'Intente nuevamente'));
    } finally {
      setIsResettingAdmin(false);
    }
  };

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
          <div className="mt-3 flex flex-col items-center gap-2 text-center">
            <button
              type="button"
              onClick={openRecoveryModal}
              className="inline-flex items-center gap-1.5 text-[9px] font-bold text-amber-400/90 hover:text-amber-300 uppercase tracking-wider transition-colors py-1 px-3 rounded-lg hover:bg-slate-800"
            >
              <HelpCircle size={13} className="text-amber-400" />
              ¿Olvidaste tu contraseña o usuario?
            </button>

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

      {/* MODAL: Solución a Usuario o Contraseña Olvidada */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1e293b] border border-slate-700 rounded-[2.5rem] w-full max-w-lg p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 my-8 space-y-5">
            {/* Encabezado */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Recuperación de Acceso
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Solución para usuarios y contraseñas olvidadas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selector de Pestañas: Vendedor vs Administrador */}
            <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setRecoveryTab('seller')}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  recoveryTab === 'seller'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users size={14} />
                <span>Soy Vendedor</span>
              </button>

              <button
                type="button"
                onClick={() => setRecoveryTab('admin')}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  recoveryTab === 'admin'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck size={14} />
                <span>Soy Administrador</span>
              </button>
            </div>

            {recoverySuccessMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 uppercase tracking-wide">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{recoverySuccessMessage}</span>
              </div>
            )}

            {/* Contenido Pestaña: Vendedor */}
            {recoveryTab === 'seller' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase">
                    <ShieldAlert size={16} />
                    <span>Control Centralizado de Seguridad</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Por políticas de seguridad, las cuentas de vendedor y sus privilegios están bajo el control de tu <strong>Administrador</strong>.
                  </p>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                    <p className="font-bold text-white uppercase text-[9px] tracking-wider">
                      ¿Cómo restablecer tu contraseña?
                    </p>
                    <p>
                      1. Contacta al Administrador de tu negocio.
                    </p>
                    <p>
                      2. El Administrador ingresará a <strong>Ajustes &gt; Gestión de Usuarios y Privilegios</strong>.
                    </p>
                    <p>
                      3. Presionará el botón <strong>&quot;Contraseña&quot;</strong> junto a tu nombre y te asignará una nueva clave al instante.
                    </p>
                  </div>
                </div>

                {/* Si olvidó el nombre de usuario exacto, listar los usuarios registrados */}
                <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    ¿No recuerdas tu nombre de usuario exacto? Usuarios en este equipo:
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {knownUsers.length > 0 ? (
                      knownUsers.map((u, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, username: u.username }));
                            setShowRecoveryModal(false);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left text-[10px] font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
                          title="Haz clic para autocompletar este usuario"
                        >
                          <span className="text-orange-400">@{u.username}</span>
                          <span className="text-[8px] text-slate-500 uppercase">({u.name})</span>
                          <ArrowRight size={10} className="text-slate-500" />
                        </button>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">
                        No hay otros usuarios registrados en este equipo además del admin.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contenido Pestaña: Administrador */}
            {recoveryTab === 'admin' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 space-y-3">
                  <div className="flex items-center gap-2 text-orange-400 text-xs font-black uppercase">
                    <ShieldCheck size={16} />
                    <span>Recuperación de Administrador</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Si olvidaste la contraseña del Administrador principal o necesitas recuperar el acceso al sistema, dispones de dos mecanismos directos:
                  </p>

                  <div className="space-y-2">
                    {/* Opción 1: Huella digital */}
                    {biometricAvailable && (
                      <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-start gap-2.5">
                        <Fingerprint size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">
                            1. Ingreso Biométrico
                          </p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            Si configuraste tu huella digital en este teléfono, puedes cerrar este aviso y presionar el botón <strong>&quot;Ingresar con Huella Digital&quot;</strong>.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Opción 2: Restablecer Administrador de Emergencia */}
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
                            Restablecer Administrador de Emergencia
                          </p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            Reestablece de forma segura el usuario <strong>admin</strong> con la clave por defecto <strong>admin123</strong> con todos los privilegios.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleEmergencyAdminReset}
                        disabled={isResettingAdmin}
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {isResettingAdmin ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <KeyRound size={16} />
                        )}
                        <span>Restablecer Admin a &quot;admin / admin123&quot;</span>
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[9px] text-slate-500 text-center uppercase tracking-wider">
                  Una vez que ingreses, recuerda cambiar la contraseña en Ajustes si lo deseas.
                </p>
              </div>
            )}

            {/* Pie del modal */}
            <div className="pt-2 border-t border-slate-700/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
