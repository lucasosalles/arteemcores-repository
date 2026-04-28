import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, LogOut,
  ClipboardList, Star, BarChart3, Building2, CreditCard,
  History, Users, FileText, CalendarCheck
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const sindicoNav: NavItem[] = [
  { label: 'Dashboard',   path: '/sindico/dashboard',  icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Chamados',    path: '/sindico/chamados',   icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Orçamentos',  path: '/sindico/orcamentos', icon: <FileText className="w-5 h-5" /> },
  { label: 'Prestadores', path: '/sindico/prestadores', icon: <Users className="w-5 h-5" /> },
  { label: 'Relatórios',  path: '/sindico/relatorios', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Meu Plano',   path: '/sindico/plano',      icon: <Star className="w-5 h-5" /> },
];

const moradorNav: NavItem[] = [
  { label: 'Chamados',   path: '/morador/chamados',   icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Orçamentos', path: '/morador/orcamentos', icon: <FileText className="w-5 h-5" /> },
  { label: 'Histórico',  path: '/morador/historico',  icon: <History className="w-5 h-5" /> },
];

const arquitetoNav: NavItem[] = [
  { label: 'Dashboard',   path: '/arquiteto/dashboard',  icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Orçamentos',  path: '/arquiteto/orcamentos', icon: <FileText className="w-5 h-5" /> },
  { label: 'Chamados',    path: '/arquiteto/chamados',   icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Prestadores', path: '/arquiteto/prestadores',icon: <Users className="w-5 h-5" /> },
  { label: 'Condomínio',  path: '/arquiteto/condominio', icon: <Building2 className="w-5 h-5" /> },
  { label: 'Meu Plano',   path: '/arquiteto/plano',      icon: <Star className="w-5 h-5" /> },
];

const prestadorNav: NavItem[] = [
  { label: 'Dashboard',  path: '/prestador/dashboard',  icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Chamados',   path: '/prestador/chamados',   icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Orçamentos', path: '/prestador/orcamentos', icon: <FileText className="w-5 h-5" /> },
  { label: 'Serviços',   path: '/prestador/servicos',   icon: <CalendarCheck className="w-5 h-5" /> },
  { label: 'Clientes',   path: '/prestador/clientes',   icon: <Users className="w-5 h-5" /> },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard',   path: '/admin/dashboard',    icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Chamados',    path: '/admin/chamados',     icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Prestadores', path: '/admin/prestadores',  icon: <Users className="w-5 h-5" /> },
  { label: 'Condomínios', path: '/admin/condominios',  icon: <Building2 className="w-5 h-5" /> },
  { label: 'Financeiro',  path: '/admin/financeiro',   icon: <CreditCard className="w-5 h-5" /> },
  { label: 'Relatórios',  path: '/admin/relatorios',   icon: <BarChart3 className="w-5 h-5" /> },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const navItems =
    role === 'sindico'   ? sindicoNav   :
    role === 'morador'   ? moradorNav   :
    role === 'arquiteto' ? arquitetoNav :
    role === 'prestador' ? prestadorNav :
    adminNav;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0 hidden lg:flex">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-gradient-gold text-lg">Fino Haus</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/sindico/dashboard' || item.path === '/admin/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'gradient-primary text-foreground shadow-md glow-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Notifications + User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <NotificationBell />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{profile?.full_name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-gradient-gold text-sm">Fino Haus</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex">
        {navItems.slice(0, 4).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/sindico/dashboard' || item.path === '/admin/dashboard'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-secondary' : 'text-muted-foreground'
              }`
            }
          >
            {item.icon}
            <span className="mt-1">{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto lg:p-0 pt-16 pb-20 lg:pt-0 lg:pb-0">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
