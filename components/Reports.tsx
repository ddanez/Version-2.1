
import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  PieChart, 
  TrendingUp, 
  Calendar, 
  CreditCard, 
  ShoppingBag, 
  Package, 
  PackageSearch, 
  PackageX, 
  Layers, 
  Users, 
  Truck, 
  Trash2, 
  Wallet, 
  ClipboardList,
  ArrowLeft,
  Search,
  ChevronRight,
  X,
  Gift,
  Tag,
  Award,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { Sale, Purchase, AppSettings, Product, Expense, Customer, Supplier, Movement, Promotion, CustomerPromotion } from '../types';
import { dbService } from '../db';
import AIAnalysis from './AIAnalysis';
import { calculateBS } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface Props {
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  settings: AppSettings;
  movements: Movement[];
  promotions?: Promotion[];
  customerPromotions?: CustomerPromotion[];
}

type ReportType = 
  | 'transactions_day' 
  | 'transactions_summary' 
  | 'sales_credit' 
  | 'purchases_credit' 
  | 'product_sales' 
  | 'product_purchases' 
  | 'products_no_sales' 
  | 'category_sales' 
  | 'clients_ranking' 
  | 'suppliers_ranking' 
  | 'product_waste' 
  | 'payment_methods' 
  | 'inventory_adjustments'
  | 'promotions_delivered';

const Reports: React.FC<Props> = ({ sales, purchases, expenses, products, customers, suppliers, settings, movements, promotions, customerPromotions }) => {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all');
  const [promoViewMode, setPromoViewMode] = useState<'by_customer' | 'chronological'>('by_customer');
  const [localPromotions, setLocalPromotions] = useState<Promotion[]>(promotions || []);
  const [localCustomerPromos, setLocalCustomerPromos] = useState<CustomerPromotion[]>(customerPromotions || []);

  useEffect(() => {
    if (promotions && promotions.length > 0) {
      setLocalPromotions(promotions);
    } else {
      dbService.getAll<Promotion>('promotions').then(res => {
        if (res && res.length > 0) setLocalPromotions(res);
      });
    }

    if (customerPromotions && customerPromotions.length > 0) {
      setLocalCustomerPromos(customerPromotions);
    } else {
      dbService.getAll<CustomerPromotion>('customer_promotions').then(res => {
        if (res && res.length > 0) setLocalCustomerPromos(res);
      });
    }
  }, [promotions, customerPromotions]);

  const reportCards = [
    { id: 'transactions_day', title: 'Transacciones Por Día', icon: <Calendar size={24} />, color: 'bg-emerald-500' },
    { id: 'transactions_summary', title: 'Resumen Transacciones', icon: <BarChart3 size={24} />, color: 'bg-emerald-600' },
    { id: 'promotions_delivered', title: 'Promociones Entregadas', icon: <Gift size={24} />, color: 'bg-orange-500' },
    { id: 'sales_credit', title: 'Ventas Crédito', icon: <CreditCard size={24} />, color: 'bg-amber-500' },
    { id: 'purchases_credit', title: 'Compras Crédito', icon: <ShoppingBag size={24} />, color: 'bg-amber-600' },
    { id: 'product_sales', title: 'Producto Ventas', icon: <Package size={24} />, color: 'bg-indigo-500' },
    { id: 'product_purchases', title: 'Producto Compras', icon: <PackageSearch size={24} />, color: 'bg-indigo-600' },
    { id: 'products_no_sales', title: 'Productos Sin Ventas', icon: <PackageX size={24} />, color: 'bg-rose-500' },
    { id: 'category_sales', title: 'Categoría Ventas', icon: <Layers size={24} />, color: 'bg-rose-600' },
    { id: 'clients_ranking', title: 'Ranking Clientes', icon: <Users size={24} />, color: 'bg-cyan-500' },
    { id: 'suppliers_ranking', title: 'Ranking Proveedores', icon: <Truck size={24} />, color: 'bg-cyan-600' },
    { id: 'product_waste', title: 'Merma Productos', icon: <Trash2 size={24} />, color: 'bg-yellow-600' },
    { id: 'payment_methods', title: 'Forma Pago', icon: <Wallet size={24} />, color: 'bg-teal-600' },
  ];
  const chartData = [
    { name: 'Ventas', total: sales.reduce((sum, s) => sum + s.totalUSD, 0) },
    { name: 'Compras', total: purchases.reduce((sum, p) => sum + p.totalUSD, 0) },
    { name: 'Gastos', total: expenses.reduce((sum, e) => sum + e.amountUSD, 0) },
  ];

  const exportToCSV = () => {
    const headers = ['ID', 'Fecha', 'Cliente', 'Total USD', 'Total BS', 'Estado'];
    const rows = sales.map(s => [
      s.id,
      s.date,
      s.customerName,
      s.totalUSD.toFixed(2),
      calculateBS(s.totalUSD, s.status, s.exchangeRate, settings.exchangeRate).toFixed(2),
      s.status === 'paid' ? 'Pagado' : 'Pendiente'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSales = sales.reduce((sum, s) => sum + s.totalUSD, 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + p.totalUSD, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountUSD, 0);
  const estimatedProfit = totalSales - totalPurchases - totalExpenses;

  const totalSalesBS = sales.reduce((sum, s) => sum + calculateBS(s.totalUSD, s.status, s.exchangeRate, settings.exchangeRate), 0);
  const totalPurchasesBS = purchases.reduce((sum, p) => sum + calculateBS(p.totalUSD, p.status, p.exchangeRate, settings.exchangeRate), 0);
  const totalExpensesBS = expenses.reduce((sum, e) => sum + e.amountBS, 0);
  const estimatedProfitBS = totalSalesBS - totalPurchasesBS - totalExpensesBS;

  const renderReportDetail = () => {
    if (!selectedReport) return null;

    let title = "";
    let content = null;

    switch (selectedReport) {
      case 'transactions_day':
        title = "Transacciones Por Día";
        const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          return {
            date: dateStr,
            total: sales.filter(s => s.date.startsWith(dateStr)).reduce((sum, s) => sum + s.totalUSD, 0)
          };
        }).reverse();

        content = (
          <div className="space-y-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `$${val}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
        break;

      case 'transactions_summary':
        title = "Resumen de Transacciones";
        const filteredSales = sales.filter(s => s.date.split('T')[0] >= startDate && s.date.split('T')[0] <= endDate);
        const filteredPurchases = purchases.filter(p => p.date.split('T')[0] >= startDate && p.date.split('T')[0] <= endDate);
        const filteredExpenses = expenses.filter(e => e.date.split('T')[0] >= startDate && e.date.split('T')[0] <= endDate);

        const currentTotalSales = filteredSales.reduce((sum, s) => sum + s.totalUSD, 0);
        const currentTotalPurchases = filteredPurchases.reduce((sum, p) => sum + p.totalUSD, 0);
        const currentTotalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amountUSD, 0);
        const currentEstimatedProfit = currentTotalSales - currentTotalPurchases - currentTotalExpenses;

        const currentTotalSalesBS = filteredSales.reduce((sum, s) => sum + calculateBS(s.totalUSD, s.status, s.exchangeRate, settings.exchangeRate), 0);
        const currentTotalPurchasesBS = filteredPurchases.reduce((sum, p) => sum + calculateBS(p.totalUSD, p.status, p.exchangeRate, settings.exchangeRate), 0);
        const currentTotalExpensesBS = filteredExpenses.reduce((sum, e) => sum + e.amountBS, 0);
        const currentEstimatedProfitBS = currentTotalSalesBS - currentTotalPurchasesBS - currentTotalExpensesBS;

        content = (
          <div className="space-y-6">
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Desde</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500" 
                />
              </div>
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Hasta</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ventas</p>
                <p className="text-2xl font-black text-emerald-400">${currentTotalSales.toFixed(2)}</p>
                <p className="text-sm text-slate-400">Bs. {currentTotalSalesBS.toFixed(2)}</p>
              </div>
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Compras</p>
                <p className="text-2xl font-black text-rose-400">${currentTotalPurchases.toFixed(2)}</p>
                <p className="text-sm text-slate-400">Bs. {currentTotalPurchasesBS.toFixed(2)}</p>
              </div>
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Gastos</p>
                <p className="text-2xl font-black text-rose-400">${currentTotalExpenses.toFixed(2)}</p>
                <p className="text-sm text-slate-400">Bs. {currentTotalExpensesBS.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Utilidad Estimada</p>
              <p className={`text-3xl font-black ${currentEstimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                ${currentEstimatedProfit.toFixed(2)}
              </p>
              <p className={`text-lg font-bold ${currentEstimatedProfitBS >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                Bs. {currentEstimatedProfitBS.toFixed(2)}
              </p>
            </div>
          </div>
        );
        break;

      case 'category_sales':
        title = "Ventas por Categoría";
        const categoryData = products.reduce((acc: any[], p) => {
          const catSales = sales.reduce((sum, s) => 
            sum + s.items.filter(i => i.productId === p.id).reduce((isum, item) => isum + (item.quantity * item.priceUSD), 0), 0
          );
          const existing = acc.find(a => a.name === p.category);
          if (existing) {
            existing.value += catSales;
          } else {
            acc.push({ name: p.category, value: catSales });
          }
          return acc;
        }, []).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

        content = (
          <div className="space-y-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
        break;

      case 'product_waste':
        title = "Merma de Productos";
        const filteredMovements = movements.filter(m => 
          m.type === 'merma' && 
          m.date.split('T')[0] >= startDate && 
          m.date.split('T')[0] <= endDate
        );

        const wasteByProduct = filteredMovements.reduce((acc: { [key: string]: number }, m) => {
          acc[m.productId] = (acc[m.productId] || 0) + Math.abs(m.quantity);
          return acc;
        }, {});

        const wasteProducts = products
          .filter(p => wasteByProduct[p.id] > 0)
          .map(p => ({
            ...p,
            periodWaste: wasteByProduct[p.id]
          }))
          .sort((a, b) => b.periodWaste - a.periodWaste);

        // Global statistics for the period
        const totalWasteQty = wasteProducts.reduce((sum, p) => sum + p.periodWaste, 0);
        const totalSoldQty = movements
          .filter(m => m.type === 'sale' && m.date.split('T')[0] >= startDate && m.date.split('T')[0] <= endDate)
          .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
        const globalWastePct = (totalWasteQty + totalSoldQty) > 0 
          ? (totalWasteQty / (totalWasteQty + totalSoldQty)) * 100 
          : 0;

        const totalWasteUSDVal = wasteProducts.reduce((sum, p) => sum + (p.periodWaste * p.costUSD), 0);
        const totalWasteBSVal = calculateBS(totalWasteUSDVal, 'pending', undefined, settings.exchangeRate);
        
        content = (
          <div className="space-y-4">
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Desde</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500" 
                />
              </div>
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Hasta</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500" 
                />
              </div>
            </div>

            {/* Premium Period Summary Cards */}
            {wasteProducts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#1e293b]/50 p-4 rounded-2xl border border-slate-800">
                  <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">Costo Total de Merma</p>
                  <p className="text-lg font-black text-white leading-none">${totalWasteUSDVal.toFixed(2)}</p>
                  <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Bs. {totalWasteBSVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-[#1e293b]/50 p-4 rounded-2xl border border-slate-800">
                  <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Unidades Mermadas</p>
                  <p className="text-lg font-black text-white leading-none">{totalWasteQty % 1 === 0 ? totalWasteQty : totalWasteQty.toFixed(1)} uni.</p>
                  <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">En el período seleccionado</p>
                </div>
                <div className="bg-[#1e293b]/50 p-4 rounded-2xl border border-slate-800">
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">% de Merma Global</p>
                  <p className="text-lg font-black text-emerald-400 leading-none">{globalWastePct.toFixed(1)}%</p>
                  <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">De salidas totales del período</p>
                </div>
              </div>
            )}

            <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e293b] text-slate-400 font-black uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="p-4">Producto</th>
                    <th className="p-4 text-right">Cant. Merma</th>
                    <th className="p-4 text-right" title="Porcentaje de unidades mermadas sobre la salida total (Ventas + Merma) de este producto en el período">% Merma / Salidas</th>
                    <th className="p-4 text-right">Valor Est. (USD)</th>
                    <th className="p-4 text-right">Valor Est. (BS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {wasteProducts.map((p, i) => {
                    const valorUSD = p.periodWaste * p.costUSD;
                    const valorBS = calculateBS(valorUSD, 'pending', undefined, settings.exchangeRate);
                    
                    const soldQty = movements
                      .filter(m => m.productId === p.id && m.type === 'sale' && m.date.split('T')[0] >= startDate && m.date.split('T')[0] <= endDate)
                      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
                    
                    const totalOutflow = p.periodWaste + soldQty;
                    const percentage = totalOutflow > 0 ? (p.periodWaste / totalOutflow) * 100 : 0;

                    return (
                      <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-bold">
                          <div>
                            <p>{p.name}</p>
                            <p className="text-[7.5px] text-slate-500 font-bold uppercase mt-0.5">Vendido: {soldQty % 1 === 0 ? soldQty : soldQty.toFixed(1)} uni. en período</p>
                          </div>
                        </td>
                        <td className="p-4 text-right font-black text-rose-400">{p.periodWaste % 1 === 0 ? p.periodWaste : p.periodWaste.toFixed(2)}</td>
                        <td className="p-4 text-right font-black">
                          <span className={`text-[11px] ${percentage > 15 ? 'text-rose-500' : percentage > 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {percentage.toFixed(1)}%
                          </span>
                          <span className="block text-[7.5px] text-slate-500 font-medium uppercase tracking-tighter">de {totalOutflow % 1 === 0 ? totalOutflow : totalOutflow.toFixed(1)} salidas</span>
                        </td>
                        <td className="p-4 text-right font-black text-slate-400">${valorUSD.toFixed(2)}</td>
                        <td className="p-4 text-right font-black text-emerald-400">Bs. {valorBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                  {wasteProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 font-bold uppercase italic">No hay merma registrada en este periodo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
        break;

      case 'payment_methods':
        title = "Ventas por Forma de Pago";
        // Asumiendo que las ventas pagadas son 'Efectivo' por defecto si no hay campo
        const paymentData = [
          { name: 'Contado', value: sales.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.totalUSD, 0) },
          { name: 'Crédito', value: sales.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.totalUSD, 0) },
        ].sort((a, b) => b.value - a.value);

        content = (
          <div className="space-y-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `$${val}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
        break;

      case 'product_sales':
        title = "Top Productos Vendidos";
        const topProducts = products
          .map(p => ({
            name: p.name,
            total: sales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((isum, item) => isum + item.quantity, 0), 0)
          }))
          .filter(p => p.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);
        
        content = (
          <div className="space-y-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e293b] text-slate-400 font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-4">Producto</th>
                    <th className="p-4 text-right">Cantidad Vendida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {topProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-bold">{p.name}</td>
                      <td className="p-4 text-right font-black text-emerald-400">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        break;

      case 'sales_credit':
        title = "Ventas a Crédito (CXC)";
        const creditSales = sales.filter(s => s.status === 'pending');
        content = (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pendiente (USD)</p>
                <p className="text-2xl font-black text-amber-400">${creditSales.reduce((sum, s) => sum + s.totalUSD, 0).toFixed(2)}</p>
              </div>
              <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pendiente (BS)</p>
                <p className="text-2xl font-black text-emerald-400">Bs. {creditSales.reduce((sum, s) => sum + calculateBS(s.totalUSD, s.status, s.exchangeRate, settings.exchangeRate), 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e293b] text-slate-400 font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4 text-right">Monto USD</th>
                    <th className="p-4 text-right">Monto BS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {creditSales.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-bold">{s.customerName}</td>
                      <td className="p-4 text-slate-400">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="p-4 text-right font-black text-amber-400">${s.totalUSD.toFixed(2)}</td>
                      <td className="p-4 text-right font-black text-emerald-400">Bs. {calculateBS(s.totalUSD, s.status, s.exchangeRate, settings.exchangeRate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        break;

      case 'purchases_credit':
        title = "Compras a Crédito (CXP)";
        const creditPurchases = purchases.filter(p => p.status === 'pending');
        content = (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total por Pagar (USD)</p>
                <p className="text-2xl font-black text-rose-400">${creditPurchases.reduce((sum, p) => sum + p.totalUSD, 0).toFixed(2)}</p>
              </div>
              <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total por Pagar (BS)</p>
                <p className="text-2xl font-black text-emerald-400">Bs. {creditPurchases.reduce((sum, p) => sum + calculateBS(p.totalUSD, p.status, p.exchangeRate, settings.exchangeRate), 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e293b] text-slate-400 font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-4">Proveedor</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4 text-right">Monto USD</th>
                    <th className="p-4 text-right">Monto BS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {creditPurchases.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-bold">{p.supplierName}</td>
                      <td className="p-4 text-slate-400">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="p-4 text-right font-black text-rose-400">${p.totalUSD.toFixed(2)}</td>
                      <td className="p-4 text-right font-black text-emerald-400">Bs. {calculateBS(p.totalUSD, p.status, p.exchangeRate, settings.exchangeRate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        break;

      case 'clients_ranking':
        title = "Ranking de Clientes";
        const clientRanking = customers
          .map(c => {
            const clientSales = sales.filter(s => s.customerId === c.id);
            const totalUSD = clientSales.reduce((sum, s) => sum + s.totalUSD, 0);
            const totalBS = clientSales.reduce((sum, s) => sum + calculateBS(s.totalUSD, s.status, s.exchangeRate, settings.exchangeRate), 0);
            return {
              name: c.name,
              totalUSD,
              totalBS
            };
          })
          .filter(c => c.totalUSD > 0)
          .sort((a, b) => b.totalUSD - a.totalUSD);
        
        content = (
          <div className="space-y-4">
            <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e293b] text-slate-400 font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-4">Cliente</th>
                    <th className="p-4 text-right">Total (USD)</th>
                    <th className="p-4 text-right">Total (BS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {clientRanking.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-bold">{c.name}</td>
                      <td className="p-4 text-right font-black text-emerald-400">${c.totalUSD.toFixed(2)}</td>
                      <td className="p-4 text-right font-black text-emerald-500/70">Bs. {c.totalBS.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        break;

      case 'promotions_delivered': {
        title = "Promociones y Premios Entregados";

        // Consolidate delivered promotions list
        const list: {
          id: string;
          date: string;
          customerId: string;
          customerName: string;
          customerPhone?: string;
          promotionId: string;
          promotionName: string;
          productName: string;
          quantity: number;
          source: string;
        }[] = [];

        // Helper maps
        const customerMap = new Map<string, Customer>();
        customers.forEach(c => customerMap.set(c.id, c));

        const promoMap = new Map<string, Promotion>();
        localPromotions.forEach(p => promoMap.set(p.id, p));

        // 1. Check movements of type 'obsequio'
        movements.filter(m => m.type === 'obsequio').forEach(m => {
          let custId = m.customerId || '';
          let custName = m.customerName || '';
          let custPhone = '';

          if (!custId && m.relatedId) {
            const relSale = sales.find(s => s.id === m.relatedId);
            if (relSale) {
              custId = relSale.customerId;
              custName = relSale.customerName;
            } else {
              const relCp = localCustomerPromos.find(cp => cp.promotionId === m.relatedId && cp.totalRedeemed > 0);
              if (relCp) {
                custId = relCp.customerId;
              }
            }
          }

          const cust = custId ? customerMap.get(custId) : undefined;
          if (cust) {
            custName = cust.name;
            custPhone = cust.phone;
          } else if (!custName) {
            custName = 'Cliente / Canje';
          }

          const promo = (m.promotionId ? promoMap.get(m.promotionId) : undefined) || 
                        (m.relatedId ? promoMap.get(m.relatedId) : undefined);

          const promoName = m.promotionName || promo?.name || 'Promoción de Fidelidad';
          const prizeName = m.productName || promo?.name || 'Premio de Promoción';

          list.push({
            id: m.id,
            date: m.date,
            customerId: custId || `cust-${custName}`,
            customerName: custName,
            customerPhone: custPhone,
            promotionId: promo?.id || m.promotionId || m.relatedId || 'promo',
            promotionName: promoName,
            productName: prizeName,
            quantity: Math.abs(m.quantity) || 1,
            source: 'Canje de Promoción'
          });
        });

        // 2. Check sales of type 'obsequio'
        const movementRelatedIds = new Set(movements.map(m => m.relatedId).filter(Boolean));
        sales.filter(s => s.type === 'obsequio' && !movementRelatedIds.has(s.id)).forEach(s => {
          const cust = customerMap.get(s.customerId);
          (s.items || []).forEach((item, idx) => {
            list.push({
              id: `${s.id}-${idx}`,
              date: s.date,
              customerId: s.customerId,
              customerName: s.customerName || cust?.name || 'Cliente',
              customerPhone: cust?.phone,
              promotionId: 'obsequio_venta',
              promotionName: 'Obsequio / Cortesía',
              productName: item.name,
              quantity: item.quantity,
              source: 'Venta / Obsequio'
            });
          });
        });

        // 3. Customer promotions with totalRedeemed > 0 (fallback for past data)
        localCustomerPromos.filter(cp => cp.totalRedeemed > 0).forEach(cp => {
          const existingCount = list.filter(item => 
            (item.customerId === cp.customerId) && 
            (item.promotionId === cp.promotionId)
          ).length;

          const missingCount = cp.totalRedeemed - existingCount;
          if (missingCount > 0) {
            const cust = customerMap.get(cp.customerId);
            const promo = promoMap.get(cp.promotionId);
            for (let i = 0; i < missingCount; i++) {
              list.push({
                id: `cp-redeemed-${cp.id}-${i}`,
                date: cp.lastUpdate || new Date().toISOString(),
                customerId: cp.customerId,
                customerName: cust?.name || 'Cliente',
                customerPhone: cust?.phone,
                promotionId: cp.promotionId,
                promotionName: promo?.name || 'Promoción de Fidelidad',
                productName: promo?.name || 'Premio de Promoción',
                quantity: promo?.rewardQuantity || 1,
                source: 'Canje Registrado'
              });
            }
          }
        });

        // Chronological sort
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Filter by date range
        const inPeriod = list.filter(item => {
          const d = item.date.split('T')[0];
          return d >= startDate && d <= endDate;
        });

        // Filter by customer
        const customerFiltered = selectedCustomerFilter === 'all' 
          ? inPeriod 
          : inPeriod.filter(item => item.customerId === selectedCustomerFilter);

        // Filter by search term
        const term = searchTerm.toLowerCase().trim();
        const finalDeliveries = term === '' 
          ? customerFiltered 
          : customerFiltered.filter(item => 
              item.customerName.toLowerCase().includes(term) ||
              (item.customerPhone && item.customerPhone.includes(term)) ||
              item.promotionName.toLowerCase().includes(term) ||
              item.productName.toLowerCase().includes(term)
            );

        // Metrics
        const totalDeliveriesCount = finalDeliveries.length;
        const totalUnitsDelivered = finalDeliveries.reduce((sum, d) => sum + d.quantity, 0);
        const distinctCustomersCount = new Set(finalDeliveries.map(d => d.customerId)).size;

        const promoCountMap: { [name: string]: number } = {};
        finalDeliveries.forEach(d => {
          promoCountMap[d.promotionName] = (promoCountMap[d.promotionName] || 0) + 1;
        });
        const topPromoEntry = Object.entries(promoCountMap).sort((a, b) => b[1] - a[1])[0];
        const topPromoName = topPromoEntry ? `${topPromoEntry[0]} (${topPromoEntry[1]})` : 'Sin datos';

        // Group by customer
        const groupedByCustomer: {
          customerId: string;
          customerName: string;
          customerPhone?: string;
          totalDeliveries: number;
          totalUnits: number;
          deliveries: typeof finalDeliveries;
        }[] = [];

        const customerGroups: { [id: string]: typeof groupedByCustomer[0] } = {};
        finalDeliveries.forEach(item => {
          if (!customerGroups[item.customerId]) {
            customerGroups[item.customerId] = {
              customerId: item.customerId,
              customerName: item.customerName,
              customerPhone: item.customerPhone,
              totalDeliveries: 0,
              totalUnits: 0,
              deliveries: []
            };
            groupedByCustomer.push(customerGroups[item.customerId]);
          }
          customerGroups[item.customerId].totalDeliveries += 1;
          customerGroups[item.customerId].totalUnits += item.quantity;
          customerGroups[item.customerId].deliveries.push(item);
        });

        groupedByCustomer.sort((a, b) => b.totalDeliveries - a.totalDeliveries);

        // All distinct customers in history for the filter selector
        const customersWithDeliveries = Array.from(new Set(list.map(l => l.customerId)))
          .map(id => {
            const match = list.find(l => l.customerId === id);
            return { id, name: match?.customerName || 'Cliente' };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        const handlePresetPeriod = (preset: 'today' | '7days' | 'this_month' | 'last_month' | 'all') => {
          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];

          if (preset === 'today') {
            setStartDate(todayStr);
            setEndDate(todayStr);
          } else if (preset === '7days') {
            const past7 = new Date();
            past7.setDate(now.getDate() - 7);
            setStartDate(past7.toISOString().split('T')[0]);
            setEndDate(todayStr);
          } else if (preset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            setStartDate(firstDay);
            setEndDate(todayStr);
          } else if (preset === 'last_month') {
            const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
            const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
            setStartDate(firstDayPrev);
            setEndDate(lastDayPrev);
          } else if (preset === 'all') {
            setStartDate('2020-01-01');
            setEndDate(todayStr);
          }
        };

        const exportCSV = () => {
          const headers = ['ID', 'Fecha', 'Hora', 'Cliente', 'Telefono', 'Promocion', 'Premio_Entregado', 'Cantidad', 'Origen'];
          const rows = finalDeliveries.map(r => {
            const d = new Date(r.date);
            const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString() : r.date;
            const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return [
              `"${r.id}"`,
              `"${dateStr}"`,
              `"${timeStr}"`,
              `"${(r.customerName || '').replace(/"/g, '""')}"`,
              `"${(r.customerPhone || '').replace(/"/g, '""')}"`,
              `"${(r.promotionName || '').replace(/"/g, '""')}"`,
              `"${(r.productName || '').replace(/"/g, '""')}"`,
              r.quantity,
              `"${r.source}"`
            ];
          });

          const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
          ].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `promociones_entregadas_${startDate}_al_${endDate}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        content = (
          <div className="space-y-6">
            {/* Control Bar: Date pickers & presets */}
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 space-y-4">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Desde</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500 transition-all" 
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Hasta</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500 transition-all" 
                  />
                </div>
              </div>

              {/* Quick Period Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Período rápido:</span>
                <button 
                  onClick={() => handlePresetPeriod('today')}
                  className="px-3 py-1.5 rounded-lg bg-[#0f172a] hover:bg-orange-500/20 text-slate-300 hover:text-orange-400 text-[10px] font-bold uppercase transition-all border border-slate-700"
                >
                  Hoy
                </button>
                <button 
                  onClick={() => handlePresetPeriod('7days')}
                  className="px-3 py-1.5 rounded-lg bg-[#0f172a] hover:bg-orange-500/20 text-slate-300 hover:text-orange-400 text-[10px] font-bold uppercase transition-all border border-slate-700"
                >
                  Últimos 7 días
                </button>
                <button 
                  onClick={() => handlePresetPeriod('this_month')}
                  className="px-3 py-1.5 rounded-lg bg-[#0f172a] hover:bg-orange-500/20 text-slate-300 hover:text-orange-400 text-[10px] font-bold uppercase transition-all border border-slate-700"
                >
                  Este Mes
                </button>
                <button 
                  onClick={() => handlePresetPeriod('last_month')}
                  className="px-3 py-1.5 rounded-lg bg-[#0f172a] hover:bg-orange-500/20 text-slate-300 hover:text-orange-400 text-[10px] font-bold uppercase transition-all border border-slate-700"
                >
                  Mes Anterior
                </button>
                <button 
                  onClick={() => handlePresetPeriod('all')}
                  className="px-3 py-1.5 rounded-lg bg-[#0f172a] hover:bg-orange-500/20 text-slate-300 hover:text-orange-400 text-[10px] font-bold uppercase transition-all border border-slate-700"
                >
                  Todo el Historial
                </button>
              </div>

              {/* Customer Selector & Mode Switch */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-700/50">
                <div className="w-full sm:w-72">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-1">
                    <Filter size={12} className="text-orange-500" /> Filtrar por Cliente
                  </label>
                  <select 
                    value={selectedCustomerFilter}
                    onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-orange-500 uppercase transition-all mt-1"
                  >
                    <option value="all">TODOS LOS CLIENTES ({customersWithDeliveries.length})</option>
                    {customersWithDeliveries.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto self-end">
                  <div className="flex bg-[#0f172a] p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
                    <button 
                      onClick={() => setPromoViewMode('by_customer')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        promoViewMode === 'by_customer' 
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Users size={14} /> Por Cliente
                    </button>
                    <button 
                      onClick={() => setPromoViewMode('chronological')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        promoViewMode === 'chronological' 
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ClipboardList size={14} /> Cronológico
                    </button>
                  </div>

                  <button 
                    onClick={exportCSV}
                    disabled={finalDeliveries.length === 0}
                    title="Exportar datos a CSV"
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Entregas</p>
                  <Gift size={16} className="text-orange-500" />
                </div>
                <p className="text-3xl font-black text-orange-400">{totalDeliveriesCount}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">En el período seleccionado</p>
              </div>

              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Clientes Beneficiados</p>
                  <Users size={16} className="text-emerald-500" />
                </div>
                <p className="text-3xl font-black text-emerald-400">{distinctCustomersCount}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Clientes distintos</p>
              </div>

              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unidades Obsequiadas</p>
                  <Package size={16} className="text-indigo-400" />
                </div>
                <p className="text-3xl font-black text-indigo-400">{totalUnitsDelivered}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Total artículos/premios</p>
              </div>

              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaña Principal</p>
                  <Award size={16} className="text-amber-400" />
                </div>
                <p className="text-sm font-black text-amber-300 uppercase truncate" title={topPromoName}>
                  {topPromoName}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Más canjeada</p>
              </div>
            </div>

            {/* Body: By Customer or Chronological */}
            {finalDeliveries.length === 0 ? (
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-12 text-center space-y-3">
                <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto">
                  <Gift size={32} />
                </div>
                <h4 className="text-base font-black uppercase tracking-wider text-white">No hay entregas registradas</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  No se encontraron promociones entregadas en el período del {new Date(startDate + 'T12:00:00').toLocaleDateString()} al {new Date(endDate + 'T12:00:00').toLocaleDateString()}{selectedCustomerFilter !== 'all' ? ' para el cliente seleccionado' : ''}.
                </p>
              </div>
            ) : promoViewMode === 'by_customer' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-widest">
                    {groupedByCustomer.length} Cliente{groupedByCustomer.length === 1 ? '' : 's'} con Promociones Entregadas
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Ordenado por mayor cantidad de premios
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {groupedByCustomer.map(group => (
                    <div key={group.customerId} className="bg-[#1e293b] rounded-2xl border border-slate-700/80 overflow-hidden hover:border-orange-500/50 transition-all shadow-lg">
                      {/* Customer Card Header */}
                      <div className="p-5 bg-[#0f172a]/60 border-b border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-black text-sm">
                            {group.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{group.customerName}</h4>
                            {group.customerPhone && (
                              <p className="text-[10px] font-bold text-slate-400">{group.customerPhone}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase tracking-wider">
                            {group.totalDeliveries} Entrega{group.totalDeliveries === 1 ? '' : 's'}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider">
                            {group.totalUnits} {group.totalUnits === 1 ? 'Unidad' : 'Unidades'}
                          </span>
                        </div>
                      </div>

                      {/* Items Delivered to this Customer */}
                      <div className="p-4 divide-y divide-slate-800">
                        {group.deliveries.map(delivery => {
                          const dateObj = new Date(delivery.date);
                          const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : delivery.date;
                          const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                          return (
                            <div key={delivery.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#0f172a] rounded-lg text-orange-400">
                                  <Gift size={16} />
                                </div>
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-black text-white uppercase">
                                      {delivery.productName}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider">
                                      {delivery.promotionName}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                                    {dateStr} {timeStr && `• ${timeStr}`} • {delivery.source}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right flex items-center sm:block gap-2 pl-9 sm:pl-0">
                                <span className="text-xs font-black text-emerald-400">
                                  {delivery.quantity > 0 ? `+${delivery.quantity}` : delivery.quantity} {delivery.quantity === 1 ? 'unidad' : 'unidades'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Chronological Audit Table */
              <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1e293b] text-slate-400 font-black uppercase tracking-widest text-[10px]">
                      <tr>
                        <th className="p-4">Fecha y Hora</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Promoción / Campaña</th>
                        <th className="p-4">Premio Entregado</th>
                        <th className="p-4 text-center">Cantidad</th>
                        <th className="p-4">Origen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {finalDeliveries.map((delivery) => {
                        const dateObj = new Date(delivery.date);
                        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : delivery.date;
                        const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                        return (
                          <tr key={delivery.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 font-bold text-slate-300 whitespace-nowrap">
                              <div>{dateStr}</div>
                              {timeStr && <div className="text-[10px] text-slate-500 font-normal">{timeStr}</div>}
                            </td>
                            <td className="p-4">
                              <div className="font-black text-white uppercase">{delivery.customerName}</div>
                              {delivery.customerPhone && (
                                <div className="text-[10px] text-slate-500">{delivery.customerPhone}</div>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-bold uppercase whitespace-nowrap">
                                {delivery.promotionName}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-slate-200">
                              <div className="flex items-center gap-2">
                                <Gift size={14} className="text-orange-400 shrink-0" />
                                <span>{delivery.productName}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-black text-[11px]">
                                {delivery.quantity}
                              </span>
                            </td>
                            <td className="p-4 text-slate-400 text-[10px] uppercase font-bold">
                              {delivery.source}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
        break;
      }

      default:
        title = "Reporte en Desarrollo";
        content = (
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
               <BarChart3 className="text-slate-600" size={40} />
            </div>
            <p className="text-slate-400 text-sm">Estamos trabajando en la visualización detallada de este reporte.</p>
          </div>
        );
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedReport(null)} />
        <div className="relative bg-[#0f172a] w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
          <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]/50">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-black uppercase tracking-tighter">{title}</h2>
            </div>
            <button 
              onClick={() => setSelectedReport(null)}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
            >
              <X size={24} />
            </button>
          </header>
          <div className="p-6 overflow-y-auto">
            {content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {renderReportDetail()}
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-slate-400 text-sm">Análisis detallado de tu negocio</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar reporte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#1e293b] border border-slate-700 rounded-2xl py-3 pl-12 pr-6 text-sm focus:outline-none focus:border-orange-500 transition-all w-full md:w-64"
          />
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {reportCards
          .filter(card => card.title.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((card) => (
          <button 
            key={card.id}
            onClick={() => setSelectedReport(card.id as ReportType)}
            className="group relative flex flex-col items-center justify-center p-6 rounded-[2rem] bg-[#1e293b] border border-slate-700 hover:border-orange-500/50 transition-all hover:shadow-2xl hover:shadow-orange-500/10 active:scale-95 overflow-hidden"
          >
            <div className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
              {card.icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-center text-slate-300 group-hover:text-white transition-colors">
              {card.title}
            </span>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={16} className="text-slate-500" />
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        <AIAnalysis 
          sales={sales} 
          purchases={purchases} 
          expenses={expenses} 
          products={products} 
          settings={settings}
          movements={movements}
        />
        
        <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6">
           <h2 className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="text-orange-500" /> Exportar Datos
           </h2>
           <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={exportToCSV}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-700"
              >
                 <Download size={20} /> Ventas (CSV)
              </button>
              <button 
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-700 opacity-50 cursor-not-allowed"
              >
                 <Download size={20} /> Inventario (PDF)
              </button>
           </div>
        </div>

        <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6">
           <h2 className="text-xl font-bold flex items-center gap-2">
              <PieChart className="text-emerald-500" /> Resumen Financiero
           </h2>
           <div className="space-y-4 py-4">
              <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-400">Ventas Brutas:</span>
                 <div className="text-right">
                    <p className="font-bold text-white">${totalSales.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500">Bs. {totalSalesBS.toFixed(2)}</p>
                 </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-400">Inversión (Compras):</span>
                 <div className="text-right">
                    <p className="font-bold text-rose-400">${totalPurchases.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500">Bs. {totalPurchasesBS.toFixed(2)}</p>
                 </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-400">Gastos Operativos:</span>
                 <div className="text-right">
                    <p className="font-bold text-rose-400">${totalExpenses.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500">Bs. {totalExpensesBS.toFixed(2)}</p>
                 </div>
              </div>
              <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                 <span className="font-bold">Utilidad Neta:</span>
                 <div className="text-right">
                    <p className={`text-xl font-black ${estimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                      ${estimatedProfit.toFixed(2)}
                    </p>
                    <p className={`text-xs font-bold ${estimatedProfitBS >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                      Bs. {estimatedProfitBS.toFixed(2)}
                    </p>
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6 md:col-span-2">
           <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="text-indigo-400" /> Comparativa Financiera (USD)
           </h2>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={[
                    { name: 'Ventas', total: totalSales },
                    { name: 'Compras', total: totalPurchases },
                    { name: 'Gastos', total: totalExpenses },
                 ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} barSize={60}>
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                      <Cell fill="#6366f1" />
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
