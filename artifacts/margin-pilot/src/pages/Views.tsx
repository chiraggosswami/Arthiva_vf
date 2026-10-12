import { useState, useEffect, useMemo, type ReactNode, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { motion, useAnimation, useInView } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, Filter, MapPin, Search, ShieldCheck, Sparkles, Truck, Wallet, AlertTriangle, TrendingDown, TrendingUp, BarChart3, Layers, Activity, PackageCheck, Plus, Upload, Building2, Copy, Wifi, Send, Zap } from 'lucide-react';
import { couriers, customers, pincodes, products, type Order, type Product, type Pin, type Courier, type Customer } from '../data/seed';
import { DEFAULT_ENGINE_CONFIG, evaluate, type EngineConfig } from '../engine';
import { useAppState } from '../state/AppState';
import { useListListingAlerts } from '@workspace/api-client-react';
import { AddSellerCsvDialog } from '../components/AddSellerCsvDialog';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const lookupOrderDetails = (
  o: Order,
  productsList: Product[] = products,
  pinsList: Pin[] = pincodes,
  couriersList: Courier[] = couriers,
  custsList: Customer[] = customers
) => {
  const foundP = productsList.find(x => x.id === o.productId || x.name === o.productId);
  const p: Product = foundP || {
    id: o.productId || `P_${o.id}`,
    name: (o as any).productName || o.productId || 'Catalog Product',
    price: o.value || 1000,
    cogs: (o as any).cogs ?? Math.max(100, Math.round((o.value || 1000) * 0.35)),
    damageRate: 0.02,
    sellerId: o.sellerId
  };

  const foundPin = pinsList.find(x => x.code === o.pincode);
  const pin: Pin = foundPin || {
    code: o.pincode || '110001',
    city: (o as any).city || 'Metro City',
    state: (o as any).state || 'India',
    rtoRate: (o as any).rtoRate ?? 0.18,
    success: 1 - ((o as any).rtoRate ?? 0.18)
  };

  const foundCourier = couriersList.find(x => x.id === o.courierId);
  const courier: Courier = foundCourier || couriersList[0] || {
    id: 'delhivery',
    name: 'Delhivery',
    success: 0.88,
    forward: 82,
    reverse: 96
  };

  const foundCust = custsList.find(x => x.id === o.customerId);
  const customer: Customer = {
    id: o.customerId || `C_${o.id}`,
    name: o.customerName || foundCust?.name || 'Customer',
    phone: o.customerPhone || foundCust?.phone || '+91 9800000000',
    city: (o as any).city || pin.city || 'Metro City',
    orders: (o as any).customerOrders ?? foundCust?.orders ?? 1,
    rtos: (o as any).customerRtos ?? foundCust?.rtos ?? 0,
    prepaid: o.payment === 'Prepaid' ? 1 : 0
  };

  return { p, pin, courier, customer };
};

const lookup = (o: Order, pList?: Product[], pinList?: Pin[], cList?: Courier[], custList?: Customer[]) =>
  lookupOrderDetails(o, pList, pinList, cList, custList);

const valueFor = (o: Order, config: EngineConfig = DEFAULT_ENGINE_CONFIG, pList?: Product[], pinList?: Pin[], cList?: Courier[], custList?: Customer[]) => {
  const x = lookup(o, pList, pinList, cList, custList);
  return evaluate(o, x.p, x.pin, x.courier, x.customer, config);
};
function AnimatedValue({value, prefix = '', suffix = ''}: {value: number, prefix?: string, suffix?: string}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = display;
    const dur = 1000;
    const startTime = performance.now();
    let frameId: number;
    const update = (t: number) => {
      const p = Math.min((t - startTime) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (value - start) * ease);
      if (p < 1) frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [value]);
  return <>{prefix}{display.toLocaleString('en-IN', {maximumFractionDigits: suffix==='%'?1:0})}{suffix}</>;
}
function Heading({eyebrow,title,sub,action}:{eyebrow:string;title:string;sub:string;action?:ReactNode}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{sub}</p></div>{action}</div>}
function Stat({label,value,change,meta,tone='teal', rawValue, prefix, suffix}:{label:string;value:string;change?:ReactNode;meta:string;tone?:string;rawValue?:number;prefix?:string;suffix?:string}){return <div className={`stat stat-${tone}`}><div className="stat-top">{label}<span>{change}</span></div><strong className="money">{rawValue !== undefined ? <AnimatedValue value={rawValue} prefix={prefix} suffix={suffix}/> : value}</strong><small>{meta}</small></div>}
function RiskPill({score}:{score:number}){const {engineConfig}=useAppState();const {highRisk,watch}=engineConfig.scoreThresholds;const tone=score>=watch?'low':score>=highRisk?'mid':'high';return <span className={`risk-pill ${tone}`}><i/>{score} · {tone==='low'?'Healthy':tone==='mid'?'Watch':'High risk'}</span>}
function AnimatedScoreRing({score}:{score:number}) {
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    let start = displayScore;
    const dur = 800;
    const startTime = performance.now();
    let frameId: number;
    const update = (t: number) => {
      const p = Math.min((t - startTime) / dur, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(start + (score - start) * ease));
      if (p < 1) frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [score]);
  return <span className="score-ring" style={{'--score': `${displayScore * 3.6}deg`, transition: '--score 0.8s cubic-bezier(0.215, 0.61, 0.355, 1)'} as any}><b>{displayScore}</b><small>/100</small></span>;
}
function MarginWaterfall({order}:{order:Order}){
  const {engineConfig, allProducts, allPincodes, allCouriers, allCustomers}=useAppState();
  const {p,courier}=lookup(order, allProducts, allPincodes, allCouriers, allCustomers);
  const ev=valueFor(order,engineConfig, allProducts, allPincodes, allCouriers, allCustomers);
  const items=[['Order value',order.value],['Product cost',-p.cogs*order.qty],['Shipping',-courier.forward],['Fulfilment & fees',-63],['Expected RTO drag',-Math.round(ev.pRto*ev.rtoLoss)],['Expected margin',ev.best.ev]];
  return <motion.div className="waterfall" initial="hidden" animate="visible" variants={{visible: {transition: {staggerChildren: 0.1}}}}>{items.map(([label,num],i)=><motion.div variants={{hidden: {opacity: 0, x: -10}, visible: {opacity: 1, x: 0}}} className={`wf-item ${i===items.length-1?'wf-total':''}`} key={label as string}><span>{label}</span><b className="money">{Number(num)<0?'−':''}{inr(Math.abs(Number(num)))}</b></motion.div>)}</motion.div>;
}

export function Dashboard(){
 const { toast } = useToast();
 const [period, setPeriod] = useState<'7d' | '14d' | '30d'>('30d');
 const [addCsvOpen, setAddCsvOpen] = useState(false);
 const { orders, sellerOrders, currentSeller, engineConfig, allProducts, allPincodes, allCouriers, allCustomers, liveConnectionState, sendSimulatedOrder } = useAppState();
 const [isSimulating, setIsSimulating] = useState(false);
 const [copiedId, setCopiedId] = useState(false);

 const handleCopySellerId = () => {
   navigator.clipboard.writeText(currentSeller.id);
   setCopiedId(true);
   toast({ title: 'Seller ID Copied', description: `${currentSeller.id} copied to clipboard.` });
   setTimeout(() => setCopiedId(false), 2000);
 };

 const handleTriggerSimulation = async () => {
   setIsSimulating(true);
   try {
     const res = await sendSimulatedOrder();
     toast({
       title: 'Simulated Order Received!',
       description: `Ingested order ${res.orderId} into ${currentSeller.name} via real-time stream.`,
     });
   } catch (err: any) {
     toast({
       title: 'Simulation Error',
       description: err.message || 'Could not send test order to Firestore.',
       variant: 'destructive',
     });
   } finally {
     setIsSimulating(false);
   }
 };
 
 const activeOrders = useMemo(() => {
   return orders.filter(o => o.sellerId === currentSeller.id);
 }, [orders, currentSeller.id]);

 const data = useMemo(() => activeOrders.map(o => ({
   o,
   e: valueFor(o, engineConfig, allProducts, allPincodes, allCouriers, allCustomers)
 })), [activeOrders, engineConfig, allProducts, allPincodes, allCouriers, allCustomers]);

 const realized = useMemo(() => activeOrders.filter(o => o.status === 'Delivered').reduce((s, o) => s + o.value, 0), [activeOrders]);
 const exp = useMemo(() => data.reduce((s, x) => s + x.e.best.ev, 0), [data]);
 const avgRto = useMemo(() => data.length > 0 ? data.reduce((s, x) => s + x.e.pRto, 0) / data.length : 0, [data]);
 const marginSavedByMP = useMemo(() => data.reduce((s, x) => {
   const fullCodEv = x.e.journeys.find((j: any) => j.name === 'Full COD')?.ev || x.e.best.ev;
   const added = x.e.best.ev - fullCodEv;
   return s + Math.max(0, added) + (x.o.recoveredValue || 0);
 }, 0), [data]);

 const daysCount = period === '7d' ? 7 : period === '14d' ? 14 : 30;
 const trend = useMemo(() => Array.from({ length: daysCount }, (_, i) => ({
   day: daysCount === 7 ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7] : (i % (daysCount === 14 ? 3 : 5) === 0 ? 'Jun ' + (i + 1) : String(i + 1)),
   rto: Math.round(17 + Math.sin(i * 0.54) * 5 + (i % 7) * 0.55),
   saved: Math.round(22 + Math.cos(i * 0.35) * 8)
 })), [daysCount]);

 const campaignSources = useMemo(() => {
   const set = Array.from(new Set(activeOrders.map(o => o.campaign).filter(Boolean)));
   return set.length > 0 ? set : ['Instagram', 'Meta prospecting', 'Google Search', 'Direct'];
 }, [activeOrders]);

 const channel = useMemo(() => campaignSources.map(c => ({
   name: c,
   margin: Math.round(data.filter(x => x.o.campaign === c).reduce((s, x) => s + x.e.best.ev, 0) / Math.max(1, data.filter(x => x.o.campaign === c).length))
 })), [campaignSources, data]);

 const risk = useMemo(() => data.slice().sort((a, b) => a.e.score - b.e.score).slice(0, 4), [data]);

 const pins = useMemo(() => {
   const activePincodes = new Set(activeOrders.map(o => o.pincode));
   const matched = allPincodes.filter(p => activePincodes.has(p.code));
   const sourceList = matched.length > 0 ? matched : allPincodes;
   return [...sourceList].sort((a, b) => b.rtoRate - a.rtoRate).slice(0, 5);
 }, [activeOrders, allPincodes]);

 const { data: listingAlertsData } = useListListingAlerts();
 const listingAlerts = useMemo(() => (Array.isArray(listingAlertsData) ? listingAlertsData : []).slice(0, 4), [listingAlertsData]);

 return (
  <div className="page-enter space-y-5">
    {/* Page Header */}
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
      <div>
        <div className="eyebrow flex items-center gap-2">
          <span>INDIA OPERATIONS</span>
          <span aria-hidden="true">·</span>
          <span>{currentSeller.name.toUpperCase()} WORKSPACE</span>
        </div>
        <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
          Command centre
        </h1>
        <p className="text-xs text-[#70817d] mt-1">
          A clearer view of the expected margin and automated interventions behind every order for {currentSeller.name}.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setAddCsvOpen(true)}
          className="px-3 py-1.5 text-xs font-bold bg-[#0e3b43] text-white hover:bg-[#134954] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Upload size={13} />
          <span>Import CSV</span>
        </button>

        <div className="inline-flex items-center bg-[#edf2ef] p-1 rounded-lg border border-[#e1e8e4]">
          {(['7d', '14d', '30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                toast({ title: 'Period Updated', description: `Showing operations metrics for past ${p.toUpperCase()}` });
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                period === p ? 'bg-white text-[#0e3b43] shadow-xs' : 'text-[#6e7f79] hover:text-[#0e3b43]'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          className="button button-soft text-xs"
          onClick={() => {
            localStorage.removeItem('arthiva-state');
            localStorage.removeItem('margin-pilot-state');
            localStorage.removeItem('margin-pilot-rules');
            toast({ title: 'Data Reset', description: 'Resetting local storage and reloading...', duration: 2000 });
            setTimeout(() => window.location.reload(), 500);
          }}
        >
          Reset Data
        </button>
      </div>
    </div>

    {/* Live Sync Connection Banner if seller is in live_sync mode */}
    {currentSeller.connectionMode === 'live_sync' && (
      <div className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${
        liveConnectionState.status === 'connected'
          ? 'bg-[#f0f9f4] border-[#b8dec9]'
          : liveConnectionState.status === 'error'
          ? 'bg-[#fdf2f2] border-[#f5c6c6]'
          : 'bg-[#f8faf9] border-[#d8e5df]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
            liveConnectionState.status === 'connected'
              ? 'bg-[#1f8a5b] text-white shadow-xs'
              : liveConnectionState.status === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-[#eaf4ef] text-[#0e3b43]'
          }`}>
            {liveConnectionState.status === 'connected' ? <CheckCircle2 size={18} /> : <Wifi size={18} className="animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#0e3b43]">
                {liveConnectionState.status === 'connected'
                  ? 'Real-Time Cloud Firestore Stream Active'
                  : liveConnectionState.status === 'error'
                  ? 'Firestore Connection Notice'
                  : 'Live Data Seller Mode · Listening for Payloads'}
              </h3>
              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase ${
                liveConnectionState.status === 'connected'
                  ? 'bg-[#d8f0e2] text-[#156b46]'
                  : liveConnectionState.status === 'error'
                  ? 'bg-[#fcdada] text-red-700'
                  : 'bg-[#fcf2dd] text-[#9b6807]'
              }`}>
                {liveConnectionState.status === 'connected' ? 'Connected' : liveConnectionState.status === 'error' ? 'Error' : 'Awaiting Payload'}
              </span>
            </div>
            <p className="text-[11px] text-[#6d7e79] mt-0.5">
              Seller ID: <code className="font-mono font-bold text-[#0e3b43] bg-white/70 px-1.5 py-0.5 rounded border border-[#d2ded8]">{currentSeller.id}</code>
              {liveConnectionState.events && liveConnectionState.events.length > 0 && ` · ${liveConnectionState.events.length} audit events logged`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySellerId}
            className="px-3 py-1.5 rounded-lg border border-[#d2ded8] bg-white text-xs font-semibold text-[#0e3b43] hover:bg-[#edf5f1] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {copiedId ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedId ? 'Copied' : 'Copy Seller ID'}</span>
          </button>
          <button
            type="button"
            disabled={isSimulating}
            onClick={handleTriggerSimulation}
            className="px-3 py-1.5 rounded-lg bg-[#0e3b43] text-white text-xs font-bold hover:bg-[#134954] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Send size={12} className={isSimulating ? 'animate-spin' : ''} />
            <span>{isSimulating ? 'Simulating...' : 'Send Test Order'}</span>
          </button>
        </div>
      </div>
    )}

    {/* Empty State when live seller has 0 orders received yet */}
    {currentSeller.connectionMode === 'live_sync' && activeOrders.length === 0 && (
      <div className="bg-white border border-[#e1e8e4] rounded-[20px] p-8 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-[#eaf4ef] text-[#0e3b43] mx-auto flex items-center justify-center font-bold">
          <Wifi size={24} className="animate-pulse" />
        </div>
        <div className="max-w-md mx-auto">
          <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
            Awaiting Live Order Feed for {currentSeller.name}
          </h2>
          <p className="text-xs text-[#6e7f79] mt-1 leading-relaxed">
            No orders have arrived in Firestore collection <code className="bg-[#f0f4f2] px-1 py-0.5 rounded text-[#0e3b43]">sellers/{currentSeller.id}/orders</code> yet. Start the Replit seller simulator or click below to trigger a live test order.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={isSimulating}
            onClick={handleTriggerSimulation}
            className="px-5 py-2.5 rounded-xl bg-[#0e3b43] text-white text-xs font-bold hover:bg-[#134954] shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Send size={13} className={isSimulating ? 'animate-spin' : ''} />
            <span>Trigger Simulated Order to Firestore</span>
          </button>
          <button
            type="button"
            onClick={handleCopySellerId}
            className="px-4 py-2.5 rounded-xl border border-[#d2ded8] bg-white text-xs font-semibold text-[#0e3b43] hover:bg-[#f6faf8] flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Copy size={13} />
            <span>{copiedId ? 'Copied' : 'Copy Seller ID'}</span>
          </button>
        </div>
      </div>
    )}

    {/* BENTO GRID MATRIX */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-5">
      
      {/* 1. Realised Revenue */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] hover:border-[#9bbcaf] transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[#667a75] text-xs font-semibold">
            <span>Realised revenue</span>
            <span className="p-1 rounded-md bg-[#eaf5ef] text-[#1f8a5b]">
              <ArrowUpRight size={14} />
            </span>
          </div>
          <div className="mt-3">
            <strong className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] tracking-tight text-[#0e3b43] money">
              <AnimatedValue value={realized} prefix="₹" />
            </strong>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#edf1ef] flex items-center justify-between text-[11px] text-[#82918e]">
          <span>Delivered orders</span>
          <span className="text-[#1f8a5b] font-semibold flex items-center gap-0.5">
            +12.4% <ArrowUpRight size={12} />
          </span>
        </div>
      </div>

      {/* 2. Expected Margin */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#f3f9f5] p-5 rounded-[20px] border border-[#d6ecde] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] hover:border-[#9bbcaf] transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[#2e6d56] text-xs font-semibold">
            <span>Expected margin</span>
            <span className="p-1 rounded-md bg-[#e1f3e9] text-[#1c7851]">
              <Sparkles size={14} />
            </span>
          </div>
          <div className="mt-3">
            <strong className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] tracking-tight text-[#14533d] money">
              <AnimatedValue value={exp} prefix="₹" />
            </strong>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#d8ece0] flex items-center justify-between text-[11px] text-[#558273]">
          <span>After risk & interventions</span>
          <span className="font-bold text-[#1a7853]">+8.4%</span>
        </div>
      </div>

      {/* 3. RTO Exposure */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#fcf9f2] p-5 rounded-[20px] border border-[#f5e7c8] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] hover:border-[#dfc38a] transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[#855e1a] text-xs font-semibold">
            <span>RTO exposure</span>
            <span className="p-1 rounded-md bg-[#fcf2dd] text-[#9b6807]">
              <TrendingDown size={14} />
            </span>
          </div>
          <div className="mt-3">
            <strong className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] tracking-tight text-[#754a02] money">
              <AnimatedValue value={avgRto * 100} suffix="%" />
            </strong>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#f4e5c0] flex items-center justify-between text-[11px] text-[#8c6d32]">
          <span>Portfolio open orders</span>
          <span className="text-[#1f8a5b] font-semibold flex items-center gap-0.5">
            <ArrowDownRight size={12} /> Trending down
          </span>
        </div>
      </div>

      {/* 4. Margin Saved Hero Card */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#0e3b43] text-white p-5 rounded-[20px] border border-[#09292e] shadow-[0_4px_14px_rgba(14,59,67,0.18)] hover:shadow-[0_8px_24px_rgba(14,59,67,0.25)] hover:border-[#22636a] transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[#a0c2bd] text-xs font-semibold">
            <span>Margin saved by MP</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#f5a524] text-[#0e3b43]">
              LIVE
            </span>
          </div>
          <div className="mt-3">
            <strong className="block text-2xl lg:text-3xl font-bold font-['Bricolage_Grotesque'] tracking-tight text-white money">
              <AnimatedValue value={activeOrders.length === 0 ? 0 : marginSavedByMP} prefix="₹" />
            </strong>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#1d4d54] flex items-center justify-between text-[11px] text-[#96b8b2]">
          <span>vs full COD baseline</span>
          <span className="text-[#4ee29d] font-bold flex items-center gap-0.5">
            <ArrowUpRight size={12} /> +₹{activeOrders.length === 0 ? 0 : Math.round(marginSavedByMP / Math.max(1, activeOrders.length))}/order
          </span>
        </div>
      </div>

      {/* 5. DELIVERY HEALTH & RTO TRAJECTORY CHART (Wide 12 Columns) */}
      <div className="col-span-12 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.07)] hover:border-[#9bbcaf] transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <div className="eyebrow text-[#7b8b87]">DELIVERY HEALTH · TRAJECTORY</div>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight">
                RTO rate vs. margin protected
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-[#778782]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0e3b43] inline-block" />
                RTO rate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f5a524] inline-block" />
                Margin saved
              </span>
            </div>
          </div>

          <div className="h-[210px] w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="bentoRtoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e3b43" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#0e3b43" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bentoSavedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5a524" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#f5a524" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e8eeeb" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#82908e' }} interval={daysCount === 7 ? 0 : 3} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#82908e' }} unit="%" />
                <Tooltip />
                <Area type="monotone" dataKey="rto" stroke="#0e3b43" strokeWidth={2.5} fill="url(#bentoRtoFill)" />
                <Area type="monotone" dataKey="saved" stroke="#f5a524" strokeWidth={2} fill="url(#bentoSavedFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pt-3 border-t border-[#edf1ef] mt-3 flex flex-wrap items-center justify-between text-xs text-[#82918d]">
          <span className="flex items-center gap-2">
            <span>Period window: <b>{period.toUpperCase()}</b></span>
            <span>·</span>
            <span>Avg RTO: <b>{(avgRto * 100).toFixed(1)}%</b></span>
          </span>
          <span className="text-[#1f8a5b] font-bold flex items-center gap-1">
            RTO trending down <ArrowDownRight size={14} />
          </span>
        </div>
      </div>

      {/* 10. HIGH RISK INTERVENTION QUEUE (7 Columns) */}
      <div className="col-span-12 lg:col-span-7 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.07)] hover:border-[#9bbcaf] transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="eyebrow text-[#7b8b87]">INTERVENTION QUEUE</div>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight">
                High-risk orders requiring intervention
              </h2>
            </div>
            <Link href="/orders" className="text-xs font-semibold text-[#1b655f] hover:underline flex items-center gap-1">
              All orders ({activeOrders.length}) <ArrowRight size={13} />
            </Link>
          </div>

          <div className="space-y-2 mt-3">
            {risk.map(({ o, e }) => (
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f6faf8] border border-transparent hover:border-[#e1ece6] transition-all text-inherit"
                key={o.id}
              >
                <div className="w-8 h-8 rounded-lg bg-[#fcf1e0] text-[#bb8016] flex items-center justify-center shrink-0">
                  <CircleAlert size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-[#0e3b43] truncate">
                    {o.id} <span className="font-medium text-[#61716d] text-[11px]">· {lookup(o).customer.name}</span>
                  </div>
                  <div className="text-[10px] text-[#84918e] truncate mt-0.5">
                    {lookup(o).p.name} · PIN {o.pincode} · {o.payment}
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <RiskPill score={e.score} />
                    <div className="text-[10px] font-bold text-[#14533d] money mt-0.5">
                      {inr(e.best.ev)} EV
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-[#a1b0ab]" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-[#edf1ef] mt-3 flex items-center justify-between text-xs text-[#82918d]">
          <span>Auto-action candidate recommendations active</span>
          <Link href="/orders" className="text-[#1a625b] hover:underline font-semibold flex items-center gap-1">
            Dispatch queue <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* 11. TODAY'S MARGIN MOVES / LIVE DECISIONS (5 Columns) */}
      <div className="col-span-12 lg:col-span-5 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.07)] hover:border-[#9bbcaf] transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="eyebrow text-[#7b8b87]">DECISION ENGINE</div>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight">
                Today's margin moves
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#eaf5ef] text-[#1e755c]">
              {activeOrders.filter((o) => o.status !== 'Delivered').length} OPEN
            </span>
          </div>

          <div className="space-y-2 mt-3">
            {risk.slice(0, 3).map(({ o, e }, i) => (
              <Link
                href={`/orders/${o.id}`}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#f7f9f8] hover:bg-[#edf4f1] border border-[#edf1ef] hover:border-[#d2e4dc] transition-all text-inherit"
                key={o.id}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    i === 0 ? 'bg-[#eaf5ef] text-[#1f8a5b]' : i === 1 ? 'bg-[#fcf2dd] text-[#a76c05]' : 'bg-[#e9f0f4] text-[#4c7273]'
                  }`}
                >
                  {i === 0 ? <ShieldCheck size={14} /> : <Clock3 size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-[#0e3b43]">{e.best.name}</div>
                  <div className="text-[10px] text-[#7c8b87] line-clamp-2 mt-0.5 leading-relaxed">
                    {o.id} · {e.explanation}
                  </div>
                </div>
                <strong className="text-xs font-bold text-[#1b5a55] money shrink-0 mt-0.5">
                  {inr(e.best.ev)}
                </strong>
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-[#edf1ef] mt-3 flex items-center justify-end">
          <Link href="/orders" className="text-xs font-bold text-[#1b655f] hover:underline flex items-center gap-1.5">
            Review all live decisions <ArrowRight size={13} />
          </Link>
        </div>
      </div>

    </div>

    {/* CSV Upload & Import Modal for Dashboard */}
    <AddSellerCsvDialog open={addCsvOpen} onOpenChange={setAddCsvOpen} initialStep={2} />
  </div>
 );
}

export function OrdersPage() {
  const { orders, engineConfig, currentSeller } = useAppState();
  const [q, setQ] = useState('');
  const [payment, setPayment] = useState('All payment');
  const [risk, setRisk] = useState('All risk');
  const [source, setSource] = useState('All sources');
  const [courier, setCourier] = useState('All couriers');
  const [brandOnly, setBrandOnly] = useState(true);
  const [addCsvOpen, setAddCsvOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const baseOrders = useMemo(() => {
    if (!brandOnly) return orders;
    return orders.filter(o => o.sellerId === currentSeller.id);
  }, [orders, brandOnly, currentSeller.id]);

  const filtered = useMemo(() => {
    return baseOrders.filter(o => {
      const name = lookup(o).customer.name;
      const score = valueFor(o, engineConfig).score;
      const textMatch = (`${o.id} ${name} ${o.pincode} ${lookup(o).p.name}`).toLowerCase().includes(q.toLowerCase());
      const payMatch = payment === 'All payment' || o.payment === payment;
      const riskMatch = risk === 'All risk' || (
        risk === 'High risk' ? score < engineConfig.scoreThresholds.highRisk :
        risk === 'Watch' ? score >= engineConfig.scoreThresholds.highRisk && score < engineConfig.scoreThresholds.watch :
        score >= engineConfig.scoreThresholds.watch
      );
      const sourceMatch = source === 'All sources' || o.campaign === source;
      const courierMatch = courier === 'All couriers' || lookup(o).courier.name === courier;
      return textMatch && payMatch && riskMatch && sourceMatch && courierMatch;
    });
  }, [baseOrders, engineConfig, q, payment, risk, source, courier]);

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [q, payment, risk, source, courier, brandOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const startIndex = (validPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, validPage, pageSize]);

  // Summary Metrics
  const healthyCount = useMemo(() => baseOrders.filter(o => valueFor(o, engineConfig).score >= engineConfig.scoreThresholds.watch).length, [baseOrders, engineConfig]);
  const watchCount = useMemo(() => baseOrders.filter(o => {
    const s = valueFor(o, engineConfig).score;
    return s >= engineConfig.scoreThresholds.highRisk && s < engineConfig.scoreThresholds.watch;
  }).length, [baseOrders, engineConfig]);
  const highRiskCount = useMemo(() => baseOrders.filter(o => valueFor(o, engineConfig).score < engineConfig.scoreThresholds.highRisk).length, [baseOrders, engineConfig]);
  const totalMargin = useMemo(() => filtered.reduce((s, o) => s + valueFor(o, engineConfig).best.ev, 0), [filtered, engineConfig]);

  return (
    <div className="page-enter space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>ORDER DISPATCH OPERATIONS</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Orders
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Scored in real time for health, expected value, and profit-protecting journey rules.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAddCsvOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-[#edf5f1] text-[#0e3b43] border border-[#d2ded8] hover:bg-[#e4efe9] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Upload size={13} />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setBrandOnly(!brandOnly)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
              brandOnly
                ? 'bg-[#0e3b43] text-white border-[#0e3b43]'
                : 'bg-white text-[#556965] border-[#d8e2dd] hover:border-[#9bbcaf]'
            }`}
          >
            {brandOnly ? `Showing: ${currentSeller.name}` : 'All Multi-Tenant Orders'}
          </button>
          <Link href="/checkout" className="button button-primary text-xs font-bold">
            ＋ New order
          </Link>
        </div>
      </div>

      {/* BENTO GRID MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-5">
        
        {/* Bento 1: Filters & Search Command Card (8 Cols) */}
        <div className="col-span-12 lg:col-span-8 bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow text-[#7b8b87]">SEARCH & FILTERS</span>
              <span className="text-xs font-bold text-[#1f8a5b]">
                {filtered.length} matched of {baseOrders.length} orders
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <label className="search-box bg-[#f8faf9] border border-[#e2eae6] rounded-xl px-3 py-2 flex items-center gap-2 flex-1">
                <Search size={16} className="text-[#80908b]" />
                <input
                  aria-label="Search orders"
                  data-testid="input-search-orders"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search order ID, customer name, product, or pincode..."
                  className="bg-transparent border-0 outline-none text-xs w-full text-[#143d41]"
                />
              </label>

              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="text-xs text-[#70817d] hover:text-[#0e3b43] px-2"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Filter Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {[
                [payment, setPayment, ['All payment', 'COD', 'Partial COD', 'Prepaid']],
                [risk, setRisk, ['All risk', 'High risk', 'Watch', 'Healthy']],
                [source, setSource, ['All sources', 'Instagram', 'Meta prospecting', 'Google Search', 'Direct', 'Email']],
                [courier, setCourier, ['All couriers', ...couriers.map(c => c.name)]]
              ].map(([val, set, options]: any, i) => (
                <select
                  key={i}
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="bg-[#fcfdfc] border border-[#e1e8e4] rounded-lg px-2.5 py-1.5 text-xs text-[#415954] font-medium"
                >
                  {options.map((x: string) => <option key={x}>{x}</option>)}
                </select>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#edf1ef] mt-4 flex items-center justify-between text-xs text-[#7f8e8a]">
            <span>Active sort: <b>Newest created first</b></span>
            {(payment !== 'All payment' || risk !== 'All risk' || source !== 'All sources' || courier !== 'All couriers') && (
              <button
                type="button"
                onClick={() => { setPayment('All payment'); setRisk('All risk'); setSource('All sources'); setCourier('All couriers'); }}
                className="text-[#1a655f] font-bold hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Bento 2: Health Breakdown Card (4 Cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow text-[#7b8b87]">PORTFOLIO HEALTH</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#eaf5ef] text-[#1c7553]">
                AI SCORED
              </span>
            </div>
            
            <div className="mt-2 space-y-2.5">
              <div
                onClick={() => setRisk(risk === 'Healthy' ? 'All risk' : 'Healthy')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  risk === 'Healthy' ? 'bg-[#eaf5ef] border-[#a1d4b8]' : 'bg-[#fafcfb] border-[#edf2ef] hover:border-[#cbdcd3]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1f8a5b]" />
                  <span className="text-xs font-bold text-[#1a5542]">Healthy (&ge;{engineConfig.scoreThresholds.watch})</span>
                </div>
                <b className="text-xs text-[#1f8a5b] font-bold">{healthyCount} ({Math.round(healthyCount / Math.max(1, baseOrders.length) * 100)}%)</b>
              </div>

              <div
                onClick={() => setRisk(risk === 'Watch' ? 'All risk' : 'Watch')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  risk === 'Watch' ? 'bg-[#fcf3e0] border-[#ecd39e]' : 'bg-[#fdfbf7] border-[#f4eee2] hover:border-[#ecd39e]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f5a524]" />
                  <span className="text-xs font-bold text-[#8f6412]">Watch List</span>
                </div>
                <b className="text-xs text-[#9b6807] font-bold">{watchCount} ({Math.round(watchCount / Math.max(1, baseOrders.length) * 100)}%)</b>
              </div>

              <div
                onClick={() => setRisk(risk === 'High risk' ? 'All risk' : 'High risk')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  risk === 'High risk' ? 'bg-[#fceeed] border-[#f1b9b4]' : 'bg-[#fdfaf9] border-[#f6ece9] hover:border-[#f1b9b4]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#bd4136]" />
                  <span className="text-xs font-bold text-[#963026]">High Risk (&lt;{engineConfig.scoreThresholds.highRisk})</span>
                </div>
                <b className="text-xs text-[#b83f33] font-bold">{highRiskCount} ({Math.round(highRiskCount / Math.max(1, baseOrders.length) * 100)}%)</b>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#edf1ef] mt-3 flex items-center justify-between text-xs">
            <span className="text-[#7e8d89]">Expected Margin Pool</span>
            <b className="text-[#0e3b43] font-bold money">{inr(totalMargin)}</b>
          </div>
        </div>

        {/* Bento 3: Full Orders Table (12 Cols) */}
        <div className="col-span-12 bg-white rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 pb-3 border-b border-[#edf1ef] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                  Active Order Manifest
                </h2>
                <span className="text-xs text-[#6e7f7a]">
                  Showing {filtered.length === 0 ? 0 : (validPage - 1) * pageSize + 1}–{Math.min(filtered.length, validPage * pageSize)} of {filtered.length} orders (10 per page)
                </span>
              </div>
              <span className="text-xs font-semibold text-[#1a655f] px-2.5 py-1 rounded-md bg-[#eaf4ef]">
                Page {validPage} of {totalPages}
              </span>
            </div>

            <div className="table-wrap border-0 rounded-none">
              <table>
                <thead>
                  <tr>
                    <th>ORDER / CUSTOMER</th>
                    <th>HEALTH SCORE</th>
                    <th>PAYMENT · CHANNEL</th>
                    <th>ASSIGNED JOURNEY</th>
                    <th>STATUS</th>
                    <th className="right">EXPECTED MARGIN</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map(o => {
                    const ev = valueFor(o, engineConfig);
                    const { customer, p, courier } = lookup(o);
                    return (
                      <tr key={o.id}>
                        <td>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link className="order-title font-bold text-[#145158] hover:underline" href={`/orders/${o.id}`}>
                              {o.id} <ArrowUpRight size={13} />
                            </Link>
                            {o.isSimulated && (
                              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-[#f0f4f2] text-[#44635e] border border-[#d2ded8]">
                                Simulated
                              </span>
                            )}
                          </div>
                          <span className="table-sub text-xs text-[#7e8e89] mt-0.5">
                            {customer.name} · {p.name}
                          </span>
                        </td>
                        <td>
                          <RiskPill score={ev.score} />
                        </td>
                        <td>
                          <b className="text-xs text-[#1e3c38]">{o.payment}</b>
                          <span className="table-sub text-[11px] text-[#7e8e89]">{o.campaign}</span>
                        </td>
                        <td>
                          <span className="journey-name text-xs font-semibold text-[#18534d]">{o.journey}</span>
                          <span className="table-sub text-[11px] text-[#7e8e89]">{courier.name}</span>
                        </td>
                        <td>
                          <span className={`status ${o.status === 'Delivered' ? 'done' : o.status.includes('RTO') ? 'bad' : o.status === 'NDR raised' ? 'warn' : ''}`}>
                            <i />{o.status}
                          </span>
                        </td>
                        <td className="right money expected font-bold text-xs">
                          {inr(ev.best.ev)}
                          <span className="table-sub text-[10px] text-[#2d7658] font-medium">{ev.best.name}</span>
                        </td>
                        <td>
                          <Link href={`/orders/${o.id}`} className="row-arrow hover:text-[#0e3b43]" aria-label={`Open ${o.id}`}>
                            <ArrowRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="empty-state py-12">
                  <Search size={28} className="mx-auto text-[#a0ada8] mb-2" />
                  <h3 className="font-bold text-base text-[#1b3e41]">No matching orders</h3>
                  <p className="text-xs text-[#72827e]">Try relaxing your search terms or clearing filters.</p>
                  <button
                    type="button"
                    className="button button-soft text-xs mt-3"
                    onClick={() => { setQ(''); setPayment('All payment'); setRisk('All risk'); setSource('All sources'); setCourier('All couriers'); }}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pagination Navigation Bar */}
          {filtered.length > 0 && (
            <div className="p-4 border-t border-[#edf1ef] bg-[#fbfdfc] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#6e7f7a]">
                Showing page <b>{validPage}</b> of <b>{totalPages}</b>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={validPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-[#dce5e1] text-xs font-semibold text-[#415954] hover:bg-[#edf4f0] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                {/* Page Number Buttons: 1, 2, 3, 4 ... */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                      validPage === pageNum
                        ? 'bg-[#0e3b43] text-white shadow-sm'
                        : 'border border-[#dce5e1] text-[#36514c] hover:bg-[#edf4f0] bg-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={validPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#dce5e1] text-xs font-bold text-[#0e3b43] hover:bg-[#edf4f0] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all ml-1 shadow-sm bg-white"
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ArrowRight size={14} className="text-[#0e3b43]" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* CSV Import Modal for Orders Page */}
      <AddSellerCsvDialog open={addCsvOpen} onOpenChange={setAddCsvOpen} initialStep={2} />
    </div>
  );
}

export function OrderDetail(){
 const {id=''}=useParams();const {orders,event,engineConfig,allProducts,allPincodes,allCouriers,allCustomers}=useAppState();const order=orders.find(x=>x.id===id);
 if(!order)return <div className="empty-state detail-missing"><h2>Order not found</h2><Link href="/orders" className="button button-primary">Back to orders</Link></div>;
 const {customer,p,pin,courier}=lookup(order, allProducts, allPincodes, allCouriers, allCustomers),ev=valueFor(order,engineConfig, allProducts, allPincodes, allCouriers, allCustomers);
 const actions=['Address verified','OTP passed','Advance paid','Delivery attempted','NDR raised','RTO initiated'];
 return <div className="page-enter"><div className="detail-back"><Link href="/orders">← Orders</Link><span>/</span>{order.id}</div><Heading eyebrow={`ORDER · ${order.created}`} title={order.id} sub={`${customer.name} · ${p.name} × ${order.qty}`} action={<RiskPill score={ev.score}/>}/>
 <div className="detail-grid"><div className="detail-main">
  <section className="panel health-panel"><div className="panel-head"><div><div className="eyebrow">LIVE ORDER HEALTH</div><h2>Why this order scores {ev.score}</h2></div><AnimatedScoreRing score={ev.score} /></div><div className="factor-grid">{ev.factors.map(f=><div className="factor" key={f.name}><div><b>{f.name}</b><span>{f.points} / {f.name==='Customer history'?20:f.name==='Pincode RTO'?15:f.name==='Campaign source'?10:f.name==='Courier / pincode success'?10:f.name==='Value vs margin'?5:20}</span></div><p>{f.reason}</p><div className="factor-track"><i style={{width:`${Math.min(100,f.points/(f.name==='Value vs margin'?5:f.name==='Campaign source'||f.name==='Courier / pincode success'?10:f.name==='Pincode RTO'?15:20)*100)}%`}}/></div></div>)}</div><div className="risk-formula"><span>Estimated RTO probability</span><b>{(ev.pRto*100).toFixed(1)}%</b><small>p = 0.02 + (100 − score) × 0.55</small></div></section>
  <section className="panel"><div className="panel-head"><div><div className="eyebrow">EXPECTED VALUE</div><h2>Pick the journey that pays</h2></div><span className="recommended"><Sparkles size={13}/> RECOMMENDED</span></div><p className="section-intro">{ev.explanation}</p><div className="journey-chart">{ev.journeys.map(j=><div className={`journey-bar-row ${j.name===ev.best.name?'best':''}`} key={j.name}><span>{j.name}{j.name===ev.best.name&&<small>Best expected value</small>}</span><div className="bar-track"><i style={{width:`${Math.max(7,Math.min(100,j.ev/Math.max(1,ev.best.ev)*100))}%`}}/></div><b className="money">{inr(j.ev)}</b></div>)}</div><div className="journey-current">Selected journey <b>{order.journey}</b><span> · {courier.name}</span></div></section>
  <section className="panel"><div className="panel-head"><div><div className="eyebrow">MARGIN WATERFALL</div><h2>From checkout to expected margin</h2></div><span className="eyebrow">PER ORDER</span></div><MarginWaterfall order={order}/></section>
 </div><aside className="detail-aside">
  <section className="panel order-card"><div className="eyebrow">ORDER SNAPSHOT</div><div className="snapshot-price money">{inr(order.value)}</div><div className="snapshot-caption">{order.payment} · {order.campaign}</div><div className="snapshot-rule"/><div className="snapshot-line"><span><MapPin size={14}/> Delivery</span><b>{pin.city}, {pin.code}</b></div><div className="snapshot-line"><span><Truck size={14}/> Courier</span><b>{courier.name}</b></div><div className="snapshot-line"><span><Wallet size={14}/> Customer</span><b>{customer.orders} prior orders</b></div><div className="address-box"><small>SHIP TO</small><b>{order.address}</b><span>{customer.phone}</span></div></section>
  <section className="panel action-panel"><div className="eyebrow">SIMULATE AN EVENT</div><h3>Move the order forward</h3><p>Changes update health, journey and expected margin.</p><div className="action-buttons">{actions.map(a=><button key={a} onClick={()=>event(order.id,a)} disabled={order.timeline.some(t=>t.label===a)} className={order.timeline.some(t=>t.label===a)?'is-done':''}>{order.timeline.some(t=>t.label===a)?<Check size={14}/>:<ArrowRight size={14}/>} {a}</button>)}</div></section>
  <section className="panel timeline-panel"><div className="eyebrow">ORDER TIMELINE</div><div className="timeline">{order.timeline.slice().reverse().map((t,i)=><div className="timeline-item" key={i}><i/><span><b>{t.label}</b><small>{t.at}</small></span></div>)}</div></section>
 </aside></div></div>
}

export function Checkout() {
  const { addOrder, orders, engineConfig, currentSeller } = useAppState();
  const [, setLocation] = useLocation();
  const sellerProducts = useMemo(() => {
    const list = products.filter(p => p.sellerId === currentSeller.id);
    return list.length > 0 ? list : products;
  }, [currentSeller.id]);

  const [productId, setProduct] = useState(sellerProducts[0].id);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('273001');
  const [payment, setPayment] = useState<Order['payment']>('COD');
  const [campaign, setCampaign] = useState('Instagram');

  const product = products.find(p => p.id === productId) || products[0];
  const pincode = pincodes.find(p => p.code === pin) || pincodes[0];
  const customer = customers[0];
  const courier = couriers[0];

  const draft: Order = {
    id: 'MP-NEW',
    productId,
    customerId: customer.id,
    qty: 1,
    value: product.price,
    payment,
    address,
    addressComplete: address.trim().split(/\s+/).length >= 4,
    addressVerified: false,
    otpPassed: false,
    campaign,
    pincode: pincode.code,
    courierId: courier.id,
    status: 'Confirmed',
    journey: '',
    score: 0,
    created: new Date().toISOString().slice(0, 10),
    advancePaid: false,
    sellerId: currentSeller.id,
    timeline: []
  };

  const preview = evaluate(draft, product, pincode, courier, { orders: 0, rtos: 0, prepaid: 0 }, engineConfig);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let next = Number(localStorage.getItem('arthiva-next-id') || localStorage.getItem('naomi-next-id') || 1043);
    while (orders.some(o => o.id === `MP-${String(next).padStart(4, '0')}`)) next++;
    localStorage.setItem('arthiva-next-id', String(next + 1));
    const order = {
      ...draft,
      id: `MP-${String(next).padStart(4, '0')}`,
      customerId: customer.id,
      customerName: name,
      customerPhone: phone,
      journey: preview.best.name,
      score: preview.score,
      timeline: [{ label: `Order created via Arthiva Storefront · ${campaign}`, at: 'Just now' }]
    };
    addOrder(order);
    setLocation(`/orders/${order.id}`);
  };

  return (
    <div className="page-enter space-y-5">
      <div className="detail-back">
        <Link href="/orders">← Orders</Link>
        <span>/</span>
        <span>Store Simulation</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>STOREFRONT SIMULATION</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Create an order
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Simulate storefront checkout with live margin analysis and automated journey assignment.
          </p>
        </div>
      </div>

      {/* BENTO GRID MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Bento 1: Checkout Form Card (7 Cols) */}
        <form onSubmit={submit} className="col-span-12 lg:col-span-7 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-6">
          {/* Section 01: Product */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-6 h-6 rounded-lg bg-[#eaf5ef] text-[#1f8a5b] font-bold text-xs flex items-center justify-center">01</span>
              <div>
                <h2 className="text-base font-bold text-[#0e3b43] font-['Bricolage_Grotesque']">Choose Product</h2>
                <p className="text-xs text-[#70817d]">Unit economics flow directly into risk score calculation.</p>
              </div>
            </div>
            
            <label className="field-label">
              <span>Catalog Product</span>
              <select value={productId} onChange={e => setProduct(e.target.value)} className="w-full">
                {sellerProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} · {inr(p.price)}</option>
                ))}
              </select>
            </label>

            <div className="product-economics mt-2 p-3 rounded-xl bg-[#f8faf9] flex items-center justify-between text-xs text-[#6e7f7b]">
              <span>Price: <b className="text-[#0e3b43]">{inr(product.price)}</b></span>
              <span>COGS: <b className="text-[#0e3b43]">{inr(product.cogs)}</b></span>
              <span>Unit Margin: <b className="text-[#1f8a5b] font-bold">{inr(product.price - product.cogs)}</b></span>
            </div>
          </div>

          {/* Section 02: Customer */}
          <div className="pt-4 border-t border-[#edf1ef]">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-6 h-6 rounded-lg bg-[#eaf5ef] text-[#1f8a5b] font-bold text-xs flex items-center justify-center">02</span>
              <div>
                <h2 className="text-base font-bold text-[#0e3b43] font-['Bricolage_Grotesque']">Customer Profile</h2>
                <p className="text-xs text-[#70817d]">Customer contact and verification details.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="field-label">
                <span>Full Name</span>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rhea Malhotra" />
              </label>
              <label className="field-label">
                <span>Phone Number</span>
                <input required pattern="[+]?[0-9 ()-]{10,16}" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </label>
            </div>
          </div>

          {/* Section 03: Address */}
          <div className="pt-4 border-t border-[#edf1ef]">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-6 h-6 rounded-lg bg-[#eaf5ef] text-[#1f8a5b] font-bold text-xs flex items-center justify-center">03</span>
              <div>
                <h2 className="text-base font-bold text-[#0e3b43] font-['Bricolage_Grotesque']">Delivery Destination</h2>
                <p className="text-xs text-[#70817d]">Address completeness is scored by Arthiva risk intelligence.</p>
              </div>
            </div>

            <label className="field-label mb-3">
              <span>Street Address & Landmark</span>
              <textarea required rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="House, street, apartment, landmark" />
            </label>

            <label className="field-label">
              <span>Destination Pincode</span>
              <select value={pin} onChange={e => setPin(e.target.value)}>
                {pincodes.map(p => (
                  <option key={p.code} value={p.code}>{p.code} · {p.city}, {p.state} ({Math.round(p.rtoRate * 100)}% RTO)</option>
                ))}
              </select>
            </label>
          </div>

          {/* Section 04: Payment & Campaign */}
          <div className="pt-4 border-t border-[#edf1ef]">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-6 h-6 rounded-lg bg-[#eaf5ef] text-[#1f8a5b] font-bold text-xs flex items-center justify-center">04</span>
              <div>
                <h2 className="text-base font-bold text-[#0e3b43] font-['Bricolage_Grotesque']">Payment & Acquisition Channel</h2>
                <p className="text-xs text-[#70817d]">Expected value engine compares retention across journeys.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="field-label">
                <span>Payment Method</span>
                <select value={payment} onChange={e => setPayment(e.target.value as Order['payment'])}>
                  <option>COD</option>
                  <option>Partial COD</option>
                  <option>Prepaid</option>
                </select>
              </label>
              <label className="field-label">
                <span>Campaign Source</span>
                <select value={campaign} onChange={e => setCampaign(e.target.value)}>
                  {['Instagram', 'Meta prospecting', 'Google Search', 'Direct', 'Email'].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name || !phone || !address}
            className="button button-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
          >
            Create Order · {inr(product.price)} <ArrowRight size={16} />
          </button>
        </form>

        {/* Bento 2: Live AI Health & Recommendations (5 Cols) */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          
          {/* Health Score Tile */}
          <div className="bg-[#0e3b43] text-white p-6 rounded-[20px] border border-[#09292e] shadow-[0_4px_14px_rgba(14,59,67,0.18)]">
            <div className="flex items-center justify-between text-xs font-semibold text-[#a0c2bd]">
              <span>LIVE HEALTH PREVIEW</span>
              <RiskPill score={preview.score} />
            </div>

            <div className="flex items-baseline gap-2 mt-4 mb-2">
              <b className="text-4xl font-bold font-['Bricolage_Grotesque']">{preview.score}</b>
              <span className="text-sm text-[#a0c2bd]">/100</span>
            </div>

            <div className="w-full h-2 rounded-full bg-[#184e57] overflow-hidden my-3">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${preview.score}%`,
                  backgroundColor: preview.score >= 70 ? '#4ee29d' : preview.score >= 45 ? '#f5a524' : '#e05345'
                }}
              />
            </div>

            <p className="text-xs text-[#a0c2bd] leading-relaxed">
              Completing the address or switching from full COD instantly improves this order’s score.
            </p>

            <div className="mt-4 pt-3 border-t border-[#1d4d54] space-y-1.5 text-xs">
              {preview.factors.slice(0, 3).map(f => (
                <div key={f.name} className="flex justify-between text-[#c4ded9]">
                  <span>{f.name}</span>
                  <b className="font-bold text-white">{f.points} pts</b>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation Tile */}
          <div className="bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#b47a16] mb-2">
              <Sparkles size={14} /> NAOMI RECOMMENDS
            </div>

            <h3 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
              {preview.best.name}
            </h3>
            <p className="text-xs text-[#738480] leading-relaxed mt-1 mb-3">
              {preview.explanation}
            </p>

            <div className="p-3 rounded-xl bg-[#eaf5ef] flex items-center justify-between text-xs mb-4">
              <span className="text-[#366857] font-semibold">Expected Margin:</span>
              <b className="text-[#1a704e] font-bold text-sm money">{inr(preview.best.ev)}</b>
            </div>

            <MarginWaterfall order={draft} />
          </div>

        </div>

      </div>
    </div>
  );
}

