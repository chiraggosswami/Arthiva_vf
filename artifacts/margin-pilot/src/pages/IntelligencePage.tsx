import { useState, useEffect, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, Sparkles, AlertTriangle, ShieldCheck, TrendingDown, Layers, MapPin, Package, ShoppingBag, Truck } from 'lucide-react';
import { useAppState } from '../state/AppState';
import { couriers, customers, pincodes, products } from '../data/seed';
import { getIntelligenceStats, generateSuggestions } from '../engine/intelligence';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function IntelligencePage() {
  const { orders, engineConfig, updateEngineConfig, currentSeller, allPincodes, allProducts, allCouriers, allCustomers } = useAppState();
  const [tab, setTab] = useState<'pincode'|'product'|'channel'|'courier'>('pincode');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  const activeOrders = useMemo(() => {
    return orders.filter(o => o.sellerId === currentSeller.id);
  }, [orders, currentSeller.id]);

  const targetOrders = currentSeller.connectionMode === 'live_sync'
    ? activeOrders
    : (activeOrders.length > 0 ? activeOrders : orders);
  const stats = useMemo(() => getIntelligenceStats(targetOrders, allPincodes, allProducts, allCouriers, allCustomers), [targetOrders, allPincodes, allProducts, allCouriers, allCustomers]);
  const suggestions = useMemo(() => generateSuggestions(stats), [stats]);
  
  const applySuggestion = (policy: any) => {
    if (!engineConfig.policies.some(p => p.id === policy.id)) {
      updateEngineConfig({ ...engineConfig, policies: [...engineConfig.policies, policy] });
      toast({
        title: "Policy Activated",
        description: `Automated guardrail active: ${policy.name}`,
      });
    }
  };

  const currentStats = 
    tab === 'pincode' ? stats.byPin :
    tab === 'product' ? stats.byProduct :
    tab === 'channel' ? stats.byChannel : stats.byCourier;

  const totalDrag = useMemo(() => {
    return stats.byPin.reduce((s, x) => s + x.marginDrag, 0);
  }, [stats]);

  const trend = [
    { month: 'W1', rto: 22.4, baseline: 26 },
    { month: 'W2', rto: 21.1, baseline: 26 },
    { month: 'W3', rto: 19.8, baseline: 25.5 },
    { month: 'W4', rto: 18.2, baseline: 25 },
    { month: 'W5', rto: 17.5, baseline: 25 },
    { month: 'W6', rto: 16.3, baseline: 24.8 },
  ];

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>RISK INTELLIGENCE</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Insight to action
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Identify sources of margin drag across pincodes, products, channels, and couriers to plug leaks before dispatch.
          </p>
        </div>
      </div>

      {/* BENTO ROW 1: 4 TOP STAT TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>Total Margin Drag</span>
            <TrendingDown size={15} className="text-[#bd4136]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#b83f33] mt-2 money">
            {inr(totalDrag)}
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">RTO cost leakage across portfolio</small>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>Active Policy Plugs</span>
            <ShieldCheck size={15} className="text-[#1f8a5b]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] mt-2">
            {engineConfig.policies.length} Active
          </b>
          <small className="text-xs text-[#1f8a5b] font-semibold mt-1 block">Rule-based guardrails protecting margin</small>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>High Risk Pincodes</span>
            <MapPin size={15} className="text-[#f5a524]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#a0680a] mt-2">
            {stats.byPin.filter(p => p.rtoRate > 0.25).length} Pincodes
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">RTO rate exceeding 25%</small>
        </div>

        <div className="bg-[#f4f8f6] p-5 rounded-[20px] border border-[#d6ecde] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#226750]">
            <span>Recoverable Margin</span>
            <Sparkles size={15} className="text-[#226750]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#14533d] mt-2 money">
            {inr(totalDrag * 0.45)}
          </b>
          <small className="text-xs text-[#4c7567] mt-1 block">With suggested policy rules applied</small>
        </div>
      </div>

      {/* BENTO ROW 2: AI RECOMMENDATIONS CARD */}
      {suggestions.length > 0 && (
        <div className="bg-[#fdfaf3] p-5 rounded-[20px] border border-[#f4e4be] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#916919] flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles size={14} /> AI Recommended Margin Actions
            </span>
            <span className="text-xs text-[#8c6c2e] font-semibold">
              {suggestions.filter(s => engineConfig.policies.some(p => p.id === s.policy.id)).length} of {suggestions.length} active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {loading ? (
              <>
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </>
            ) : (
              suggestions.map((s, i) => {
                const applied = engineConfig.policies.some(p => p.id === s.policy.id);
                return (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-[#f0deae] shadow-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#faece9] text-[#bd4136] grid place-items-center shrink-0 mt-0.5">
                        <AlertTriangle size={15} />
                      </div>
                      <div>
                        <b className="text-xs text-[#2c3d39] font-bold block">{s.text}</b>
                        <small className="text-[11px] text-[#7d8b87]">Plugs margin drag automatically</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`button shrink-0 text-xs font-bold py-1.5 px-3.5 ${applied ? 'button-soft bg-[#edf3f0] text-[#1f7354]' : 'button-primary'}`}
                      onClick={() => applySuggestion(s.policy)}
                      disabled={applied}
                    >
                      {applied ? '✓ Applied' : 'Apply rule'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* BENTO ROW 3: 8 COLS MULTI-DIMENSION TABLE + 4 COLS TREND CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Bento 1: Dimension Breakdown Table (8 Cols) */}
        <section className="col-span-12 lg:col-span-8 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#edf1ef]">
            <div>
              <span className="eyebrow text-[#7b8b87]">MARGIN LEAKAGE MATRIX</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                Breakdown by Operational Dimension
              </h2>
            </div>
            
            {/* Dimension Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-[#f4f7f5] rounded-xl">
              {[
                ['pincode', 'Pincodes', MapPin],
                ['product', 'Products', Package],
                ['channel', 'Channels', ShoppingBag],
                ['courier', 'Couriers', Truck],
              ].map(([key, label, Icon]: any) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    tab === key
                      ? 'bg-[#0e3b43] text-white shadow-xs'
                      : 'text-[#5d736e] hover:text-[#0e3b43]'
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap border-0 rounded-none mt-3">
            <table className="w-full">
              <thead>
                <tr>
                  <th>DIMENSION</th>
                  <th>TOTAL ORDERS</th>
                  <th>RTO RATE</th>
                  <th className="right">MARGIN DRAG</th>
                </tr>
              </thead>
              <tbody>
                {currentStats.map(s => (
                  <tr key={s.id}>
                    <td>
                      <b className="text-xs text-[#1e4844] font-bold">{s.name}</b>
                      <small className="text-[11px] text-[#7d8c88] block">{s.id}</small>
                    </td>
                    <td>
                      <span className="text-xs font-semibold text-[#274842]">{s.orders} orders</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 max-w-xs">
                        <div className="h-1.5 flex-1 bg-[#edf2ef] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, s.rtoRate * 100 * 2.5)}%`,
                              background: s.rtoRate > 0.25 ? '#bd4136' : s.rtoRate > 0.15 ? '#f5a524' : '#1f8a5b',
                            }}
                          />
                        </div>
                        <b className="text-xs font-bold money" style={{ color: s.rtoRate > 0.25 ? '#bd4136' : '#274a44' }}>
                          {(s.rtoRate * 100).toFixed(1)}%
                        </b>
                      </div>
                    </td>
                    <td className="right money font-bold text-xs" style={{ color: s.marginDrag > 1000 ? '#b83f33' : '#1f8a5b' }}>
                      {inr(s.marginDrag)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bento 2: RTO Trajectory Chart Card (4 Cols) */}
        <aside className="col-span-12 lg:col-span-4 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-4">
          <div className="pb-3 border-b border-[#edf1ef]">
            <div className="eyebrow text-[#7b8b87]">HISTORICAL TRAJECTORY</div>
            <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
              RTO Suppression Rate
            </h2>
          </div>

          <p className="text-xs text-[#70817d]">
            Comparing standard baseline return rate vs. Arthiva engine-managed order flow.
          </p>

          <div className="h-48 w-full bg-[#fbfdfc] p-2 rounded-xl border border-[#edf2ef]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eeeb" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#82908e' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#82908e' }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip />
                <Area type="monotone" dataKey="baseline" stroke="#f5a524" fill="#fdf8ed" strokeDasharray="4 4" name="Baseline COD" />
                <Area type="monotone" dataKey="rto" stroke="#0e3b43" fill="#eaf5ef" name="Arthiva Engine" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 bg-[#f5f8f6] rounded-xl border border-[#e5ece8] space-y-1 text-xs text-[#526a63]">
            <div className="flex items-center justify-between font-bold">
              <span>Current Suppression</span>
              <span className="text-[#1f8a5b]">-6.1% RTO</span>
            </div>
            <div className="text-[11px] text-[#71857f]">
              Saved approximately {inr(orders.length * 120)} in reverse freight and stock lockup.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
