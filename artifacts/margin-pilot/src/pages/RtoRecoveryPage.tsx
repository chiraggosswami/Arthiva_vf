import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, RotateCcw, Warehouse } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { couriers, customers, pincodes, products, type Order } from '../data/seed';
import { evaluate } from '../engine';
import { rankRecoveryActions } from '../engine/recovery';
import { useAppState } from '../state/AppState';
import './recovery.css';

const routes: NonNullable<Order['inventoryRoute']>[] = ['Return to warehouse', 'Restock', 'Refurbish', 'Write off'];
const reasonNames: NonNullable<Order['ndrReason']>[] = ['Customer unreachable', 'Address incorrect', 'Refused / low intent', 'Rescheduled request', 'Delayed'];
const reasonColors = ['#287a65', '#d39a32', '#d97858', '#597e9a', '#9ba9a0'];
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function RtoRecoveryPage() {
  const { orders, currentSeller, engineConfig, updateOrder, allProducts, allPincodes, allCouriers, allCustomers } = useAppState();

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.sellerId === currentSeller.id);
  }, [orders, currentSeller.id]);

  const targetOrders = currentSeller.connectionMode === 'live_sync'
    ? activeOrders
    : (activeOrders.length > 0 ? activeOrders : orders);

  const candidates = useMemo(() => targetOrders
    .filter(order => order.status === 'NDR raised' || order.status === 'RTO initiated' || order.status === 'RTO' || Boolean(order.recoveryAction) || (order.status !== 'Delivered' && order.score < engineConfig.scoreThresholds.highRisk))
    .sort((a, b) => a.score - b.score), [targetOrders, engineConfig]);
  const [selectedId, setSelectedId] = useState('');
  const [route, setRoute] = useState<NonNullable<Order['inventoryRoute']>>('Restock');
  const [notice, setNotice] = useState('');
  const selected = candidates.find(order => order.id === selectedId) ?? candidates[0];
  const product = allProducts.find(item => item.id === selected?.productId || item.name === selected?.productId) ?? {
    id: selected?.productId || 'P_item',
    name: (selected as any)?.productName || 'Catalog Product',
    price: selected?.value || 1000,
    cogs: (selected as any)?.cogs ?? Math.max(100, Math.round((selected?.value || 1000) * 0.35)),
    damageRate: 0.02,
    sellerId: selected?.sellerId
  };
  const pin = allPincodes.find(item => item.code === selected?.pincode) ?? {
    code: selected?.pincode || '110001',
    city: (selected as any)?.city || 'Metro City',
    state: (selected as any)?.state || 'India',
    rtoRate: (selected as any)?.rtoRate ?? 0.18,
    success: 1 - ((selected as any)?.rtoRate ?? 0.18)
  };
  const courier = allCouriers.find(item => item.id === selected?.courierId) ?? allCouriers[0];
  const alternate = allCouriers.find(item => item.id !== courier.id && item.success > courier.success) ?? allCouriers.find(item => item.id !== courier.id) ?? courier;
  const customer = allCustomers.find(item => item.id === selected?.customerId) ?? {
    id: selected?.customerId || `C_${selected?.id}`,
    name: selected?.customerName || 'Customer',
    phone: selected?.customerPhone || '+91 9800000000',
    city: (selected as any)?.city || pin.city,
    orders: 1,
    rtos: 0,
    prepaid: selected?.payment === 'Prepaid' ? 1 : 0
  };
  const evaluation = selected ? evaluate(selected, product, pin, courier, customer, engineConfig) : null;
  const actions = selected && evaluation ? rankRecoveryActions(selected, evaluation.marginSuccess, courier.reverse, pin, courier, alternate) : [];
  const savedValue = targetOrders.reduce((sum, order) => sum + (Number(order.recoveredValue) || 0), 0);
  const leading = actions[0];
  const selectedAction = selected?.recoveryAction ? actions.find(action => action.name === selected.recoveryAction) : undefined;
  const reasonAnalysis = useMemo(() => {
    const rows = new Map(reasonNames.map(reason => [reason, { reason, count: 0, orderValue: 0 }]));
    candidates.forEach(order => {
      const reason = order.ndrReason ?? (order.status === 'RTO initiated' || order.status === 'RTO' ? 'Refused / low intent' : order.status === 'NDR raised' ? 'Customer unreachable' : order.addressComplete ? 'Delayed' : 'Address incorrect');
      const row = rows.get(reason);
      if (row) {
        row.count += 1;
        row.orderValue += order.value;
      }
    });
    return [...rows.values()].filter(row => row.count > 0).sort((a, b) => b.count - a.count);
  }, [candidates]);

  const saveChoice = (actionName: string) => {
    if (!selected) return;
    const action = actions.find(item => item.name === actionName);
    if (!action) return;
    updateOrder(selected.id, { recoveryAction: action.name, inventoryRoute: route, recoveredValue: Math.max(0, action.value) }, `Recovery selected · ${action.name} · ${route}`);
    setNotice(`${action.name} saved for ${selected.id}.`);
  };

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>RTO & RETURNS</span>
            <span>·</span>
            <span>VALUE RECOVERY DESK</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Recovery desk
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Choose the next recovery move by expected margin, then route inventory with purpose.
          </p>
        </div>

        <div className="recovered-total self-start sm:self-auto">
          <small className="text-[10px] text-[#2c7553] font-bold tracking-wider uppercase">RECOVERED VALUE · SAVED ORDERS</small>
          <b className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#1a624b] money">{money(savedValue)}</b>
          <span className="text-xs text-[#2c7553] flex items-center gap-1 font-semibold"><Check size={14}/> Persisted in workspace</span>
        </div>
      </div>

      {notice && (
        <div className="ops-notice" role="status">
          <Check size={16} />
          {notice}
          <button type="button" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {/* TOP BENTO STAT ROW (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all">
          <span className="text-xs font-semibold text-[#71827d]">Active Inbound Exceptions</span>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] mt-2 money">
            {candidates.length} orders
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">Requiring value optimization</small>
        </div>

        <div className="bg-[#f3f9f5] p-5 rounded-[20px] border border-[#d6ecde] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all">
          <span className="text-xs font-semibold text-[#276b53]">Average Salvage Rate</span>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#14533d] mt-2 money">
            {Math.round((savedValue / Math.max(1, candidates.reduce((s, o) => s + o.value, 0))) * 100)}%
          </b>
          <small className="text-xs text-[#527d6e] mt-1 block">Expected vs write-off loss</small>
        </div>

        <div className="bg-[#0e3b43] text-white p-5 rounded-[20px] border border-[#09292e] shadow-[0_4px_14px_rgba(14,59,67,0.18)] hover:shadow-[0_8px_24px_rgba(14,59,67,0.25)] transition-all">
          <span className="text-xs font-semibold text-[#a0c2bd]">Top Recovery Channel</span>
          <b className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] text-white mt-2">
            Reattempt via WhatsApp
          </b>
          <small className="text-xs text-[#a0c2bd] mt-1 block">72% historical conversion</small>
        </div>
      </div>

      {/* MAIN BENTO GRID (4 cols Queue + 8 cols Decision Matrix) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Bento 1: At-Risk Orders Queue (4 Cols) */}
        <section className="col-span-12 lg:col-span-4 bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#edf1ef]">
            <div>
              <span className="eyebrow text-[#7b8b87]">INBOUND QUEUE</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                At-Risk Orders
              </h2>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#fcf2dd] text-[#a76c05]">
              {candidates.length} CANDIDATES
            </span>
          </div>

          <p className="text-xs text-[#758480]">
            Ranked by expected recovery margin. Select an order to evaluate actions.
          </p>

          {candidates.length === 0 ? (
            <div className="ops-empty inline py-12 text-center">
              <RotateCcw size={24} className="mx-auto text-[#94a39e] mb-2" />
              <h3 className="font-bold text-sm text-[#1e4245]">Queue is clear</h3>
              <p className="text-xs text-[#71827e]">Orders in NDR or RTO will appear here automatically.</p>
            </div>
          ) : (
            <div className="recovery-order-list space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {candidates.map(order => {
                const prod = allProducts.find(item => item.id === order.productId || item.name === order.productId) ?? { name: (order as any).productName || 'Catalog Product' };
                const customerName = order.customerName || allCustomers.find(item => item.id === order.customerId)?.name || 'Customer';
                const selectedState = selected?.id === order.id;
                return (
                  <button
                    type="button"
                    className={`recovery-order w-full text-left p-3.5 rounded-xl border transition-all ${
                      selectedState
                        ? 'bg-[#f2f7f4] border-[#7cae97] shadow-xs'
                        : 'bg-[#fbfcfb] border-[#e7ece9] hover:bg-[#f6faf8]'
                    }`}
                    key={order.id}
                    onClick={() => { setSelectedId(order.id); setNotice(''); setRoute(order.inventoryRoute ?? 'Restock'); }}
                    aria-pressed={selectedState}
                    data-testid={`button-select-recovery-${order.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <b className="text-xs font-bold text-[#144f47]">{order.id}</b>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        order.status === 'NDR raised' ? 'bg-[#fcf2dd] text-[#a76c05]' : 'bg-[#faece9] text-[#b65b4c]'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#1f3c38] mt-1">{customerName}</div>
                    <div className="flex items-center justify-between text-xs text-[#71827e] mt-1 pt-1.5 border-t border-[#edf1ef]">
                      <span>{prod.name} · PIN {order.pincode}</span>
                      <b className="text-[#0e3b43] money">{money(order.recoveredValue ?? order.value)}</b>
                    </div>
                    {order.recoveryAction && (
                      <div className="mt-1 text-[11px] text-[#1f8a5b] font-semibold flex items-center gap-1">
                        <Check size={12} /> {order.recoveryAction} · {order.inventoryRoute}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Bento 2: Order Economics, Decision Table & Routing (8 Cols) */}
        {selected && evaluation ? (
          <section className="col-span-12 lg:col-span-8 space-y-5">
            {/* Economic Snapshot Card */}
            <div className="bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="eyebrow text-[#7b8b87]">ORDER ECONOMICS</div>
                  <h2 className="text-xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                    {selected.id} <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-[#f0f4f1] text-[#61746f] align-middle ml-2">{selected.status}</span>
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#798a85] block">DELIVERY MARGIN</span>
                  <b className="text-xl font-bold text-[#1b6651] money">{money(evaluation.marginSuccess)}</b>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#f8faf9] border border-[#edf1ef] mt-4 text-xs">
                <div>
                  <small className="text-[10px] text-[#81908c] uppercase font-bold tracking-wider block">CUSTOMER</small>
                  <b className="text-[#1f3c38] font-bold block mt-0.5">{selected.customerName || customer.name}</b>
                </div>
                <div>
                  <small className="text-[10px] text-[#81908c] uppercase font-bold tracking-wider block">PINCODE · COURIER</small>
                  <b className="text-[#1f3c38] font-bold block mt-0.5">{pin.city} ({pin.code}) · {courier.name}</b>
                </div>
                <div>
                  <small className="text-[10px] text-[#81908c] uppercase font-bold tracking-wider block">REVERSE COST BASELINE</small>
                  <b className="text-[#b43e32] font-bold money block mt-0.5">{money(courier.reverse)}</b>
                </div>
              </div>

              {selected.ndrReason && (
                <div className="reason-analysis mt-3 p-3.5 rounded-xl bg-[#fcf4e5] border border-[#f3e5c0] flex gap-3 text-xs">
                  <span className="reason-mark w-6 h-6 rounded-full bg-[#f4e5c4] text-[#9a6e1b] font-bold flex items-center justify-center shrink-0">!</span>
                  <div>
                    <b className="text-[#6d5527] font-bold block">{selected.ndrReason}</b>
                    <p className="text-[#7e6d4c] mt-0.5 leading-relaxed">
                      {selected.ndrReason === 'Customer unreachable' ? 'Confirm a delivery window before paying for another attempt.' :
                       selected.ndrReason === 'Address incorrect' ? 'Resolve the address detail before routing a new shipment.' :
                       selected.ndrReason === 'Refused / low intent' ? 'Confirm purchase intent or reduce collection friction before dispatch.' :
                       selected.ndrReason === 'Delayed' ? 'Reassure the customer and protect the original delivery opportunity.' :
                       'A confirmed window can improve the odds of a successful reattempt.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Ranked Actions Decision Card */}
            <div className="bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#edf1ef]">
                <div>
                  <div className="eyebrow text-[#7b8b87]">RECOVERY DECISION</div>
                  <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                    Ranked Recovery Actions
                  </h2>
                </div>
                <span className="text-xs text-[#71827e]">Expected margin basis</span>
              </div>

              <div className="space-y-2 mt-3">
                {actions.map((action, index) => {
                  const isLead = index === 0;
                  const isChosen = selected.recoveryAction === action.name;
                  return (
                    <div
                      key={action.name}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isChosen
                          ? 'bg-[#eaf5ef] border-[#89c8a7]'
                          : isLead
                          ? 'bg-[#f7faf8] border-[#cce1d6]'
                          : 'bg-white border-[#e6ede9]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isLead ? 'bg-[#1f8a5b] text-white' : 'bg-[#eef2f0] text-[#697d77]'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <b className="text-xs text-[#0e3b43] font-bold">{action.name}</b>
                            {isLead && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1f8a5b] text-white">
                                OPTIMAL
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#71827e] mt-0.5 line-clamp-2">{action.reason}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-[#526a63]">
                            <div className="w-20 h-1.5 bg-[#e1eae5] rounded-full overflow-hidden">
                              <div className="h-full bg-[#1f8a5b] rounded-full" style={{ width: `${action.probability * 100}%` }} />
                            </div>
                            <span className="font-semibold">{Math.round(action.probability * 100)}% success</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#edf1ef]">
                        <div className="text-right">
                          <b className="text-sm font-bold text-[#1f8a5b] money block">{money(action.value)}</b>
                          <small className="text-[11px] text-[#71827e] block">
                            vs rev {action.versusReverse >= 0 ? '+' : '−'}{money(Math.abs(action.versusReverse))}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            isChosen
                              ? 'bg-[#1f8a5b] text-white border-[#1f8a5b]'
                              : 'bg-white text-[#1f8a5b] border-[#1f8a5b] hover:bg-[#eaf5ef]'
                          }`}
                          onClick={() => saveChoice(action.name)}
                          data-testid={`button-recovery-${action.name.toLowerCase().replaceAll(' ', '-')}`}
                        >
                          {isChosen ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {leading && (
                <div className="why-wins mt-4 p-3.5 rounded-xl bg-[#eef6f1] border border-[#d6ecde] text-xs text-[#2c7553] flex items-start gap-2.5">
                  <ArrowUpRight size={16} className="shrink-0 mt-0.5" />
                  <p className="m-0 leading-relaxed text-[#35614d]">
                    <b>Why {leading.name} leads:</b> {leading.reason} At {Math.round(leading.probability * 100)}% estimated success probability, its expected value is {money(leading.value)} after {money(leading.cost)} intervention cost, beating the {money(courier.reverse)} reverse-cost baseline.
                  </p>
                </div>
              )}
            </div>

            {/* Inventory Routing Card */}
            <div className="bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="eyebrow text-[#7b8b87]">INVENTORY ROUTING</div>
                  <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                    Parcel Disposition Route
                  </h2>
                </div>
                <Warehouse size={18} className="text-[#7b8b87]" />
              </div>
              <p className="text-xs text-[#71827e] mb-3">
                Assign disposition path for returned units to maximize warehouse turnover.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {routes.map(option => (
                  <label
                    key={option}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      route === option
                        ? 'bg-[#eaf5ef] border-[#1f8a5b]'
                        : 'bg-[#fafcfb] border-[#e1e8e4] hover:border-[#b8cfc5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="inventory-route"
                        value={option}
                        checked={route === option}
                        onChange={() => setRoute(option)}
                        className="accent-[#1f8a5b]"
                        data-testid={`radio-route-${option.toLowerCase().replaceAll(' ', '-')}`}
                      />
                      <b className="text-xs text-[#0e3b43]">{option}</b>
                    </div>
                    <small className="text-[11px] text-[#71827e] leading-snug">
                      {option === 'Return to warehouse' ? 'Send to closest hub' :
                       option === 'Restock' ? 'Return to sellable stock' :
                       option === 'Refurbish' ? 'Inspect and repackage' :
                       'Liquidate uneconomic units'}
                    </small>
                  </label>
                ))}
              </div>

              <div className="route-save-line mt-4 pt-3 border-t border-[#edf1ef] flex items-center justify-between text-xs text-[#72827e]">
                <span>
                  {selectedAction ? (
                    <span className="flex items-center gap-1.5 text-[#1f8a5b] font-semibold">
                      <Check size={14} /> Active recovery: {selectedAction.name} · {selected.inventoryRoute || route}
                    </span>
                  ) : (
                    'Select an action above to commit the recovery plan.'
                  )}
                </span>
                {selected.recoveryAction && selectedAction && (
                  <b className="text-[#1f8a5b] font-bold text-sm money">
                    {money(selected.recoveredValue ?? selectedAction.value)} saved value
                  </b>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="col-span-12 lg:col-span-8 bg-white p-12 rounded-[20px] border border-[#e1e8e4] text-center">
            <RotateCcw size={32} className="mx-auto text-[#94a39e] mb-2" />
            <h2 className="font-bold text-base text-[#1b3e41]">No order selected</h2>
            <p className="text-xs text-[#71827e]">Select any order from the queue to view margin-ranked recovery actions.</p>
          </div>
        )}

        {/* Bento: Delivery Exception Mix & Reason Analysis Card (12 Cols) */}
        <section className="col-span-12 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between pb-3 border-b border-[#edf1ef]">
            <div>
              <span className="eyebrow text-[#7b8b87]">DELIVERY EXCEPTION MIX</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                Return Reason Analysis
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#5a706b]">
              {candidates.length} at-risk / returned orders
            </span>
          </div>
          {reasonAnalysis.length ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mt-4">
              <div className="col-span-12 md:col-span-4 h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reasonAnalysis} dataKey="count" nameKey="reason" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                      {reasonAnalysis.map(row => (
                        <Cell key={row.reason} fill={reasonColors[reasonNames.indexOf(row.reason)]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <b className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">{candidates.length}</b>
                  <span className="text-[10px] text-[#788884] uppercase font-bold tracking-wider">orders</span>
                </div>
              </div>
              <div className="col-span-12 md:col-span-8 space-y-2">
                <div className="grid grid-cols-3 text-[11px] font-bold text-[#7a8b86] pb-1 border-b border-[#edf1ef] uppercase tracking-wider">
                  <span>REASON</span>
                  <span className="text-center">ORDERS</span>
                  <span className="text-right">ORDER VALUE</span>
                </div>
                {reasonAnalysis.map(row => (
                  <div className="grid grid-cols-3 items-center py-2 text-xs border-b border-[#f3f7f5]" key={row.reason}>
                    <span className="flex items-center gap-2 font-medium text-[#2d4b47]">
                      <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: reasonColors[reasonNames.indexOf(row.reason)] }} />
                      {row.reason}
                    </span>
                    <b className="text-center text-[#183e3b]">{row.count}</b>
                    <b className="money text-right text-[#0e3b43] font-bold">{money(row.orderValue)}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#82928c]">
              Reason patterns appear once orders enter the recovery queue.
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
