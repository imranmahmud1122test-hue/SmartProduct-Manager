import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Layers,
  CheckCircle2,
  X,
  AlertCircle,
  Plus,
  Minus
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, User } from '../../types';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedProduct?: Product | null;
  businessId: string;
  currentUser: User;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedProduct,
  businessId,
  currentUser,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'SUB'>('SUB');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('Damaged / Spoilage write-off');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const prods = db.getProducts(businessId);
      setProducts(prods);
      if (preselectedProduct) {
        setSelectedProductId(preselectedProduct.id);
      } else if (prods.length > 0) {
        setSelectedProductId(prods[0].id);
      }
      setQuantity(1);
      setAdjustmentType('SUB');
      setReason('Damaged / Spoilage write-off');
      setError(null);
    }
  }, [isOpen, preselectedProduct, businessId]);

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const previousStock = currentProduct ? currentProduct.currentStock : 0;
  const delta = adjustmentType === 'ADD' ? Math.abs(quantity) : -Math.abs(quantity);
  const computedStock = previousStock + delta;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId) {
      setError('Please select a product.');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }

    if (computedStock < 0) {
      setError(`Cannot reduce below 0. Current stock is ${previousStock}.`);
      return;
    }

    try {
      db.adjustStock(
        businessId,
        {
          productId: selectedProductId,
          deltaQuantity: delta,
          reason: reason.trim(),
        },
        currentUser
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Manual Stock Adjustment</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Log inventory reconciliation, loss, damage, or audit count
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-800">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku} • Current Stock: {p.currentStock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Adjustment Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('ADD')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  adjustmentType === 'ADD'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                Increase Stock (+)
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('SUB')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  adjustmentType === 'SUB'
                    ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <Minus className="w-4 h-4 text-rose-600" />
                Decrease Stock (-)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Adjustment Quantity ({currentProduct?.unit || 'units'})
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Category</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Damaged / Spoilage write-off">Damaged / Spoilage</option>
                <option value="Physical Inventory Count Audit">Physical Count Audit</option>
                <option value="Expired Batch Removal">Expired Batch Removal</option>
                <option value="Customer Return Restock">Customer Return Restock</option>
                <option value="Internal Store Usage">Internal Store Usage</option>
              </select>
            </div>
          </div>

          {/* Verification Box */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Previous Stock</span>
              <span className="font-bold text-slate-800 text-sm">{previousStock} {currentProduct?.unit}</span>
            </div>
            <div className="text-center font-bold text-base text-slate-400">
              {delta > 0 ? `+${delta}` : delta}
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">New Computed Stock</span>
              <span className={`font-extrabold text-sm ${computedStock < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {computedStock} {currentProduct?.unit}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Apply Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
