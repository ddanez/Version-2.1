
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Tag, Users, Truck, 
  HandCoins, Wallet, BarChart3, Settings as SettingsIcon, Menu, X, UserCheck, Camera, ChefHat
} from 'lucide-react';
import { AppTab, CompanyInfo, AppSettings, Product, Customer, Supplier, Sale, Purchase, Seller, User, Promotion, CustomerPromotion } from './types';
import { dbService } from './db';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Sales from './components/Sales';
import Purchases from './components/Purchases';
import Contacts from './components/Contacts';
import Accounts from './components/Accounts';
import Expenses from './components/Expenses';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Splash from './components/Splash';
import ExchangeRateModal from './components/ExchangeRateModal';
import Auth from './components/Auth';
import Manufacturing from './components/Manufacturing';
import Promotions from './components/Promotions';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('user_data');
      const savedToken = localStorage.getItem('auth_token');
      if (savedUser && savedToken) {
        dbService.setToken(savedToken);
        return { ...JSON.parse(savedUser), token: savedToken };
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const saved = localStorage.getItem('active_tab');
    return (saved as AppTab) || AppTab.DASHBOARD;
  });
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    const savedToken = localStorage.getItem('auth_token');
    const splashShown = sessionStorage.getItem('splash_shown');
    if (!savedToken || splashShown) {
      return false;
    }
    sessionStorage.setItem('splash_shown', 'true');
    return true;
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showPermissionNudge, setShowPermissionNudge] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Efecto para controlar la duración mínima del Splash
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isDataLoaded || !user) {
        setShowSplash(false);
      }
    }, 2000); // Mínimo 2 segundos de splash para que se vea bien

    // Timeout de seguridad: desaparecer tras 10 segundos pase lo que pase
    const safetyTimer = setTimeout(() => {
      setShowSplash(false);
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, [isDataLoaded, user]);

  // Si los datos se cargan, y ya pasó el tiempo mínimo, quitamos el splash
  useEffect(() => {
    if (isDataLoaded && !showSplash) {
      localStorage.setItem('last_active_time', Date.now().toString());
    }
  }, [isDataLoaded, showSplash]);

  const [company, setCompany] = useState<CompanyInfo>({
    name: "D'DANEZ DISTRIBUCIONES",
    rif: "J-00000000-0",
    address: "Calle Principal",
    phone: "0412-0000000"
  });
  
  const [settings, setSettings] = useState<AppSettings>({
    exchangeRate: 45.5,
    lastRateUpdate: '',
    darkMode: true,
    showLogoOnTicket: true,
    showIvaOnTicket: true,
    includeQr: false,
    ticketFooter: "¡Gracias por su compra!\nNo se aceptan devoluciones sin factura."
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [customerPromotions, setCustomerPromotions] = useState<CustomerPromotion[]>([]);

  const lastDataLoadRef = useRef<number>(0);

  const loadData = useCallback(async (force = false) => {
    if (!user) return;
    try {
      dbService.setToken(user.token || null);
      lastDataLoadRef.current = Date.now();

      // Intento 1: Bootstrap de alto rendimiento (1 sola llamada ultrarrápida)
      const bootData = await dbService.bootstrap();

      let p: Product[] = [];
      let c: Customer[] = [];
      let s: Supplier[] = [];
      let sa: Sale[] = [];
      let pu: Purchase[] = [];
      let st: any[] = [];
      let sel: Seller[] = [];
      let pay: any[] = [];
      let ex: any[] = [];
      let mov: any[] = [];
      let pro: Promotion[] = [];
      let cpro: CustomerPromotion[] = [];

      if (bootData) {
        p = bootData.products || [];
        c = bootData.customers || [];
        s = bootData.suppliers || [];
        sa = bootData.sales || [];
        pu = bootData.purchases || [];
        st = bootData.settings || [];
        sel = bootData.sellers || [];
        pay = bootData.payments || [];
        ex = bootData.expenses || [];
        mov = bootData.movements || [];
        pro = bootData.promotions || [];
        cpro = bootData.customer_promotions || [];
      } else {
        // Fallback: Si no hay bootstrap disponible
        await dbService.init();
        [p, c, s, sa, pu, st, sel, pay, ex, mov, pro, cpro] = await Promise.all([
          dbService.getAll<Product>('products'),
          dbService.getAll<Customer>('customers'),
          dbService.getAll<Supplier>('suppliers'),
          dbService.getAll<Sale>('sales'),
          dbService.getAll<Purchase>('purchases'),
          dbService.getAll<any>('settings'),
          dbService.getAll<Seller>('sellers'),
          dbService.getAll<any>('payments'),
          dbService.getAll<any>('expenses'),
          dbService.getAll<any>('movements'),
          dbService.getAll<any>('promotions'),
          dbService.getAll<any>('customer_promotions')
        ]);
      }

      setProducts(p || []);
      setCustomers(c || []);
      setSuppliers(s || []);
      setSellers(sel || []);
      setSales((sa || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setPurchases((pu || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setPayments((pay || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setExpenses((ex || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setMovements((mov || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setPromotions(pro || []);
      setCustomerPromotions(cpro || []);

      const savedSettings = st.find((s: any) => s.id === 'app_settings');
      const savedCompany = st.find((s: any) => s.id === 'company_info');

      if (savedSettings) setSettings(savedSettings);
      if (savedCompany) setCompany(savedCompany);

      const today = new Date().toISOString().split('T')[0];
      if (!savedSettings || savedSettings.lastRateUpdate !== today) {
        setShowExchangeModal(true);
      }

      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (status.state === 'prompt') {
            setShowPermissionNudge(true);
          }
        } catch (e) {
          console.warn("Permissions API no soportada");
        }
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setIsDataLoaded(true);
    }
  }, [user]);

  const forceLogout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('active_tab');
    setUser(null);
    dbService.setToken(null);
  }, []);

  useEffect(() => {
    dbService.setOnSessionExpired(() => {
      forceLogout();
    });
  }, [forceLogout]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user_data');
    const savedToken = localStorage.getItem('auth_token');
    if (savedUser && savedToken) {
      setUser({ ...JSON.parse(savedUser), token: savedToken });
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('active_tab', activeTab);
    }
  }, [activeTab, user]);

  // Manejo del botón atrás y visibilidad para evitar salir de la app accidentalmente
  useEffect(() => {
    if (!user) return;

    const handlePopState = (e: PopStateEvent) => {
      // Forzamos que el historial siempre tenga una entrada extra para capturar el botón atrás
      window.history.pushState(null, "", window.location.pathname);
      console.log("Botón atrás capturado - Evitando cierre");
    };

    // Inicializamos el historial con varias entradas para mayor seguridad
    window.history.pushState(null, "", window.location.pathname);
    window.history.pushState(null, "", window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    
    // Escuchar cuando la app vuelve a primer plano
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Al volver a primer plano, nos aseguramos de que el historial esté correcto
        window.history.pushState(null, "", window.location.pathname);
        localStorage.setItem('last_active_time', Date.now().toString());
        // Solo refrescar si han pasado más de 3 minutos de inactividad
        const elapsed = Date.now() - lastDataLoadRef.current;
        if (elapsed > 180000) {
          console.log("App en primer plano - Sincronizando datos");
          loadData();
        }
      }
    };
    window.document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleUnload = () => {
      localStorage.setItem('last_active_time', Date.now().toString());
    };
    window.addEventListener('unload', handleUnload);

    // Actualizar el tiempo de actividad periódicamente
    const activityInterval = setInterval(() => {
      localStorage.setItem('last_active_time', Date.now().toString());
    }, 60000); // Cada minuto

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('unload', handleUnload);
      clearInterval(activityInterval);
    };
  }, [user]);

  const handleLogout = () => {
    if (!confirm('¿ESTÁ SEGURO QUE DESEA SALIR DE LA APLICACIÓN?')) return;
    forceLogout();
  };

  const handleUpdateExchangeRate = async (rate: number) => {
    const newSettings = { 
      ...settings, 
      exchangeRate: rate, 
      lastRateUpdate: new Date().toISOString().split('T')[0] 
    };
    setSettings(newSettings);
    await dbService.put('settings', { ...newSettings, id: 'app_settings' });
    setShowExchangeModal(false);
  };

  const navItems = [
    { id: AppTab.DASHBOARD, label: 'DASHBOARD', icon: LayoutDashboard, roles: ['admin', 'seller'] },
    { id: AppTab.INVENTORY, label: 'INVENTARIO', icon: Package, roles: ['admin'] },
    { id: AppTab.SALES, label: 'VENTAS POS', icon: Tag, roles: ['admin', 'seller'] },
    { id: AppTab.PURCHASES, label: 'COMPRAS', icon: ShoppingCart, roles: ['admin'] },
    { id: AppTab.EXPENSES, label: 'GASTOS', icon: Wallet, roles: ['admin'] },
    { id: AppTab.CUSTOMERS, label: 'CLIENTES', icon: Users, roles: ['admin', 'seller'] },
    { id: AppTab.SUPPLIERS, label: 'PROVEEDORES', icon: Truck, roles: ['admin'] },
    { id: AppTab.MANUFACTURING, label: 'MANUFACTURA', icon: ChefHat, roles: ['admin'] },
    { id: AppTab.PROMOTIONS, label: 'PROMOCIONES', icon: Tag, roles: ['admin', 'seller'] },
    { id: AppTab.CXC, label: 'CXC (DEUDAS)', icon: HandCoins, roles: ['admin', 'seller'] },
    { id: AppTab.CXP, label: 'CXP (PAGOS)', icon: Wallet, roles: ['admin'] },
    { id: AppTab.REPORTS, label: 'REPORTES', icon: BarChart3, roles: ['admin'] },
    { id: AppTab.SETTINGS, label: 'AJUSTES', icon: SettingsIcon, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const currentTabLabel = navItems.find(item => item.id === activeTab)?.label || 'GESTIÓN';

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setShowPermissionNudge(false);
    } catch (err) {
      console.error("Error al solicitar permiso de cámara:", err);
      setShowPermissionNudge(false);
    }
  };

  if (!user) return <Auth onLogin={setUser} />;

  if (showSplash) return <Splash company={company} />;

  return (
    <div className={`min-h-screen ${settings.darkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-900'} flex flex-col md:flex-row`}>
      {/* Aviso de Permisos en ESPAÑOL */}
      {showPermissionNudge && (
        <div className="fixed inset-0 z-[1000] bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#1e293b] border border-slate-700 p-8 rounded-[3rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Camera size={40} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 text-white">Acceso a Cámara</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed font-bold uppercase tracking-tight">
              ESTA APLICACIÓN REQUIERE ACCESO A SU CÁMARA PARA PERMITIR EL ESCANEO DE CÓDIGOS DE BARRAS EN VENTAS E INVENTARIO.
            </p>
            <button 
              onClick={requestCameraPermission}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-orange-500/20 uppercase text-[10px] tracking-[0.2em]"
            >
              PERMITIR ACCESO
            </button>
          </div>
        </div>
      )}

      <div className="md:hidden flex items-center justify-between p-4 bg-[#1e293b] border-b border-slate-700 sticky top-0 z-50 h-14">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-300">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="font-black text-[10px] truncate uppercase tracking-widest text-orange-500">{currentTabLabel}</span>
        <div className="w-8"></div>
      </div>

      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:sticky top-0 inset-y-0 left-0 z-50 w-64 bg-[#1e293b] border-r border-slate-700 transition-transform duration-300 ease-in-out flex flex-col h-screen`}>
        <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
           <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Package size={18} />
           </div>
           <span className="font-black text-xs tracking-tighter uppercase italic">Gestor<span className="text-orange-500">PRO</span></span>
        </div>
        <nav className="px-3 space-y-1 flex-1 overflow-y-auto py-4">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-2xl mb-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-xs uppercase">
              {user.name.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-white truncate uppercase tracking-tighter">{user.name}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <X size={14} /> Salir del Sistema
          </button>
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <main className="flex-1 overflow-y-auto bg-[#0f172a]">
        <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
          {activeTab === AppTab.DASHBOARD && <Dashboard sales={sales} purchases={purchases} expenses={expenses} products={products} settings={settings} movements={movements} />}
          {activeTab === AppTab.INVENTORY && <Inventory products={products} setProducts={setProducts} settings={settings} />}
          {activeTab === AppTab.SALES && <Sales sales={sales} setSales={setSales} customers={customers} setCustomers={setCustomers} products={products} setProducts={setProducts} sellers={sellers} settings={settings} company={company} />}
          {activeTab === AppTab.PURCHASES && <Purchases purchases={purchases} setPurchases={setPurchases} suppliers={suppliers} setSuppliers={setSuppliers} products={products} setProducts={setProducts} settings={settings} />}
          {activeTab === AppTab.EXPENSES && <Expenses expenses={expenses} setExpenses={setExpenses} settings={settings} />}
          {activeTab === AppTab.CUSTOMERS && <Contacts type="customers" items={customers} setItems={setCustomers} relatedData={sales} payments={payments} settings={settings} />}
          {activeTab === AppTab.SUPPLIERS && <Contacts type="suppliers" items={suppliers} setItems={setSuppliers} relatedData={purchases} payments={payments} settings={settings} />}
          { activeTab === AppTab.MANUFACTURING && <Manufacturing settings={settings} /> }
          { activeTab === AppTab.PROMOTIONS && <Promotions settings={settings} company={company} customers={customers} products={products} setProducts={setProducts} /> }
          {activeTab === AppTab.CXC && <Accounts type="cxc" items={sales.filter(s => s.status === 'pending')} settings={settings} company={company} onUpdate={loadData} customers={customers} suppliers={suppliers} />}
          {activeTab === AppTab.CXP && <Accounts type="cxp" items={purchases.filter(p => p.status === 'pending')} settings={settings} company={company} onUpdate={loadData} customers={customers} suppliers={suppliers} />}
          {activeTab === AppTab.REPORTS && <Reports sales={sales} purchases={purchases} expenses={expenses} products={products} customers={customers} suppliers={suppliers} settings={settings} movements={movements} promotions={promotions} customerPromotions={customerPromotions} />}
          {activeTab === AppTab.SETTINGS && <Settings company={company} setCompany={setCompany} settings={settings} setSettings={setSettings} user={user} />}
        </div>
      </main>

      {showExchangeModal && <ExchangeRateModal onSave={handleUpdateExchangeRate} currentRate={settings.exchangeRate} />}
    </div>
  );
};

export default App;
