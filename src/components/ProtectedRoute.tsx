import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'sindico' | 'tecnico' | 'admin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { session, role, loading } = useAuth();

  // Ainda carregando sessão/role
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  // Sem sessão = login
  if (!session) return <Navigate to="/login" replace />;

  // Tem sessão mas sem role ainda = aguarda (não redireciona)
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Role não permitida = login
  if (!allowedRoles.includes(role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
