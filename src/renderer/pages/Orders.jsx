import React, { useState, useEffect, useCallback } from 'react';
import { dbAll, dbRun, dbGet } from '../api/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Minus, Trash2, Receipt, Search, X, Printer, Pencil, FileText } from 'lucide-react';
import clsx from 'clsx';

const orderTypes = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'delivery', label: 'Delivery' },
];

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
  { value: 'partial', label: 'Partial' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'other_bank', label: 'Other Bank' },
];

function generateOrderNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const r = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `ORD-${y}${m}${day}-${h}${min}${s}-${r}`;
}

export default function Orders() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewHistory, setViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stockItems, setStockItems] = useState([]);
  const [receiptData, setReceiptData] = useState(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [editOrderModal, setEditOrderModal] = useState(null);
  const [editOrderItems, setEditOrderItems] = useState([]);
  const [editOrderType, setEditOrderType] = useState('dine_in');
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editDiscountType, setEditDiscountType] = useState('fixed');
  const [editDiscountValue, setEditDiscountValue] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAddItemSearch, setEditAddItemSearch] = useState('');

  const loadData = useCallback(async () => {
    const [catRes, itemRes, custRes, stockRes] = await Promise.all([
      dbAll('SELECT * FROM menu_categories ORDER BY sort_order, name'),
      dbAll('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category_id, name'),
      dbAll('SELECT id, name, phone, current_balance, credit_limit FROM credit_customers ORDER BY name'),
      dbAll('SELECT id, name, current_quantity, min_quantity FROM stock_items'),
    ]);
    setCategories(catRes?.data ?? []);
    setItems(itemRes?.data ?? []);
    setCustomers(custRes?.data ?? []);
    setStockItems(stockRes?.data ?? []);
    if (!selectedCategory && (catRes?.data?.length)) setSelectedCategory('general');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (categories.length && !selectedCategory) setSelectedCategory('general');
  }, [categories]);

  const searchLower = menuSearch.trim().toLowerCase();
  const itemsByCategory = selectedCategory === 'general' || !selectedCategory
    ? items
    : items.filter((i) => Number(i.category_id) === Number(selectedCategory));
  const filteredItems = searchLower
    ? itemsByCategory.filter((i) => (i.name || '').toLowerCase().includes(searchLower))
    : itemsByCategory;

  const addNewCustomer = async () => {
    if (!newCustomer.name.trim()) {
      alert('Enter customer name.');
      return;
    }
    const res = await dbRun(
      'INSERT INTO credit_customers (name, phone) VALUES (?, ?)',
      [newCustomer.name.trim(), newCustomer.phone?.trim() || null]
    );
    if (res?.error) {
      alert('Failed to add customer: ' + res.error);
      return;
    }
    const idRes = await dbGet('SELECT id FROM credit_customers WHERE name = ? ORDER BY id DESC LIMIT 1', [newCustomer.name.trim()]);
    const newId = idRes?.data?.id;
    await loadData();
    if (newId) {
      setCustomerId(String(newId));
      setCustomerName(newCustomer.name.trim());
      setCustomerPhone(newCustomer.phone?.trim() || '');
    }
    setNewCustomer({ name: '', phone: '' });
    setShowAddCustomer(false);
  };

  const getStockAvailable = (itemName, currentCart = cart) => {
    const nameLower = (itemName || '').trim().toLowerCase();
    if (!nameLower) return null;
    const stock = stockItems.find((s) => (s.name || '').trim().toLowerCase() === nameLower);
    if (!stock) return null;
    const inCart = currentCart
      .filter((r) => (r.item_name || '').trim().toLowerCase() === nameLower)
      .reduce((sum, r) => sum + r.quantity, 0);
    const available = Math.max(0, (Number(stock.current_quantity) || 0) - inCart);
    return { stockId: stock.id, available, currentQuantity: Number(stock.current_quantity) || 0 };
  };

  const addToCart = (item) => {
    const stockInfo = getStockAvailable(item.name);
    if (stockInfo && stockInfo.available <= 0) {
      alert(`${item.name}: No stock available (${stockInfo.currentQuantity} in stock).`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id && !c.variant_id);
      const nameLower = (item.name || '').trim().toLowerCase();
      const inCart = prev.filter((r) => (r.item_name || '').trim().toLowerCase() === nameLower).reduce((sum, r) => sum + r.quantity, 0);
      const stock = stockItems.find((s) => (s.name || '').trim().toLowerCase() === nameLower);
      const maxQty = stock ? Math.max(0, (Number(stock.current_quantity) || 0) - inCart) : null;
      if (existing) {
        const newQty = existing.quantity + 1;
        if (maxQty != null && newQty > maxQty) return prev;
        return prev.map((c) => (c === existing ? { ...c, quantity: newQty, total_price: newQty * c.unit_price } : c));
      }
      if (maxQty != null && 1 > maxQty) return prev;
      return [...prev, { menu_item_id: item.id, item_name: item.name, unit_price: Number(item.sale_price), quantity: 1, total_price: Number(item.sale_price), variant_id: null }];
    });
  };

  const updateQty = (index, delta) => {
    setCart((prev) => {
      const row = prev[index];
      const nameLower = (row.item_name || '').trim().toLowerCase();
      const stock = stockItems.find((s) => (s.name || '').trim().toLowerCase() === nameLower);
      const inCartOthers = prev.filter((r, i) => i !== index && (r.item_name || '').trim().toLowerCase() === nameLower).reduce((sum, r) => sum + r.quantity, 0);
      const maxQty = stock ? Math.max(0, (Number(stock.current_quantity) || 0) - inCartOthers) : null;
      let newQty = row.quantity + delta;
      if (maxQty != null && newQty > maxQty) newQty = maxQty;
      if (newQty <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((r, i) => (i === index ? { ...r, quantity: newQty, total_price: newQty * r.unit_price } : r));
    });
  };

  const removeFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((s, c) => s + c.total_price, 0);
  let discountAmount = 0;
  if (discountValue !== '') {
    const v = Number(discountValue) || 0;
    discountAmount = discountType === 'percent' ? (subtotal * v) / 100 : v;
  }
  const total = Math.max(0, subtotal - discountAmount);

  const completeOrder = async () => {
    if (cart.length === 0) {
      alert('Add at least one item to the order.');
      return;
    }
    const stockRes = await dbAll('SELECT id, name, current_quantity FROM stock_items');
    const currentStock = stockRes?.data ?? [];
    for (const row of cart) {
      const nameLower = (row.item_name || '').trim().toLowerCase();
      const stock = currentStock.find((s) => (s.name || '').trim().toLowerCase() === nameLower);
      if (stock) {
        const available = Number(stock.current_quantity) || 0;
        if (row.quantity > available) {
          alert(`${row.item_name}: Only ${available} in stock. Reduce quantity or remove from cart.`);
          return;
        }
      }
    }
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name || !phone) {
      alert('Customer name and phone are required.');
      return;
    }
    if ((paymentMethod === 'credit' || paymentMethod === 'partial') && !customerId) {
      alert('Select or add a customer for credit / partial payment.');
      return;
    }
    if (paymentMethod === 'partial') {
      const paid = Number(amountPaid) || 0;
      if (paid <= 0 || paid > total) {
        alert('Enter amount paid now (greater than 0 and up to total).');
        return;
      }
    }

    let orderCustomerId = customerId;
    if (!orderCustomerId) {
      const existing = (await dbGet('SELECT id FROM credit_customers WHERE phone = ? LIMIT 1', [phone])).data;
      if (existing) {
        orderCustomerId = String(existing.id);
        await dbRun('UPDATE credit_customers SET name = ?, updated_at = datetime("now") WHERE id = ?', [name, existing.id]);
      } else {
        const ins = await dbRun('INSERT INTO credit_customers (name, phone) VALUES (?, ?)', [name, phone]);
        if (ins?.error) {
          alert('Failed to save customer: ' + ins.error);
          return;
        }
        const newC = (await dbGet('SELECT id FROM credit_customers WHERE phone = ? ORDER BY id DESC LIMIT 1', [phone])).data;
        if (newC) orderCustomerId = String(newC.id);
      }
    }

    let paidAmountNow = total;
    let creditBalanceToAdd = 0;
    let paymentStatus = 'paid';
    if (paymentMethod === 'credit') {
      paidAmountNow = 0;
      creditBalanceToAdd = total;
      paymentStatus = 'pending';
    } else if (paymentMethod === 'partial') {
      paidAmountNow = Math.min(total, Number(amountPaid) || 0);
      creditBalanceToAdd = total - paidAmountNow;
      paymentStatus = paidAmountNow >= total ? 'paid' : 'partial';
    }

    let customerCreditLimit = 0;
    let customerCurrentBalance = 0;
    let creditLimitExceeded = false;
    if (creditBalanceToAdd > 0 && orderCustomerId) {
      const custRow = (await dbGet('SELECT current_balance, credit_limit FROM credit_customers WHERE id = ?', [orderCustomerId])).data;
      if (custRow) {
        customerCurrentBalance = Number(custRow.current_balance) || 0;
        customerCreditLimit = Number(custRow.credit_limit) || 0;
        const newBalance = customerCurrentBalance + creditBalanceToAdd;
        if (customerCreditLimit > 0 && newBalance > customerCreditLimit) {
          creditLimitExceeded = true;
          const custName = customers.find((c) => c.id === Number(orderCustomerId))?.name || name;
          const proceed = window.confirm(
            `Credit limit will be exceeded.\n\nCustomer: ${custName}\nCredit limit: Rs. ${customerCreditLimit.toLocaleString()}\nCurrent balance: Rs. ${customerCurrentBalance.toLocaleString()}\nThis order adds: Rs. ${creditBalanceToAdd.toLocaleString()}\nNew balance: Rs. ${newBalance.toLocaleString()}\n\nProceed anyway? (Yes = save & print, No = cancel)`
          );
          if (!proceed) return;
        }
      }
    }

    const orderNumber = generateOrderNumber();
    const paymentMethodDb = paymentMethod === 'partial' ? 'mixed' : (paymentMethod === 'jazzcash' || paymentMethod === 'easypaisa' || paymentMethod === 'other_bank') ? 'card' : paymentMethod;

    const orderRes = await dbRun(
      `INSERT INTO orders (order_number, order_type, table_number, customer_id, subtotal, discount_amount, discount_type, tax_amount, total, payment_method, payment_status, paid_amount, created_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        orderType,
        tableNumber || null,
        orderCustomerId || null,
        subtotal,
        discountAmount,
        discountValue ? discountType : null,
        total,
        paymentMethodDb,
        paymentStatus,
        paidAmountNow,
        user?.id ?? null,
        notes || null,
      ]
    );
    if (orderRes?.error) {
      alert('Failed to save order: ' + orderRes.error);
      return;
    }

    const orderIdRes = await dbGet('SELECT id FROM orders WHERE order_number = ?', [orderNumber]);
    const orderId = orderIdRes?.data?.id;
    if (!orderId) {
      alert('Order saved but could not get ID.');
      return;
    }

    for (const row of cart) {
      await dbRun(
        'INSERT INTO order_items (order_id, menu_item_id, variant_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, row.menu_item_id, row.variant_id, row.item_name, row.quantity, row.unit_price, row.total_price]
      );
    }

    for (const row of cart) {
      const nameLower = (row.item_name || '').trim().toLowerCase();
      const stock = stockItems.find((s) => (s.name || '').trim().toLowerCase() === nameLower);
      if (!stock || row.quantity <= 0) continue;
      const qty = Number(row.quantity) || 0;
      const currRes = await dbGet('SELECT current_quantity FROM stock_items WHERE id = ?', [stock.id]);
      const currentQty = Number(currRes?.data?.current_quantity) ?? 0;
      const newQty = Math.max(0, currentQty - qty);
      const updateRes = await dbRun(
        'UPDATE stock_items SET current_quantity = ?, updated_at = datetime("now") WHERE id = ?',
        [newQty, stock.id]
      );
      if (updateRes?.error) {
        console.error('Stock update failed:', updateRes.error);
        alert(`Could not update stock for ${row.item_name}: ${updateRes.error}`);
      } else {
        await dbRun(
          'INSERT INTO stock_movements (stock_item_id, type, quantity, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [stock.id, 'out', -qty, orderNumber, 'Order', user?.id ?? null]
        );
      }
    }

    if (creditBalanceToAdd > 0 && orderCustomerId) {
      await dbRun('UPDATE credit_customers SET current_balance = current_balance + ?, updated_at = datetime("now") WHERE id = ?', [creditBalanceToAdd, orderCustomerId]);
    }

    const settingsRes = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    (settingsRes?.data ?? []).forEach((r) => { settings[r.key] = r.value; });

    const receiptCustomerName = orderCustomerId ? (customers.find((c) => c.id === Number(orderCustomerId))?.name ?? name) : name;
    const balanceAfterOrder = creditBalanceToAdd > 0 && orderCustomerId ? customerCurrentBalance + creditBalanceToAdd : null;
    setReceiptData({
      orderNumber,
      date: new Date().toISOString(),
      orderType,
      tableNumber: tableNumber || null,
      customerName: receiptCustomerName || null,
      items: [...cart],
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      notes: notes || null,
      settings,
      creditLimit: customerCreditLimit > 0 ? customerCreditLimit : null,
      balanceAfterOrder,
      creditLimitExceeded: creditLimitExceeded || (customerCreditLimit > 0 && balanceAfterOrder != null && balanceAfterOrder > customerCreditLimit),
      pendingAmount: creditBalanceToAdd > 0 ? creditBalanceToAdd : null,
    });

    setCart([]);
    setTableNumber('');
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setAmountPaid('');
    setDiscountValue('');
    setNotes('');
    setPaymentMethod('cash');
    await loadData();
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const loadOrderHistory = useCallback(async () => {
    const res = await dbAll(
      `SELECT o.*, s.name as created_by_name FROM orders o LEFT JOIN staff s ON s.id = o.created_by WHERE date(o.created_at) = ? ORDER BY o.created_at DESC`,
      [historyDate]
    );
    setOrderHistory(res?.data ?? []);
  }, [historyDate]);

  const showReceiptForOrder = async (o) => {
    const itemsRes = await dbAll('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const orderItems = itemsRes?.data ?? [];
    const receiptItems = orderItems.map((row) => ({
      item_name: row.item_name,
      quantity: row.quantity,
      unit_price: Number(row.unit_price) || 0,
      total_price: Number(row.total_price) || 0,
    }));
    let customerName = null;
    let creditLimit = null;
    let balanceAfterOrder = null;
    let creditLimitExceeded = false;
    if (o.customer_id) {
      const cust = customers.find((c) => c.id === Number(o.customer_id));
      if (cust) {
        customerName = cust.name;
        const limit = Number(cust.credit_limit) || 0;
        const balance = Number(cust.current_balance) || 0;
        if (limit > 0) creditLimit = limit;
        balanceAfterOrder = balance;
        creditLimitExceeded = limit > 0 && balance > limit;
      } else {
        const custRes = await dbGet('SELECT name, credit_limit, current_balance FROM credit_customers WHERE id = ?', [o.customer_id]);
        if (custRes?.data) {
          customerName = custRes.data.name;
          const limit = Number(custRes.data.credit_limit) || 0;
          const balance = Number(custRes.data.current_balance) || 0;
          if (limit > 0) creditLimit = limit;
          balanceAfterOrder = balance;
          creditLimitExceeded = limit > 0 && balance > limit;
        }
      }
    }
    const settingsRes = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    (settingsRes?.data ?? []).forEach((r) => { settings[r.key] = r.value; });
    const paymentMethodDisplay = o.payment_method === 'mixed' ? 'partial' : o.payment_method;
    const pendingAmount = (o.payment_status === 'pending' || o.payment_status === 'partial')
      ? (Number(o.total) || 0) - (Number(o.paid_amount) || 0)
      : null;
    setReceiptData({
      orderNumber: o.order_number,
      date: o.created_at,
      orderType: o.order_type,
      tableNumber: o.table_number || null,
      customerName,
      items: receiptItems,
      subtotal: Number(o.subtotal) || 0,
      discountAmount: Number(o.discount_amount) || 0,
      total: Number(o.total) || 0,
      paymentMethod: paymentMethodDisplay,
      notes: o.notes || null,
      settings,
      creditLimit,
      balanceAfterOrder,
      creditLimitExceeded,
      pendingAmount,
    });
  };

  const openEditOrderModal = async (o) => {
    setEditOrderModal(o);
    const itemsRes = await dbAll('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const rows = (itemsRes?.data ?? []).map((r) => ({
      menu_item_id: r.menu_item_id,
      item_name: r.item_name,
      unit_price: Number(r.unit_price) || 0,
      quantity: r.quantity,
      total_price: Number(r.total_price) || 0,
      variant_id: r.variant_id || null,
    }));
    setEditOrderItems(rows);
    setEditOrderType(o.order_type || 'dine_in');
    setEditTableNumber(o.table_number || '');
    setEditCustomerId(o.customer_id ? String(o.customer_id) : '');
    const sub = Number(o.subtotal) || 0;
    const discType = o.discount_type === 'percent' ? 'percent' : 'fixed';
    const discAmt = Number(o.discount_amount) || 0;
    const discVal = discType === 'percent' && sub > 0 ? String((discAmt / sub) * 100) : (discAmt ? String(discAmt) : '');
    setEditDiscountType(discType);
    setEditDiscountValue(discVal);
    const pm = o.payment_method === 'mixed' ? 'partial' : (o.payment_method === 'card' ? 'cash' : o.payment_method);
    setEditPaymentMethod(pm || 'cash');
    setEditAmountPaid(o.paid_amount != null ? String(o.paid_amount) : '');
    setEditNotes(o.notes || '');
    setEditAddItemSearch('');
  };

  const editUpdateQty = (index, delta) => {
    setEditOrderItems((prev) => {
      const row = prev[index];
      const newQty = Math.max(0, row.quantity + delta);
      if (newQty === 0) return prev.filter((_, i) => i !== index);
      return prev.map((r, i) =>
        i === index ? { ...r, quantity: newQty, total_price: newQty * r.unit_price } : r
      );
    });
  };

  const editRemoveItem = (index) => {
    setEditOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const editAddItem = (item) => {
    setEditOrderItems((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id && !c.variant_id);
      if (existing) {
        return prev.map((c) =>
          c === existing
            ? { ...c, quantity: c.quantity + 1, total_price: (c.quantity + 1) * c.unit_price }
            : c
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          item_name: item.name,
          unit_price: Number(item.sale_price),
          quantity: 1,
          total_price: Number(item.sale_price),
          variant_id: null,
        },
      ];
    });
  };

  const saveEditedOrder = async () => {
    if (!editOrderModal) return;
    if (editOrderItems.length === 0) {
      alert('Order must have at least one item.');
      return;
    }
    const sub = editOrderItems.reduce((s, r) => s + r.total_price, 0);
    let discountAmount = 0;
    if (editDiscountValue !== '') {
      const v = Number(editDiscountValue) || 0;
      discountAmount = editDiscountType === 'percent' ? (sub * v) / 100 : v;
    }
    const total = Math.max(0, sub - discountAmount);
    const paymentMethodDb =
      editPaymentMethod === 'partial'
        ? 'mixed'
        : ['jazzcash', 'easypaisa', 'other_bank'].includes(editPaymentMethod)
          ? 'card'
          : editPaymentMethod;
    let paymentStatus = 'paid';
    let paidAmountNow = total;
    if (editPaymentMethod === 'credit') {
      paymentStatus = 'pending';
      paidAmountNow = 0;
    } else if (editPaymentMethod === 'partial') {
      const paid = Number(editAmountPaid) || 0;
      if (paid <= 0 || paid > total) {
        alert('Enter amount paid (greater than 0 and up to total).');
        return;
      }
      paidAmountNow = paid;
      paymentStatus = paid >= total ? 'paid' : 'partial';
    }
    if ((editPaymentMethod === 'credit' || editPaymentMethod === 'partial') && !editCustomerId) {
      alert('Select a customer for credit or partial payment.');
      return;
    }
    const orderId = editOrderModal.id;
    const oldCustomerId = editOrderModal.customer_id ? String(editOrderModal.customer_id) : null;
    const newCustomerId = editCustomerId || null;
    const oldCredit =
      editOrderModal.payment_method === 'credit'
        ? Number(editOrderModal.total) || 0
        : editOrderModal.payment_method === 'mixed'
          ? (Number(editOrderModal.total) || 0) - (Number(editOrderModal.paid_amount) || 0)
          : 0;
    const newCredit =
      editPaymentMethod === 'credit'
        ? total
        : editPaymentMethod === 'partial'
          ? total - paidAmountNow
          : 0;
    const updateRes = await dbRun(
      `UPDATE orders SET order_type = ?, table_number = ?, customer_id = ?, subtotal = ?, discount_amount = ?, discount_type = ?, total = ?, payment_method = ?, payment_status = ?, paid_amount = ?, notes = ? WHERE id = ?`,
      [
        editOrderType,
        editTableNumber || null,
        newCustomerId,
        sub,
        discountAmount,
        editDiscountValue ? editDiscountType : null,
        total,
        paymentMethodDb,
        paymentStatus,
        paidAmountNow,
        editNotes || null,
        orderId,
      ]
    );
    if (updateRes?.error) {
      alert('Failed to update order: ' + updateRes.error);
      return;
    }
    await dbRun('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    for (const row of editOrderItems) {
      await dbRun(
        'INSERT INTO order_items (order_id, menu_item_id, variant_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, row.menu_item_id, row.variant_id, row.item_name, row.quantity, row.unit_price, row.total_price]
      );
    }
    if (oldCustomerId && oldCredit > 0) {
      await dbRun(
        'UPDATE credit_customers SET current_balance = current_balance - ?, updated_at = datetime("now") WHERE id = ?',
        [oldCredit, oldCustomerId]
      );
    }
    if (newCustomerId && newCredit > 0) {
      await dbRun(
        'UPDATE credit_customers SET current_balance = current_balance + ?, updated_at = datetime("now") WHERE id = ?',
        [newCredit, newCustomerId]
      );
    }
    await loadOrderHistory();
    setEditOrderModal(null);
    setEditOrderItems([]);
    setEditOrderType('dine_in');
    setEditTableNumber('');
    setEditCustomerId('');
    setEditDiscountValue('');
    setEditPaymentMethod('cash');
    setEditAmountPaid('');
    setEditNotes('');
  };

  useEffect(() => {
    if (viewHistory) loadOrderHistory();
  }, [viewHistory, historyDate, loadOrderHistory]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse mt-4" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Orders</h1>
        <button
          type="button"
          onClick={() => setViewHistory(!viewHistory)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
        >
          <Receipt className="w-4 h-4" />
          {viewHistory ? 'New Order' : 'Order History'}
        </button>
      </div>

      {viewHistory ? (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex gap-4 mb-4">
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm font-semibold text-slate-600">
                  <th className="py-2 px-3">Order #</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Total</th>
                  <th className="py-2 px-3">Payment</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orderHistory.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">{o.order_number}</td>
                    <td className="py-2 px-3 capitalize">{o.order_type?.replace('_', ' ')}</td>
                    <td className="py-2 px-3">Rs. {Number(o.total).toLocaleString()}</td>
                    <td className="py-2 px-3 capitalize">{o.payment_method}</td>
                    <td className="py-2 px-3">
                      <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', o.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                        {o.payment_status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-sm">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => showReceiptForOrder(o)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                          title="Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditOrderModal(o)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary-100 text-primary-700 text-xs font-medium hover:bg-primary-200"
                          title="Edit this order"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orderHistory.length === 0 && <p className="py-8 text-center text-slate-500">No orders for this date.</p>}
        </div>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left: Menu */}
          <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200 overflow-x-auto shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('general')}
                className={clsx(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px',
                  selectedCategory === 'general'
                    ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50'
                )}
              >
                General
              </button>
              {categories.filter((cat) => (cat.name || '').toLowerCase() !== 'general').map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={clsx(
                    'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px',
                    Number(selectedCategory) === Number(cat.id)
                      ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                      : 'border-transparent text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="shrink-0 px-4 py-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search menu..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filteredItems.map((item) => {
                  const nameLower = (item.name || '').trim().toLowerCase();
                  const stock = stockItems.find((s) => (s.name || '').trim().toLowerCase() === nameLower);
                  const stockInfo = getStockAvailable(item.name);
                  const minQty = Number(stock?.min_quantity) ?? 0;
                  const isLow = stockInfo && minQty > 0 && stockInfo.available <= minQty;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addToCart(item)}
                      className={clsx(
                        'p-4 rounded-lg border text-left transition-colors',
                        isLow ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400 hover:bg-amber-50' : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50/30'
                      )}
                    >
                      <p className="font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-sm text-primary-600 font-medium mt-0.5">Rs. {Number(item.sale_price).toLocaleString()}</p>
                      {stockInfo != null && (
                        <p className={clsx('text-xs mt-1', isLow ? 'text-amber-700 font-medium' : 'text-slate-500')}>
                          {stockInfo.available <= 0 ? 'Out of stock' : `${stockInfo.available} left`}
                          {isLow && stockInfo.available > 0 && ' · Low stock'}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              {filteredItems.length === 0 && <p className="text-center text-slate-500 py-8">No items in this category.</p>}
            </div>
          </div>

          {/* Right: Cart & Payment */}
          <div className="w-96 shrink-0 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="p-4 border-b border-slate-200 space-y-3 shrink-0">
                <div className="flex gap-2 flex-wrap">
                  {orderTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setOrderType(t.value)}
                      className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium', orderType === t.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {orderType === 'dine_in' && (
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Table #"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer phone *</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-500">Select customer</label>
                  <div className="flex gap-2">
                    <select
                      value={customerId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCustomerId(id);
                        const c = customers.find((x) => x.id === Number(id));
                        if (c) {
                          setCustomerName(c.name || '');
                          setCustomerPhone(c.phone || '');
                        } else {
                          setCustomerId('');
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Select customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''} (Rs. {Number(c.current_balance || 0).toLocaleString()})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(true)}
                      className="shrink-0 px-3 py-2 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

            <div className="flex-1 min-h-[180px] overflow-y-auto p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Cart ({cart.length})</h3>
              {cart.length === 0 ? (
                <p className="text-slate-500 text-sm">Cart is empty. Add items from the menu.</p>
              ) : (
                <ul className="space-y-2">
                  {cart.map((row, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{row.item_name}</p>
                        <p className="text-slate-500">Rs. {row.unit_price.toLocaleString()} × {row.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => updateQty(index, -1)} className="p-1 rounded bg-slate-100 hover:bg-slate-200">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-6 text-center font-medium">{row.quantity}</span>
                        <button type="button" onClick={() => updateQty(index, 1)} className="p-1 rounded bg-slate-100 hover:bg-slate-200">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => removeFromCart(index)} className="p-1 rounded text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="font-medium text-slate-800 w-20 text-right">Rs. {row.total_price.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 space-y-3 border-b border-slate-200 shrink-0">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded text-sm w-24"
                >
                  <option value="fixed">Rs.</option>
                  <option value="percent">%</option>
                </select>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Discount"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  min="0"
                  step={discountType === 'percent' ? '1' : '0.01'}
                />
              </div>
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Total</span>
                <span>Rs. {total.toLocaleString()}</span>
              </div>
              {paymentMethod === 'partial' && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount paid now (rest will be credit)</label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={`0 - ${total}`}
                    min="0"
                    max={total}
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  {amountPaid !== '' && Number(amountPaid) < total && (
                    <p className="text-xs text-slate-500 mt-1">Balance Rs. {(total - (Number(amountPaid) || 0)).toLocaleString()} will be added to credit.</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 space-y-3 shrink-0">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                <div className="flex gap-2 flex-wrap">
                  {paymentMethods.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPaymentMethod(p.value)}
                      className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium', paymentMethod === p.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={completeOrder}
                disabled={cart.length === 0}
                className="w-full py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Complete Order — Rs. {total.toLocaleString()}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Add customer</h2>
              <button type="button" onClick={() => { setShowAddCustomer(false); setNewCustomer({ name: '', phone: '' }); }} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-3">Customer will be saved and can be selected for credit orders.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Customer name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => { setShowAddCustomer(false); setNewCustomer({ name: '', phone: '' }); }} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={addNewCustomer} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500">
                Save & select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal — edit this order only */}
      {editOrderModal && (() => {
        const editSubtotal = editOrderItems.reduce((s, r) => s + r.total_price, 0);
        let editDiscountAmount = 0;
        if (editDiscountValue !== '') {
          const v = Number(editDiscountValue) || 0;
          editDiscountAmount = editDiscountType === 'percent' ? (editSubtotal * v) / 100 : v;
        }
        const editTotal = Math.max(0, editSubtotal - editDiscountAmount);
        const editAddItemFilter = editAddItemSearch.trim().toLowerCase();
        const editMenuItems = editAddItemFilter
          ? items.filter((i) => (i.name || '').toLowerCase().includes(editAddItemFilter))
          : items.slice(0, 20);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-semibold text-slate-800">Edit order</h2>
                <button type="button" onClick={() => { setEditOrderModal(null); setEditOrderItems([]); }} className="p-1 rounded hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Order #</span> {editOrderModal.order_number} · {new Date(editOrderModal.created_at).toLocaleString()}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {orderTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setEditOrderType(t.value)}
                      className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium', editOrderType === t.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {editOrderType === 'dine_in' && (
                  <input
                    type="text"
                    value={editTableNumber}
                    onChange={(e) => setEditTableNumber(e.target.value)}
                    placeholder="Table #"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer (required for credit/partial)</label>
                  <select
                    value={editCustomerId}
                    onChange={(e) => setEditCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">—</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Items</p>
                  <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {editOrderItems.map((row, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="flex-1 min-w-0 truncate text-slate-800">{row.item_name} × {row.quantity}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => editUpdateQty(i, -1)} className="p-1 rounded bg-slate-100 hover:bg-slate-200">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center font-medium">{row.quantity}</span>
                          <button type="button" onClick={() => editUpdateQty(i, 1)} className="p-1 rounded bg-slate-100 hover:bg-slate-200">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => editRemoveItem(i)} className="p-1 rounded text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="font-medium text-slate-800 w-16 text-right">Rs. {row.total_price.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <input
                      type="text"
                      value={editAddItemSearch}
                      onChange={(e) => setEditAddItemSearch(e.target.value)}
                      placeholder="Search & add item..."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm mb-1"
                    />
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {editMenuItems.slice(0, 12).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => editAddItem(item)}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                        >
                          {item.name} — Rs.{Number(item.sale_price).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={editDiscountType}
                    onChange={(e) => setEditDiscountType(e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded text-sm w-24"
                  >
                    <option value="fixed">Rs.</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    type="number"
                    value={editDiscountValue}
                    onChange={(e) => setEditDiscountValue(e.target.value)}
                    placeholder="Discount"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    min="0"
                    step={editDiscountType === 'percent' ? '1' : '0.01'}
                  />
                </div>
                <div className="text-sm space-y-0.5 pt-2 border-t border-slate-200">
                  <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>Rs. {editSubtotal.toLocaleString()}</span></div>
                  {editDiscountAmount > 0 && <div className="flex justify-between text-slate-600"><span>Discount</span><span>- Rs. {editDiscountAmount.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-semibold text-slate-800"><span>Total</span><span>Rs. {editTotal.toLocaleString()}</span></div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment</label>
                  <div className="flex gap-2 flex-wrap">
                    {paymentMethods.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setEditPaymentMethod(p.value)}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium', editPaymentMethod === p.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {editPaymentMethod === 'partial' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Amount paid now</label>
                    <input
                      type="number"
                      value={editAmountPaid}
                      onChange={(e) => setEditAmountPaid(e.target.value)}
                      placeholder={`0 - ${editTotal}`}
                      min="0"
                      max={editTotal}
                      step="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="p-4 border-t border-slate-200 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditOrderModal(null); setEditOrderItems([]); }}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditedOrder}
                  disabled={editOrderItems.length === 0}
                  className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save order
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col no-print">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
              <span className="font-semibold text-slate-800">Receipt</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptData(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 receipt-print-only" id="receipt-print">
              <div className="max-w-xs mx-auto text-center text-slate-800">
                <h2 className="text-lg font-bold border-b border-slate-300 pb-2 mb-2">
                  {receiptData.settings?.restaurant_name || 'Hadeez Restaurant'}
                </h2>
                {receiptData.settings?.restaurant_address && (
                  <p className="text-xs text-slate-600 mb-1">{receiptData.settings.restaurant_address}</p>
                )}
                {receiptData.settings?.restaurant_phone && (
                  <p className="text-xs text-slate-600 mb-3">{receiptData.settings.restaurant_phone}</p>
                )}
                {receiptData.settings?.receipt_header && (
                  <p className="text-xs text-slate-500 mb-3">{receiptData.settings.receipt_header}</p>
                )}
                <p className="text-sm font-semibold mt-3">Order # {receiptData.orderNumber}</p>
                <p className="text-xs text-slate-600">
                  {new Date(receiptData.date).toLocaleString()} · {receiptData.orderType?.replace('_', ' ')}
                  {receiptData.tableNumber && ` · Table ${receiptData.tableNumber}`}
                </p>
                {receiptData.customerName && (
                  <p className="text-xs text-slate-600 mt-1">Customer: {receiptData.customerName}</p>
                )}
                <div className="border-t border-b border-slate-300 my-4 py-3 text-left">
                  {receiptData.items.map((row, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span>
                        {row.item_name} × {row.quantity}
                      </span>
                      <span>{(receiptData.settings?.currency || 'Rs.')} {row.total_price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="text-left text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{(receiptData.settings?.currency || 'Rs.')} {receiptData.subtotal.toLocaleString()}</span>
                  </div>
                  {receiptData.discountAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount</span>
                      <span>- {(receiptData.settings?.currency || 'Rs.')} {receiptData.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-slate-300">
                    <span>Total</span>
                    <span>{(receiptData.settings?.currency || 'Rs.')} {receiptData.total.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Payment: {paymentMethods.find((p) => p.value === receiptData.paymentMethod)?.label || receiptData.paymentMethod}</p>
                  {receiptData.pendingAmount != null && receiptData.pendingAmount > 0 && (
                    <p className="text-sm font-semibold text-amber-700 mt-2">Pending amount: {(receiptData.settings?.currency || 'Rs.')} {Number(receiptData.pendingAmount).toLocaleString()}</p>
                  )}
                </div>
                {(receiptData.creditLimit != null && receiptData.creditLimit > 0) && (
                  <div className="text-left text-xs mt-3 pt-3 border-t border-slate-200 space-y-0.5">
                    <p className="text-slate-600">Credit limit: {(receiptData.settings?.currency || 'Rs.')} {Number(receiptData.creditLimit).toLocaleString()}</p>
                    {receiptData.balanceAfterOrder != null && (
                      <p className="text-slate-600">Balance after this order: {(receiptData.settings?.currency || 'Rs.')} {Number(receiptData.balanceAfterOrder).toLocaleString()}</p>
                    )}
                    {receiptData.creditLimitExceeded && (
                      <p className="font-medium text-amber-700">Credit limit exceeded</p>
                    )}
                  </div>
                )}
                {receiptData.notes && (
                  <p className="text-xs text-slate-500 mt-3 text-left">Note: {receiptData.notes}</p>
                )}
                {receiptData.settings?.receipt_footer && (
                  <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-200">{receiptData.settings.receipt_footer}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
