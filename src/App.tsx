import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import SindicoDashboard from "@/pages/sindico/SindicoDashboard";
import SindicoChamados from "@/pages/sindico/SindicoChamados";
import SindicoPlano from "@/pages/sindico/SindicoPlano";
import SindicoRelatorios from "@/pages/sindico/SindicoRelatorios";
import TecnicoDashboard from "@/pages/tecnico/TecnicoDashboard";
import TecnicoDisponiveis from "@/pages/tecnico/TecnicoDisponiveis";
import TecnicoHistorico from "@/pages/tecnico/TecnicoHistorico";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminChamados from "@/pages/admin/AdminChamados";
import AdminTecnicos from "@/pages/admin/AdminTecnicos";
import AdminCondominios from "@/pages/admin/AdminCondominios";
import AdminFinanceiro from "@/pages/admin/AdminFinanceiro";
import AdminRelatorios from "@/pages/admin/AdminRelatorios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const { session, role, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">Sem permissão de acesso</p>
          <p className="text-muted-foreground text-sm">Sua conta não possui um perfil de acesso configurado. Contacte o administrador.</p>
        </div>
      </div>
    );
  }
  const redirectMap: Record<string, string> = { sindico: '/sindico', tecnico: '/tecnico', admin: '/admin' };
  return <Navigate to={redirectMap[role]} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Síndico routes */}
            <Route path="/sindico" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/sindico/chamados" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoChamados /></AppLayout></ProtectedRoute>} />
            <Route path="/sindico/plano" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoPlano /></AppLayout></ProtectedRoute>} />
            <Route path="/sindico/relatorios" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoRelatorios /></AppLayout></ProtectedRoute>} />

            {/* Técnico routes */}
            <Route path="/tecnico" element={<ProtectedRoute allowedRoles={['tecnico']}><AppLayout><TecnicoDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/tecnico/disponiveis" element={<ProtectedRoute allowedRoles={['tecnico']}><AppLayout><TecnicoDisponiveis /></AppLayout></ProtectedRoute>} />
            <Route path="/tecnico/historico" element={<ProtectedRoute allowedRoles={['tecnico']}><AppLayout><TecnicoHistorico /></AppLayout></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/chamados" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminChamados /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/tecnicos" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminTecnicos /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/condominios" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminCondominios /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/financeiro" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminFinanceiro /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/relatorios" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminRelatorios /></AppLayout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
