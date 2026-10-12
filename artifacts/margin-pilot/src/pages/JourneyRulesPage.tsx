import { useMemo, useState } from 'react';
import { Check, RotateCcw, Save, SlidersHorizontal, Sliders, ShieldCheck, Zap, Info } from 'lucide-react';
import { customers, couriers, pincodes, products } from '../data/seed';
import { DEFAULT_ENGINE_CONFIG, evaluate, journeyValues, type EngineConfig } from '../engine';
import { useAppState } from '../state/AppState';
import { useToast } from '@/hooks/use-toast';

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const percent = (n: number) => `${Math.round(n * 100)}%`;

export default function JourneyRulesPage() {
  const { orders, engineConfig, updateEngineConfig, currentSeller, allProducts, allPincodes, allCouriers, allCustomers } = useAppState();
  const [draft, setDraft] = useState<EngineConfig>(() => structuredClone(engineConfig));

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.sellerId === currentSeller.id);
  }, [orders, currentSeller.id]);
  const targetOrders = activeOrders.length > 0 ? activeOrders : orders;

  const [selectedId, setSelectedId] = useState(targetOrders[0]?.id ?? '');
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const selected = targetOrders.find(order => order.id === selectedId) ?? targetOrders[0];
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
  const customer = allCustomers.find(item => item.id === selected?.customerId) ?? {
    id: selected?.customerId || `C_${selected?.id}`,
    name: selected?.customerName || 'Customer',
    phone: selected?.customerPhone || '+91 9800000000',
    city: pin.city,
    orders: 1,
    rtos: 0,
    prepaid: selected?.payment === 'Prepaid' ? 1 : 0
  };
  const currentEvaluation = selected ? evaluate(selected, product, pin, courier, customer, engineConfig) : null;
  const [whatIf, setWhatIf] = useState(Math.round((currentEvaluation?.pRto ?? .2) * 100));
  const whatIfResults = useMemo(() => selected && currentEvaluation ? journeyValues(selected, currentEvaluation.marginSuccess, currentEvaluation.rtoLoss, whatIf / 100, draft) : [], [selected, currentEvaluation, whatIf, draft]);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(engineConfig);

  const updateJourney = (index: number, key: 'retention' | 'rtoMult' | 'cost' | 'discount', raw: string) => {
    const value = Number(raw);
    setDraft(current => ({ ...current, journeys: current.journeys.map((journey, i) => i === index ? {
      ...journey,
      [key]: key === 'retention' || key === 'rtoMult' ? Math.max(0, Math.min(1, value / 100)) : key === 'discount' ? (value > 0 ? Math.min(1, value / 100) : undefined) : Math.max(0, value),
    } : journey) }));
    setSaved(false);
  };

  const updateThreshold = (key: 'highRisk' | 'watch', value: string) => {
    const num = Math.max(0, Math.min(100, Number(value)));
    setDraft(current => ({ ...current, scoreThresholds: { ...current.scoreThresholds, [key]: num } }));
    setSaved(false);
  };

  const save = () => {
    const normalized = { ...draft, scoreThresholds: { highRisk: Math.min(draft.scoreThresholds.highRisk, draft.scoreThresholds.watch), watch: Math.max(draft.scoreThresholds.highRisk, draft.scoreThresholds.watch) } };
    setDraft(normalized);
    updateEngineConfig(normalized);
    setSaved(true);
    toast({
      title: "Journey Rules Saved",
      description: "Engine rules updated across orders and live calculations.",
    });
  };

  const restore = () => {
    const defaults = structuredClone(DEFAULT_ENGINE_CONFIG);
    setDraft(defaults);
    updateEngineConfig(defaults);
    setSaved(true);
    toast({
      title: "Defaults Restored",
      description: "Reset engine parameters to factory defaults.",
    });
  };

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>ENGINE CONFIGURATION</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Journey rules
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Set how much margin each intervention keeps, spends and protects across the workspace.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="button button-soft inline-flex items-center gap-1.5 text-xs font-bold"
            onClick={restore}
            data-testid="button-restore-defaults"
          >
            <RotateCcw size={14} /> Restore defaults
          </button>
          <button
            type="button"
            className="button button-primary inline-flex items-center gap-1.5 text-xs font-bold"
            onClick={save}
            disabled={!isDirty}
            data-testid="button-save-journey-rules"
          >
            <Save size={14} /> {saved ? 'Saved' : 'Save rules'}
          </button>
        </div>
      </div>

      {saved && (
        <div className="ops-notice" role="status">
          <Check size={16} />
          Engine rules saved. Existing orders and pages now use this configuration.
        </div>
      )}

      {/* BENTO GRID ROW 1: 4 TOP STAT TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <span className="text-xs font-semibold text-[#71827d]">Configured Journeys</span>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] mt-2">
            {draft.journeys.length} Strategies
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">Full COD, OTP, Advance, Manual</small>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <span className="text-xs font-semibold text-[#71827d]">High Risk Score Cutoff</span>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#b83f33] mt-2">
            &lt; {draft.scoreThresholds.highRisk}
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">Orders flagged for strict guardrails</small>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <span className="text-xs font-semibold text-[#71827d]">Watch Score Cutoff</span>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#f5a524] mt-2">
            &lt; {draft.scoreThresholds.watch}
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">Requires soft confirmation</small>
        </div>

        <div className="bg-[#f4f8f6] p-5 rounded-[20px] border border-[#d6ecde] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <span className="text-xs font-semibold text-[#226750]">Status</span>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#14533d] mt-2">
            {isDirty ? 'Unsaved' : 'Synced'}
          </b>
          <small className="text-xs text-[#4c7567] mt-1 block">
            {isDirty ? 'Pending changes in draft' : 'Active across all calculations'}
          </small>
        </div>
      </div>

      {/* BENTO GRID ROW 2: 8 COLS JOURNEY EDITOR + 4 COLS WHAT-IF SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Bento 1: Journey Constants Table (8 Cols) */}
        <section className="col-span-12 lg:col-span-8 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between pb-3 border-b border-[#edf1ef]">
            <div>
              <span className="eyebrow text-[#7b8b87]">JOURNEY CONSTANTS</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                Retention, Risk Multiplier & Cost
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#1f8a5b] bg-[#eaf5ef] px-2.5 py-1 rounded-full">
              Live Recalculation
            </span>
          </div>

          <div className="rules-table-wrap mt-4">
            <table className="rules-table w-full">
              <thead>
                <tr>
                  <th>JOURNEY</th>
                  <th>RETENTION</th>
                  <th>RTO MULTIPLIER</th>
                  <th>INTERVENTION COST</th>
                  <th>DISCOUNT</th>
                </tr>
              </thead>
              <tbody>
                {draft.journeys.map((journey, index) => (
                  <tr key={journey.name}>
                    <td>
                      <b className="text-xs text-[#1e4540]">{journey.name}</b>
                      <small className="text-[11px] text-[#7d8d89] block mt-0.5">
                        {journey.name === 'Human review'
                          ? 'Only offered above ₹2,500 order value'
                          : journey.name === 'Full COD'
                          ? 'Baseline zero intervention'
                          : 'Applied to eligible orders'}
                      </small>
                    </td>
                    <td>
                      <label className="unit-input">
                        <input
                          aria-label={`${journey.name} retention`}
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round(journey.retention * 100)}
                          onChange={e => updateJourney(index, 'retention', e.target.value)}
                          data-testid={`input-retention-${index}`}
                        />
                        <span>%</span>
                      </label>
                    </td>
                    <td>
                      <label className="unit-input">
                        <input
                          aria-label={`${journey.name} RTO multiplier`}
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round(journey.rtoMult * 100)}
                          onChange={e => updateJourney(index, 'rtoMult', e.target.value)}
                          data-testid={`input-rto-multiplier-${index}`}
                        />
                        <span>%</span>
                      </label>
                    </td>
                    <td>
                      <label className="unit-input rupee-input">
                        <span>₹</span>
                        <input
                          aria-label={`${journey.name} intervention cost`}
                          type="number"
                          min="0"
                          step="1"
                          value={journey.cost}
                          onChange={e => updateJourney(index, 'cost', e.target.value)}
                          data-testid={`input-intervention-cost-${index}`}
                        />
                      </label>
                    </td>
                    <td>
                      <label className="unit-input">
                        <input
                          aria-label={`${journey.name} discount`}
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round((journey.discount ?? 0) * 100)}
                          onChange={e => updateJourney(index, 'discount', e.target.value)}
                          data-testid={`input-discount-${index}`}
                        />
                        <span>%</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Thresholds Sub-Card */}
          <div className="threshold-section mt-5 pt-4 border-t border-[#edf1ef]">
            <div>
              <div className="eyebrow text-[#7b8b87]">ORDER HEALTH BANDS</div>
              <h3 className="text-base font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">Score Thresholds</h3>
              <p className="text-xs text-[#788680] mt-0.5">Adjust cutoff scores across cockpit risk badges.</p>
            </div>
            <label className="threshold-control">
              <span className="text-xs font-semibold text-[#5a6e66] flex items-center gap-1.5">
                <i className="threshold-dot high w-2 h-2 rounded-full bg-[#bd4136]" /> High risk below
              </span>
              <div className="unit-input">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.scoreThresholds.highRisk}
                  onChange={e => updateThreshold('highRisk', e.target.value)}
                  aria-label="High risk score threshold"
                  data-testid="input-threshold-high-risk"
                />
                <span>/ 100</span>
              </div>
            </label>
            <label className="threshold-control">
              <span className="text-xs font-semibold text-[#5a6e66] flex items-center gap-1.5">
                <i className="threshold-dot watch w-2 h-2 rounded-full bg-[#f5a524]" /> Watch below
              </span>
              <div className="unit-input">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.scoreThresholds.watch}
                  onChange={e => updateThreshold('watch', e.target.value)}
                  aria-label="Watch score threshold"
                  data-testid="input-threshold-watch"
                />
                <span>/ 100</span>
              </div>
            </label>
          </div>
        </section>

        {/* Bento 2: What-If RTO Probability Shift Simulator (4 Cols) */}
        <aside className="col-span-12 lg:col-span-4 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#edf1ef]">
            <div>
              <div className="eyebrow flex items-center gap-1.5 text-[#7b8b87]">
                <SlidersHorizontal size={13} /> WHAT-IF SIMULATOR
              </div>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                RTO Probability Shift
              </h2>
            </div>
          </div>

          <p className="text-xs text-[#70817d]">
            Move the risk slider to see how expected margin changes for a real order without modifying its saved score.
          </p>

          <label className="field-label block text-xs font-semibold text-[#4e645e]">
            Compare order
            <select
              value={selected?.id ?? ''}
              onChange={e => {
                setSelectedId(e.target.value);
                const next = targetOrders.find(order => order.id === e.target.value);
                if (next) {
                  const nextProduct = allProducts.find(item => item.id === next.productId || item.name === next.productId) ?? {
                    id: next.productId || 'P_item',
                    name: (next as any)?.productName || 'Catalog Product',
                    price: next.value || 1000,
                    cogs: (next as any)?.cogs ?? Math.max(100, Math.round((next.value || 1000) * 0.35)),
                    damageRate: 0.02,
                    sellerId: next.sellerId
                  };
                  const nextPin = allPincodes.find(item => item.code === next.pincode) ?? {
                    code: next.pincode || '110001',
                    city: (next as any)?.city || 'Metro City',
                    state: (next as any)?.state || 'India',
                    rtoRate: (next as any)?.rtoRate ?? 0.18,
                    success: 1 - ((next as any)?.rtoRate ?? 0.18)
                  };
                  const nextCourier = allCouriers.find(item => item.id === next.courierId) ?? allCouriers[0];
                  const nextCustomer = allCustomers.find(item => item.id === next.customerId) ?? {
                    id: next.customerId || `C_${next.id}`,
                    name: next.customerName || 'Customer',
                    phone: next.customerPhone || '+91 9800000000',
                    city: nextPin.city,
                    orders: 1,
                    rtos: 0,
                    prepaid: next.payment === 'Prepaid' ? 1 : 0
                  };
                  setWhatIf(Math.round(evaluate(next, nextProduct, nextPin, nextCourier, nextCustomer, engineConfig).pRto * 100));
                }
              }}
              data-testid="select-whatif-order"
              className="mt-1 w-full bg-[#fcfdfc] border border-[#e1e8e4] rounded-lg px-2.5 py-1.5 text-xs text-[#2e4742]"
            >
              {targetOrders.map(order => (
                <option key={order.id} value={order.id}>
                  {order.id} · {order.customerName || allCustomers.find(item => item.id === order.customerId)?.name || 'Customer'}
                </option>
              ))}
            </select>
          </label>

          {selected && currentEvaluation ? (
            <div className="space-y-3.5">
              <div className="whatif-order-strip bg-[#f5f8f6] p-3 rounded-xl flex items-center justify-between text-xs text-[#5a6d66]">
                <span>{product.name}</span>
                <b className="text-sm font-bold text-[#145147]">{money(selected.value)}</b>
              </div>

              <div className="slider-value flex items-center justify-between text-xs text-[#61726c]">
                <span>Hypothetical RTO probability</span>
                <b className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#1a6753]">{whatIf}%</b>
              </div>

              <input
                className="risk-slider w-full"
                type="range"
                min="2"
                max="70"
                step="1"
                value={whatIf}
                onChange={e => setWhatIf(Number(e.target.value))}
                aria-label="Hypothetical RTO probability"
                data-testid="slider-whatif-rto"
              />

              <div className="slider-ends flex items-center justify-between text-[11px] text-[#8a9490]">
                <span>2% low risk</span>
                <span>70% severe risk</span>
              </div>

              <div className="whatif-baseline flex items-center justify-between py-2 border-y border-[#edf1ef] text-xs text-[#75837d]">
                <span>Current scored risk</span>
                <b className="text-[#1e4d44]">{percent(currentEvaluation.pRto)}</b>
              </div>

              <div className="whatif-results space-y-1.5 pt-1">
                <div className="eyebrow text-[#7b8b87] text-[10px]">EXPECTED MARGIN · PER ORDER</div>
                {whatIfResults.map((journey, index) => (
                  <div
                    className={`whatif-row flex items-center justify-between p-2.5 rounded-lg border ${
                      index === 0 ? 'bg-[#f4f9f6] border-[#cae5d4]' : 'bg-[#fafcfb] border-[#edf2ef]'
                    }`}
                    key={journey.name}
                  >
                    <div>
                      <span className="text-xs font-bold text-[#234b46]">{journey.name}</span>
                      {index === 0 && <small className="block text-[10px] text-[#2a7251] font-semibold">Highest expected value</small>}
                    </div>
                    <b className="money text-xs font-bold text-[#1a6d4b]">{money(journey.ev)}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ops-empty inline p-4 text-center text-xs text-[#82928c]">
              Select an order to use the what-if simulator.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
