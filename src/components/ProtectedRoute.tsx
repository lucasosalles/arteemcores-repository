import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'sindico' | 'tecnico' | 'admin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { session, role, loading } = useAuth();

  // Se tem sessão e role, renderiza direto sem esperar loading
  if (session && role && allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  // Sem sessão confirmada e loading terminou = vai para login
  if (!loading && !session) {
    return <Navigate to="/login" replace />;
  }

  // Role não permitida — redireciona para o dashboard do próprio perfil
  if (!loading && session && role && !allowedRoles.includes(role)) {
    const roleHome: Record<string, string> = {
      sindico: '/sindico/dashboard',
      tecnico: '/tecnico/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={roleHome[role] ?? '/login'} replace />;
  }

  // Ainda carregando
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;
