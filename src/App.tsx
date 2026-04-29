import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

// Lazy-loaded pages — each page bundle is only fetched when the route is first visited
const LoginPage             = lazy(() => import("@/pages/LoginPage"));
const NotFound              = lazy(() => import("./pages/NotFound"));
const PlaceholderPage       = lazy(() => import("@/pages/PlaceholderPage"));

// Síndico
const SindicoDashboard      = lazy(() => import("@/pages/sindico/SindicoDashboard"));
const SindicoChamados       = lazy(() => import("@/pages/sindico/SindicoChamados"));
const SindicoPrestadores    = lazy(() => import("@/pages/sindico/SindicoPrestadores"));
const SindicoOrcamentos     = lazy(() => import("@/pages/sindico/SindicoOrcamentos"));
const SindicoCondominios    = lazy(() => import("@/pages/sindico/SindicoCondominios"));

// Admin
const AdminDashboard        = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminChamados         = lazy(() => import("@/pages/admin/AdminChamados"));
const AdminTecnicos         = lazy(() => import("@/pages/admin/AdminTecnicos"));
const AdminPrestadores      = lazy(() => import("@/pages/admin/AdminPrestadores"));
const AdminArquitetos       = lazy(() => import("@/pages/admin/AdminArquitetos"));
const AdminCondominios      = lazy(() => import("@/pages/admin/AdminCondominios"));
const AdminFinanceiro       = lazy(() => import("@/pages/admin/AdminFinanceiro"));
const AdminRelatorios       = lazy(() => import("@/pages/admin/AdminRelatorios"));

// Morador
const MoradorChamados       = lazy(() => import("@/pages/morador/MoradorChamados"));
const OrcamentosPage        = lazy(() => import("@/pages/orcamentos/OrcamentosPage"));

// Arquiteto
const ArquitetoDashboard    = lazy(() => import("@/pages/arquiteto/ArquitetoDashboard"));
const ArquitetoOrcamentos   = lazy(() => import("@/pages/arquiteto/ArquitetoOrcamentos"));
const ArquitetoPrestadores  = lazy(() => import("@/pages/arquiteto/ArquitetoPrestadores"));
const ArquitetoPortfolio    = lazy(() => import("@/pages/arquiteto/ArquitetoPortfolio"));
const ArquitetoClientes     = lazy(() => import("@/pages/arquiteto/ArquitetoClientes"));

// Prestador
const PrestadorDashboard    = lazy(() => import("@/pages/prestador/PrestadorDashboard"));
const PrestadorChamados     = lazy(() => import("@/pages/prestador/PrestadorChamados"));
const PrestadorOrcamentos   = lazy(() => import("@/pages/prestador/PrestadorOrcamentos"));
const PrestadorServicos     = lazy(() => import("@/pages/prestador/PrestadorServicos"));
const PrestadorClientes     = lazy(() => import("@/pages/prestador/PrestadorClientes"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
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
              <Route path="/arquiteto/orcamentos" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoOrcamentos /></AppLayout></ProtectedRoute>} />
              <Route path="/arquiteto/prestadores" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoPrestadores /></AppLayout></ProtectedRoute>} />
              <Route path="/arquiteto/portfolio" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoPortfolio /></AppLayout></ProtectedRoute>} />
              <Route path="/arquiteto/clientes" element={<ProtectedRoute allowedRoles={['arquiteto']}><AppLayout><ArquitetoClientes /></AppLayout></ProtectedRoute>} />
              <Route path="/arquiteto/chamados" element={<ProtectedRoute allowedRoles={['arquiteto']}><Navigate to="/arquiteto/dashboard" replace /></ProtectedRoute>} />
              <Route path="/arquiteto/condominio" element={<ProtectedRoute allowedRoles={['arquiteto']}><Navigate to="/arquiteto/dashboard" replace /></ProtectedRoute>} />
              <Route path="/arquiteto/plano" element={<ProtectedRoute allowedRoles={['arquiteto']}><Navigate to="/arquiteto/dashboard" replace /></ProtectedRoute>} />

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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
