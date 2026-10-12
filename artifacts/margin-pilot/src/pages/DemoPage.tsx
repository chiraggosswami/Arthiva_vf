import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ArrowLeft, RotateCcw, CheckCircle, Sparkles, AlertTriangle, ShieldCheck, Truck, Check, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../state/AppState';
import { couriers, customers, pincodes, products } from '../data/seed';
import { evaluate, DEFAULT_ENGINE_CONFIG } from '../engine/index';
import { recommendNdrRescue } from '../engine/recovery';
import { useToast } from '@/hooks/use-toast';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function DemoPage() {
  const { orders, updateOrder, engineConfig, currentSeller } = useAppState();
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  
  const order = orders.find(o => o.id === 'MP-1042') ?? orders[0];
  
  if (!order) {
    return (
      <div className="ops-page p-8 text-center">
        <h2 className="text-xl font-bold text-[#0e3b43]">Order MP-1042 not found</h2>
        <p className="text-sm text-[#71827e] mt-1">Please reset workspace state to reload default seed orders.</p>
      </div>
    );
  }

  const p = products.find(x => x.id === order.productId) ?? products[0];
  const pin = pincodes.find(x => x.code === order.pincode) ?? pincodes[0];
  const c = couriers.find(x => x.id === order.courierId) ?? couriers[0];
  const cust = customers.find(x => x.id === order.customerId) ?? customers[0];
  
  const ev = evaluate(order, p, pin, c, cust, engineConfig);
  
  const advanceStep = () => {
    if (step === 2) {
      updateOrder(order.id, { addressComplete: true, advancePaid: true, status: 'Confirmed' }, 'Customer completed address & paid advance');
      toast({ title: 'Step 3: Risk Mitigated', description: 'Partial COD advance received. Order confirmed.' });
    } else if (step === 3) {
      updateOrder(order.id, { status: 'NDR raised', ndrReason: 'Customer unreachable' }, 'Courier reported NDR: Customer unreachable');
      toast({ title: 'Step 4: Exception Raised', description: 'Courier NDR: Customer unreachable.' });
    } else if (step === 4) {
      const rescue = recommendNdrRescue('Customer unreachable', cust.name, ev.best.ev);
      updateOrder(order.id, { rescueAction: rescue.action, rescueMessage: rescue.message, recoveredValue: ev.best.ev }, 'Rescue flow triggered via WhatsApp');
      toast({ title: 'Step 5: Rescue Sent', description: `${rescue.action} dispatched to buyer.` });
    } else if (step === 5) {
      updateOrder(order.id, { status: 'Delivered' }, 'Delivered successfully on second attempt');
      toast({ title: 'Step 6: Delivered', description: 'Order completed! ₹1,499 revenue realized.' });
    }
    setStep(s => Math.min(6, s + 1));
  };

  const steps = [
    { num: 1, title: 'Order Received', desc: 'High-risk COD arrives' },
    { num: 2, title: 'Journey Selection', desc: 'EV evaluation matrix' },
    { num: 3, title: 'Risk Mitigated', desc: 'Address & OTP verified' },
    { num: 4, title: 'Delivery Exception', desc: 'NDR raised by courier' },
    { num: 5, title: 'Delivery Rescue', desc: 'Automated WhatsApp trigger' },
    { num: 6, title: 'Realised Margin', desc: 'Final profit secured' }
  ];

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>INTERACTIVE WALKTHROUGH</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Demo mode
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Follow the complete end-to-end profit lifecycle of order MP-1042 from high-risk cart to delivered margin.
          </p>
        </div>
        <button
          type="button"
          className="button button-soft inline-flex items-center gap-1.5 text-xs font-bold"
          onClick={() => {
            localStorage.removeItem('margin-pilot-state');
            window.location.reload();
          }}
        >
          <RotateCcw size={14} /> Reset demo
        </button>
      </div>

      {/* BENTO STEPPER STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {steps.map(s => {
          const isActive = s.num === step;
          const isDone = s.num < step;
          return (
            <div
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-[#0e3b43] text-white border-[#0e3b43] shadow-[0_4px_12px_rgba(14,59,67,0.15)]'
                  : isDone
                  ? 'bg-[#f3f9f5] text-[#1c644d] border-[#d2eadb]'
                  : 'bg-white text-[#6b7e78] border-[#e1e8e4]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
                <span>STEP {s.num}</span>
                {isDone && <Check size={12} className="text-[#1f8a5b]" />}
                {isActive && <span className="w-2 h-2 rounded-full bg-[#f5a524]" />}
              </div>
              <div className="mt-2">
                <b className="text-xs font-bold block leading-tight">{s.title}</b>
                <small className={`text-[10px] block mt-0.5 line-clamp-1 ${isActive ? 'text-[#9fc7c1]' : 'text-[#879792]'}`}>
                  {s.desc}
                </small>
              </div>
            </div>
          );
        })}
      </div>

      {/* BENTO MAIN GRID: 7 COLS NARRATIVE CARD + 5 COLS LIVE ORDER METADATA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Narrative & Action Tile (7 Cols) */}
        <section className="col-span-12 lg:col-span-7 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] min-h-[420px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#edf1ef]">
              <div>
                <span className="eyebrow text-[#7b8b87]">SCENARIO TIMELINE</span>
                <h2 className="text-xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                  {steps[step - 1].title}
                </h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#f2f6f4] text-[#2c5249]">
                Step {step} of 6
              </span>
            </div>

            <div className="pt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {step === 1 && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#48635c] leading-relaxed">
                        A new COD order arrives for <b>{p.name}</b> valued at <b>{inr(order.value)}</b> from {order.campaign}. The traditional checkout would treat this as a standard dispatch.
                      </p>
                      <div className="p-4 bg-[#faece9] rounded-xl border border-[#f5d0cb] text-[#9a382c] space-y-2">
                        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                          <AlertTriangle size={15} /> Initial Order Risk Signals
                        </div>
                        <ul className="text-xs space-y-1 pl-4 list-disc text-[#9a382c]">
                          <li>Incomplete street address entered during fast mobile checkout</li>
                          <li>First-time shopper with zero prior order history</li>
                          <li>High RTO Pincode: {pin.code} ({pin.city}) with 28% historical return rate</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#48635c] leading-relaxed">
                        Rather than guessing, Arthiva calculates Expected Value (EV) across all predefined order journeys taking into account margin, freight loss, and retention.
                      </p>
                      <div className="p-4 bg-[#f4f8f6] rounded-xl border border-[#d6ecde] space-y-2">
                        <div className="text-xs font-bold text-[#1a5542] flex items-center justify-between">
                          <span>Winning Strategy: {ev.best.name}</span>
                          <span className="money text-sm font-bold text-[#1f8a5b]">{inr(ev.best.ev)} expected</span>
                        </div>
                        <p className="text-xs text-[#527d6e]">
                          {ev.explanation}
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#48635c] leading-relaxed">
                        Buyer receives an automated confirmation link. They verify complete apartment details and agree to pay a small ₹150 advance to unlock express delivery.
                      </p>
                      <div className="p-4 bg-[#eaf5ef] rounded-xl border border-[#cbe5d5] text-[#196547] space-y-1">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <CheckCircle size={15} /> Order Health Score Climbed to 88/100
                        </div>
                        <p className="text-xs text-[#31795c]">
                          Address complete. Intent verified. Order approved for courier dispatch.
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#48635c] leading-relaxed">
                        In transit, courier delivery executive marks an exception: <i>Customer unreachable on phone</i>. Standard courier flow would trigger an automatic RTO return.
                      </p>
                      <div className="p-4 bg-[#fcf3e0] rounded-xl border border-[#f5dfad] text-[#8f6412] space-y-1">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <AlertTriangle size={15} /> NDR Raised in Real Time
                        </div>
                        <p className="text-xs text-[#9a6e19]">
                          Arthiva catches the webhook within 60 seconds and queues an instant Delivery Rescue flow.
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#48635c] leading-relaxed">
                        Arthiva dispatches a personalized WhatsApp notification with one-tap reschedule options.
                      </p>
                      <div className="p-4 bg-[#f5f8f6] rounded-xl border border-[#e2eae6] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#1f7354]">
                          <MessageSquare size={15} /> WhatsApp Rescue Dispatched
                        </div>
                        <blockquote className="text-xs text-[#39564e] italic bg-white p-3 rounded-lg border border-[#e5eeea]">
                          "Hi {cust.name}, Delhivery missed you for order MP-1042. Tap here to select your preferred reattempt slot for tomorrow morning."
                        </blockquote>
                      </div>
                    </div>
                  )}

                  {step === 6 && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#48635c] leading-relaxed">
                        Buyer confirmed reattempt for 11 AM next day. Courier successfully delivered the package and collected payment.
                      </p>
                      <div className="p-4 bg-[#0e3b43] text-white rounded-xl space-y-2">
                        <div className="text-xs font-bold text-[#8fc4bd] uppercase tracking-wider">
                          Net Profit Preserved
                        </div>
                        <b className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#f5a524] block money">
                          {inr(order.value - p.cogs - 90)}
                        </b>
                        <p className="text-xs text-[#a2cac3]">
                          Saved ₹280 in two-way reverse shipping and inventory damage vs. baseline write-off.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-4 border-t border-[#edf1ef] mt-4 flex items-center justify-between">
            <button
              type="button"
              className="button button-soft text-xs font-bold py-2 px-3.5"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ArrowLeft size={13} /> Previous
            </button>

            {step < 6 ? (
              <button
                type="button"
                className="button button-primary text-xs font-bold py-2 px-4 inline-flex items-center gap-1.5"
                onClick={advanceStep}
              >
                Simulate Next Step <ArrowRight size={13} />
              </button>
            ) : (
              <Link href="/orders" className="button button-primary text-xs font-bold py-2 px-4 inline-flex items-center gap-1.5">
                Inspect All Orders <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </section>

        {/* Live Order Telemetry Bento Card (5 Cols) */}
        <aside className="col-span-12 lg:col-span-5 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-4">
          <div className="pb-3 border-b border-[#edf1ef] flex items-center justify-between">
            <div>
              <span className="eyebrow text-[#7b8b87]">ORDER TELEMETRY</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                {order.id} Live Manifest
              </h2>
            </div>
            <span className={`status text-xs font-bold ${order.status === 'Delivered' ? 'done' : order.status === 'NDR raised' ? 'warn' : ''}`}>
              <i /> {order.status}
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#f8faf9] rounded-xl border border-[#edf2ef] flex items-center justify-between">
              <span className="text-xs text-[#6e817c]">Health Score</span>
              <b className="text-sm font-bold text-[#0e3b43]">{step >= 3 ? '88 / 100 · Healthy' : `${ev.score} / 100 · High Risk`}</b>
            </div>

            <div className="p-3 bg-[#f8faf9] rounded-xl border border-[#edf2ef] flex items-center justify-between">
              <span className="text-xs text-[#6e817c]">Customer</span>
              <b className="text-xs font-bold text-[#0e3b43]">{cust.name} ({cust.city})</b>
            </div>

            <div className="p-3 bg-[#f8faf9] rounded-xl border border-[#edf2ef] flex items-center justify-between">
              <span className="text-xs text-[#6e817c]">Assigned Journey</span>
              <b className="text-xs font-bold text-[#1f8a5b]">{order.journey || ev.best.name}</b>
            </div>

            <div className="p-3 bg-[#f8faf9] rounded-xl border border-[#edf2ef] flex items-center justify-between">
              <span className="text-xs text-[#6e817c]">Courier Partner</span>
              <b className="text-xs font-bold text-[#0e3b43]">{c.name} ({c.success * 100}% benchmark)</b>
            </div>

            <div className="p-3 bg-[#f8faf9] rounded-xl border border-[#edf2ef] flex items-center justify-between">
              <span className="text-xs text-[#6e817c]">Order Value / COGS</span>
              <b className="text-xs font-bold text-[#0e3b43] money">{inr(order.value)} / {inr(p.cogs)}</b>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
