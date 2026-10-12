import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../state/AuthContext';
import { Shell } from './Shell';

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
}

export function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { user, isLoading, openAuthModal, setRequestedRoute } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      // Save requested route so user continues after auth
      setRequestedRoute(location);
      // Open auth modal
      openAuthModal('signin', location);
      // Redirect to landing page /
      setLocation('/');
    }
  }, [user, isLoading, location, setLocation, openAuthModal, setRequestedRoute]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f4f7f5]">
        <div className="text-center p-6 bg-white rounded-2xl border border-[#dce5e1] shadow-md max-w-sm">
          <div className="w-8 h-8 border-3 border-[#0e3b43] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#0e3b43]">Loading Arthiva Workspace...</h3>
          <p className="text-xs text-[#6e7f79] mt-1">Verifying session</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Shell>
      <Component />
    </Shell>
  );
}
