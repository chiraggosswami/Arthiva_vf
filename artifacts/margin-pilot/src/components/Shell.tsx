import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Activity, CircleHelp, Plus, ShoppingBag, LifeBuoy, RotateCcw, SlidersHorizontal, BrainCircuit, Database, PlayCircle, FlaskConical, Layers, ChevronDown, Check, Store, LogOut, LayoutDashboard } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { LoadingScreen } from './LoadingScreen';
import { ArthivaLogo } from './ArthivaLogo';
import { LanguageSelector } from './LanguageSelector';
import { AddSellerCsvDialog } from './AddSellerCsvDialog';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthContext';
import type { ReactNode } from 'react';

export function Shell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const { t } = useTranslation();
  const { sellers, currentSeller, setCurrentSellerId } = useAppState();
  const { user, logout } = useAuth();
  const [sellerOpen, setSellerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [addSellerOpen, setAddSellerOpen] = useState(false);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'NP';
  };

  return (
    <div className="app-shell">
      <LoadingScreen />
      <CommandPalette />
      
      <aside className="sidebar" style={{ backgroundColor: currentSeller.accentColor.primary, transition: 'background-color 0.3s ease', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Brand with arthiva calligraphic wordmark */}
        <Link href="/dashboard" className="brand flex items-center justify-between group shrink-0" style={{ padding: '2px 4px', marginBottom: '2px' }}>
          <div className="flex items-center gap-2">
            <ArthivaLogo size="md" theme="dark" accentDotColor={currentSeller.accentColor.highlight} />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] px-1.5 py-0.5 rounded text-white/80 bg-white/10">
              OPS
            </span>
          </div>
        </Link>

        {/* Multi-Seller Workspace Selector */}
        <div className="relative mt-2.5 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setSellerOpen(!sellerOpen)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-white transition-all text-left text-xs font-semibold select-none"
            aria-label="Switch brand seller"
            aria-expanded={sellerOpen}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: currentSeller.accentColor.highlight }}
            />
            <div className="min-w-0 flex-1">
              <span className="truncate text-xs font-bold leading-tight flex items-center gap-1.5">
                <span className="truncate">{currentSeller.name}</span>
                {currentSeller.connectionMode === 'live_sync' && (
                  <span className="text-[8.5px] px-1 py-0.2 rounded bg-amber-400/25 text-amber-300 font-bold uppercase shrink-0">
                    LIVE
                  </span>
                )}
              </span>
              <span className="block truncate text-[9.5px] text-white/60 leading-tight">{currentSeller.category}</span>
            </div>
            <ChevronDown size={12} className={`text-white/60 transition-transform ${sellerOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {sellerOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 p-1 bg-[#0b282d] border border-white/20 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[9px] font-bold tracking-wider text-white/40 uppercase">
                Active Brand Sellers
              </div>
              {sellers.map((s) => {
                const isSelected = s.id === currentSeller.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setCurrentSellerId(s.id);
                      setSellerOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                      isSelected ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.accentColor.highlight }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate flex items-center gap-1.5">
                        <span className="truncate">{s.name}</span>
                        {s.connectionMode === 'live_sync' && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold uppercase shrink-0">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[9.5px] text-white/50 truncate">{s.category}</div>
                    </div>
                    {isSelected && <Check size={12} className="text-white shrink-0 ml-auto" />}
                  </button>
                );
              })}

              <div className="border-t border-white/10 my-1" />
              <button
                type="button"
                onClick={() => {
                  setSellerOpen(false);
                  setAddSellerOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-bold text-[#f5a524] hover:bg-white/10 hover:text-[#fbbf24] transition-colors cursor-pointer select-none"
              >
                <Plus size={13} className="shrink-0 text-[#f5a524]" />
                <span>+ Add New Seller</span>
              </button>
            </div>
          )}
        </div>

        <div className="nav-label" style={{ padding: '0 6px 3px', fontSize: '9.5px' }}>{t('common.activeWorkspace', 'WORKSPACE')}</div>
        <nav className="nav-links" style={{ gap: '2px' }}>
          <Link href="/dashboard" className={`nav-link ${path === '/dashboard' || path === '/' ? 'active' : ''}`}>
            <Activity size={16} /> {t('nav.commandCentre', 'Command centre')}
          </Link>
          <Link href="/orders" className={`nav-link ${path.startsWith('/orders') ? 'active' : ''}`}>
            <ShoppingBag size={16} /> {t('nav.orders', 'Orders')} <span className="nav-count">80+</span>
          </Link>
          <Link href="/rescue" className={`nav-link ${path === '/rescue' ? 'active' : ''}`}>
            <LifeBuoy size={16} /> {t('nav.rescue', 'Delivery rescue')}
          </Link>
          <Link href="/recovery" className={`nav-link ${path === '/recovery' ? 'active' : ''}`}>
            <RotateCcw size={16} /> {t('nav.recovery', 'RTO recovery')}
          </Link>
          <Link href="/listings" className={`nav-link ${path.startsWith('/listings') ? 'active' : ''}`}>
            <Layers size={16} /> {t('nav.listings', 'Listing intelligence')}
          </Link>
          <Link href="/journeys" className={`nav-link ${path === '/journeys' ? 'active' : ''}`}>
            <SlidersHorizontal size={16} /> {t('nav.journeys', 'Journey rules')}
          </Link>

          <div className="nav-label" style={{ marginTop: '8px', padding: '0 6px 3px', fontSize: '9.5px' }}>SYSTEM</div>
          <Link href="/intelligence" className={`nav-link ${path === '/intelligence' ? 'active' : ''}`}>
            <BrainCircuit size={16} /> {t('nav.intelligence', 'Intelligence')}
          </Link>
          <Link href="/integrations" className={`nav-link ${path === '/integrations' ? 'active' : ''}`} style={{ backgroundColor: '#551818' }}>
            <Database size={16} /> {t('nav.integrations', 'Integrations')}
          </Link>
          <Link href="/lab" className={`nav-link ${path === '/lab' ? 'active' : ''}`}>
            <FlaskConical size={16} /> {t('nav.lab', 'Simulation Lab')}
          </Link>
          <Link href="/demo" className={`nav-link ${path === '/demo' ? 'active' : ''}`}>
            <PlayCircle size={16} /> {t('nav.demo', 'Demo Mode')}
          </Link>
        </nav>

        <div className="sidebar-bottom shrink-0 mt-auto" style={{ paddingTop: '10px', marginTop: '10px' }}>
          <div className="today-dot" style={{ backgroundColor: currentSeller.accentColor.highlight }} />
          <div>
            <b>{currentSeller.name}</b>
            <small>Connected · India Operations</small>
          </div>
          <CircleHelp size={15} />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">
            <span className="text-xs font-bold text-[#627772]">arthiva</span>
            <span>/</span>
            <b className="text-xs">
              {path === '/checkout'
                ? 'NEW ORDER'
                : path.startsWith('/orders/')
                ? 'ORDER DETAIL'
                : path === '/orders'
                ? 'ORDERS'
                : path === '/rescue'
                ? 'DELIVERY RESCUE'
                : path === '/recovery'
                ? 'RTO RECOVERY'
                : path.startsWith('/listings/')
                ? 'LISTING DETAIL'
                : path === '/listings'
                ? 'LISTING INTELLIGENCE'
                : path === '/journeys'
                ? 'JOURNEY RULES'
                : path === '/intelligence'
                ? 'INTELLIGENCE'
                : path === '/integrations'
                ? 'INTEGRATIONS'
                : path === '/lab'
                ? 'SIMULATION LAB'
                : path === '/demo'
                ? 'DEMO MODE'
                : 'OVERVIEW'}
            </b>
          </div>

          <div className="top-actions flex items-center gap-3">
            {/* Language Selector */}
            <LanguageSelector variant="compact" />

            {/* Seller Quick Select pill in header */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e1e8e4] bg-white text-xs font-semibold text-[#0e3b43]">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: currentSeller.accentColor.highlight }}
              />
              <span className="font-bold">{currentSeller.name}</span>
            </div>

            <span className="live text-xs" title="Press Cmd+K for command menu">
              <i style={{ backgroundColor: currentSeller.accentColor.secondary }} /> Live data
            </span>

            <Link
              href="/checkout"
              className="button button-primary top-new text-xs font-bold"
              style={{ backgroundColor: currentSeller.accentColor.primary }}
            >
              <Plus size={16} /> {t('common.newOrder', 'New order')}
            </Link>

            {/* Circular user avatar button with account menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-xs cursor-pointer border border-[#d6e2de] hover:opacity-90 transition-all overflow-hidden"
                style={{ backgroundColor: currentSeller.accentColor.primary, color: '#ffffff' }}
                title={user ? `${user.name} (${user.email})` : currentSeller.name}
                aria-label="Open user profile menu"
                aria-expanded={userMenuOpen}
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(user?.name, user?.email)
                )}
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#e1e8e4] shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-[#edf2f0]">
                    <p className="text-xs font-bold text-[#0e3b43] truncate">{user?.name || currentSeller.name}</p>
                    <p className="text-[11px] text-[#718580] truncate">{user?.email || 'operator@arthiva.local'}</p>
                    <span className="inline-block mt-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#eaf4ef] text-[#1a625b]">
                      {t('common.activeWorkspace', 'Active Workspace')}
                    </span>
                  </div>

                  <Link
                    href="/dashboard"
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#1e3c38] hover:bg-[#f4f8f6] flex items-center gap-2.5 transition-colors"
                  >
                    <LayoutDashboard size={15} className="text-[#1a625b]" />
                    <span>{t('common.dashboard', 'Dashboard')}</span>
                  </Link>

                  <Link
                    href="/"
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1e3c38] hover:bg-[#f4f8f6] flex items-center gap-2.5 transition-colors"
                  >
                    <Store size={15} className="text-[#1a625b]" />
                    <span>{t('common.home', 'Landing Page')}</span>
                  </Link>

                  <div className="border-t border-[#edf2f0] my-1" />

                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>{t('common.signOut', 'Sign out')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="content">
          {children}
        </section>
      </main>

      {/* Add New Seller & CSV Import Flow Modal */}
      <AddSellerCsvDialog open={addSellerOpen} onOpenChange={setAddSellerOpen} />
    </div>
  );
}

