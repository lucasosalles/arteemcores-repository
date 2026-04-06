import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'sindico' | 'tecnico' | 'admin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { session, role, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Timeout de segurança: se após 5s ainda estiver loading, força a decisão
    const timer = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Ainda carregando e não atingiu timeout
  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  // Sem sessão = vai para login
  if (!session) return <Navigate to="/login" replace />;

  // Tem sessão mas role não bate = vai para login
  if (role && !allowedRoles.includes(role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
