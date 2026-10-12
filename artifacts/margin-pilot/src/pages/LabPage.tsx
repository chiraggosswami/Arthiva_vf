import { useState, useMemo } from 'react';
import { evaluate, DEFAULT_ENGINE_CONFIG, journeys } from '../engine';
import { Settings2, Play, Info, Sparkles, TrendingUp, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppState } from '@/state/AppState';

export default function LabPage() {
  const [orderCount, setOrderCount] = useState(500);
  const [aov, setAov] = useState(1500);
  const [marginPct, setMarginPct] = useState(40);
  const [baseRto, setBaseRto] = useState(25);
  const { currentSeller } = useAppState();

  const results = useMemo(() => {
    let baselineMargin = 0;
    let mpMargin = 0;
    let baselineRtos = 0;
    let mpRtos = 0;

    for (let i = 0; i < orderCount; i++) {
      const randomRisk = Math.random();
      const rtoRate = (baseRto / 100) * (0.5 + randomRisk);
      const cogs = Math.round(aov * (1 - marginPct / 100));
      
      const order: any = {
        id: `SIM-${i}`,
        productId: 'P1',
        customerId: 'CUST-1',
        value: aov,
        qty: 1,
        payment: 'COD',
        address: 'Connaught Place',
        campaign: 'Google',
        advancePaid: false,
        otpPassed: false,
        addressVerified: false,
        addressComplete: true,
        pincode: '110001',
        courierId: 'C1',
        status: 'Unfulfilled',
        journey: 'Full COD',
        score: 50,
        created: new Date().toISOString(),
        timeline: [],
        customerName: 'Sim',
      };
      const product = { id: 'P1', name: 'Sample Product', price: aov, cogs, category: 'Apparel', damageRate: 0.1 };
      const pin = { code: '110001', pincode: '110001', city: 'Delhi', state: 'DL', tier: 1, rtoRate, success: 0.9 };
      const courier = { id: 'C1', name: 'Delhivery', forward: 45, reverse: 45, cod: 28, success: 0.9 };
      const cust = { orders: Math.floor(Math.random() * 3), rtos: Math.floor(Math.random() * 2), prepaid: 0 };

      const evalResult = evaluate(order, product, pin, courier, cust, DEFAULT_ENGINE_CONFIG);
      
      const codJourney = evalResult.journeys.find(j => j.name === 'Full COD') || evalResult.journeys[0];
      const bestJourney = evalResult.best;

      baselineMargin += codJourney.ev;
      mpMargin += bestJourney.ev;
      
      baselineRtos += evalResult.pRto * codJourney.rtoMult;
      mpRtos += evalResult.pRto * bestJourney.rtoMult;
    }

    return {
      baselineMargin,
      mpMargin,
      marginLift: mpMargin - baselineMargin,
      baselineRtoPct: (baselineRtos / orderCount) * 100,
      mpRtoPct: (mpRtos / orderCount) * 100
    };
  }, [orderCount, aov, marginPct, baseRto]);

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>PROFIT LAB & SIMULATION</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Simulation lab
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Model expected outcomes across thousands of simulated orders to benchmark Arthiva against unmanaged baseline COD.
          </p>
        </div>
      </div>

      {/* BENTO ROW 1: 4 TOP STAT TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Projected Margin Lift */}
        <div className="bg-[#0e3b43] text-white p-5 rounded-[20px] border border-[#092b31] shadow-[0_4px_16px_rgba(14,59,67,0.15)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#8ebdb6]">
            <span>Projected Margin Lift</span>
            <Sparkles size={16} className="text-[#f5a524]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#f5a524] mt-2 money">
            +₹{Math.round(results.marginLift).toLocaleString('en-IN')}
          </b>
          <small className="text-xs text-[#9cc4bd] mt-1 block">Net extra profit retained</small>
        </div>

        {/* Tile 2: Managed RTO % */}
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>Arthiva Managed RTO %</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#1f8a5b]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#1f8a5b] mt-2">
            {results.mpRtoPct.toFixed(1)}%
          </b>
          <small className="text-xs text-[#1f8a5b] font-semibold mt-1 block">
            -{(results.baselineRtoPct - results.mpRtoPct).toFixed(1)}% lower than baseline
          </small>
        </div>

        {/* Tile 3: Baseline COD RTO % */}
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>Baseline Full COD RTO %</span>
            <ShieldAlert size={15} className="text-[#bd4136]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#b83f33] mt-2">
            {results.baselineRtoPct.toFixed(1)}%
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">Uncontrolled checkout returns</small>
        </div>

        {/* Tile 4: Modeled Batch Size */}
        <div className="bg-[#f4f8f6] p-5 rounded-[20px] border border-[#d6ecde] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#226750]">
            <span>Simulated Orders</span>
            <Settings2 size={15} className="text-[#226750]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#14533d] mt-2">
            {orderCount.toLocaleString()}
          </b>
          <small className="text-xs text-[#4c7567] mt-1 block">AOV: ₹{aov.toLocaleString()} · {marginPct}% margin</small>
        </div>
      </div>

      {/* BENTO ROW 2: 5 COLS ASSUMPTIONS SLIDERS + 7 COLS COMPARATIVE VISUALIZATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Bento 1: Assumptions & Parameter Sliders (5 Cols) */}
        <section className="col-span-12 lg:col-span-5 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-4">
          <div className="pb-3 border-b border-[#edf1ef] flex items-center justify-between">
            <div>
              <span className="eyebrow text-[#7b8b87]">MODEL PARAMETERS</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                Unit Economic Assumptions
              </h2>
            </div>
            <Settings2 size={16} className="text-[#71827d]" />
          </div>

          <div className="space-y-4 pt-1">
            <div className="lab-slider">
              <label className="flex items-center justify-between text-xs font-semibold text-[#48635c] mb-2">
                <span>Monthly Order Volume</span>
                <b className="text-sm font-bold text-[#0e3b43]">{orderCount.toLocaleString()} orders</b>
              </label>
              <input
                type="range"
                min={100}
                max={5000}
                step={100}
                value={orderCount}
                onChange={e => setOrderCount(Number(e.target.value))}
                className="w-full accent-[#0e3b43]"
              />
            </div>

            <div className="lab-slider">
              <label className="flex items-center justify-between text-xs font-semibold text-[#48635c] mb-2">
                <span>Average Order Value (AOV)</span>
                <b className="text-sm font-bold text-[#0e3b43]">₹{aov.toLocaleString()}</b>
              </label>
              <input
                type="range"
                min={500}
                max={5000}
                step={100}
                value={aov}
                onChange={e => setAov(Number(e.target.value))}
                className="w-full accent-[#0e3b43]"
              />
            </div>

            <div className="lab-slider">
              <label className="flex items-center justify-between text-xs font-semibold text-[#48635c] mb-2">
                <span>Gross Margin % (Pre-freight)</span>
                <b className="text-sm font-bold text-[#0e3b43]">{marginPct}%</b>
              </label>
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={marginPct}
                onChange={e => setMarginPct(Number(e.target.value))}
                className="w-full accent-[#0e3b43]"
              />
            </div>

            <div className="lab-slider">
              <label className="flex items-center justify-between text-xs font-semibold text-[#48635c] mb-2">
                <span>Baseline Organic RTO Rate</span>
                <b className="text-sm font-bold text-[#b83f33]">{baseRto}%</b>
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={baseRto}
                onChange={e => setBaseRto(Number(e.target.value))}
                className="w-full accent-[#b83f33]"
              />
            </div>
          </div>

          <div className="p-3 bg-[#f5f8f6] rounded-xl border border-[#e5ece8] flex items-start gap-2 text-xs text-[#526a63]">
            <Info size={15} className="shrink-0 text-[#21675a] mt-0.5" />
            <span>
              Calculates stochastic probability distributions across address verification, OTP compliance, and partial COD commitments.
            </span>
          </div>
        </section>

        {/* Bento 2: Comparative Outcomes & Waterfall (7 Cols) */}
        <section className="col-span-12 lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card A: Baseline */}
            <div className="bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-3">
              <div className="pb-2 border-b border-[#edf1ef]">
                <span className="eyebrow text-[#7b8b87]">CURRENT STATUS QUO</span>
                <h3 className="text-base font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                  Baseline (Full COD)
                </h3>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <small className="text-[11px] text-[#7d8c88] block uppercase font-bold tracking-wider">
                    Expected Net Margin
                  </small>
                  <b className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#2c4743] money">
                    ₹{Math.round(results.baselineMargin).toLocaleString('en-IN')}
                  </b>
                </div>

                <div>
                  <small className="text-[11px] text-[#7d8c88] block uppercase font-bold tracking-wider">
                    Effective RTO Loss Rate
                  </small>
                  <b className="text-xl font-bold text-[#bd4136]">
                    {results.baselineRtoPct.toFixed(1)}%
                  </b>
                </div>
              </div>
            </div>

            {/* Card B: Arthiva Engine */}
            <div className="bg-white p-6 rounded-[20px] border-2 border-[#1f8a5b] shadow-[0_4px_14px_rgba(31,138,91,0.08)] space-y-3">
              <div className="pb-2 border-b border-[#eaf5ef] flex items-center justify-between">
                <div>
                  <span className="eyebrow text-[#1f8a5b] font-bold">OPTIMIZED ENGINE</span>
                  <h3 className="text-base font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                    Arthiva Journeys
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eaf5ef] text-[#1c7851]">
                  WINNER
                </span>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <small className="text-[11px] text-[#7d8c88] block uppercase font-bold tracking-wider">
                    Expected Net Margin
                  </small>
                  <b className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#1f8a5b] money">
                    ₹{Math.round(results.mpMargin).toLocaleString('en-IN')}
                  </b>
                </div>

                <div>
                  <small className="text-[11px] text-[#7d8c88] block uppercase font-bold tracking-wider">
                    Effective RTO Loss Rate
                  </small>
                  <b className="text-xl font-bold text-[#1f8a5b]">
                    {results.mpRtoPct.toFixed(1)}%
                  </b>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Hero Card */}
          <div className="bg-[#f2f8f4] p-6 rounded-[20px] border border-[#d2eadb] shadow-[0_2px_10px_rgba(14,59,67,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="eyebrow text-[#1f8a5b] font-bold">ANNUALIZED IMPACT PROJECTION</span>
              <h3 className="text-xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] mt-0.5">
                +₹{Math.round(results.marginLift * 12).toLocaleString('en-IN')} / year
              </h3>
              <p className="text-xs text-[#567269] mt-1">
                Based on continuous rule execution across {orderCount * 12} annual dispatches.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-4 py-2 bg-[#0e3b43] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs">
                Active in workspace <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
