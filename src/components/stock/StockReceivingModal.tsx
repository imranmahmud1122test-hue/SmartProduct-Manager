import React, { useState, useEffect } from 'react';
import {
  PackagePlus,
  Truck,
  Layers,
  ArrowRight,
  CheckCircle2,
  X,
  AlertCircle,
  DollarSign,
  FileText
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, User, Supplier } from '../../types';
import { formatCurrency } from '../../utils/codeGenerators';

interface StockReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedProduct?: Product | null;
  businessId: string;
  currentUser: User;
}

export const StockReceivingModal: React.FC<StockReceivingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedProduct,
  businessId,
  currentUser,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [supplierName, setSupplierName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [unitCost, setUnitCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const prods = db.getProducts(businessId).filter((p) => p.status === 'active');
      setProducts(prods);
      const sups = db.getSuppliers(businessId);
      setSuppliers(sups);

      if (preselectedProduct) {
        setSelectedProductId(preselectedProduct.id);
        setSupplierName(preselectedProduct.supplier || sups[0]?.name || '');
        setUnitCost(preselectedProduct.purchasePrice || 0);
      } else if (prods.length > 0) {
        setSelectedProductId(prods[0].id);
        setSupplierName(prods[0].supplier || sups[0]?.name || '');
        setUnitCost(prods[0].purchasePrice || 0);
      }
      setQuantity(10);
      setInvoiceNumber(`PO-${Date.now().toString().slice(-6)}`);
      setNotes('Standard inventory shipment intake');
      setError(null);
    }
  }, [isOpen, preselectedProduct, businessId]);

  if (!isOpen) return null;

  const business = db.getBusinessById(businessId);
  const currency = business?.currencySymbol || '৳';
  const currentProduct = products.find((p) => p.id === selectedProductId);
  const previousStock = currentProduct ? currentProduct.currentStock : 0;
  const loadAmount = Number(quantity) || 0;
  const computedCurrentStock = previousStock + loadAmount;
  const totalCost = loadAmount * (Number(unitCost) || 0);

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    setSelectedProductId(pId);
    const p = products.find((prod) => prod.id === pId);
    if (p) {
      setSupplierName(p.supplier || '');
      setUnitCost(p.purchasePrice || 0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId) {
      setError('Please select a product.');
      return;
    }

    if (loadAmount <= 0) {
      setError('Receiving stock quantity must be greater than 0.');
      return;
    }

    try {
      db.receiveStock(
        businessId,
        {
          productId: selectedProductId,
          quantity: loadAmount,
          supplierName: supplierName.trim(),
          invoiceNumber: invoiceNumber.trim(),
          unitCost: Number(unitCost) || 0,
          notes: notes.trim(),
        },
        currentUser
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to receive stock.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-800 to-teal-800 text-white relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Receive Inward Stock (New Load)</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Log shipment receipt, preserve stock audit trail & update ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-emerald-950/50 text-emerald-200 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-slate-800">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Product <span className="text-rose-500">*</span>
            </label>
            <select
              id="select-stock-product"
              value={selectedProductId}
              onChange={handleProductChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku} • In Stock: {p.currentStock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Mandated Previous vs New vs Current Stock Visualization Box */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-3">
              Stock Calculation Verification
            </span>
            <div className="grid grid-cols-3 gap-2 text-center items-center">
              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                <span className="text-[11px] text-slate-400 block font-medium">Previous Stock</span>
                <span className="text-xl font-bold text-slate-200">{previousStock}</span>
                <span className="text-[10px] text-slate-400 block">{currentProduct?.unit}</span>
              </div>
              <div className="p-3 bg-emerald-950/80 rounded-xl border border-emerald-600/50">
                <span className="text-[11px] text-emerald-400 block font-medium">New Load</span>
                <span className="text-xl font-extrabold text-emerald-400">+{loadAmount}</span>
                <span className="text-[10px] text-emerald-300 block">{currentProduct?.unit}</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                <span className="text-[11px] text-cyan-400 block font-bold">Current Stock</span>
                <span className="text-xl font-extrabold text-cyan-300">{computedCurrentStock}</span>
                <span className="text-[10px] text-cyan-400 block">{currentProduct?.unit}</span>
              </div>
            </div>
            <div className="mt-3 text-center text-xs text-slate-400 font-mono">
              Formula: Previous ({previousStock}) + New (+{loadAmount}) = Current ({computedCurrentStock} {currentProduct?.unit})
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                New Load Quantity ({currentProduct?.unit || 'units'}) <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-receive-qty"
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Unit Purchase Cost ({currency})
              </label>
              <input
                id="input-receive-cost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Total Batch Cost: {formatCurrency(totalCost, currency)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
              <input
                id="input-receive-supplier"
                type="text"
                placeholder="e.g. Golden Valley Dairy"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supplier Invoice / PO #
              </label>
              <input
                id="input-receive-invoice"
                type="text"
                placeholder="e.g. INV-8821"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receiving Notes</label>
            <input
              id="input-receive-notes"
              type="text"
              placeholder="Delivery condition, truck #, batch inspection remarks"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-receive-stock"
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Inward Load (+{loadAmount})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
