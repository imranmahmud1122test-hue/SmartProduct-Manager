import React, { useState, useEffect } from 'react';
import {
  FileText,
  DollarSign,
  TrendingUp,
  Package,
  Calendar,
  Download,
  Printer,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle2,
  PieChart,
  ShoppingBag,
  Trash2
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, Sale, InventoryMovement, Business } from '../../types';
import { formatCurrency, formatDate, formatShortDate } from '../../utils/codeGenerators';
import { printFinancialReport, printProductCatalog, printThermalReceipt } from '../../utils/printHelper';

interface ReportsViewProps {
  businessId: string;
  business: Business | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ businessId, business }) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'profit' | 'movements'>('sales');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month'>('this_month');
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const reloadData = () => {
    const sls = db.getSales(businessId);
    setSales(sls);
    const prods = db.getProducts(businessId);
    setProducts(prods);
    const movs = db.getMovements(businessId);
    setMovements(movs);
  };

  useEffect(() => {
    reloadData();
    window.addEventListener('spm_storage_update', reloadData);
    return () => window.removeEventListener('spm_storage_update', reloadData);
  }, [businessId]);

  const handleDeleteMovement = (movId: string, productName: string) => {
    if (window.confirm(`Are you sure you want to delete this stock movement record for "${productName}"?`)) {
      db.deleteMovement(movId);
      reloadData();
    }
  };

  const currency = business?.currencySymbol || '৳';

  // Filter sales by date range
  const filteredSales = sales.filter((s) => {
    if (dateRange === 'all') return true;
    const saleDate = new Date(s.createdAt);
    const now = new Date();

    if (dateRange === 'today') {
      return saleDate.toDateString() === now.toDateString();
    }
    if (dateRange === 'this_week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return saleDate >= weekAgo;
    }
    if (dateRange === 'this_month') {
      return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  // Sales financial aggregations
  const totalGrossSales = filteredSales.reduce((acc, s) => acc + s.subtotal, 0);
  const totalDiscounts = filteredSales.reduce((acc, s) => acc + s.discount, 0);
  const totalTax = filteredSales.reduce((acc, s) => acc + s.tax, 0);
  const totalNetRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalOrders = filteredSales.length;

  // Inventory valuation
  const inventoryCostValue = products.reduce((acc, p) => acc + p.purchasePrice * (p.currentStock > 0 ? p.currentStock : 0), 0);
  const inventoryRetailValue = products.reduce((acc, p) => acc + p.sellingPrice * (p.currentStock > 0 ? p.currentStock : 0), 0);
  const unrealizedGrossMargin = inventoryRetailValue - inventoryCostValue;

  // Product estimated COGS and profit from completed sales
  let totalCOGS = 0;
  filteredSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const unitCost = prod ? prod.purchasePrice : 0;
      totalCOGS += unitCost * item.quantity;
    });
  });

  const estimatedGrossProfit = totalGrossSales - totalDiscounts - totalCOGS;
  const profitMarginPercent = totalNetRevenue > 0 ? Math.round((estimatedGrossProfit / totalNetRevenue) * 100) : 0;

  const exportSalesCSV = () => {
    const headers = ['Invoice #', 'Date', 'Customer', 'Items Count', 'Subtotal', 'Discount', 'Tax', 'Total Amount', 'Payment Method', 'Cashier'];
    const rows = filteredSales.map((s) => [
      s.invoiceNumber,
      `"${formatDate(s.createdAt)}"`,
      `"${(s.customerName || 'Walk-in').replace(/"/g, '""')}"`,
      s.items.reduce((a, c) => a + c.quantity, 0),
      s.subtotal,
      s.discount,
      s.tax,
      s.totalAmount,
      s.paymentMethod,
      `"${s.cashierName}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${business?.slug || 'store'}_sales_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="reports-view-content" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Business Reports & Audits</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit sales, stock valuations, profit margins, and chronological inventory movements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="today">Period: Today</option>
            <option value="this_week">Period: Past 7 Days</option>
            <option value="this_month">Period: This Month</option>
            <option value="all">Period: All Time</option>
          </select>

          <button
            onClick={exportSalesCSV}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>
          <button
            onClick={() => {
              if (activeTab === 'inventory') {
                printProductCatalog(products, business);
              } else {
                printFinancialReport(business, filteredSales, {
                  grossSales: totalGrossSales,
                  totalOrders: totalOrders,
                  totalTax: totalTax,
                  totalDiscount: totalDiscounts,
                  netSales: totalNetRevenue,
                  avgOrderValue: totalOrders > 0 ? Math.round(totalNetRevenue / totalOrders) : 0
                });
              }
            }}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer no-print"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'sales'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Sales & Orders
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Stock Valuation
        </button>

        <button
          onClick={() => setActiveTab('profit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'profit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Profit & Margins
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'movements'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Movements ({movements.length})
        </button>
      </div>

      {/* TAB 1: Sales & Orders Report */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Net Revenue</span>
              <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                {formatCurrency(totalNetRevenue, currency)}
              </span>
              <span className="text-[11px] text-slate-400">{totalOrders} completed orders</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Gross Sales</span>
              <span className="text-2xl font-black text-slate-800 mt-0.5 block">
                {formatCurrency(totalGrossSales, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Before discounts & tax</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Total Discounts</span>
              <span className="text-2xl font-black text-rose-600 mt-0.5 block">
                -{formatCurrency(totalDiscounts, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Customer savings applied</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Tax Collected</span>
              <span className="text-2xl font-black text-slate-900 mt-0.5 block">
                {formatCurrency(totalTax, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Government sales tax</span>
            </div>
          </div>

          {/* Sales List Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-center">Items Sold</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Tax</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Payment</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        No sales found for this date range.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.invoiceNumber}</td>
                        <td className="py-3 px-4 text-slate-500">{formatDate(s.createdAt)}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{s.customerName || 'Walk-in'}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {s.items.reduce((a, c) => a + c.quantity, 0)} pcs
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(s.subtotal, currency)}</td>
                        <td className="py-3 px-4 text-right text-slate-500">{formatCurrency(s.tax, currency)}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                          {formatCurrency(s.totalAmount, currency)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold uppercase">
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{s.cashierName}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => printThermalReceipt(s, business, s.cashierName)}
                            title="Print Thermal Receipt"
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Printer className="w-3 h-3 text-emerald-600" />
                            Print
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Stock Valuation */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Total Cost Value (At Buy Price)</span>
              <span className="text-2xl font-black text-slate-800 mt-0.5 block">
                {formatCurrency(inventoryCostValue, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Capital invested in available stock</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Total Retail Value (At Selling Price)</span>
              <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                {formatCurrency(inventoryRetailValue, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Expected revenue upon sell-out</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Unrealized Potential Margin</span>
              <span className="text-2xl font-black text-cyan-700 mt-0.5 block">
                {formatCurrency(unrealizedGrossMargin, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Retail Value minus Cost Value</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Product-by-Product Stock Valuation Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase">
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Cost / Unit</th>
                    <th className="py-2.5 px-3 text-right">Retail / Unit</th>
                    <th className="py-2.5 px-3 text-right">Total Cost Value</th>
                    <th className="py-2.5 px-3 text-right">Total Retail Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const cVal = p.purchasePrice * (p.currentStock > 0 ? p.currentStock : 0);
                    const rVal = p.sellingPrice * (p.currentStock > 0 ? p.currentStock : 0);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{p.category}</td>
                        <td className="py-2.5 px-3 text-center font-bold">{p.currentStock} {p.unit}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(p.purchasePrice, currency)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">{formatCurrency(p.sellingPrice, currency)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">{formatCurrency(cVal, currency)}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-emerald-800">{formatCurrency(rVal, currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Profit & Margin Analysis */}
      {activeTab === 'profit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Cost of Goods Sold (COGS)</span>
              <span className="text-2xl font-black text-rose-700 mt-0.5 block">
                {formatCurrency(totalCOGS, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Total purchase cost of sold items</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Estimated Gross Profit</span>
              <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                {formatCurrency(estimatedGrossProfit, currency)}
              </span>
              <span className="text-[11px] text-slate-400">Gross Sales - COGS - Discounts</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block font-medium">Gross Margin Ratio</span>
              <span className="text-2xl font-black text-slate-900 mt-0.5 block">
                {profitMarginPercent}%
              </span>
              <span className="text-[11px] text-slate-400">Gross Profit as % of revenue</span>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800">
            <h3 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider mb-2">
              Accounting Ledger Integrity Guarantee
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every sale transaction directly links to unit cost recorded at time of stock receiving. Inward shipments maintain audit records ensuring strict inventory ledger reconciliations with no synthetic pricing.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: All Chronological Movements */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Master Inventory Movements Ledger</h3>
            <span className="text-xs text-slate-500">{movements.length} total transactional events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4 text-center">Previous</th>
                  <th className="py-3 px-4 text-center">Delta</th>
                  <th className="py-3 px-4 text-center">New Balance</th>
                  <th className="py-3 px-4">Reference / Order #</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.productName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          m.type === 'RECEIVING'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.type === 'SALE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{m.previousStock}</td>
                    <td className="py-3 px-4 text-center font-bold">
                      <span className={m.type === 'SALE' || m.type === 'ADJUSTMENT_SUB' ? 'text-rose-600' : 'text-emerald-700'}>
                        {m.type === 'SALE' || m.type === 'ADJUSTMENT_SUB' ? `-${m.quantity}` : `+${m.quantity}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold text-slate-900">{m.newStock}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{m.referenceId || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-600">{m.performedBy}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteMovement(m.id, m.productName)}
                        title="Delete Stock Movement Record"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
