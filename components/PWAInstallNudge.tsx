
import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export const PWAInstallNudge: React.FC = () => {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Si no se dispara el evento (algunos navegadores), mostramos el nudge después de un tiempo
    const timer = setTimeout(() => {
      if (!isStandalone) setShow(true);
    }, 10000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    } else {
      // Instrucciones manuales si no hay prompt automático
      alert('Para instalar:\n1. Toca el botón de Menú (3 puntos) o Compartir.\n2. Selecciona "Instalar aplicación" o "Agregar a pantalla de inicio".');
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-3xl shadow-2xl flex items-center gap-4">
        <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center shrink-0">
          <Smartphone size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[10px] font-black uppercase tracking-tighter">Instalar App</p>
          <p className="text-slate-400 text-[8px] font-bold uppercase leading-tight">Instala la app para evitar que se cierre al cambiar de aplicación.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleInstall}
            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20"
          >
            Instalar
          </button>
          <button 
            onClick={() => setShow(false)}
            className="p-2 text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
