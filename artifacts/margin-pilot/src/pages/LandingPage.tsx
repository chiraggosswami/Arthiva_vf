import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ArthivaLogo } from '../components/ArthivaLogo';
import { SiteHeader } from '../components/SiteHeader';
import { useAuth } from '../state/AuthContext';
import { useAppState } from '../state/AppState';
import {
  ArrowRight,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  LifeBuoy,
  RotateCcw,
  SlidersHorizontal,
  Check,
  Server,
  Lock,
  ChevronRight,
  Zap,
  Layers,
  ArrowUpRight
} from 'lucide-react';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function LandingPage() {
  const { t } = useTranslation();
  const { user, openAuthModal, authModalOpen, authModalTab, closeAuthModal } = useAuth();
  const { orders } = useAppState();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#143d41] flex flex-col font-['Hanken_Grotesk'] selection:bg-[#0e3b43] selection:text-white">
      {/* Header Navigation */}
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#e3efe9]/60 to-transparent pointer-events-none -z-10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#eaf4ef] border border-[#cfdfd7] text-xs font-bold text-[#14533d] animate-in fade-in slide-in-from-bottom-2">
              <Sparkles size={14} className="text-[#1f8a5b]" />
              <span>{t('landing.badge', 'PROFIT-AWARE D2C DISPATCH & DELIVERY INTELLIGENCE')}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-['Bricolage_Grotesque'] tracking-tight text-[#0e3b43] leading-[1.12]">
              {t('landing.headline', 'Stop shipping orders that kill your bottom line.')}
            </h1>

            <p className="text-base sm:text-lg text-[#556e68] max-w-2xl mx-auto leading-relaxed">
              {t('landing.subheadline', 'Arthiva scores every order before dispatch, calculates expected margin across journeys, rescues in-transit delivery exceptions (NDRs), and turns RTO losses into recovered profits.')}
            </p>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => setLocation('/dashboard')}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#0e3b43] via-[#134954] to-[#185e6b] hover:from-[#134954] hover:via-[#195c68] hover:to-[#206f7e] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0e3b43]/20 hover:shadow-xl hover:shadow-[#0e3b43]/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <span>{t('landing.openDashboard', 'Open Live Dashboard')}</span>
                  <ArrowRight size={17} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthModal('register', '/dashboard')}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#0e3b43] via-[#134954] to-[#185e6b] hover:from-[#134954] hover:via-[#195c68] hover:to-[#206f7e] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0e3b43]/20 hover:shadow-xl hover:shadow-[#0e3b43]/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    <span>{t('landing.createAccount', 'Create your account')}</span>
                    <ArrowRight size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() => openAuthModal('signin', '/dashboard')}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-white via-[#fcfdfe] to-[#f6faf8] hover:from-[#edf6f2] hover:to-[#e3efe9] text-[#0e3b43] font-bold text-sm border border-[#d6e2de] hover:border-[#9bbcaf] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>{t('landing.alreadyAccount', 'Already have an account? Sign in')}</span>
                  </button>
                </>
              )}
            </div>

            {/* Privacy & Server-Sync Note */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-5 text-xs text-[#6e8580]">
              <span className="flex items-center gap-1.5">
                <Lock size={13} className="text-[#1f8a5b]" />
                <span>Zero telemetry · Private workspace</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Server size={13} className="text-[#1f8a5b]" />
                <span>Real-time server sync & persistent state</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[#1f8a5b]" />
                <span>Multi-seller COD & OTP evaluation</span>
              </span>
            </div>

          </div>

          {/* Product Preview Card (Interactive Workspace Teaser) */}
          <div className="mt-14 max-w-5xl mx-auto rounded-3xl bg-white border border-[#dce6e2] shadow-[0_20px_50px_rgba(14,59,67,0.08)] overflow-hidden">
            
            {/* Window Topbar Preview */}
            <div className="bg-[#0e3b43] text-white px-5 py-3.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
                </div>
                <span className="text-xs font-bold text-white/80 ml-2">arthiva · operations preview</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f5a524] text-[#0e3b43]">
                  {t('landing.demoBadge', '80+ SEEDED DEMO ORDERS')}
                </span>
                <Link
                  href="/orders"
                  className="text-xs font-bold text-white/90 hover:text-white flex items-center gap-1 ml-2"
                >
                  <span>{t('landing.exploreManifest', 'Explore manifest')}</span> <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            {/* Mini Dashboard Preview Inside Card */}
            <div className="p-6 sm:p-8 bg-[#fafcfb] space-y-6">
              
              {/* Stat Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-[#e2eae6] shadow-xs">
                  <div className="text-[11px] font-bold text-[#6a807a]">REALISED REVENUE</div>
                  <div className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] mt-1">₹3,42,850</div>
                  <div className="text-[10px] text-[#1f8a5b] font-semibold mt-1 flex items-center gap-1">
                    <ArrowUpRight size={11} /> +12.4% vs last cycle
                  </div>
                </div>

                <div className="bg-[#f2f8f4] p-4 rounded-2xl border border-[#d6ecde] shadow-xs">
                  <div className="text-[11px] font-bold text-[#2e6d56]">EXPECTED MARGIN</div>
                  <div className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#14533d] mt-1">₹84,200</div>
                  <div className="text-[10px] text-[#14533d] font-semibold mt-1">After journey interventions</div>
                </div>

                <div className="bg-[#fcf9f2] p-4 rounded-2xl border border-[#f5e7c8] shadow-xs">
                  <div className="text-[11px] font-bold text-[#855e1a]">RTO EXPOSURE</div>
                  <div className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#754a02] mt-1">14.8%</div>
                  <div className="text-[10px] text-[#1f8a5b] font-semibold mt-1 flex items-center gap-1">
                    <TrendingDown size={11} /> Dropped from 22.4%
                  </div>
                </div>

                <div className="bg-[#0e3b43] text-white p-4 rounded-2xl border border-[#0b2f36] shadow-xs">
                  <div className="text-[11px] font-bold text-[#a0c2bd]">MARGIN PROTECTED</div>
                  <div className="text-2xl font-bold font-['Bricolage_Grotesque'] text-white mt-1">₹28,640</div>
                  <div className="text-[10px] text-[#4ee29d] font-bold mt-1">+₹340/order vs baseline</div>
                </div>
              </div>

              {/* Sample Dispatch Rows */}
              <div className="bg-white rounded-2xl border border-[#e2eae6] overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-[#f8faf9] border-b border-[#e9f0ec] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0e3b43]">Live Scored Orders (Sample)</span>
                  <span className="text-[11px] text-[#6d817d]">Top 3 of {orders.length} orders</span>
                </div>

                <div className="divide-y divide-[#edf2ef]">
                  {orders.slice(0, 3).map((o, idx) => (
                    <div key={o.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="font-bold text-[#0e3b43]">{o.id}</div>
                        <div className="text-[11px] text-[#718580] mt-0.5">PIN {o.pincode} · {o.payment}</div>
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-[11px] font-semibold text-[#18534d] px-2 py-0.5 rounded bg-[#eaf4ef]">
                          {o.journey}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#14533d] font-mono">
                          {inr(o.price * 0.28)} EV
                        </div>
                        <span className="text-[10px] text-[#6b807b]">Health: {o.score}/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Banner inside preview */}
              <div className="p-4 rounded-2xl bg-[#edf5f1] border border-[#d2e4db] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[#1e4e46]">
                  <b>Interactive Demo:</b> Switch between Ojas Botanics, Kavya Couture, Urban Stride, and Aura Living in the dashboard.
                </div>
                <button
                  type="button"
                  onClick={() => openAuthModal('signin', '/dashboard')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0e3b43] via-[#134954] to-[#185e6b] hover:from-[#134954] hover:via-[#195c68] hover:to-[#206f7e] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shrink-0 cursor-pointer text-center"
                >
                  Open Live Dashboard
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Feature Pillars Section */}
      <section className="py-16 bg-white border-y border-[#e1e8e4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
              {t('landing.pillarsTitle', 'Engineered specifically for Indian D2C delivery economics')}
            </h2>
            <p className="text-sm text-[#5f7570] mt-2">
              {t('landing.pillarsSubtitle', 'Most platforms only look at RTO risk percentage. Arthiva computes pure expected margin in rupees to recommend the highest-yield action.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            
            {/* Pillar 1 */}
            <div className="p-6 rounded-2xl bg-[#f8faf9] border border-[#e1e8e4] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#eaf4ef] text-[#14533d] flex items-center justify-center font-bold">
                <SlidersHorizontal size={20} />
              </div>
              <h3 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                {t('landing.pillar1Title', 'Order Health & Journey Scoring')}
              </h3>
              <p className="text-xs text-[#556e68] leading-relaxed">
                {t('landing.pillar1Desc', 'Evaluate Full COD, OTP confirmation, and Prepaid incentive journeys side-by-side using real courier and pincode history.')}
              </p>
              <Link href="/journeys" className="inline-flex items-center gap-1 text-xs font-bold text-[#1a625b] hover:underline pt-1">
                <span>View journey rules</span> <ChevronRight size={13} />
              </Link>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-2xl bg-[#f8faf9] border border-[#e1e8e4] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#fcf2dd] text-[#9b6807] flex items-center justify-center font-bold">
                <LifeBuoy size={20} />
              </div>
              <h3 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                {t('landing.pillar2Title', 'Delivery Rescue (NDR Board)')}
              </h3>
              <p className="text-xs text-[#556e68] leading-relaxed">
                {t('landing.pillar2Desc', 'Address fake delivery attempts, customer unavailable flags, and incorrect addresses with automated WhatsApp interventions.')}
              </p>
              <Link href="/rescue" className="inline-flex items-center gap-1 text-xs font-bold text-[#1a625b] hover:underline pt-1">
                <span>Explore NDR rescue</span> <ChevronRight size={13} />
              </Link>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-2xl bg-[#f8faf9] border border-[#e1e8e4] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#fceeed] text-[#b83f33] flex items-center justify-center font-bold">
                <RotateCcw size={20} />
              </div>
              <h3 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                {t('landing.pillar3Title', 'RTO Recovery & Write-off Engine')}
              </h3>
              <p className="text-xs text-[#556e68] leading-relaxed">
                {t('landing.pillar3Desc', 'Rank recovery actions for RTO-initiated orders: decide instantly whether to reattempt, reroute to local fulfillment, or restock.')}
              </p>
              <Link href="/recovery" className="inline-flex items-center gap-1 text-xs font-bold text-[#1a625b] hover:underline pt-1">
                <span>Explore RTO recovery</span> <ChevronRight size={13} />
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#0a292f] text-white/80 py-12 border-t border-white/10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
            <div className="flex items-center gap-3">
              <ArthivaLogo size="md" theme="dark" accentDotColor="#f5a524" />
              <span className="text-[11px] text-white/50">· D2C Profit Operations Pilot</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-white/70">
              <Link href="/" className="hover:text-white transition-colors">{t('nav.home', 'Home')}</Link>
              <Link href="/orders" className="hover:text-white transition-colors">{t('nav.orders', 'Orders')}</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">{t('nav.pricing', 'Pricing')}</Link>
              <Link href="/dashboard" className="hover:text-white transition-colors">{t('nav.dashboard', 'Dashboard')}</Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/50">
            <p>
              {t('landing.footerDisclaimer', 'Arthiva is a small-scale pilot project built for Indian D2C ecommerce brands. Local state persists seamlessly across sessions.')}
            </p>
            <p>© {new Date().getFullYear()} Arthiva Operations. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
