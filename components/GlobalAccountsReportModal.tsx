
import React, { useRef, useState, useMemo } from 'react';
import { X, FileText, LayoutList, List, Share2 } from 'lucide-react';
import { CompanyInfo, AppSettings, Sale, Purchase } from '../types';
import * as htmlToImage from 'html-to-image';
import { calculateBS } from '../utils';
import { downloadOrShareFile } from '../downloadHelper';

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

  const netTotal = Math.max(0, totalOutstanding - totalCredit);

  if (!isOpen) return null;

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);
    
    try {
      // Pequeña pausa para asegurar que fuentes y DOM estén listos
      await new Promise(resolve => setTimeout(resolve, 350));

      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 3, // Alta definición para máxima nitidez al ampliar en móviles
        cacheBust: true,
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `Reporte_General_${type.toUpperCase()}_${dateStr}.png`;
      const success = await downloadOrShareFile({
        fileName,
        title: `${reportTitle} - ${new Date().toLocaleDateString('es-VE')}`,
        dataUrl,
        mimeType: 'image/png'
      });

      if (!success) {
        alert('No se pudo guardar la imagen automáticamente. Intente tomar una captura de pantalla.');
      }
    } catch (err) {
      console.error('Error al generar imagen:', err);
      alert('No se pudo generar la imagen. Intente de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTitle = type === 'cxc' ? 'CUENTAS POR COBRAR GENERAL' : 'CUENTAS POR PAGAR GENERAL';

  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header Controls */}
        <div className="bg-slate-900 p-4 flex flex-col gap-3">
           <div className="flex justify-between items-center">
             <span className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <FileText size={18} className="text-orange-500" />
                {reportTitle}
             </span>
             <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
               <X size={22} />
             </button>
           </div>

           <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Modo de Vista</label>
                <div className="flex bg-slate-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setViewMode('summary')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'summary' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                  >
                    <LayoutList size={14} /> Resumen
                  </button>
                  <button 
                    onClick={() => setViewMode('detailed')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'detailed' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                  >
                    <List size={14} /> Detallado
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Ordenar por</label>
                <select 
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-full bg-slate-800 text-white text-[10px] font-black uppercase p-2.5 rounded-xl border border-slate-700 outline-none appearance-none cursor-pointer"
                >
                  <option value="alphabetical">Alfabeto (A-Z)</option>
                  <option value="balance-high">Saldo (Mayor a Menor)</option>
                  <option value="balance-low">Saldo (Menor a Mayor)</option>
                </select>
              </div>
           </div>
        </div>

        {/* Report Preview & Capture Container */}
        <div className="max-h-[62vh] overflow-y-auto overflow-x-auto bg-slate-200/90 p-2 sm:p-4 flex justify-start md:justify-center">
          <div 
            ref={reportRef} 
            className="p-8 text-slate-900 bg-white font-sans w-[740px] min-w-[740px] leading-normal shadow-md"
          >
             {/* Company Header */}
             <div className="text-center space-y-2 mb-6 pb-4 border-b-2 border-slate-900">
                {settings.showLogoOnTicket && company.logo && (
                  <div className="flex justify-center mb-2">
                    <img 
                      src={company.logo} 
                      alt="Logo" 
                      className="h-14 max-h-16 w-auto object-contain block mx-auto" 
                    />
                  </div>
                )}
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">{company.name}</h2>
                <div className="inline-block bg-orange-600 text-white text-xs font-black uppercase tracking-widest px-3 py-1 rounded-md">
                  {reportTitle}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-600 pt-2 border-t border-slate-200 mt-2">
                  <div>RIF: <span className="text-slate-900 font-extrabold">{company.rif || 'N/A'}</span></div>
                  <div>FECHA: <span className="text-slate-900 font-extrabold">{new Date().toLocaleDateString('es-VE')}</span></div>
                  <div>TASA: <span className="text-slate-900 font-extrabold">{settings.exchangeRate > 0 ? `${settings.exchangeRate.toFixed(2)} Bs/$` : 'N/A'}</span></div>
                </div>
             </div>

             {/* Totals Summary Cards */}
             <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-slate-50 p-4 border-2 border-slate-900 rounded-xl shadow-sm">
                 <p className="text-xs font-black uppercase text-slate-600 tracking-wider mb-1">Total Pendiente General</p>
                 <p className="text-2xl font-black text-slate-900">US$ {totalOutstanding.toFixed(2).replace('.', ',')}</p>
                 {settings.exchangeRate > 0 && (
                   <p className="text-xs font-bold text-slate-700 mt-0.5">
                     ≈ {calculateBS(totalOutstanding, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                   </p>
                 )}
               </div>

               <div className="bg-emerald-50 p-4 border-2 border-emerald-700 rounded-xl shadow-sm">
                 <p className="text-xs font-black uppercase text-emerald-800 tracking-wider mb-1">Total Saldo a Favor</p>
                 <p className="text-2xl font-black text-emerald-700">US$ {totalCredit.toFixed(2).replace('.', ',')}</p>
                 {settings.exchangeRate > 0 && (
                   <p className="text-xs font-bold text-emerald-800 mt-0.5">
                     ≈ {calculateBS(totalCredit, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                   </p>
                 )}
               </div>
             </div>

             {/* Net Total Highlight Bar */}
             <div className="bg-slate-900 text-white px-5 py-3.5 rounded-xl flex justify-between items-center mb-6 shadow-md">
                <span className="text-xs font-black uppercase tracking-widest text-orange-400">
                  NETO REAL POR {type === 'cxc' ? 'COBRAR' : 'PAGAR'}:
                </span>
                <div className="text-right">
                   <span className="text-xl font-black tracking-tight text-white">
                     US$ {netTotal.toFixed(2).replace('.', ',')}
                   </span>
                   {settings.exchangeRate > 0 && (
                     <span className="block text-[11px] font-bold text-slate-300">
                       {calculateBS(netTotal, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                     </span>
                   )}
                </div>
             </div>

             {/* Table Header */}
             <div className="grid grid-cols-12 bg-slate-100 text-slate-900 font-black text-xs uppercase px-4 py-2.5 rounded-lg border-b-2 border-slate-900 mb-3">
                <span className="col-span-7">CLIENTE / ENTIDAD {viewMode === 'detailed' && 'Y DOCUMENTOS'}</span>
                <span className="col-span-5 text-right">MONTO PENDIENTE</span>
             </div>

             {/* List of Entities */}
             <div className="space-y-3">
                {sortedData.filter(item => item.totalPending > 0).map((group, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-white hover:bg-slate-50/50 transition-colors">
                    <div className="grid grid-cols-12 items-baseline">
                      <div className="col-span-7">
                        <span className="font-black text-sm uppercase text-slate-900 tracking-tight">{group.name}</span>
                        {group.creditBalance > 0 && (
                          <div className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Saldo a favor: -US$ {group.creditBalance.toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-5 text-right">
                        <span className="font-black text-base text-slate-900">US$ {group.totalPending.toFixed(2)}</span>
                        {settings.exchangeRate > 0 && (
                          <span className="block text-xs font-semibold text-slate-600">
                            {calculateBS(group.totalPending, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detailed Invoice Breakdown */}
                    {viewMode === 'detailed' && group.invoices.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 pl-3">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                          Documentos pendientes ({group.invoices.length}):
                        </div>
                        {group.invoices.map((inv, invIdx) => {
                          const balance = (inv.totalUSD || 0) - (inv.paidAmountUSD || 0);
                          return (
                            <div key={invIdx} className="flex justify-between items-center text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200/60">
                              <span className="font-bold">
                                #{inv.id.slice(-6).toUpperCase()} • {new Date(inv.date).toLocaleDateString('es-VE')}
                              </span>
                              <span className="font-extrabold text-slate-900">
                                US$ {balance.toFixed(2)}
                                {settings.exchangeRate > 0 && (
                                  <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                                    ({calculateBS(balance, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.)
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
             </div>

             {/* Footer Notice */}
             <div className="mt-8 pt-4 border-t-2 border-slate-900 text-center space-y-1">
                <p className="text-xs font-extrabold uppercase text-slate-600">
                  GESTOR PRO • REPORTE GENERADO EL {new Date().toLocaleDateString('es-VE')} A LAS {new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold">
                  *** Documento de control interno administrativo ***
                </p>
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
           <button 
             onClick={handleDownloadImage} 
             disabled={isGenerating}
             className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
           >
              {isGenerating ? 'Generando imagen nítida...' : <><Share2 size={20} /> Guardar o Compartir Reporte en Alta Calidad</>}
           </button>
           
           <button onClick={onClose} className="sm:w-32 bg-slate-200 hover:bg-slate-300 text-slate-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
             Cerrar
           </button>
        </div>
      </div>
    </div>
  );
};

