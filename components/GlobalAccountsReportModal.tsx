
import React, { useRef, useState, useMemo } from 'react';
import { X, Download, FileText, LayoutList, List, SortAsc, SortDesc, Type } from 'lucide-react';
import { CompanyInfo, AppSettings, Sale, Purchase } from '../types';
import * as htmlToImage from 'html-to-image';
import { calculateBS } from '../utils';

interface GroupedData {
  id: string;
  name: string;
  totalPending: number;
  invoices: (Sale | Purchase)[];
  creditBalance: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: GroupedData[];
  company: CompanyInfo;
  settings: AppSettings;
  type: 'cxc' | 'cxp';
}

type SortOption = 'alphabetical' | 'balance-high' | 'balance-low';
type ViewMode = 'summary' | 'detailed';

export const GlobalAccountsReportModal: React.FC<Props> = ({ 
  isOpen, onClose, data, company, settings, type 
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('alphabetical');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  const sortedData = useMemo(() => {
    const result = [...data];
    if (sortOption === 'alphabetical') {
      return result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === 'balance-high') {
      return result.sort((a, b) => b.totalPending - a.totalPending);
    } else if (sortOption === 'balance-low') {
      return result.sort((a, b) => a.totalPending - b.totalPending);
    }
    return result;
  }, [data, sortOption]);

  const totalOutstanding = useMemo(() => {
    return data.reduce((sum, item) => sum + item.totalPending, 0);
  }, [data]);

  const totalCredit = useMemo(() => {
    return data.reduce((sum, item) => sum + item.creditBalance, 0);
  }, [data]);

  if (!isOpen) return null;

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);
    
    try {
      // Pequeña pausa para asegurar que el DOM esté listo
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        backgroundColor: '#fff',
        pixelRatio: 2, // Reducido un poco para mayor compatibilidad en móviles
        cacheBust: true,
      });

      const fileName = `Reporte_General_${type.toUpperCase()}_${new Date().toISOString().split('T')[0]}.png`;
      
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = dataUrl;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);

    } catch (err) {
      console.error('Error al generar imagen:', err);
      alert('No se pudo generar la imagen. Intente de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTitle = type === 'cxc' ? 'CUENTAS POR COBRAR GENERAL' : 'CUENTAS POR PAGAR GENERAL';

  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-2 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header Controls */}
        <div className="bg-slate-900 p-4 flex flex-col gap-4">
           <div className="flex justify-between items-center">
             <span className="text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2">
                <FileText size={18} className="text-orange-500" />
                {reportTitle}
             </span>
             <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
               <X size={24} />
             </button>
           </div>

           <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Modo de Vista</label>
                <div className="flex bg-slate-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setViewMode('summary')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'summary' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                  >
                    <LayoutList size={14} /> Resumen
                  </button>
                  <button 
                    onClick={() => setViewMode('detailed')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'detailed' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                  >
                    <List size={14} /> Detallado
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Ordenar por</label>
                <select 
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-full bg-slate-800 text-white text-[9px] font-black uppercase p-2 rounded-xl border-none outline-none appearance-none cursor-pointer"
                >
                  <option value="alphabetical">Alfabeto (A-Z)</option>
                  <option value="balance-high">Saldo (Mayor-Menor)</option>
                  <option value="balance-low">Saldo (Menor-Mayor)</option>
                </select>
              </div>
           </div>
        </div>

        {/* Report Content */}
        <div className="max-h-[60vh] overflow-y-auto bg-slate-100 p-2">
          <div 
            ref={reportRef} 
            className="p-8 text-black bg-white font-mono text-[11px] leading-tight min-w-[500px]"
          >
             {/* Company Header */}
             <div className="text-center space-y-1 mb-6">
                <h2 className="text-[20px] font-black uppercase leading-none tracking-tighter">{company.name}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">{reportTitle}</p>
                <div className="text-[9px] font-bold mt-2 pt-2 border-t border-slate-100 flex justify-around">
                  <p>RIF: {company.rif}</p>
                  <p>FECHA: {new Date().toLocaleDateString('es-VE')}</p>
                </div>
             </div>

             <div className="border-t-2 border-black mb-4"></div>

             {/* Totals Summary Card (Always Visible on Top) */}
             <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-slate-50 p-4 border-2 border-black rounded-lg">
                 <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Total Pendiente General</p>
                 <p className="text-[18px] font-black">US$ {totalOutstanding.toFixed(2).replace('.', ',')}</p>
                 <p className="text-[10px] font-bold text-slate-600">
                    {calculateBS(totalOutstanding, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                 </p>
               </div>
               <div className="bg-slate-50 p-4 border-2 border-black rounded-lg">
                 <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Total Saldo Favor</p>
                 <p className="text-[18px] font-black text-emerald-600">US$ {totalCredit.toFixed(2).replace('.', ',')}</p>
                 <p className="text-[10px] font-bold text-slate-600">
                    {calculateBS(totalCredit, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                 </p>
               </div>
             </div>

             {/* Table Header */}
             <div className="flex justify-between font-black text-[10px] uppercase border-b-2 border-black pb-2 mb-2">
                <span className="w-[60%]">ENTIDAD / DETALLE</span>
                <span className="w-[40%] text-right">MONTO PENDIENTE</span>
             </div>

             {/* List */}
             <div className="space-y-4">
                {sortedData.filter(item => item.totalPending > 0).map((group, idx) => (
                  <div key={idx} className="border-b border-slate-200 pb-2">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-black text-[12px] uppercase">{group.name}</span>
                      <span className="font-black text-[12px] text-right">US$ {group.totalPending.toFixed(2)}</span>
                    </div>

                    {viewMode === 'detailed' && group.invoices.length > 0 && (
                      <div className="pl-4 space-y-1 mt-1 opacity-80">
                        {group.invoices.map((inv, invIdx) => {
                          const balance = (inv.totalUSD || 0) - (inv.paidAmountUSD || 0);
                          return (
                            <div key={invIdx} className="flex justify-between text-[9px] border-l-2 border-slate-200 pl-2">
                              <span>#{inv.id.slice(-6).toUpperCase()} - {new Date(inv.date).toLocaleDateString()}</span>
                              <span>US$ {balance.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {group.creditBalance > 0 && (
                      <div className="flex justify-between text-[9px] font-bold text-emerald-600 mt-1 italic">
                        <span>SALDO A FAVOR</span>
                        <span>- US$ {group.creditBalance.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
             </div>

             <div className="mt-8 pt-6 border-t-2 border-black text-center space-y-4">
                <div className="flex justify-between items-center bg-slate-100 p-4 font-black text-[16px]">
                   <span className="uppercase tracking-tighter">NETO POR {type === 'cxc' ? 'COBRAR' : 'PAGAR'}</span>
                   <span>US$ {Math.max(0, totalOutstanding - totalCredit).toFixed(2).replace('.', ',')}</span>
                </div>
                
                <p className="text-[10px] font-black uppercase text-slate-400">
                  *** FIN DEL REPORTE GENERADO EL {new Date().toLocaleDateString('es-VE')} ***
                </p>
             </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
           <button 
             onClick={handleDownloadImage} 
             disabled={isGenerating}
             className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
           >
              {isGenerating ? 'Generando...' : <><Download size={20} /> Descargar Reporte como Imagen</>}
           </button>
           
           <button onClick={onClose} className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest font-sans">
             Cerrar
           </button>
        </div>
      </div>
    </div>
  );
};
