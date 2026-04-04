import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Paintbrush, Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type RoleTab = 'sindico' | 'tecnico' | 'admin';

const roleLabels: Record<RoleTab, string> = {
  sindico: 'Síndico',
  tecnico: 'Técnico',
  admin: 'Admin',
};

const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RoleTab>('sindico');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error('Erro ao fazer login', {
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos.' 
          : error.message,
      });
      setIsLoading(false);
    }
    // redirect is handled by AuthContext + RootRedirect
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="lg:w-1/2 gradient-primary flex flex-col items-center justify-center p-8 lg:p-16 min-h-[300px] lg:min-h-screen relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-secondary/10 blur-2xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-accent/10 blur-3xl" />
        
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full gradient-gold flex items-center justify-center shadow-lg animate-pulse-glow">
            <Paintbrush className="w-12 h-12 text-secondary-foreground" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gradient-gold mb-4">
            ARTE EM CORES
          </h1>
          <p className="text-lg text-foreground/80 max-w-md leading-relaxed">
            Manutenção previsível.<br />Condomínio organizado.
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Sistema de Gestão</h2>
            <p className="text-muted-foreground mt-2">Acesse sua conta para continuar</p>
          </div>

          {/* Role tabs */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {(Object.keys(roleLabels) as RoleTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab
                    ? 'gradient-primary text-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {roleLabels[tab]}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activeTab === 'admin' ? 'admin@arteemcores.com.br' : 'seu@email.com'}
                  className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/80">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              variant="golden"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            © 2025 Arte em Cores — Sistema de Gestão
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
