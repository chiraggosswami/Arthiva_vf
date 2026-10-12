import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { LandingPage } from '@/pages/LandingPage';
import { PricingPage } from '@/pages/PricingPage';
import { Dashboard, OrdersPage, OrderDetail, Checkout } from '@/pages/Views';
import DeliveryRescuePage from '@/pages/DeliveryRescuePage';
import RtoRecoveryPage from '@/pages/RtoRecoveryPage';
import JourneyRulesPage from '@/pages/JourneyRulesPage';
import IntelligencePage from '@/pages/IntelligencePage';
import IntegrationsPage from '@/pages/IntegrationsPage';
import ListingsPage from '@/pages/ListingsPage';
import ListingDetailPage from '@/pages/ListingDetailPage';
import LabPage from '@/pages/LabPage';
import DemoPage from '@/pages/DemoPage';
import { AppState } from '@/state/AppState';
import { AuthProvider, useAuth } from '@/state/AuthContext';
import { AuthPanel } from '@/components/AuthPanel';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useTranslation } from 'react-i18next';
import { STORAGE_KEY, SUPPORTED_LANGUAGES } from './i18n/config';
import '@/pages/operations.css';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function HomeRoute() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  return <LandingPage />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        {/* Public Landing & Marketing */}
        <Route path="/" component={HomeRoute} />
        <Route path="/pricing" component={PricingPage} />

        {/* Authenticated Workspace Routes */}
        <Route path="/dashboard">
          {() => <ProtectedRoute component={Dashboard} />}
        </Route>
        <Route path="/orders">
          {() => <ProtectedRoute component={OrdersPage} />}
        </Route>
        <Route path="/orders/:id">
          {() => <ProtectedRoute component={OrderDetail} />}
        </Route>
        <Route path="/checkout">
          {() => <ProtectedRoute component={Checkout} />}
        </Route>
        <Route path="/rescue">
          {() => <ProtectedRoute component={DeliveryRescuePage} />}
        </Route>
        <Route path="/recovery">
          {() => <ProtectedRoute component={RtoRecoveryPage} />}
        </Route>
        <Route path="/journeys">
          {() => <ProtectedRoute component={JourneyRulesPage} />}
        </Route>
        <Route path="/listings">
          {() => <ProtectedRoute component={ListingsPage} />}
        </Route>
        <Route path="/listings/:id">
          {() => <ProtectedRoute component={ListingDetailPage} />}
        </Route>
        <Route path="/intelligence">
          {() => <ProtectedRoute component={IntelligencePage} />}
        </Route>
        <Route path="/integrations">
          {() => <ProtectedRoute component={IntegrationsPage} />}
        </Route>
        <Route path="/lab">
          {() => <ProtectedRoute component={LabPage} />}
        </Route>
        <Route path="/demo">
          {() => <ProtectedRoute component={DemoPage} />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function LanguageSync() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const initialSyncUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = i18n.language || 'en';
      const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language);
      document.documentElement.dir = current?.dir || 'ltr';
    }
  }, [i18n.language]);

  // Sync profile's saved preferredLanguage once when a user signs in
  useEffect(() => {
    if (user) {
      if (initialSyncUserRef.current !== user.id) {
        initialSyncUserRef.current = user.id;
        if (user.preferredLanguage && user.preferredLanguage !== i18n.language) {
          i18n.changeLanguage(user.preferredLanguage);
          try {
            localStorage.setItem(STORAGE_KEY, user.preferredLanguage);
          } catch {
            // ignore
          }
        }
      }
    } else {
      initialSyncUserRef.current = null;
    }
  }, [user?.id, user?.preferredLanguage, i18n]);

  return null;
}

function GlobalAuthModal() {
  const { authModalOpen, authModalTab, closeAuthModal } = useAuth();
  if (!authModalOpen) return null;
  return (
    <AuthPanel
      initialTab={authModalTab}
      isModal={true}
      onClose={closeAuthModal}
    />
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <LanguageSync />
          <AppState>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
              <GlobalAuthModal />
            </WouterRouter>
          </AppState>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
