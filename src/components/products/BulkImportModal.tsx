import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Download,
  Play,
  FileSpreadsheet,
  AlertOctagon,
  Loader2
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, User } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  currentUser: User;
  onImportSuccess: () => Promise<void>;
}

interface ParsedRow {
  rowNumber: number;
  data: Partial<Omit<Product, 'id' | 'businessId' | 'currentStock' | 'createdAt' | 'updatedAt' | 'totalSold'>>;
  isValid: boolean;
  errors: string[];
  warning?: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  businessId,
  currentUser,
  onImportSuccess,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  if (!isOpen) return null;

  // Generate Sample CSV Template for download
  const downloadTemplate = () => {
    const headers = [
      'Name',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      'Description',
      'Purchase Price',
      'Selling Price',
      'Opening Stock',
      'Min Stock Level',
      'Max Stock Level',
      'Unit',
      'Supplier',
      'Batch Number',
      'Expiry Date',
      'Notes',
      'Is Public (true/false)'
    ];
    
    const sampleRows = [
      [
        'Fresh Whole Milk 1L',
        'DAIRY-MILK-1L',
        '890103001',
        'Dairy & Eggs',
        'Aarong Dairy',
        'Pasteurized homogenized whole milk, high calcium',
        '85',
        '95',
        '50',
        '10',
        '200',
        'pcs',
        'Golden Valley Dairy Ltd.',
        'BCH-2026-M01',
        '2026-10-15',
        'Daily delivery item',
        'true'
      ],
      [
        'Organic Brown Rice 5kg',
        'GRAIN-RICE-5K',
        '890103002',
        'Pantry & Grains',
        'Chashi',
        'Premium quality brown rice, husked organic',
        '320',
        '380',
        '30',
        '5',
        '100',
        'packet',
        'Green Valley Produce',
        'BCH-2026-R05',
        '2027-12-31',
        'Store in cool dry place',
        'true'
      ]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'SPM_Bulk_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV template downloaded successfully.');
  };

  // Safe split line to handle quotes containing commas
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let insideQuote = false;
    let entry = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        result.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    result.push(entry.trim());
    
    // Remove enclosing quotes if any
    return result.map(val => {
      let v = val;
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.substring(1, v.length - 1);
      }
      return v.replace(/""/g, '"');
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a valid .csv file.');
      return;
    }
    setFileName(file.name);
    parseCSV(file);
  };

  // Helper to normalize header matching
  const matchHeader = (headers: string[], keys: string[]): number => {
    return headers.findIndex(h => {
      const cleanH = h.toLowerCase().replace(/[\s_\-()]/g, '');
      return keys.some(k => cleanH === k.toLowerCase().replace(/[\s_\-()]/g, ''));
    });
  };

  const parseCSV = (file: File) => {
    setIsParsing(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error('File is empty.');
        }

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('CSV must contain a header row and at least one product row.');
        }

        const headers = parseCSVLine(lines[0]);
        
        // Find column indexes
        const idxName = matchHeader(headers, ['name', 'productname', 'title']);
        const idxSku = matchHeader(headers, ['sku', 'productsku', 'itemcode']);
        const idxBarcode = matchHeader(headers, ['barcode', 'upc', 'ean', 'code']);
        const idxCategory = matchHeader(headers, ['category', 'dept', 'department']);
        const idxBrand = matchHeader(headers, ['brand', 'make']);
        const idxDescription = matchHeader(headers, ['description', 'desc', 'summary']);
        const idxPurchasePrice = matchHeader(headers, ['purchaseprice', 'purchase_price', 'cost', 'costprice']);
        const idxSellingPrice = matchHeader(headers, ['sellingprice', 'selling_price', 'price']);
        const idxOpeningStock = matchHeader(headers, ['openingstock', 'opening_stock', 'stock', 'qty', 'quantity']);
        const idxMinStock = matchHeader(headers, ['minstock', 'minstocklevel', 'minimumstock']);
        const idxMaxStock = matchHeader(headers, ['maxstock', 'maxstocklevel', 'maximumstock']);
        const idxUnit = matchHeader(headers, ['unit', 'measure']);
        const idxSupplier = matchHeader(headers, ['supplier', 'vendor']);
        const idxBatch = matchHeader(headers, ['batch', 'batchnumber', 'batch_number']);
        const idxExpiry = matchHeader(headers, ['expiry', 'expirydate', 'expiry_date']);
        const idxNotes = matchHeader(headers, ['notes', 'note', 'comment']);
        const idxPublic = matchHeader(headers, ['public', 'ispublic', 'is_public', 'published']);

        if (idxName === -1) {
          throw new Error('Header row is missing required "Name" or "Product Name" column.');
        }

        const existingProducts = db.getProducts(businessId);
        const existingSkus = new Set(existingProducts.map(p => p.sku.trim().toLowerCase()));
        const existingBarcodes = new Set(existingProducts.filter(p => p.barcode).map(p => p.barcode.trim().toLowerCase()));

        const rows: ParsedRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const cols = parseCSVLine(line);
          
          // Skip completely empty lines
          if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) {
            continue;
          }

          const rawName = cols[idxName] || '';
          const rawSku = idxSku !== -1 ? cols[idxSku] : '';
          const rawBarcode = idxBarcode !== -1 ? cols[idxBarcode] : '';
          const rawCategory = idxCategory !== -1 ? cols[idxCategory] : 'General';
          const rawBrand = idxBrand !== -1 ? cols[idxBrand] : 'Generic';
          const rawDesc = idxDescription !== -1 ? cols[idxDescription] : '';
          const rawPurchase = idxPurchasePrice !== -1 ? cols[idxPurchasePrice] : '0';
          const rawSelling = idxSellingPrice !== -1 ? cols[idxSellingPrice] : '0';
          const rawOpening = idxOpeningStock !== -1 ? cols[idxOpeningStock] : '0';
          const rawMin = idxMinStock !== -1 ? cols[idxMinStock] : '5';
          const rawMax = idxMaxStock !== -1 ? cols[idxMaxStock] : '100';
          const rawUnit = idxUnit !== -1 ? cols[idxUnit] : 'pcs';
          const rawSupplier = idxSupplier !== -1 ? cols[idxSupplier] : '';
          const rawBatch = idxBatch !== -1 ? cols[idxBatch] : '';
          const rawExpiry = idxExpiry !== -1 ? cols[idxExpiry] : '';
          const rawNotes = idxNotes !== -1 ? cols[idxNotes] : '';
          const rawPublic = idxPublic !== -1 ? cols[idxPublic] : 'true';

          const errors: string[] = [];
          let warning: string | undefined = undefined;

          // Val: Name
          if (!rawName.trim()) {
            errors.push('Product name is required.');
          }

          // Val: SKU
          let finalSku = rawSku.trim();
          if (!finalSku) {
            finalSku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          } else if (existingSkus.has(finalSku.toLowerCase())) {
            warning = `SKU "${finalSku}" already exists. Importing this will create a duplicate item.`;
          }

          // Val: Barcode
          let finalBarcode = rawBarcode.trim();
          if (finalBarcode && existingBarcodes.has(finalBarcode.toLowerCase())) {
            warning = warning 
              ? `${warning} Also, Barcode "${finalBarcode}" is already in use.`
              : `Barcode "${finalBarcode}" is already in use.`;
          }

          // Val: Prices
          const purchasePrice = parseFloat(rawPurchase.replace(/[^0-9.]/g, '')) || 0;
          const sellingPrice = parseFloat(rawSelling.replace(/[^0-9.]/g, '')) || 0;
          if (purchasePrice < 0) errors.push('Purchase Price cannot be negative.');
          if (sellingPrice < 0) errors.push('Selling Price cannot be negative.');
          if (sellingPrice < purchasePrice) {
            warning = warning
              ? `${warning} Selling price is lower than cost purchase price.`
              : `Selling price is lower than cost purchase price.`;
          }

          // Val: Stock
          const openingStock = parseInt(rawOpening.replace(/[^0-9\-]/g, '')) || 0;
          const minStock = parseInt(rawMin.replace(/[^0-9]/g, '')) || 5;
          const maxStock = parseInt(rawMax.replace(/[^0-9]/g, '')) || 100;
          if (openingStock < 0) errors.push('Opening Stock cannot be negative.');

          // Val: Unit type validation mapping
          const allowedUnits = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'packet', 'carton', 'can', 'bottle', 'pack'];
          let finalUnit = rawUnit.trim().toLowerCase();
          if (!allowedUnits.includes(finalUnit)) {
            finalUnit = 'pcs';
          }

          // Val: Public flag
          const isPublic = rawPublic.trim().toLowerCase() !== 'false';

          const productData: ParsedRow['data'] = {
            name: rawName.trim(),
            sku: finalSku,
            barcode: finalBarcode,
            category: rawCategory.trim() || 'General',
            brand: rawBrand.trim() || 'Generic',
            description: rawDesc.trim(),
            purchasePrice,
            sellingPrice,
            openingStock,
            totalReceived: openingStock, // match opening
            stockAdjustments: 0,
            minStockLevel: minStock,
            maxStockLevel: maxStock,
            unit: finalUnit as any,
            supplier: rawSupplier.trim(),
            batchNumber: rawBatch.trim(),
            expiryDate: rawExpiry.trim(),
            notes: rawNotes.trim(),
            imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80', // placeholder
            isPublic,
            isPublished: isPublic,
            status: 'active'
          };

          rows.push({
            rowNumber: i + 1,
            data: productData,
            isValid: errors.length === 0,
            errors,
            warning
          });
        }

        setParsedRows(rows);
        toast.success(`Successfully parsed ${rows.length} product rows from CSV.`);
      } catch (err: any) {
        console.error('CSV Parsing Error:', err);
        toast.error(err?.message || 'Failed to parse CSV file. Please check format.');
        resetState();
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read CSV file.');
      setIsParsing(false);
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid products to import.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: validRows.length });

    try {
      let importedCount = 0;
      for (const row of validRows) {
        // Safe cast to pass database expectations
        await db.addProduct(businessId, row.data as any, currentUser);
        importedCount++;
        setImportProgress(prev => ({ ...prev, current: importedCount }));
      }

      toast.success(`Successfully imported ${importedCount} products into your catalog.`);
      await onImportSuccess();
      onClose();
    } catch (err: any) {
      console.error('[Bulk Import] execution error:', err);
      toast.error(`Import failed halfway: ${err?.message || 'Check database permissions.'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFileName(null);
    setParsedRows([]);
    setDragActive(false);
    setImportProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;
  const warningCount = parsedRows.filter(r => r.isValid && r.warning).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Bulk Import Products</h2>
              <p className="text-xs text-slate-500">Add multiple products instantly by uploading a CSV spreadsheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Instructions / Download Template Block */}
          {!fileName && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-sm font-bold text-slate-800">CSV Import Instructions:</h3>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                  <li>Make sure your CSV file is UTF-8 encoded with standard comma separators.</li>
                  <li><strong>Product Name</strong> is a mandatory column. Each product must have a name.</li>
                  <li>SKU will be auto-generated if left empty. Duplicate SKUs will trigger warnings.</li>
                  <li><strong>Valid units:</strong> pcs, kg, g, ltr, ml, box, packet, carton, can, bottle, pack.</li>
                  <li>Number values (prices, stocks) should not contain currency characters or commas.</li>
                </ul>
              </div>
              <div className="flex flex-col items-center justify-center bg-slate-50 p-4 border border-slate-200 rounded-2xl text-center">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-700 mb-2">Need a starting template?</p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" /> Download Template
                </button>
              </div>
            </div>
          )}

          {/* Drag & Drop Box */}
          {!fileName && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/30'
                  : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-4 bg-white shadow-xs rounded-2xl mb-4 border border-slate-100">
                <Upload className="w-8 h-8 text-emerald-600 animate-pulse" />
              </div>
              <p className="text-sm font-extrabold text-slate-800">Drag & drop your CSV file here</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse your computer files</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4">Supported format: .csv</p>
            </div>
          )}

          {/* Loader */}
          {isParsing && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">Parsing and validating CSV data...</p>
            </div>
          )}

          {/* Parsed Output / Preview table */}
          {!isParsing && parsedRows.length > 0 && (
            <div className="space-y-4">
              {/* Stat Summarizer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Rows</p>
                  <p className="text-xl font-extrabold text-slate-800">{parsedRows.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Ready to Import</p>
                  <p className="text-xl font-extrabold text-emerald-600">{validCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Invalid (Errors)</p>
                  <p className="text-xl font-extrabold text-rose-600">{invalidCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Warnings</p>
                  <p className="text-xl font-extrabold text-amber-600">{warningCount}</p>
                </div>
              </div>

              {/* Warnings / Error Panel */}
              {(invalidCount > 0 || warningCount > 0) && (
                <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-4 space-y-2 max-h-[160px] overflow-y-auto">
                  <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Validation Notices:
                  </h4>
                  <ul className="text-[11px] text-slate-700 space-y-1 list-none pl-1">
                    {parsedRows.map((row) => {
                      if (!row.isValid) {
                        return (
                          <li key={row.rowNumber} className="text-rose-700 flex items-start gap-1">
                            <span className="font-bold shrink-0">Row {row.rowNumber}:</span>
                            <span>{row.errors.join(' ')}</span>
                          </li>
                        );
                      }
                      if (row.warning) {
                        return (
                          <li key={row.rowNumber} className="text-amber-700 flex items-start gap-1">
                            <span className="font-bold shrink-0">Row {row.rowNumber}:</span>
                            <span>{row.warning}</span>
                          </li>
                        );
                      }
                      return null;
                    })}
                  </ul>
                </div>
              )}

              {/* Scrollable Preview Grid */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Barcode</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Cost Price</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Opening Stock</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr 
                        key={row.rowNumber} 
                        className={`hover:bg-slate-50/50 ${
                          !row.isValid ? 'bg-rose-50/30' : row.warning ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-medium text-slate-400">#{row.rowNumber}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{row.data.name || <span className="text-rose-500 italic">Missing</span>}</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-600">{row.data.sku}</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{row.data.barcode || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{row.data.category}</td>
                        <td className="py-2 px-3 text-right text-slate-600">৳{row.data.purchasePrice?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-800 font-semibold">৳{row.data.sellingPrice?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-600 font-semibold">{row.data.openingStock}</td>
                        <td className="py-2 px-3 text-slate-500 font-medium">{row.data.unit}</td>
                        <td className="py-2 px-3 text-center">
                          {!row.isValid ? (
                            <span className="inline-flex items-center gap-1 py-0.5 px-1.5 bg-rose-100 text-rose-700 text-[9px] font-extrabold rounded-md">
                              <AlertOctagon className="w-3 h-3" /> Error
                            </span>
                          ) : row.warning ? (
                            <span className="inline-flex items-center gap-1 py-0.5 px-1.5 bg-amber-100 text-amber-700 text-[9px] font-extrabold rounded-md" title={row.warning}>
                              <AlertTriangle className="w-3 h-3" /> Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 py-0.5 px-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-extrabold rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action trigger button */}
              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={resetState}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Clear & Upload Different File
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={validCount === 0 || isImporting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" /> Import {validCount} Products
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress Overlay during live import iterations */}
        {isImporting && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center p-8 z-20 space-y-5">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Importing Products to Catalog...</h3>
              <p className="text-xs text-slate-500">Writing database changes and synchronizing with Cloud Firestore</p>
            </div>
            
            {/* Progress Bar container */}
            <div className="w-full max-w-md bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200 shadow-inner">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs font-extrabold text-slate-700">
              {importProgress.current} of {importProgress.total} products completed ({Math.round((importProgress.current / importProgress.total) * 100)}%)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
