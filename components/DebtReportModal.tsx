
import React, { useRef, useState } from 'react';
import { X, Printer, Download, FileText, Share2 } from 'lucide-react';
import { CompanyInfo, AppSettings, Sale, Purchase } from '../types';
import * as htmlToImage from 'html-to-image';
import { calculateBS } from '../utils';
import { downloadOrShareFile } from '../downloadHelper';
import { Capacitor } from '@capacitor/core';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  invoices: (Sale | Purchase)[];
  totalPending: number;
  creditBalance: number;
  company: CompanyInfo;
  settings: AppSettings;
  type: 'cxc' | 'cxp';
}

export const DebtReportModal: React.FC<Props> = ({ 
  isOpen, onClose, entityName, invoices, totalPending, creditBalance, company, settings, type 
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (Capacitor.isNativePlatform()) {
      // En APK nativo, compartir la imagen permite enviar directamente a imprimir o guardar
      handleDownloadImage();
    } else {
      window.print();
    }
  };

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);
    
    try {
      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        backgroundColor: '#fff',
        pixelRatio: 3,
        cacheBust: true,
      });

      const fileName = `Estado_Cuenta_${entityName.replace(/\s+/g, '_')}.png`;
      const success = await downloadOrShareFile({
        fileName,
        title: `${reportTitle} - ${entityName}`,
        dataUrl,
        mimeType: 'image/png'
      });

      if (!success) {
        alert('No se pudo guardar la imagen automáticamente. Intente tomar una captura de pantalla.');
      }
    } catch (err) {
      console.error('Error al generar imagen:', err);
      alert('No se pudo generar la imagen.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTitle = type === 'cxc' ? 'ESTADO DE CUENTA (CXC)' : 'ESTADO DE CUENTA (CXP)';
  const entityLabel = type === 'cxc' ? 'CLIENTE' : 'PROVEEDOR';

  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-2 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 print:shadow-none print:rounded-none">
        
        <div className="bg-slate-900 p-3 flex justify-between items-center print:hidden">
           <span className="text-white text-[10px] font-black uppercase tracking-widest">
              {reportTitle}
           </span>
           <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
             <X size={20} />
           </button>
        </div>

        <div 
          ref={reportRef} 
          className="p-6 text-black bg-white font-mono text-[11px] leading-tight print-content"
        >
           {settings.showLogoOnTicket && company.logo && (
             <div className="flex justify-center mb-4 w-full">
               <img 
                 src={company.logo} 
                 alt="Logo Empresa" 
                 className="w-32 h-auto max-h-24 object-contain block mx-auto" 
               />
             </div>
           )}

           <div className="text-center space-y-0.5 mb-4">
              <h2 className="text-[16px] font-black uppercase leading-none tracking-tighter">{company.name}</h2>
              <div className="text-[9px] font-bold space-y-0.5 mt-1 border-t border-slate-100 pt-1">
                <p>RIF: {company.rif}</p>
                {company.phone && <p>TELF: {company.phone}</p>}
                {company.address && <p className="uppercase leading-tight">{company.address}</p>}
              </div>
           </div>

           <div className="border-t border-black mb-3"></div>

           <div className="bg-slate-100 p-3 rounded-xl mb-4 border border-slate-200">
              <div className="flex justify-between items-baseline mb-1">
                 <span className="font-bold uppercase text-[8px] text-slate-500">{entityLabel}:</span>
                 <span className="uppercase font-black text-[12px] text-right">{entityName}</span>
              </div>
              <div className="flex justify-between items-baseline">
                 <span className="font-bold uppercase text-[8px] text-slate-500">FECHA REPORTE:</span>
                 <span className="font-bold text-[10px] text-right">{new Date().toLocaleDateString('es-VE')}</span>
              </div>
           </div>

           <div className="mb-4">
              <div className="flex justify-between font-black text-[8px] uppercase border-b-2 border-black pb-1 mb-2">
                 <span className="w-[20%]">FECHA</span>
                 <span className="w-[30%]">FOLIO</span>
                 <span className="w-[25%] text-right">ORIGINAL</span>
                 <span className="w-[25%] text-right">SALDO</span>
              </div>

              <div className="space-y-2">
                 {invoices.length > 0 ? invoices.map((inv, i) => {
                   const balance = (inv.totalUSD || 0) - (inv.paidAmountUSD || 0);
                   return (
                     <div key={i} className="flex justify-between text-[10px] items-center border-b border-dotted border-slate-300 pb-1">
                        <span className="w-[20%] font-bold">{new Date(inv.date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })}</span>
                        <span className="w-[30%] font-black">#{inv.id.slice(-6).toUpperCase()}</span>
                        <span className="w-[25%] text-right text-slate-500">${inv.totalUSD.toFixed(2)}</span>
                        <span className="w-[25%] text-right font-black text-rose-600">${balance.toFixed(2)}</span>
                     </div>
                   );
                 }) : (
                   <div className="text-center py-4 text-slate-400 font-bold uppercase text-[9px]">Sin facturas pendientes</div>
                 )}
              </div>
           </div>

           <div className="border-t-2 border-black pt-4 space-y-2 mb-6">
              <div className="flex justify-between text-[14px] font-black">
                 <span className="uppercase">TOTAL DEUDA</span>
                 <span className="text-right">US${totalPending.toFixed(2).replace('.', ',')}</span>
              </div>
              
              {/* {settings.exchangeRate > 0 && (
                <div className="text-right text-[12px] font-black text-slate-600">
                  {calculateBS(totalPending, 'pending', undefined, settings.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </div>
              )} */}

              {creditBalance > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-emerald-600 border-t border-dotted border-slate-300 pt-2">
                   <span className="uppercase">SALDO A FAVOR</span>
                   <span className="text-right">- US${creditBalance.toFixed(2).replace('.', ',')}</span>
                </div>
              )}

              <div className="flex justify-between text-[16px] font-black border-t-2 border-double border-black pt-2 mt-2 bg-slate-50 p-2">
                 <span className="uppercase">NETO A PAGAR</span>
                 <span className="text-right">US${Math.max(0, totalPending - creditBalance).toFixed(2).replace('.', ',')}</span>
              </div>
           </div>

           <div className="border-t border-black pt-5 mb-5">
              <div className="border border-dotted border-black p-3 text-center bg-slate-50">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 leading-none">Datos para Pago Móvil</p>
                 <div className="space-y-1">
                    <p className="uppercase font-black text-[12px] leading-none">{company.bank || 'BANCO DE VENEZUELA'}</p>
                    <p className="font-black text-[14px] leading-none">{company.mobilePhone || 'N/A'}</p>
                    <p className="font-black text-[12px] leading-none">V-{(company.dni || '').replace(/\D/g, '')}</p>
                    {company.accountNumber && (
                      <div className="pt-2 border-t border-dotted border-slate-400 mt-2">
                        <p className="text-[8px] font-black uppercase tracking-wider text-slate-600 mb-0.5">Cuenta Bancaria:</p>
                        <p className="font-black text-[11px] leading-tight font-mono tracking-wider break-all">{company.accountNumber}</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="text-center font-black text-[10px] uppercase py-4 border-t border-black text-slate-400">
              *** FIN DEL REPORTE ***
           </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3 print:hidden">
           <button 
             onClick={handleDownloadImage} 
             disabled={isGenerating}
             className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
           >
              {isGenerating ? 'Generando...' : <><Share2 size={20} /> Guardar o Compartir Imagen</>}
           </button>
           
           <div className="flex gap-3">
              <button onClick={handlePrint} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Printer size={16} /> Imprimir</button>
              <button onClick={onClose} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest">Cerrar</button>
           </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            padding: 5mm;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
};
