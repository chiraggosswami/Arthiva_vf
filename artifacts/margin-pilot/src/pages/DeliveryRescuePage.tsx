import { useMemo, useState } from 'react';
import { ArrowRight, Check, Clock3, MessageCircle, PackageCheck, Send, Truck } from 'lucide-react';
import { customers, couriers, pincodes, products, type Order } from '../data/seed';
import { evaluate } from '../engine';
import { recommendNdrRescue, type NdrReason } from '../engine/recovery';
import { useAppState } from '../state/AppState';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { DynamicVernacularTranslator } from '../components/DynamicVernacularTranslator';

const reasons: NdrReason[] = ['Customer unreachable', 'Address incorrect', 'Refused / low intent', 'Rescheduled request', 'Delayed'];
const stages = ['In transit', 'Delayed', 'NDR raised', 'Rescue sent', 'Delivered', 'RTO'];
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function orderStage(order: Order) {
  if (order.status === 'Delivered') return 'Delivered';
  if (order.status === 'RTO initiated' || order.status === 'RTO') return 'RTO';
  if (order.rescueAction) return 'Rescue sent';
  if (order.status === 'NDR raised') return order.ndrReason === 'Delayed' ? 'Delayed' : 'NDR raised';
  if (order.status === 'Delayed' || order.ndrReason === 'Delayed') return 'Delayed';
  if (order.status === 'In transit' && Number(order.id.slice(-4)) % 4 === 0) return 'Delayed';
  return 'In transit';
}

export default function DeliveryRescuePage() {
  const { orders, currentSeller, engineConfig, updateOrder, allProducts, allPincodes, allCouriers, allCustomers } = useAppState();
  const [selectedId, setSelectedId] = useState('');
  const [draftReason, setDraftReason] = useState<Record<string, NdrReason>>({});
  const [channel, setChannel] = useState<'WhatsApp' | 'SMS'>('WhatsApp');
  const { toast } = useToast();
  const [notice, setNotice] = useState('');
  const [customRescueMessage, setCustomRescueMessage] = useState<Record<string, string>>({});

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.sellerId === currentSeller.id);
  }, [orders, currentSeller.id]);

  const targetOrders = currentSeller.connectionMode === 'live_sync'
    ? activeOrders
    : (activeOrders.length > 0 ? activeOrders : orders);

  const grouped = useMemo(() => {
    const result: Record<string, Order[]> = Object.fromEntries(stages.map(stage => [stage, []]));
    targetOrders.forEach(order => result[orderStage(order)].push(order));
    return result;
  }, [targetOrders]);

  const selected = targetOrders.find(order => order.id === selectedId) ?? targetOrders.find(order => grouped['NDR raised'].includes(order)) ?? targetOrders[0];
  const product = allProducts.find(item => item.id === selected?.productId || item.name === selected?.productId) ?? {
    id: selected?.productId || 'P_item',
    name: (selected as any)?.productName || 'Catalog Product',
    price: selected?.value || 1000,
    cogs: (selected as any)?.cogs ?? Math.max(100, Math.round((selected?.value || 1000) * 0.35)),
    damageRate: 0.02,
    sellerId: selected?.sellerId
  };
  const customer = allCustomers.find(item => item.id === selected?.customerId) ?? {
    id: selected?.customerId || `C_${selected?.id}`,
    name: selected?.customerName || 'Customer',
    phone: selected?.customerPhone || '+91 9800000000',
    city: (selected as any)?.city || 'Metro City',
    orders: 1,
    rtos: 0,
    prepaid: selected?.payment === 'Prepaid' ? 1 : 0
  };
  const courier = allCouriers.find(item => item.id === selected?.courierId) ?? allCouriers[0];
  const pin = allPincodes.find(item => item.code === selected?.pincode) ?? {
    code: selected?.pincode || '110001',
    city: (selected as any)?.city || 'Metro City',
    state: (selected as any)?.state || 'India',
    rtoRate: (selected as any)?.rtoRate ?? 0.18,
    success: 1 - ((selected as any)?.rtoRate ?? 0.18)
  };
  const expectedMargin = selected ? evaluate(selected, product, pin, courier, customer, engineConfig).best.ev : 0;
  const reason = selected ? draftReason[selected.id] ?? selected.ndrReason ?? 'Customer unreachable' : 'Customer unreachable';
  const recommendation = selected ? recommendNdrRescue(reason, selected.customerName || customer?.name || 'there', expectedMargin) : null;
  const shipmentClosed = selected ? selected.status === 'Delivered' || selected.status === 'RTO initiated' || selected.status === 'RTO' : false;

  const runRescue = () => {
    if (!selected || !recommendation) return;
    const activeMsg = customRescueMessage[selected.id] || recommendation.message;
    updateOrder(selected.id, {
      status: 'Rescue sent',
      ndrReason: reason,
      rescueAction: recommendation.action,
      rescueMessage: activeMsg,
    }, `Rescue sent · ${recommendation.action}`);
    setNotice(`Rescue recorded for ${selected.id}.`);
    toast({
      title: "Rescue Simulated",
      description: `${recommendation.action} recorded on order ${selected.id}.`,
    });
  };

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>DELIVERY EXCEPTIONS</span>
            <span>·</span>
            <span>MARGIN-FIRST RESCUE</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Delivery rescue
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Turn delivery exceptions into successful reattempts with personalized WhatsApp & SMS rescue triggers.
          </p>
        </div>
        <span className="ops-heading-chip self-start sm:self-auto">
          <Truck size={14} />
          {orders.filter(o => !['Delivered', 'RTO initiated', 'RTO'].includes(o.status)).length} open shipments
        </span>
      </div>

      {/* TOP BENTO STAT ROW (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] hover:border-[#9bbcaf] transition-all">
          <div className="text-xs font-semibold text-[#71827d]">Needs Attention</div>
          <b className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] text-[#9e3a2f] mt-2 money">
            {grouped['NDR raised'].length + grouped.Delayed.length}
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">NDR raised + courier delays</small>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] hover:border-[#9bbcaf] transition-all">
          <div className="text-xs font-semibold text-[#71827d]">Rescue Dispatched</div>
          <b className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] text-[#1b655f] mt-2 money">
            {grouped['Rescue sent'].length}
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">Active interventions pending</small>
        </div>

        <div className="bg-[#f3f9f5] p-5 rounded-[20px] border border-[#d6ecde] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all">
          <div className="text-xs font-semibold text-[#276b53]">Delivered Successfully</div>
          <b className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] text-[#14533d] mt-2 money">
            {grouped.Delivered.length}
          </b>
          <small className="text-xs text-[#527d6e] mt-1 block">Exceptions converted</small>
        </div>

        <div className="bg-[#0e3b43] text-white p-5 rounded-[20px] border border-[#09292e] shadow-[0_4px_14px_rgba(14,59,67,0.18)] hover:shadow-[0_8px_24px_rgba(14,59,67,0.25)] transition-all">
          <div className="text-xs font-semibold text-[#a0c2bd]">Protected Margin Pool</div>
          <b className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] text-white mt-2 money">
            {money(grouped['Rescue sent'].reduce((s, o) => s + (o.recoveredValue || o.value * 0.4), 0) + grouped.Delivered.reduce((s, o) => s + o.value * 0.35, 0))}
          </b>
          <small className="text-xs text-[#a0c2bd] mt-1 block">Saved vs baseline write-off</small>
        </div>
      </div>

      {notice && (
        <div className="ops-notice" role="status">
          <Check size={16} />
          {notice}
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss confirmation">
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN BENTO GRID (8 cols + 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Bento 1: 6-Stage Pipeline Board (8 Cols) */}
        <section className="col-span-12 lg:col-span-8 bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]" aria-label="Delivery rescue stages">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#edf1ef]">
            <div>
              <span className="eyebrow text-[#7b8b87]">PIPELINE LANES</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                Shipment Status Board
              </h2>
            </div>
            <span className="text-xs text-[#73837f]">Click any card to inspect or trigger rescue</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto pb-2">
            {stages.map((stage, index) => (
              <div className={`rescue-lane lane-${index} flex flex-col justify-between`} key={stage}>
                <div>
                  <div className="lane-head">
                    <span><i />{stage}</span>
                    <b>{grouped[stage].length}</b>
                  </div>
                  <div className="lane-cards mt-1">
                    {grouped[stage].slice(0, 10).map(order => {
                      const person = allCustomers.find(c => c.id === order.customerId) || { name: order.customerName || 'Customer' };
                      const item = allProducts.find(p => p.id === order.productId) || { name: (order as any).productName || 'Catalog Product' };
                      const isSel = selected?.id === order.id;
                      return (
                        <motion.button
                          layoutId={order.id}
                          type="button"
                          className={`rescue-card ${isSel ? 'selected' : ''}`}
                          key={order.id}
                          onClick={() => { setSelectedId(order.id); setNotice(''); }}
                          aria-pressed={isSel}
                          data-testid={`card-rescue-order-${order.id}`}
                        >
                          <span className="rescue-card-top">
                            <b>{order.id}</b>
                            <span>{order.payment}</span>
                          </span>
                          <strong>{order.customerName || person?.name || 'Customer'}</strong>
                          <small>{item?.name ?? 'Order'} · {pin.code === order.pincode ? pin.city : pincodes.find(p => p.code === order.pincode)?.city}</small>
                          <span className="rescue-card-bottom">
                            <span>{order.ndrReason || (stage === 'Delayed' ? 'Delay' : stage === 'NDR raised' ? 'Needs action' : courier.name)}</span>
                            <b className="money">{money(order.value)}</b>
                          </span>
                        </motion.button>
                      );
                    })}
                    {grouped[stage].length === 0 && (
                      <div className="lane-empty">Clear</div>
                    )}
                  </div>
                </div>
                {grouped[stage].length > 10 && (
                  <small className="lane-overflow text-[10px] mt-2 block">
                    +{grouped[stage].length - 10} more
                  </small>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Bento 2: Selected Shipment & Automated Rescue Action Panel (4 Cols) */}
        {selected && recommendation ? (
          <aside className="col-span-12 lg:col-span-4 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="eyebrow text-[#7b8b87]">SELECTED SHIPMENT</div>
                <h2 className="text-xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight">
                  {selected.id}
                </h2>
              </div>
              <span className="risk-pill mid text-xs">
                <i />{orderStage(selected)}
              </span>
            </div>

            <p className="text-xs text-[#71827e] bg-[#f8faf9] p-2.5 rounded-xl border border-[#edf1ef]">
              <b>{selected.customerName || customer?.name}</b> · {customer?.phone || selected.customerPhone || 'Contact not on profile'}
            </p>

            <div className="rescue-facts grid grid-cols-2 gap-3 py-3 border-y border-[#edf1ef]">
              <div>
                <small className="text-[10px] text-[#81908c] uppercase font-bold tracking-wider block">ORDER VALUE</small>
                <b className="text-base text-[#1b4e4a] money font-bold">{money(selected.value)}</b>
              </div>
              <div>
                <small className="text-[10px] text-[#81908c] uppercase font-bold tracking-wider block">EXPECTED MARGIN</small>
                <b className="text-base text-[#1f8a5b] money font-bold">{money(expectedMargin)}</b>
              </div>
            </div>

            <label className="field-label block">
              <span className="text-xs font-semibold text-[#48615b] block mb-1.5">Delivery exception reason</span>
              <select
                value={reason}
                onChange={e => setDraftReason(current => ({ ...current, [selected.id]: e.target.value as NdrReason }))}
                data-testid="select-rescue-reason"
                className="w-full bg-[#fcfdfc] border border-[#dce5e0] rounded-lg p-2 text-xs"
              >
                {reasons.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>

            {/* AI Recommendation callout */}
            <div className="recommendation-callout p-3.5 rounded-xl bg-[#fdfaf2] border border-[#f3e5c0] flex gap-3">
              <div className="ops-icon w-8 h-8 rounded-lg bg-[#fceec9] text-[#9b6807] flex items-center justify-center shrink-0">
                <MessageCircle size={16} />
              </div>
              <div>
                <small className="text-[10px] font-bold text-[#98711e] uppercase tracking-wider block">
                  RECOMMENDED ACTION
                </small>
                <b className="text-xs font-bold text-[#354841] block mt-0.5">{recommendation.action}</b>
                <p className="text-xs text-[#707c76] mt-1 leading-relaxed">
                  {recommendation.includesGoodwill
                    ? 'Goodwill is included because this order retains positive margin after the offer.'
                    : 'A focused intervention protects margin without adding unnecessary discount.'}
                </p>
              </div>
            </div>

            {/* Message Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <b className="text-xs text-[#2b4b47]">Message preview</b>
                <div className="channel-switch inline-flex p-1 rounded-lg bg-[#edf2ef]" role="group">
                  {(['WhatsApp', 'SMS'] as const).map(option => (
                    <button
                      type="button"
                      key={option}
                      className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
                        channel === option ? 'bg-white text-[#0e3b43] shadow-xs' : 'text-[#74857f]'
                      }`}
                      onClick={() => setChannel(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="message-preview p-3 rounded-xl bg-[#f8faf9] border border-[#e4ece8] text-xs">
                <span className="text-[10px] font-bold tracking-wider text-[#798a84] block mb-1">
                  {channel === 'WhatsApp' ? 'WHATSAPP' : 'SMS'} · TO {customer?.phone || selected.customerPhone || 'CUSTOMER'}
                </span>
                <p className="text-xs text-[#3d534c] leading-relaxed whitespace-pre-wrap">
                  {customRescueMessage[selected.id] || recommendation.message}
                </p>
                {customRescueMessage[selected.id] && (
                  <span className="inline-block mt-2 text-[10px] bg-[#d5ede1] text-[#14533d] px-2 py-0.5 rounded font-bold">
                    Vernacular translated message active
                  </span>
                )}
              </div>
            </div>

            {/* Dynamic Vernacular Translation Assistant */}
            <DynamicVernacularTranslator
              key={selected.id}
              initialText={recommendation.message}
              context={`Customer delivery exception WhatsApp rescue communication for order ${selected.id} (Reason: ${reason})`}
              onApplyTranslation={(txt) => {
                setCustomRescueMessage(prev => ({ ...prev, [selected.id]: txt }));
                toast({
                  title: "Vernacular Message Applied",
                  description: `Updated rescue draft for order ${selected.id}.`,
                });
              }}
            />

            <button
              type="button"
              className="button button-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2"
              onClick={runRescue}
              disabled={Boolean(selected.rescueAction) || shipmentClosed}
              data-testid="button-send-rescue"
            >
              <Send size={15} />
              {selected.rescueAction ? 'Rescue already recorded' : shipmentClosed ? 'Shipment is closed' : 'Run simulated rescue'}
            </button>

            {selected.rescueAction && (
              <p className="ops-saved-note text-xs text-[#1f8a5b] flex items-center gap-1.5 font-semibold">
                <Check size={14} /> {selected.rescueAction} · saved to timeline
              </p>
            )}

            <div className="timeline rescue-timeline pt-3 border-t border-[#edf1ef]">
              {selected.timeline.slice(-3).reverse().map((event, i) => (
                <div className="timeline-item" key={`${event.label}-${i}`}>
                  <i />
                  <span>
                    <b>{event.label}</b>
                    <small>{event.at}</small>
                  </span>
                </div>
              ))}
            </div>
          </aside>
        ) : (
          <aside className="col-span-12 lg:col-span-4 bg-white p-8 rounded-[20px] border border-[#e1e8e4] text-center">
            <PackageCheck size={28} className="mx-auto text-[#94a39e] mb-2" />
            <h2 className="font-bold text-base text-[#1b3e41]">No orders selected</h2>
            <p className="text-xs text-[#73847f]">Select any order card from the lanes to inspect its delivery rescue flow.</p>
          </aside>
        )}

      </div>

      <div className="ops-footnote text-xs text-[#74857f] flex items-center gap-2 pt-2">
        <Clock3 size={15} /> Stages are derived from saved order statuses and rescue history. Choose any card to inspect its next action.
      </div>
    </div>
  );
}
