import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, clearAuthStorage } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (session && role) {
      const redirectMap: Record<string, string> = {
        admin:     '/admin',
        sindico:   '/sindico',
        tecnico:   '/prestador',
        morador:   '/morador/chamados',
        arquiteto: '/arquiteto/dashboard',
        prestador: '/prestador/dashboard',
      };
      navigate(redirectMap[role] || '/', { replace: true });
      return;
    }

    if (session && !role && !isLoading) {
      toast.error('Perfil não encontrado. Contate o administrador.');
      setIsLoading(false);
    }
  }, [session, role, loading, navigate, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error, role: fetchedRole } = await signIn(email, password);

      if (error) {
        toast.error('Erro ao fazer login', {
          description: error.message === 'Invalid login credentials'
            ? 'Email ou senha incorretos.'
            : error.message,
        });
        setIsLoading(false);
        return;
      }

      if (!fetchedRole) {
        toast.error('Perfil não encontrado. Contate o administrador.');
        setIsLoading(false);
        return;
      }

      const redirectMap: Record<string, string> = {
        admin:     '/admin',
        sindico:   '/sindico',
        tecnico:   '/prestador',
        morador:   '/morador/chamados',
        arquiteto: '/arquiteto/dashboard',
        prestador: '/prestador/dashboard',
      };

      navigate(redirectMap[fetchedRole] || '/', { replace: true });
    } catch (err) {
      console.error('Erro no login:', err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="lg:w-1/2 gradient-primary flex flex-col items-center justify-center p-8 lg:p-16 min-h-[300px] lg:min-h-screen relative overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-secondary/10 blur-2xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 text-center">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gradient-gold mb-4 mt-8">
            Fino Haus
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
            <h2 className="text-2xl font-bold text-foreground">Acesse sua conta</h2>
            <p className="text-muted-foreground mt-2">Entre com seu email e senha para continuar</p>
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
                  placeholder="seu@email.com"
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

          <div className="text-center space-y-3">
            <button
              type="button"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 transition-colors"
              onClick={() => { clearAuthStorage(); window.location.reload(); }}
            >
              Problemas para entrar? Clique aqui
            </button>
            <p className="text-sm text-muted-foreground">
              © 2026 Fino Haus — Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
