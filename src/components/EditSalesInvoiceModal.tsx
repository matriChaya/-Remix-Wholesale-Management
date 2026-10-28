import React, { useState, useEffect } from 'react';
import {
  X,
  FileCheck,
  Calendar,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  Store,
  Package,
  RotateCcw,
  CheckCircle2,
  Phone,
  User,
  Percent,
  RefreshCw,
  DollarSign,
  CreditCard,
  Building,
} from 'lucide-react';
import { OrderInvoice, OrderItem, Product, Retailer } from '../types';
import { useWholesale } from '../context/WholesaleContext';
import { formatCurrency } from '../utils/translations';
import { generateDateBasedInvoiceNo } from '../utils/invoiceNumberHelper';

interface EditSalesInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderInvoice | null;
  onSuccess?: (msg: string) => void;
}

export const EditSalesInvoiceModal: React.FC<EditSalesInvoiceModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const { retailers, products, users, orders, updateOrderInvoice, language } = useWholesale();

  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [retailerId, setRetailerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [salesPersonRole, setSalesPersonRole] = useState<string>('counter');
  const [salesPersonName, setSalesPersonName] = useState<string>('');
  const [salesPersonId, setSalesPersonId] = useState<string>('');
  const [targetCashAccount, setTargetCashAccount] = useState<string>('CREATOR_DRAWER');
  const [isAutoInvoiceNo, setIsAutoInvoiceNo] = useState<boolean>(true);
  const [paymentType, setPaymentType] = useState<string>('CASH');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize form when order changes
  useEffect(() => {
    if (!order) return;

    setInvoiceNo(order.invoiceNo || order.invoiceNumber || order.id || '');
    setDate(order.date ? order.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setRetailerId(order.retailerId || '');
    setCustomerName(order.customerName || order.retailerName || '');
    setShopName(order.shopName || '');
    setCustomerPhone(order.retailerPhone || order.customerPhone || '');
    setSalesPersonRole(order.salesPersonRole || order.creatorRole || 'counter');
    setSalesPersonName(order.salesPersonName || order.creatorName || '');
    setSalesPersonId(order.salesPersonId || order.creatorId || '');
    setTargetCashAccount((order as any).targetCashAccount || 'CREATOR_DRAWER');
    setPaymentType(order.paymentType || (order.paymentMethod === 'Cash' ? 'CASH' : 'CREDIT'));
    setPaidAmount(Number(order.paidAmount) || 0);
    setDiscountAmount(Number(order.discountAmount ?? order.discount) || 0);
    setNotes(order.notes || '');

    if (Array.isArray(order.items) && order.items.length > 0) {
      setItems(
        order.items.map((it) => {
          const isRep = it.itemType === 'REPLACEMENT' || it.isReplacement === true || Number(it.quantity) < 0;
          const cleanQty =
            it.quantity !== undefined && it.quantity !== null && !isNaN(Number(it.quantity))
              ? Math.max(0, Number(it.quantity))
              : 0;
          const cleanPrice =
            it.unitPrice !== undefined && it.unitPrice !== null && !isNaN(Number(it.unitPrice))
              ? Math.max(0, Number(it.unitPrice))
              : 0;
          return {
            ...it,
            quantity: cleanQty,
            unitPrice: cleanPrice,
            totalPrice: isRep ? -(cleanQty * cleanPrice) : (cleanQty * cleanPrice),
            total: isRep ? -(cleanQty * cleanPrice) : (cleanQty * cleanPrice),
            itemType: isRep ? 'REPLACEMENT' : 'SALE',
            isReplacement: isRep,
            replacementReason: it.replacementReason || (isRep ? 'মার্কেট থেকে রিপ্লেস ফেরত' : undefined),
          };
        })
      );
    } else {
      setItems([]);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  // Handle changes to an item
  const handleItemChange = (index: number, field: keyof OrderItem, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: val };

      if (field === 'quantity' || field === 'unitPrice' || field === 'itemType' || field === 'isReplacement') {
        const isRep = target.itemType === 'REPLACEMENT' || target.isReplacement === true;
        const q = target.quantity !== undefined && !isNaN(Number(target.quantity)) ? Math.max(0, Number(target.quantity)) : 0;
        const p = target.unitPrice !== undefined && !isNaN(Number(target.unitPrice)) ? Math.max(0, Number(target.unitPrice)) : 0;
        const lineTotal = q * p;
        target.totalPrice = isRep ? -lineTotal : lineTotal;
        target.total = target.totalPrice;
        if (field === 'itemType') {
          target.isReplacement = isRep;
          if (isRep && !target.replacementReason) {
            target.replacementReason = 'মার্কেট থেকে রিপ্লেস ফেরত';
          }
        }
      }

      next[index] = target;
      return next;
    });
  };

  // Toggle Item Type between SALE and REPLACEMENT
  const handleToggleItemType = (index: number) => {
    setItems((prev) => {
      const next = [...prev];
      const cur = next[index];
      const newType = cur.itemType === 'REPLACEMENT' || cur.isReplacement ? 'SALE' : 'REPLACEMENT';
      const isRep = newType === 'REPLACEMENT';
      const q = cur.quantity !== undefined && !isNaN(Number(cur.quantity)) ? Math.max(0, Number(cur.quantity)) : 0;
      const p = cur.unitPrice !== undefined && !isNaN(Number(cur.unitPrice)) ? Math.max(0, Number(cur.unitPrice)) : 0;
      const lineTotal = q * p;

      next[index] = {
        ...cur,
        itemType: newType,
        isReplacement: isRep,
        totalPrice: isRep ? -lineTotal : lineTotal,
        total: isRep ? -lineTotal : lineTotal,
        replacementReason: isRep ? (cur.replacementReason || 'মার্কেট থেকে রিপ্লেস ফেরত') : undefined,
      };
      return next;
    });
  };

  // Add Item Row (Regular or Custom Unlisted)
  const handleAddItemRow = (type: 'SALE' | 'REPLACEMENT' = 'SALE', isCustom: boolean = false) => {
    const firstProd = products[0];
    const unitPrice = isCustom ? 0 : (firstProd ? firstProd.wholesalePrice : 0);
    const isRep = type === 'REPLACEMENT';

    setItems((prev) => [
      ...prev,
      {
        productId: isCustom ? `unlisted_${Date.now()}` : (firstProd?.id || `prod_${Date.now()}`),
        productName: isCustom ? (isRep ? 'মার্কেট ফেরত আনলিস্টেড পণ্য' : 'কাস্টম আনলিস্টেড পণ্য') : (firstProd?.name || 'নতুন পণ্য'),
        bnProductName: isCustom ? (isRep ? 'মার্কেট ফেরত আনলিস্টেড পণ্য' : 'কাস্টম আনলিস্টেড পণ্য') : firstProd?.bnName,
        sku: isCustom ? `UNL-${Date.now().toString().slice(-4)}` : (firstProd?.sku || ''),
        quantity: isCustom ? 0 : 1,
        unit: firstProd?.unit || 'pcs',
        unitPrice,
        costPrice: 0,
        totalPrice: 0,
        total: 0,
        itemType: type,
        isReplacement: isRep,
        replacementReason: isRep ? 'মার্কেট থেকে রিপ্লেস ফেরত' : undefined,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSelectProductForItem = (index: number, prodId: string) => {
    const matched = products.find((p) => p.id === prodId);
    if (!matched) return;

    setItems((prev) => {
      const next = [...prev];
      const isRep = next[index].itemType === 'REPLACEMENT' || next[index].isReplacement;
      const q =
        next[index].quantity !== undefined && !isNaN(Number(next[index].quantity))
          ? Math.max(0, Number(next[index].quantity))
          : 0;
      const p = matched.wholesalePrice || 0;
      const lineTotal = q * p;

      next[index] = {
        ...next[index],
        productId: matched.id,
        productName: matched.name,
        bnProductName: matched.bnName,
        sku: matched.sku,
        unit: matched.unit,
        unitPrice: p,
        costPrice: matched.costPrice || 0,
        totalPrice: isRep ? -lineTotal : lineTotal,
        total: isRep ? -lineTotal : lineTotal,
        challanRefNo: matched.latestChallanNo || (matched.challanReferences && matched.challanReferences[0]?.challanNo) || '',
      };
      return next;
    });
  };

  // Calculations
  const salesItems = items.filter((i) => !i.isReplacement && i.itemType !== 'REPLACEMENT');
  const replacementItems = items.filter((i) => i.isReplacement || i.itemType === 'REPLACEMENT');

  const totalSoldPieces = salesItems.reduce((acc, it) => acc + Math.abs(Number(it.quantity) || 0), 0);
  const totalReturnedPieces = replacementItems.reduce((acc, it) => acc + Math.abs(Number(it.quantity) || 0), 0);
  const netPieces = totalSoldPieces - totalReturnedPieces;
  const saleCost = salesItems.reduce((acc, it) => acc + Math.abs(Number(it.quantity) || 0) * (Number(it.costPrice) || 0), 0);
  const repCost = replacementItems.reduce((acc, it) => acc + Math.abs(Number(it.quantity) || 0) * (Number(it.costPrice) || 0), 0);
  const totalCostAmount = Math.max(0, saleCost - repCost);

  const totalSalesAmount = salesItems.reduce((acc, it) => acc + Math.abs(Number(it.quantity) || 0) * Math.abs(Number(it.unitPrice) || 0), 0);
  const totalReplacementAmount = replacementItems.reduce((acc, it) => acc + Math.abs(Number(it.quantity) || 0) * Math.abs(Number(it.unitPrice) || 0), 0);
  const subtotal = Math.max(0, totalSalesAmount - totalReplacementAmount);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const totalProfitAmount = Math.max(0, grandTotal - totalCostAmount);
  const dueAmount = Math.max(0, grandTotal - paidAmount);

  // Date change handler with automatic date-based sequential invoice number
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (isAutoInvoiceNo && newDate) {
      const autoNo = generateDateBasedInvoiceNo(newDate, order?.id, orders);
      setInvoiceNo(autoNo);
    }
  };

  const handleRegenerateInvoiceNo = () => {
    if (date) {
      const autoNo = generateDateBasedInvoiceNo(date, order?.id, orders);
      setInvoiceNo(autoNo);
    }
  };

  const handlePaymentTypeChange = (newType: string) => {
    setPaymentType(newType);
    if (newType === 'CASH' || newType === 'BANK' || newType === 'MOBILE') {
      setPaidAmount(grandTotal);
    } else if (newType === 'CREDIT') {
      setPaidAmount(0);
    }
  };

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg(language === 'bn' ? 'চালানে অন্তত একটি পণ্য থাকা আবশ্যক।' : 'At least one item is required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const matchedRetailer = retailers.find((r) => r.id === retailerId);
      const finalShopName = shopName.trim() || matchedRetailer?.shopName || matchedRetailer?.name || 'খুচরা প্রতিষ্ঠান';
      const finalCustomerName = customerName.trim() || matchedRetailer?.ownerName || finalShopName;
      const finalPhone = customerPhone.trim() || matchedRetailer?.phone || '';

      const updatedData: any = {
        invoiceNo,
        invoiceNumber: invoiceNo,
        date,
        retailerId,
        retailerName: `${finalShopName} (${finalCustomerName})`,
        customerName: finalCustomerName,
        shopName: finalShopName,
        retailerPhone: finalPhone,
        customerPhone: finalPhone,
        salesPersonRole,
        salesPersonName,
        salesPersonId: salesPersonId || order.salesPersonId,
        creatorRole: salesPersonRole || order.creatorRole || 'counter',
        creatorName: salesPersonName || order.creatorName || '',
        creatorId: salesPersonId || order.creatorId,
        targetCashAccount,
        items,
        totalSalesAmount,
        totalReplacementAmount,
        hasReplacements: totalReplacementAmount > 0,
        totalSoldPieces,
        totalReturnedPieces,
        netPieces,
        totalCostAmount,
        totalProfitAmount,
        subtotal,
        discountAmount,
        totalAmount: grandTotal,
        paymentType,
        paymentMethod: paymentType === 'CREDIT' ? 'Credit' : paymentType === 'BANK' ? 'Bank' : 'Cash',
        paidAmount,
        dueAmount,
        notes,
      };

      const res = updateOrderInvoice(order.id, updatedData);
      if (res.success) {
        if (onSuccess) {
          onSuccess(res.message);
        }
        onClose();
      } else {
        setErrorMsg(res.message || 'Error updating order invoice');
      }
    } catch (err: any) {
      console.error('Update invoice error:', err);
      setErrorMsg(err.message || 'Error saving invoice modifications');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {language === 'bn' ? 'বিক্রয় চালান ও মেমো সংশোধন' : 'Edit Sales Invoice & Items'}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  #{invoiceNo}
                </span>
                {totalReplacementAmount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-rose-400" />
                    <span>মার্কেট রিপ্লেস সমন্বিত</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'bn'
                  ? 'ভুল পণ্য বা সংখ্যা সংশোধন করুন, মার্কেট রিপ্লেস (মাইনাস) ও বিক্রয় (প্লাস) সমন্বয় স্বয়ংক্রিয়ভাবে হবে।'
                  : 'Modify wrong items/quantities. Sales count as plus and market replacements count as minus.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top Meta: Date, Invoice No, Retailer, Phone, Staff Seller Dropdown */}
          <div className="space-y-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
            {/* Row 1: Date & Auto-Generated Sequential Invoice Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bn' ? 'চালানের তারিখ (Date):' : 'Invoice Date:'}</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {language === 'bn' ? 'তারিখ বদলালে মেমো নং স্বয়ংক্রিয়ভাবে আপডেট হবে' : 'Date change auto-updates invoice number'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>{language === 'bn' ? 'ইনভয়েস নম্বর (Auto Sequential):' : 'Invoice Number:'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateInvoiceNo}
                    title="তারিখ অনুসারে ক্রমিক নম্বর পুনরায় জেনারেট করুন"
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 font-bold cursor-pointer transition"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>{language === 'bn' ? 'অটো জেনারেট' : 'Auto Generate'}</span>
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => {
                      setInvoiceNo(e.target.value);
                      setIsAutoInvoiceNo(false);
                    }}
                    placeholder="INV-YYYYMMDD-1"
                    className="w-full bg-slate-900 border border-sky-600/50 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 focus:outline-none focus:border-sky-400 font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-sky-400/90 mt-1 block font-mono">
                  {language === 'bn' ? 'একই তারিখে একাধিক মেমো হলে -১, -২, -৩ ক্রমিক হবে' : 'Suffix 1, 2, 3... applies on same date'}
                </span>
              </div>

              {/* Retailer / Shop Select */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bn' ? 'দোকান / রিটেইলার:' : 'Retailer / Shop:'}</span>
                </label>
                <select
                  value={retailerId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setRetailerId(selId);
                    if (selId === 'walkin' || !selId) {
                      setShopName('সাধারণ ক্যাশ কাস্টমার');
                      setCustomerName('সাধারণ ক্রেতা');
                      setCustomerPhone('');
                    } else {
                      const ret = retailers.find((r) => r.id === selId);
                      if (ret) {
                        setShopName(ret.shopName || ret.name);
                        setCustomerName(ret.ownerName || ret.name);
                        setCustomerPhone(ret.phone);
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="walkin">{language === 'bn' ? '🛒 সাধারণ ক্যাশ কাস্টমার (Walk-in Customer)' : 'Walk-in Customer'}</option>
                  {retailers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.shopName || r.name} ({r.phone})
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {shopName} {customerName ? `— ${customerName}` : ''}
                </div>
              </div>
            </div>

            {/* Row 2: Customer Phone & Seller / Entry Creator Dropdown with Acceptance Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bn' ? 'গ্রাহকের মোবাইল নম্বর:' : 'Customer Phone Number:'}</span>
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Seller / Creator Dropdown (Admin Correction) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'bn' ? 'সেলার / এন্ট্রি গ্রহণকারী (Seller Dropdown):' : 'Seller / Creator (Dropdown):'}</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50">
                    {salesPersonRole.toUpperCase()}
                  </span>
                </div>
                <select
                  value={salesPersonId || users.find(u => u.name === salesPersonName)?.id || salesPersonName}
                  onChange={(e) => {
                    const selVal = e.target.value;
                    const u = users.find((usr) => usr.id === selVal || usr.name === selVal);
                    if (u) {
                      setSalesPersonId(u.id);
                      setSalesPersonName(u.name);
                      setSalesPersonRole(u.role);
                    } else {
                      setSalesPersonName(selVal);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role === 'admin' ? 'এডমিন (Admin)' : u.role === 'dsr' ? 'ডিএসআর (DSR)' : u.role === 'counter' ? 'কাউন্টার ক্যাশ (Counter)' : u.role.toUpperCase()}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-[10px] text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {language === 'bn'
                      ? `এই সেলার (${salesPersonName || 'স্টাফ'} - ${salesPersonRole.toUpperCase()}) এর একাউন্ট থেকে মেমো আপডেট একসেপ্ট হবে।`
                      : `Invoice updates will be accepted under ${salesPersonName} (${salesPersonRole.toUpperCase()})`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Items Table with Plus/Minus Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-xs sm:text-sm text-slate-200">
                  {language === 'bn' ? 'চালানের পণ্য তালিকা (বিক্রয় ও মার্কেট রিপ্লেস)' : 'Invoice Items (Sales & Market Replacements)'}
                </h4>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono font-bold">
                  {items.length} টি আইটেম
                </span>
              </div>

              {/* Add item buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddItemRow('SALE')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? '+ বিক্রি পণ্য' : '+ Sale Item'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItemRow('REPLACEMENT')}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>{language === 'bn' ? '🔄 রিপ্লেস ফেরত (-)' : '🔄 Market Replace (-)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItemRow('REPLACEMENT', true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  title="স্টকে না থাকা যেকোনো আনলিস্টেড বা ফেরত পণ্য (০ টাকা বা ০ পিসেও)"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>{language === 'bn' ? '✨ আনলিস্টেড পণ্য (০ টাকা/০ পিস)' : '✨ Unlisted (0 Tk/Qty)'}</span>
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  {language === 'bn' ? 'চালানে কোনো পণ্য যোগ করা নেই। উপরের বাটনে ক্লিক করে পণ্য যোগ করুন।' : 'No items in this invoice.'}
                </div>
              ) : (
                items.map((item, idx) => {
                  const isRep = item.itemType === 'REPLACEMENT' || item.isReplacement;
                  const lineTotal = Math.abs(item.quantity) * Math.abs(item.unitPrice);

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isRep
                          ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-600'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Product Selector and Type Badge */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 1-Click Plus/Minus Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemType(idx)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer shadow-sm ${
                              isRep
                                ? 'bg-rose-900/60 text-rose-200 border-rose-500 hover:bg-rose-800'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                            }`}
                            title={language === 'bn' ? 'ধরন পরিবর্তন করতে ক্লিক করুন' : 'Click to toggle type'}
                          >
                            {isRep ? (
                              <>
                                <RotateCcw className="w-3 h-3 text-rose-300" />
                                <span>মার্কেট রিপ্লেস (মাইনাস -)</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 text-emerald-400" />
                                <span>বিক্রি পণ্য (প্লাস +)</span>
                              </>
                            )}
                          </button>

                          {item.productId && item.productId.startsWith('unlisted_') ? (
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                              placeholder="পণ্যের নাম লিখুন (আনলিস্টেড)..."
                              className="bg-slate-900 border border-amber-500/70 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400 min-w-[180px]"
                            />
                          ) : (
                            <select
                              value={item.productId}
                              onChange={(e) => handleSelectProductForItem(idx, e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold max-w-[240px]"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.unit})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* If replacement, show reason field */}
                        {isRep && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-rose-400 font-semibold">ফেরতের কারণ:</span>
                            <select
                              value={item.replacementReason || 'মার্কেট থেকে রিপ্লেস ফেরত'}
                              onChange={(e) => handleItemChange(idx, 'replacementReason', e.target.value)}
                              className="bg-slate-900 border border-rose-800/80 rounded px-2 py-0.5 text-[11px] text-rose-200 focus:outline-none"
                            >
                              <option value="মার্কেট থেকে রিপ্লেস ফেরত">মার্কেট থেকে রিপ্লেস ফেরত (সাধারণ)</option>
                              <option value="মেয়াদোত্তীর্ণ পণ্য (Expired)">মেয়াদোত্তীর্ণ পণ্য (Expired)</option>
                              <option value="প্যাকেট নষ্ট বা ছেঁড়া">প্যাকেট নষ্ট বা ছেঁড়া (Damaged)</option>
                              <option value="ভেঙে যাওয়া বা লিকেজ">ভেঙে যাওয়া বা লিকেজ (Broken)</option>
                              <option value="ম্যানুফ্যাকচারিং ত্রুটি">ম্যানুফ্যাকচারিং ত্রুটি (Defect)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Quantity, Unit Price, and Line Total */}
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        {/* Quantity */}
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 block font-semibold">
                            {isRep ? (language === 'bn' ? 'রিপ্লেস সংখ্যা (-)' : 'Replace Qty (-)') : (language === 'bn' ? 'বিক্রয় সংখ্যা (+)' : 'Sale Qty (+)')}
                          </label>
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-bold font-mono ${isRep ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isRep ? '-' : '+'}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-[11px] text-slate-400">{item.unit || 'পিস'}</span>
                          </div>
                        </div>

                        {/* Rate / Unit Price */}
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 block font-semibold">
                            {language === 'bn' ? 'দর (৳):' : 'Rate (৳):'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                            className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="text-right min-w-[80px]">
                          <span className="text-[10px] text-slate-400 block font-semibold">
                            {language === 'bn' ? 'মোট:' : 'Total:'}
                          </span>
                          <span
                            className={`font-mono font-extrabold text-xs sm:text-sm ${
                              isRep ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {isRep ? '-' : '+'}{formatCurrency(lineTotal, language)}
                          </span>
                        </div>

                        {/* Delete Row */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Financials & Payment Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            {/* Left: Payment Method & Target Cash Account Dropdowns & Notes */}
            <div className="space-y-3">
              {/* Payment Mode & Paid Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-emerald-400" />
                      <span>{language === 'bn' ? 'লেনদেনের ধরন (Mode):' : 'Payment Mode:'}</span>
                    </span>
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => handlePaymentTypeChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    <option value="CASH">{language === 'bn' ? '💵 সম্পূর্ণ নগদ (CASH)' : 'Cash (Full)'}</option>
                    <option value="CREDIT">{language === 'bn' ? '📄 সম্পূর্ণ বাকি (CREDIT)' : 'Full Credit'}</option>
                    <option value="PARTIAL">{language === 'bn' ? '💳 আংশিক জমা (PARTIAL)' : 'Partial Payment'}</option>
                    <option value="BANK">{language === 'bn' ? '🏦 ব্যাংক জমা (BANK)' : 'Bank Deposit'}</option>
                    <option value="MOBILE">{language === 'bn' ? '📱 মোবাইল ব্যাংকিং (bKash/Nagad)' : 'Mobile Banking'}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-400" />
                      <span>{language === 'bn' ? 'নগদ জমা (Paid):' : 'Paid Amount:'}</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPaidAmount(grandTotal)}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold hover:bg-emerald-900 cursor-pointer"
                      >
                        {language === 'bn' ? 'পুরো' : 'Full'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmount(0)}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                      >
                        {language === 'bn' ? 'শূন্য' : '0'}
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Target Cash Account / Drawer Dropdown (Admin Correction) */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <Building className="w-3 h-3 text-sky-400" />
                  <span>{language === 'bn' ? 'ক্যাশ জমা ড্রয়ার / হিসাব (Target Cash Account):' : 'Target Drawer / Account:'}</span>
                </label>
                <select
                  value={targetCashAccount}
                  onChange={(e) => setTargetCashAccount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 focus:outline-none focus:border-sky-500 font-semibold"
                >
                  <option value="CREATOR_DRAWER">{language === 'bn' ? `সেলার ক্যাশ ড্রয়ার (${salesPersonName || 'সেলার'})` : 'Seller Drawer'}</option>
                  <option value="COUNTER_DRAWER">{language === 'bn' ? 'কাউন্টার ক্যাশ ড্রয়ার (Counter Drawer)' : 'Counter Drawer'}</option>
                  <option value="DSR_DRAWER">{language === 'bn' ? 'ডিএসআর ফিল্ড ক্যাশ ড্রয়ার (DSR Drawer)' : 'DSR Drawer'}</option>
                  <option value="ADMIN_VAULT">{language === 'bn' ? 'এডমিন মেইন ক্যাশ ভল্ট (Admin Main Vault)' : 'Admin Vault'}</option>
                  <option value="BANK_ACCOUNT">{language === 'bn' ? 'ব্যাংক একাউন্ট (Bank Account)' : 'Bank Account'}</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {language === 'bn'
                    ? 'ভুল ক্যাশ ড্রয়ারে টাকা জমা হলে এখান থেকে সঠিক ড্রয়ার বা ব্যাংক সিলেক্ট করুন।'
                    : 'Select the right drawer or bank account to route the received cash.'}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {language === 'bn' ? 'সংশোধনের বিবরণ / নোট:' : 'Revision Notes:'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={language === 'bn' ? 'ভুল এন্ট্রি সংশোধন বা কারণ লিখুন...' : 'Add revision reason...'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Right: Calculations Breakdown */}
            <div className="space-y-2 text-xs font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              {/* Piece Counts Summary */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] font-sans">
                <span className="text-emerald-400 font-semibold">📦 বিক্রয়: <b>{totalSoldPieces} পিস</b></span>
                <span className="text-rose-400 font-semibold">🔄 ফেরত: <b>{totalReturnedPieces} পিস</b></span>
                <span className="text-sky-400 font-bold">⚡ নিট: <b>{netPieces} পিস</b></span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1 font-sans">
                  <span className="text-emerald-400 font-bold">+</span>
                  <span>{language === 'bn' ? 'মোট নতুন বিক্রয় (Sales):' : 'Total Sales (+):'}</span>
                </span>
                <span className="font-bold text-emerald-400">{formatCurrency(totalSalesAmount, language)}</span>
              </div>

              {totalReplacementAmount > 0 && (
                <div className="flex justify-between items-center text-rose-300 bg-rose-950/40 px-2 py-1 rounded border border-rose-900/50">
                  <span className="flex items-center gap-1 font-sans">
                    <span className="text-rose-400 font-bold">-</span>
                    <span>{language === 'bn' ? 'মার্কেট রিপ্লেস কর্তন (Returns):' : 'Market Replacement (-):'}</span>
                  </span>
                  <span className="font-bold text-rose-400">-{formatCurrency(totalReplacementAmount, language)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-400 border-t border-slate-800 pt-1">
                <span className="font-sans">{language === 'bn' ? 'সমন্বয়কৃত উপমোট:' : 'Net Subtotal:'}</span>
                <span className="font-bold text-white">{formatCurrency(subtotal, language)}</span>
              </div>

              <div className="flex justify-between items-center text-amber-300">
                <span className="flex items-center gap-1 font-sans">
                  <Percent className="w-3 h-3 text-amber-400" />
                  <span>{language === 'bn' ? 'বিশেষ ছাড় (Discount):' : 'Discount:'}</span>
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs">-৳</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-amber-300 font-mono font-bold text-right"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-white border-t border-slate-700 pt-1">
                <span className="font-sans">{language === 'bn' ? 'সর্বমোট চূড়ান্ত বিল:' : 'Grand Total:'}</span>
                <span className="text-emerald-400 text-base">{formatCurrency(grandTotal, language)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-sans">{language === 'bn' ? 'অবশিষ্ট বকেয়া (Due):' : 'Due Amount:'}</span>
                <span className={`font-bold ${dueAmount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {formatCurrency(dueAmount, language)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {language === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{language === 'bn' ? 'সংশোধন সংরক্ষণ ও স্টক সমন্বয়' : 'Save Changes & Sync Stock'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
