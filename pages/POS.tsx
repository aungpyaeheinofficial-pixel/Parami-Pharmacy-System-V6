
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Minus, User, Banknote, QrCode, RotateCcw, ShoppingCart, ScanLine, Image as ImageIcon, CheckCircle, AlertCircle, X, Lock, AlertTriangle, Sparkles, BrainCircuit, Loader2, Info } from 'lucide-react';
import { useCartStore, useProductStore, useTransactionStore, useCustomerStore, useBranchStore } from '../store';
import { Button, Input, Badge, Card } from '../components/UI';
import { Product, Transaction, UNIT_TYPES } from '../types';
import CameraScanner from '../components/CameraScanner';
import { parseBarcode, GS1ParsedData } from '../utils/gs1Parser';
import { GoogleGenAI } from "@google/genai";

const ProductCard: React.FC<{ product: Product, onAdd: (p: Product) => void, index: number }> = ({ product, onAdd, index }) => (
  <div 
    onClick={() => onAdd(product)}
    className="bg-white rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group flex flex-col h-full overflow-hidden border border-transparent hover:border-blue-500 animate-in fade-in zoom-in-95 fill-mode-backwards"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    <div className="relative aspect-square bg-slate-50 w-full overflow-hidden">
       {product.image ? (
          <img src={product.image} alt={product.nameEn} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
       ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
             <ImageIcon size={48} className="opacity-50" />
          </div>
       )}
       <span className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm backdrop-blur-sm ${
           product.stockLevel < product.minStockLevel 
             ? 'bg-red-50/90 text-red-700 border-red-100' 
             : 'bg-yellow-50/90 text-yellow-800 border-yellow-200'
       }`}>
          {product.stockLevel} left
       </span>
    </div>
    
    <div className="p-3 flex flex-col flex-1">
      <h4 className="font-semibold text-slate-900 text-sm truncate leading-tight" title={product.nameEn}>{product.nameEn}</h4>
      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
         <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-600">{product.category.substring(0, 3)}</span>
         <span className="truncate">{product.sku}</span>
      </div>
      
      <div className="mt-auto pt-3 flex items-center justify-between">
         <span className="font-bold text-red-600 text-lg">{product.price.toLocaleString()} Ks</span>
         <button className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100">
            <Plus size={16} />
         </button>
      </div>
    </div>
  </div>
);

const AIPosAssistant = ({ items }: { items: any[] }) => {
    const [advice, setAdvice] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const getAdvice = async () => {
        if (items.length === 0) return;
        setLoading(true);
        setIsOpen(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const itemNames = items.map(i => `${i.nameEn} (${i.genericName || 'Generic'})`).join(', ');
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `As an expert pharmacist, analyze this customer cart: [${itemNames}]. Provide a very brief (max 3-4 bullets) summary of usage warnings, potential drug interactions, or key generic alternatives (Myanmar/English mixed). Format with clean bullets.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 },
                    maxOutputTokens: 500,
                }
            });
            setAdvice(response.text || "No specific warnings for this combination.");
        } catch (error) {
            console.error(error);
            setAdvice("Unable to contact the AI Pharmacist at the moment.");
        } finally {
            setLoading(false);
        }
    };

    if (items.length === 0) return null;

    return (
        <div className="relative">
            {!isOpen ? (
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={getAdvice}
                    className="w-full gap-2 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 transition-colors"
                >
                    <Sparkles size={14} /> AI Pharmacist Advice
                </Button>
            ) : (
                <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden animate-in slide-in-from-right-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="text-indigo-600" size={16} />
                            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Clinical Insights</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-indigo-600"><X size={14} /></button>
                    </div>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-4 text-indigo-500">
                            <Loader2 className="animate-spin mb-2" size={24} />
                            <span className="text-[10px] font-bold uppercase">Scanning Formulas...</span>
                        </div>
                    ) : (
                        <div className="text-[11px] text-slate-700 leading-relaxed font-mm whitespace-pre-wrap">
                            {advice}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

const POS = () => {
  const { items, addItem, removeItem, updateQuantity, total, clearCart, customer, setCustomer } = useCartStore();
  const { products, addProduct } = useProductStore();
  const { customers } = useCustomerStore();
  const { addTransaction } = useTransactionStore();
  const { currentBranchId } = useBranchStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [notFoundScan, setNotFoundScan] = useState<GS1ParsedData | null>(null);
  const [managerRequest, setManagerRequest] = useState<{ type: 'expired' | 'quick_add'; data: any; } | null>(null);
  const [managerCreds, setManagerCreds] = useState({ id: '', password: '' });
  const [scannedInfo, setScannedInfo] = useState<{msg: string, type: 'success' | 'error' | 'warning'} | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  
  const cartTotal = total();
  const cashValue = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashValue - cartTotal);
  const canCheckout = cashReceived !== '' && cashValue >= cartTotal;

  useEffect(() => { if (paymentModalOpen) setCashReceived(''); }, [paymentModalOpen]);

  const categories = ['All', 'Antibiotics', 'Analgesics', 'Vitamins', 'Supplements', 'Gastrointestinal', 'Diabetic'];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const lowerSearch = searchTerm.toLowerCase();
      const matchesSearch = p.nameEn.toLowerCase().includes(lowerSearch) || 
                            p.nameMm.includes(searchTerm) ||
                            p.sku.toLowerCase().includes(lowerSearch) ||
                            (p.genericName && p.genericName.toLowerCase().includes(lowerSearch));
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleManagerLogin = () => {
      if (managerCreds.id === 'admin' && managerCreds.password === '1234') {
          if (managerRequest?.type === 'expired') {
              const { product, scanData } = managerRequest.data;
              addItem(product, { 
                  transactionData: {
                      scanned_batch: scanData.batchNumber,
                      scanned_expiry: scanData.expiryDate,
                      scanned_serial: scanData.serialNumber,
                      scanned_at: new Date().toISOString(),
                      raw_barcode: scanData.rawData
                  },
                  warnings: ['EXPIRED'],
                  override: true
              });
              setScannedInfo({ msg: `Approved: ${product.nameEn} (Expired)`, type: 'warning' });
          }
          setManagerRequest(null);
          setManagerCreds({ id: '', password: '' });
      } else {
          alert('Invalid Credentials');
      }
  };

  const processBarcode = (code: string) => {
       const gs1Data = parseBarcode(code);
       let product = products.find(p => p.gtin === gs1Data.gtin || p.sku === code || p.id === code);

       if (product) {
          let isExpired = false;
          let isNearExpiry = false;
          if (gs1Data.expiryDate) {
              const today = new Date();
              const expiry = new Date(gs1Data.expiryDate);
              const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (daysLeft < 0) isExpired = true;
              else if (daysLeft < 30) isNearExpiry = true;
          }
          if (isExpired) {
              setManagerRequest({ type: 'expired', data: { product, scanData: gs1Data } });
              return;
          }
          addItem(product, {
              transactionData: {
                  scanned_batch: gs1Data.batchNumber || null,
                  scanned_expiry: gs1Data.expiryDate || null,
                  scanned_serial: gs1Data.serialNumber || null,
                  scanned_at: new Date().toISOString(),
                  raw_barcode: code
              },
              warnings: isNearExpiry ? ['NEAR_EXPIRY'] : undefined
          });
          setScannedInfo({ msg: `Added: ${product.nameEn}`, type: isNearExpiry ? 'warning' : 'success' });
          return true;
       } else {
          setNotFoundScan(gs1Data);
          setScannedInfo({ msg: `Product not found: ${code}`, type: 'error' });
          return false;
       }
  };

  const handleQuickAdd = (formData: any) => {
      const newProduct: Product = {
          id: `qp-${Date.now()}`,
          nameEn: formData.name,
          nameMm: formData.nameMm || formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          stockLevel: 100,
          minStockLevel: 10,
          sku: notFoundScan?.gtin || notFoundScan?.rawData || `SKU-${Date.now()}`,
          gtin: notFoundScan?.gtin,
          unit: formData.unit,
          requiresPrescription: false,
          image: '',
          branchId: currentBranchId,
          batches: []
      };
      addProduct(newProduct);
      addItem(newProduct, {
          transactionData: {
              scanned_batch: notFoundScan?.batchNumber || null,
              scanned_expiry: notFoundScan?.expiryDate || null,
              scanned_serial: notFoundScan?.serialNumber || null,
              scanned_at: new Date().toISOString(),
              raw_barcode: notFoundScan?.rawData || ''
          }
      });
      setNotFoundScan(null);
      setScannedInfo({ msg: `Quick Added: ${newProduct.nameEn}`, type: 'success' });
  };

  const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm) {
       processBarcode(searchTerm);
       setSearchTerm('');
       setTimeout(() => { if (!notFoundScan && !managerRequest) setScannedInfo(null) }, 3000);
    }
  };

  const handleCheckout = () => {
    addTransaction({
      id: `TRX-${Date.now()}`,
      type: 'INCOME',
      category: 'Sales',
      amount: total(),
      date: new Date().toISOString().split('T')[0],
      description: `POS Sale - ${items.length} items`,
      paymentMethod: 'CASH',
      branchId: currentBranchId,
    });
    setPaymentModalOpen(false);
    clearCart();
    setSuccessMsg('Transaction Completed!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 relative">
      {successMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
           <CheckCircle size={20} />
           <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
        <div className="p-4 bg-white border-b border-slate-200 space-y-4 shadow-sm z-10">
          <div className="flex gap-3">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Scan GS1 Barcode or Search..." 
                  className="w-full pl-12 pr-4 h-12 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleScanInput}
                  autoFocus
                />
             </div>
             <button onClick={() => setIsScannerOpen(true)} className="bg-slate-800 text-white h-12 w-12 flex items-center justify-center rounded-xl hover:bg-slate-700 transition-colors shadow-sm"><ScanLine size={20} /></button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide pt-1 px-1">
            {categories.map((cat, idx) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:text-blue-600'}`} style={{ animationDelay: `${idx * 50}ms` }}>{cat}</button>
            ))}
          </div>
          {scannedInfo && (
             <div className={`p-3 rounded-xl text-sm flex items-center gap-2 animate-in slide-in-from-top-2 fade-in ${scannedInfo.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : scannedInfo.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {scannedInfo.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {scannedInfo.msg}
             </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} index={index} />
              ))}
           </div>
        </div>
      </div>

      <div className="w-96 bg-white flex flex-col shrink-0 shadow-xl z-20 border-l border-slate-100">
         <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><ShoppingCart size={20} className="text-blue-600" /> Current Sale</h3>
               <button onClick={clearCart} className="text-xs text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium"><RotateCcw size={14} /> Clear</button>
            </div>
            <div className="relative">
               <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <select className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={customer?.id || ''} onChange={(e) => setCustomer(customers.find(c => c.id === e.target.value) || null)}>
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
            </div>
            <div className="mt-4">
                <AIPosAssistant items={items} />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
            {items.map(item => (
              <div key={item.cartId} className={`flex gap-3 bg-white border rounded-xl p-3 shadow-sm group relative animate-in slide-in-from-right-4 duration-300 ${item.warning_flags?.includes('EXPIRED') ? 'border-red-300 bg-red-50/20' : 'border-slate-100'}`}>
                 <button onClick={() => removeItem(item.cartId)} className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 border border-slate-100 shadow-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 z-10"><X size={14} /></button>
                 <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden">
                    {item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> : <ImageIcon size={20} className="text-slate-300" />}
                 </div>
                 <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-800 truncate pr-4 leading-tight">{item.nameEn}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {item.transaction_data?.scanned_batch && <Badge variant="neutral" className="text-[9px]">{item.transaction_data.scanned_batch}</Badge>}
                            {item.warning_flags?.includes('EXPIRED') && <Badge variant="danger" className="text-[9px]">EXPIRED</Badge>}
                        </div>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                       <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                          <button onClick={() => updateQuantity(item.cartId, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-slate-600"><Minus size={12} /></button>
                          <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.cartId, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-slate-600"><Plus size={12} /></button>
                       </div>
                       <p className="text-sm font-bold text-slate-900">{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                 </div>
              </div>
            ))}
         </div>

         <div className="p-5 bg-white border-t border-slate-100 space-y-4 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)]">
            <div className="space-y-2 text-sm">
               <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{total().toLocaleString()} Ks</span></div>
               <div className="flex justify-between text-xl font-bold text-slate-900 pt-3 border-t border-dashed border-slate-200 mt-2"><span>Total</span><span>{total().toLocaleString()} Ks</span></div>
            </div>
            <Button variant="primary" className="w-full h-12 text-base font-bold shadow-xl shadow-blue-500/20" disabled={items.length === 0} onClick={() => setPaymentModalOpen(true)}>Charge {total().toLocaleString()} Ks</Button>
         </div>
      </div>

      {paymentModalOpen && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
               <h3 className="text-xl font-bold text-slate-800 mb-6">Confirm Payment</h3>
               <div className="space-y-4">
                  <Input label="Cash Received" placeholder="0" autoFocus className="text-lg font-mono" value={cashReceived} onChange={(e: any) => setCashReceived(e.target.value)} type="number" />
                  <div className={`flex justify-between text-sm p-4 rounded-xl border ${changeDue > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                     <span className="text-slate-500">Change Due</span>
                     <span className="font-bold text-lg">{changeDue.toLocaleString()} Ks</span>
                  </div>
               </div>
               <div className="flex gap-3 mt-8">
                  <Button variant="outline" className="flex-1" onClick={() => setPaymentModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" className="flex-1 h-11" onClick={handleCheckout} disabled={!canCheckout}>Complete Sale</Button>
               </div>
            </div>
         </div>
      )}

      {managerRequest && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 border-t-4 border-red-500">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Manager Approval Required</h3>
                  <div className="space-y-3">
                      <Input placeholder="Manager ID" value={managerCreds.id} onChange={(e: any) => setManagerCreds({...managerCreds, id: e.target.value})} />
                      <Input type="password" placeholder="Password" value={managerCreds.password} onChange={(e: any) => setManagerCreds({...managerCreds, password: e.target.value})} />
                  </div>
                  <div className="flex gap-3 mt-6">
                      <Button variant="outline" className="flex-1" onClick={() => setManagerRequest(null)}>Cancel</Button>
                      <Button variant="parami" className="flex-1" onClick={handleManagerLogin}>Authorize</Button>
                  </div>
              </div>
          </div>
      )}

      {notFoundScan && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border-t-4 border-amber-500">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h3>
                  <p className="font-mono text-sm bg-slate-100 p-2 rounded mb-4">{notFoundScan.gtin || notFoundScan.rawData}</p>
                  <form onSubmit={(e) => { e.preventDefault(); handleQuickAdd(Object.fromEntries(new FormData(e.target as HTMLFormElement))); }} className="space-y-3">
                      <Input name="name" placeholder="Name (EN)" required />
                      <Input name="price" type="number" placeholder="Price" required />
                      <select name="category" className="w-full p-2 border rounded-xl">{categories.filter(c => c!=='All').map(c => <option key={c} value={c}>{c}</