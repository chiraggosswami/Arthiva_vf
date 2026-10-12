import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ArthivaLogo } from './ArthivaLogo';
import { LanguageSelector } from './LanguageSelector';
import { useAuth } from '../state/AuthContext';
import {
  Menu,
  X,
  User,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  ShoppingBag,
  Tag,
  Home
} from 'lucide-react';

export function SiteHeader() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user, logout, openAuthModal } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'AP';
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-[#e1e8e4] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 select-none group">
            <ArthivaLogo size="md" theme="light" accentDotColor="#f5a524" />
            <span className="hidden sm:inline-block text-[10px] font-bold tracking-widest text-[#0e3b43] uppercase px-1.5 py-0.5 rounded bg-[#eaf4ef]">
              {t('common.operations', 'OPERATIONS')}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-[#50635f]">
            <Link
              href="/"
              className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                location === '/' ? 'text-[#0e3b43] bg-[#edf4f0] font-bold' : 'hover:text-[#0e3b43] hover:bg-[#f5f8f7]'
              }`}
            >
              <Home size={15} />
              <span>{t('nav.home', 'Home')}</span>
            </Link>

            <Link
              href="/orders"
              className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                location.startsWith('/orders') ? 'text-[#0e3b43] bg-[#edf4f0] font-bold' : 'hover:text-[#0e3b43] hover:bg-[#f5f8f7]'
              }`}
            >
              <ShoppingBag size={15} />
              <span>{t('nav.orders', 'Orders')}</span>
            </Link>

            <Link
              href="/pricing"
              className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                location === '/pricing' ? 'text-[#0e3b43] bg-[#edf4f0] font-bold' : 'hover:text-[#0e3b43] hover:bg-[#f5f8f7]'
              }`}
            >
              <Tag size={15} />
              <span>{t('nav.pricing', 'Pricing')}</span>
            </Link>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language Selector in Navigation Bar */}
          <LanguageSelector variant="header" />

          {user ? (
            /* Signed In User Menu */
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-2 p-1 pl-2.5 rounded-full border border-[#d6e2de] hover:border-[#9bbcaf] bg-[#f8faf9] transition-all cursor-pointer"
                aria-label="Open user account menu"
                aria-expanded={accountMenuOpen}
              >
                <span className="text-xs font-bold text-[#0e3b43] max-w-[120px] truncate">
                  {user.name}
                </span>
                <div className="w-8 h-8 rounded-full bg-[#0e3b43] text-white flex items-center justify-center text-xs font-bold shadow-xs overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user.name, user.email)
                  )}
                </div>
                <ChevronDown size={14} className="text-[#6c7f7b] mr-1" />
              </button>

              {accountMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#e1e8e4] shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-[#edf2f0]">
                    <p className="text-xs font-bold text-[#0e3b43] truncate">{user.name}</p>
                    <p className="text-[11px] text-[#718580] truncate">{user.email}</p>
                    {user.storeName && (
                      <span className="inline-block mt-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#eaf4ef] text-[#1a625b]">
                        {user.storeName}
                      </span>
                    )}
                  </div>

                  <Link
                    href="/dashboard"
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#1e3c38] hover:bg-[#f4f8f6] flex items-center gap-2.5 transition-colors"
                  >
                    <LayoutDashboard size={15} className="text-[#1a625b]" />
                    <span>{t('common.dashboard', 'Workspace Dashboard')}</span>
                  </Link>

                  <Link
                    href="/orders"
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1e3c38] hover:bg-[#f4f8f6] flex items-center gap-2.5 transition-colors"
                  >
                    <ShoppingBag size={15} className="text-[#1a625b]" />
                    <span>{t('nav.orders', 'Live Order Dispatch')}</span>
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
          ) : (
            /* Signed Out Actions */
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#0e3b43] bg-gradient-to-r from-transparent to-transparent hover:from-[#edf5f1] hover:to-[#e3efe9] border border-transparent hover:border-[#cfdfd7] shadow-2xs hover:shadow-xs transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                {t('common.signIn', 'Sign in')}
              </button>

              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#0e3b43] via-[#134954] to-[#185e6b] hover:from-[#134954] hover:via-[#195c68] hover:to-[#206f7e] text-white shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-1.5"
              >
                <span>{t('common.register', 'Register')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <div className="w-8 h-8 rounded-full bg-[#0e3b43] text-white flex items-center justify-center text-xs font-bold">
              {getInitials(user.name, user.email)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-[#0e3b43] hover:bg-[#f0f5f3] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#e1e8e4] bg-white px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top-2">
          {/* Mobile Language Selector */}
          <LanguageSelector variant="mobile" />

          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-semibold ${
              location === '/' ? 'bg-[#edf4f0] text-[#0e3b43]' : 'text-[#4b5f5b]'
            }`}
          >
            {t('nav.home', 'Home')}
          </Link>
          <Link
            href="/orders"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-semibold ${
              location.startsWith('/orders') ? 'bg-[#edf4f0] text-[#0e3b43]' : 'text-[#4b5f5b]'
            }`}
          >
            {t('nav.orders', 'Orders')}
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-semibold ${
              location === '/pricing' ? 'bg-[#edf4f0] text-[#0e3b43]' : 'text-[#4b5f5b]'
            }`}
          >
            {t('nav.pricing', 'Pricing')}
          </Link>

          <div className="pt-3 border-t border-[#edf2f0]">
            {user ? (
              <div className="space-y-2">
                <div className="px-3 py-1">
                  <div className="text-xs font-bold text-[#0e3b43]">{user.name}</div>
                  <div className="text-[11px] text-[#70847f]">{user.email}</div>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#0e3b43] via-[#134954] to-[#185e6b] hover:from-[#134954] hover:to-[#206f7e] text-white text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  {t('common.dashboard', 'Go to Dashboard')}
                </Link>
                <button
                  type="button"
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-gradient-to-r from-red-50 to-red-100/60 hover:from-red-100 hover:to-red-200/70 border border-red-200/50 text-center transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  {t('common.signOut', 'Sign out')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { openAuthModal('signin'); setMobileMenuOpen(false); }}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-white to-[#f8faf9] hover:from-[#edf5f1] hover:to-[#e4efe9] border border-[#d6e2de] hover:border-[#9bbcaf] text-[#0e3b43] text-center shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  {t('common.signIn', 'Sign in')}
                </button>
                <button
                  type="button"
                  onClick={() => { openAuthModal('register'); setMobileMenuOpen(false); }}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#0e3b43] via-[#134954] to-[#185e6b] hover:from-[#134954] hover:via-[#195c68] hover:to-[#206f7e] text-white text-center shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  {t('common.register', 'Register')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
