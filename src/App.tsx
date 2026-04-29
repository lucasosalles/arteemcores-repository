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
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminChamados from "@/pages/admin/AdminChamados";
import AdminTecnicos from "@/pages/admin/AdminTecnicos";
import AdminPrestadores from "@/pages/admin/AdminPrestadores";
import SindicoPrestadores from "@/pages/sindico/SindicoPrestadores";
import SindicoOrcamentos from "@/pages/sindico/SindicoOrcamentos";
import SindicoCondominios from "@/pages/sindico/SindicoCondominios";
import AdminArquitetos from "@/pages/admin/AdminArquitetos";
import AdminCondominios from "@/pages/admin/AdminCondominios";
import AdminFinanceiro from "@/pages/admin/AdminFinanceiro";
import AdminRelatorios from "@/pages/admin/AdminRelatorios";
import MoradorChamados from "@/pages/morador/MoradorChamados";
import ArquitetoDashboard from "@/pages/arquiteto/ArquitetoDashboard";
import ArquitetoChamados from "@/pages/arquiteto/ArquitetoChamados";
import ArquitetoPrestadores from "@/pages/arquiteto/ArquitetoPrestadores";
import ArquitetoCondominio from "@/pages/arquiteto/ArquitetoCondominio";
import ArquitetoPlano from "@/pages/arquiteto/ArquitetoPlano";
import PrestadorDashboard from "@/pages/prestador/PrestadorDashboard";
import PrestadorChamados from "@/pages/prestador/PrestadorChamados";
import PrestadorOrcamentos from "@/pages/prestador/PrestadorOrcamentos";
import PrestadorServicos from "@/pages/prestador/PrestadorServicos";
import PrestadorClientes from "@/pages/prestador/PrestadorClientes";
import OrcamentosPage from "@/pages/orcamentos/OrcamentosPage";
import PrestadorDisponibilidade from "@/pages/prestador/PrestadorDisponibilidade";
import PlaceholderPage from "@/pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Síndico routes */}
            <Route path="/sindico" element={<ProtectedRoute allowedRoles={['sindico']}><Navigate to="/sindico/dashboard" replace /></ProtectedRoute>} />
            <Route path="/sindico/dashboard" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/sindico/chamados" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoChamados /></AppLayout></ProtectedRoute>} />
            <Route path="/sindico/plano" element={<ProtectedRoute allowedRoles={['sindico']}><Navigate to="/sindico/dashboard" replace /></ProtectedRoute>} />
            <Route path="/sindico/relatorios" element={<ProtectedRoute allowedRoles={['sindico']}><Navigate to="/sindico/dashboard" replace /></ProtectedRoute>} />
            <Route path="/sindico/orcamentos" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoOrcamentos /></AppLayout></ProtectedRoute>} />
            <Route path="/sindico/condominios" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoCondominios /></AppLayout></ProtectedRoute>} />
            <Route path="/sindico/tecnicos" element={<ProtectedRoute allowedRoles={['sindico']}><Navigate to="/sindico/prestadores" replace /></ProtectedRoute>} />
            <Route path="/sindico/prestadores" element={<ProtectedRoute allowedRoles={['sindico']}><AppLayout><SindicoPrestadores /></AppLayout></ProtectedRoute>} />

            {/* Técnico — desativado no Beta 1.0; redireciona para login */}
            <Route path="/tecnico/*" element={<Navigate to="/login" replace />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Navigate to="/admin/dashboard" replace /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/chamados" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminChamados /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/tecnicos" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminTecnicos /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/arquitetos" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminArquitetos /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/condominios" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminCondominios /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/financeiro" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminFinanceiro /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/relatorios" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminRelatorios /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/prestadores" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminPrestadores /></AppLayout></ProtectedRoute>} />

            {/* Morador routes */}
            <Route path="/morador" element={<ProtectedRoute allowedRoles={['morador']}><Navigate to="/morador/chamados" replace /></ProtectedRoute>} />
            <Route path="/morador/chamados" element={<ProtectedRoute allowedRoles={['morador']}><AppLayout><MoradorChamados /></AppLayout></ProtectedRoute>} />
            <Route path="/morador/orcamentos" element={<ProtectedRoute allowedRoles={['morador']}><AppLayout><OrcamentosPage /></AppLayout></ProtectedRoute>} />
            <Route path="/morador/historico" element={<ProtectedRoute allowedRoles={['morador']}><AppLayout><PlaceholderPage title="Histórico" /></AppLayout></ProtectedRoute>} />

            {/* Arquiteto routes */}
            <Route path="/arquiteto" element={<ProtectedRoute allowedRoles={['arquiteto']}><Navigate to="/arquiteto/dashboard" replace /></ProtectedRoute>} />
            <Route path="/arquiteto/dashboard" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/arquiteto/orcamentos" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><OrcamentosPage /></AppLayout></ProtectedRoute>} />
            <Route path="/arquiteto/chamados" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoChamados /></AppLayout></ProtectedRoute>} />
            <Route path="/arquiteto/prestadores" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoPrestadores /></AppLayout></ProtectedRoute>} />
            <Route path="/arquiteto/condominio" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoCondominio /></AppLayout></ProtectedRoute>} />
            <Route path="/arquiteto/plano" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoPlano /></AppLayout></ProtectedRoute>} />

            {/* Prestador routes */}
            <Route path="/prestador" element={<ProtectedRoute allowedRoles={['prestador']}><Navigate to="/prestador/dashboard" replace /></ProtectedRoute>} />
            <Route path="/prestador/dashboard" element={<ProtectedRoute allowedRoles={['prestador']}><AppLayout><PrestadorDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/prestador/chamados" element={<ProtectedRoute allowedRoles={['prestador']}><AppLayout><PrestadorChamados /></AppLayout></ProtectedRoute>} />
            <Route path="/prestador/orcamentos" element={<ProtectedRoute allowedRoles={['prestador']}><AppLayout><PrestadorOrcamentos /></AppLayout></ProtectedRoute>} />
            <Route path="/prestador/servicos" element={<ProtectedRoute allowedRoles={['prestador']}><AppLayout><PrestadorServicos /></AppLayout></ProtectedRoute>} />
            <Route path="/prestador/clientes" element={<ProtectedRoute allowedRoles={['prestador']}><AppLayout><PrestadorClientes /></AppLayout></ProtectedRoute>} />
            <Route path="/prestador/disponibilidade" element={<ProtectedRoute allowedRoles={['prestador']}><Navigate to="/prestador/servicos" replace /></ProtectedRoute>} />
            <Route path="/prestador/historico" element={<ProtectedRoute allowedRoles={['prestador']}><Navigate to="/prestador/dashboard" replace /></ProtectedRoute>} />
            <Route path="/prestador/plano" element={<ProtectedRoute allowedRoles={['prestador']}><Navigate to="/prestador/dashboard" replace /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
