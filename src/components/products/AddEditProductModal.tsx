import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Upload,
  QrCode,
  ScanBarcode,
  X,
  Trash2,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Layers,
  Calendar,
  Building,
  Info,
  Globe,
  Lock
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, User } from '../../types';
import { generateQRCodeDataUrl } from '../../utils/codeGenerators';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
  productToEdit?: Product | null;
  businessId: string;
  currentUser: User;
}

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  productToEdit,
  businessId,
  currentUser,
}) => {
  const isEditing = !!productToEdit;

  // Form Fields - Initialized strictly to 0 as required
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Dairy & Eggs');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [minStockLevel, setMinStockLevel] = useState<number>(0);
  const [maxStockLevel, setMaxStockLevel] = useState<number>(100);
  const [supplier, setSupplier] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [unit, setUnit] = useState<Product['unit']>('pcs');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const categories = db.getCategories();
  const suppliers = db.getSuppliers(businessId);
  const business = db.getBusinessById(businessId);
  const currency = business?.currencySymbol || '৳';

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setDescription(productToEdit.description || '');
      setCategory(productToEdit.category);
      setBrand(productToEdit.brand || '');
      setSku(productToEdit.sku);
      setBarcode(productToEdit.barcode);
      setPurchasePrice(productToEdit.purchasePrice ?? 0);
      setSellingPrice(productToEdit.sellingPrice ?? 0);
      setOpeningStock(productToEdit.openingStock ?? 0);
      setMinStockLevel(productToEdit.minStockLevel ?? 0);
      setMaxStockLevel(productToEdit.maxStockLevel ?? 100);
      setSupplier(productToEdit.supplier || '');
      setBatchNumber(productToEdit.batchNumber || '');
      setExpiryDate(productToEdit.expiryDate || '');
      setUnit(productToEdit.unit || 'pcs');
      setNotes(productToEdit.notes || '');
      setImageUrl(productToEdit.imageUrl || '');
      setImagePreview(productToEdit.imageUrl || null);
      setIsPublic(productToEdit.isPublic ?? true);
    } else {
      // Clean state for fresh creation - strictly 0 prices and quantities
      setName('');
      setDescription('');
      setCategory(categories[0] || 'Dairy & Eggs');
      setBrand('');
      const randomSku = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
      const randomBarcode = `890${Math.floor(100000 + Math.random() * 900000)}`;
      setSku(randomSku);
      setBarcode(randomBarcode);
      setPurchasePrice(0);
      setSellingPrice(0);
      setOpeningStock(0);
      setMinStockLevel(0);
      setMaxStockLevel(100);
      setSupplier(suppliers[0]?.name || '');
      setBatchNumber(`BCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setExpiryDate('');
      setUnit('pcs');
      setNotes('');
      setImageUrl('');
      setImagePreview(null);
      setIsPublic(true);
    }
    setError(null);
  }, [productToEdit, isOpen, businessId]);

  // Update QR Code preview whenever SKU or Barcode changes
  useEffect(() => {
    const qrPayload = JSON.stringify({
      shop: businessId,
      sku: sku || 'SKU',
      barcode: barcode || 'BARCODE',
      name: name || 'Product',
    });
    generateQRCodeDataUrl(qrPayload, { width: 140 }).then((url) => {
      setQrCodeDataUrl(url);
    });
  }, [sku, barcode, name, businessId]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate format
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError('Supported image types: JPG, JPEG, PNG, WEBP.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file must be less than 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setImageUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerateRandomBarcode = () => {
    const newBarcode = `890${Math.floor(100000 + Math.random() * 900000)}`;
    setBarcode(newBarcode);
  };

  const handleGenerateRandomSku = () => {
    const prefix = category.substring(0, 3).toUpperCase();
    const newSku = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    setSku(newSku);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }

    if (!sku.trim()) {
      setError('SKU code is required.');
      return;
    }

    if (!barcode.trim()) {
      setError('Barcode is required.');
      return;
    }

    try {
      if (isEditing && productToEdit) {
        const updated = db.updateProduct(
          businessId,
          productToEdit.id,
          {
            name: name.trim(),
            description: description.trim(),
            category,
            brand: brand.trim(),
            sku: sku.trim(),
            barcode: barcode.trim(),
            purchasePrice: Number(purchasePrice) || 0,
            sellingPrice: Number(sellingPrice) || 0,
            minStockLevel: Number(minStockLevel) || 0,
            maxStockLevel: Number(maxStockLevel) || 100,
            supplier: supplier.trim(),
            batchNumber: batchNumber.trim(),
            expiryDate,
            unit,
            notes: notes.trim(),
            imageUrl,
            isPublic,
          },
          currentUser
        );
        onSaved(updated);
      } else {
        const created = db.addProduct(
          businessId,
          {
            name: name.trim(),
            description: description.trim(),
            category,
            brand: brand.trim(),
            sku: sku.trim(),
            barcode: barcode.trim(),
            purchasePrice: Number(purchasePrice) || 0,
            sellingPrice: Number(sellingPrice) || 0,
            openingStock: Number(openingStock) || 0,
            totalReceived: 0,
            stockAdjustments: 0,
            minStockLevel: Number(minStockLevel) || 0,
            maxStockLevel: Number(maxStockLevel) || 100,
            supplier: supplier.trim(),
            batchNumber: batchNumber.trim(),
            expiryDate,
            unit,
            notes: notes.trim(),
            imageUrl,
            isPublic,
            status: 'active',
          },
          currentUser
        );
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 my-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white relative shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                {isEditing ? `Edit Product: ${productToEdit?.name}` : 'Add New Supermarket Product'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Workspace: <strong className="text-emerald-400">{businessId}</strong> • Transactional Inventory Tracking
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
              <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Product Basic Details & Image */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Product Image Upload & Live Preview */}
            <div className="lg:col-span-1 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
              <label className="block text-xs font-bold text-slate-700 mb-2 w-full text-center">
                Product Image
              </label>

              <div className="w-full h-44 rounded-xl bg-white border border-slate-200 overflow-hidden relative flex items-center justify-center group mb-3 shadow-2xs">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Product Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Remove image"
                      className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg shadow-sm hover:bg-rose-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-4 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-1 stroke-1" />
                    <span className="text-[11px] block">No image selected</span>
                    <span className="text-[10px] text-slate-400">(JPG, JPEG, PNG, WEBP)</span>
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />

              <div className="w-full flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  {imagePreview ? 'Replace Image' : 'Upload Image'}
                </button>
              </div>

              {/* QR Code Auto Preview */}
              <div className="mt-4 pt-4 border-t border-slate-200 w-full text-center flex flex-col items-center">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1.5">
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" /> Dynamic Product QR Code
                </span>
                {qrCodeDataUrl && (
                  <img
                    src={qrCodeDataUrl}
                    alt="Product QR Preview"
                    className="w-24 h-24 p-1 bg-white border border-slate-200 rounded-lg shadow-2xs"
                  />
                )}
              </div>
            </div>

            {/* Right: Core Fields */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-product-name"
                  type="text"
                  required
                  placeholder="e.g. Fresh Milk 1 Gallon, Basmati Rice 5kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Description (Editable) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-product-description"
                  rows={3}
                  required
                  placeholder="Detailed description (e.g. 'Fresh pasteurized full-cream whole milk suitable for household consumption.')"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    id="select-product-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Brand / Manufacturer</label>
                  <input
                    id="input-product-brand"
                    type="text"
                    placeholder="e.g. Valley Dairy, Nestle, Coca-Cola"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      SKU Code <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomSku}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      Generate SKU
                    </button>
                  </div>
                  <input
                    id="input-product-sku"
                    type="text"
                    required
                    placeholder="e.g. MILK-WHL-1G"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Barcode (EAN/UPC) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomBarcode}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      Auto-Barcode
                    </button>
                  </div>
                  <div className="relative">
                    <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-product-barcode"
                      type="text"
                      required
                      placeholder="e.g. 890103001"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Stock Parameters (Strict 0 initial values) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Financial & Stock Parameters (Default 0.00)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purchase Price ({currency})
                </label>
                <input
                  id="input-purchase-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selling Price ({currency})
                </label>
                <input
                  id="input-selling-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {!isEditing && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Opening Stock
                  </label>
                  <input
                    id="input-opening-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Unit Measurement
                </label>
                <select
                  id="select-product-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Product['unit'])}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="ltr">Liters (ltr)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="bottle">Bottle</option>
                  <option value="can">Can</option>
                  <option value="pack">Pack / 6-Pack</option>
                  <option value="box">Box</option>
                  <option value="packet">Packet</option>
                  <option value="carton">Carton</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Min Stock (Low Alert)
                </label>
                <input
                  id="input-min-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-amber-700 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Max Stock Level
                </label>
                <input
                  id="input-max-stock"
                  type="number"
                  min="1"
                  step="1"
                  value={maxStockLevel}
                  onChange={(e) => setMaxStockLevel(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batch Number
                </label>
                <input
                  id="input-batch-number"
                  type="text"
                  placeholder="BCH-2026-001"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expiry Date
                </label>
                <input
                  id="input-expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Supplier, Notes, and Public Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Distributor</label>
              <input
                id="input-product-supplier"
                type="text"
                placeholder="e.g. Golden Valley Dairy Ltd."
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Internal Notes</label>
              <input
                id="input-product-notes"
                type="text"
                placeholder="Storage temperature, shelf aisle location, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Public Catalog Visibility Toggle */}
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                {isPublic ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Public Stock Catalog Listing
                </span>
                <span className="text-xs text-slate-600">
                  {isPublic
                    ? 'Visible on the public store landing page (shows name, image, description, retail price, stock availability).'
                    : 'Private item: only accessible inside this private business dashboard.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPublic ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isPublic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              id="btn-save-product"
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isEditing ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
