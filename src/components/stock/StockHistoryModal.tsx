import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Calendar,
  UserCheck,
  Trash2
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, InventoryMovement, Business } from '../../types';
import { formatDate, formatCurrency } from '../../utils/codeGenerators';
import { printStockAuditLog } from '../../utils/printHelper';

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  businessId: string;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
  isOpen,
  onClose,
  product,
  businessId,
}) => {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const business = db.getBusinesses().find((b) => b.id === businessId) || null;

  const loadHistory = () => {
    if (isOpen && product) {
      const hist = db.getMovements(businessId, product.id);
      setMovements(hist);
    }
  };

  useEffect(() => {
    loadHistory();
    window.addEventListener('spm_storage_update', loadHistory);
    return () => window.removeEventListener('spm_storage_update', loadHistory);
  }, [isOpen, product, businessId]);

  const handleDeleteMovement = (movId: string) => {
    if (window.confirm('Are you sure you want to delete this stock movement record?')) {
      db.deleteMovement(movId);
      loadHistory();
    }
  };

  if (!isOpen || !product) return null;

  const filtered = movements.filter((m) => {
    if (filterType === 'ALL') return true;
    return m.type === filterType;
  });

  const getMovementBadge = (type: InventoryMovement['type'], quantity: number) => {
    switch (type) {
      case 'OPENING':
        return (
          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold inline-flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Opening Stock (+{quantity})
          </span>
        );
      case 'RECEIVING':
        return (
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> Stock Received (+{quantity})
          </span>
        );
      case 'SALE':
        return (
          <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" /> POS Sale (-{quantity})
          </span>
        );
      case 'ADJUSTMENT_ADD':
        return (
          <span className="px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold inline-flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Positive Adjustment (+{quantity})
          </span>
        );
      case 'ADJUSTMENT_SUB':
        return (
          <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Negative Adjustment (-{quantity})
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
            {type}
          </span>
        );
    }
  };

  const handlePrint = () => {
    if (!product) return;
    printStockAuditLog(product, movements, business);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 my-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white relative shrink-0 flex items-center justify-between no-print">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 font-semibold">{product.category}</span>
                <span className="text-xs text-slate-400 font-mono">SKU: {product.sku}</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight mt-0.5">
                Complete Stock Movement History: {product.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-400 block font-medium">Opening Stock</span>
              <span className="text-base font-bold text-slate-800">{product.openingStock} {product.unit}</span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-emerald-600 block font-medium">Total Received</span>
              <span className="text-base font-bold text-emerald-700">+{product.totalReceived} {product.unit}</span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-rose-600 block font-medium">Total Sold</span>
              <span className="text-base font-bold text-rose-700">-{product.totalSold} {product.unit}</span>
            </div>
            <div className="p-2.5 bg-emerald-100/70 rounded-xl border border-emerald-300 shadow-2xs">
              <span className="text-emerald-900 block font-bold">Current Stock</span>
              <span className="text-lg font-black text-emerald-800">{product.currentStock} {product.unit}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print">
            {/* Filter pills */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Movements ({movements.length})</option>
              <option value="RECEIVING">Stock Received In</option>
              <option value="SALE">POS Sales</option>
              <option value="OPENING">Opening Stock</option>
              <option value="ADJUSTMENT_ADD">Positive Adjustments</option>
              <option value="ADJUSTMENT_SUB">Negative Adjustments</option>
            </select>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" /> Print / Save PDF Audit Log
            </button>
          </div>
        </div>

        {/* Movements Timeline Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Layers className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No stock movement records for this filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {getMovementBadge(item.type, item.quantity)}
                      <span className="text-xs text-slate-500 font-mono">Ref: {item.referenceId || 'N/A'}</span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium">
                      {item.notes || 'Automated transactional log'}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(item.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Performed by: <strong className="text-slate-700">{item.performedBy}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Stock delta flow: Previous -> Change -> New */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center gap-3">
                      <div className="text-center">
                        <span className="text-[10px] text-slate-400 block font-medium">Previous</span>
                        <span className="font-bold text-slate-700">{item.previousStock}</span>
                      </div>
                      <div className="text-slate-400 font-bold">→</div>
                      <div className="text-center">
                        <span className="text-[10px] text-slate-400 block font-medium">Change</span>
                        <span
                          className={`font-bold ${
                            item.type === 'SALE' || item.type === 'ADJUSTMENT_SUB'
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {item.type === 'SALE' || item.type === 'ADJUSTMENT_SUB' ? `-${item.quantity}` : `+${item.quantity}`}
                        </span>
                      </div>
                      <div className="text-slate-400 font-bold">→</div>
                      <div className="text-center">
                        <span className="text-[10px] text-emerald-800 block font-bold">New Stock</span>
                        <span className="font-extrabold text-emerald-700 text-sm">{item.newStock} {product.unit}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMovement(item.id)}
                      title="Delete Stock Movement Record"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
