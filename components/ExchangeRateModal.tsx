
import React, { useState } from 'react';
import { TrendingUp, Save, DollarSign } from 'lucide-react';
import { parseNumber } from '../utils';

interface Props {
  onSave: (rate: number) => void;
  currentRate: number;
}

const ExchangeRateModal: React.FC<Props> = ({ onSave, currentRate }) => {
  const [rate, setRate] = useState(currentRate > 0 ? currentRate.toString() : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseNumber(rate);
    if (val > 0) onSave(val);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
      <div className="bg-[#1e293b] w-full max-w-md rounded-[3rem] p-12 border border-slate-700 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 bg-orange-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-orange-500/40 mb-6">
            <TrendingUp className="text-white" size={36} />
          </div>
          <h2 className="text-3xl font-black text-white">Actualizar Tasa</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2">Valor oficial de hoy</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="relative group">
            <div className="absolute -top-3 left-6 px-3 bg-[#1e293b] text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] z-10 transition-colors group-focus-within:text-white">
              Precio en Bolívares (Bs)
            </div>
            <div className="relative flex items-center">
               <div className="absolute left-6 text-slate-500 group-focus-within:text-orange-500 transition-colors">
                  <DollarSign size={24} />
               </div>
               <input
                type="number"
                step="0.01"
                lang="en-US"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#0f172a] border-2 border-slate-700 rounded-[2rem] px-14 py-8 text-4xl font-black text-white focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all text-center tracking-tighter"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="bg-slate-800/50 p-5 rounded-3xl border border-slate-700/50 text-center">
            <p className="text-xs text-slate-400 font-medium">Esta tasa se aplicará automáticamente a todas las conversiones de hoy en facturas y reportes.</p>
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-6 rounded-[2rem] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-orange-500/30 active:scale-95 uppercase tracking-[0.2em] text-sm"
          >
            <Save size={20} />
            Establecer Valor
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExchangeRateModal;
