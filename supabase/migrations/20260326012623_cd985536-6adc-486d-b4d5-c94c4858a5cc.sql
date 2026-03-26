-- Create enum types
CREATE TYPE public.app_role AS ENUM ('sindico', 'tecnico', 'admin');
CREATE TYPE public.plano_tipo AS ENUM ('essencial', 'profissional', 'premium');
CREATE TYPE public.chamado_tipo AS ENUM ('pintura_interna', 'pintura_fachada', 'esquadria', 'teto', 'urgencia', 'outros');
CREATE TYPE public.chamado_prioridade AS ENUM ('normal', 'alta', 'urgente');
CREATE TYPE public.chamado_status AS ENUM ('aguardando', 'aceito', 'a_caminho', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.pagamento_status AS ENUM ('pago', 'pendente', 'atrasado');

-- User roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Planos table
CREATE TABLE public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome plano_tipo NOT NULL UNIQUE,
  preco NUMERIC NOT NULL,
  limite_atendimentos INTEGER NOT NULL,
  descricao TEXT[] DEFAULT '{}'
);
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- Condominios table
CREATE TABLE public.condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  sindico_id UUID REFERENCES public.profiles(id),
  plano plano_tipo NOT NULL DEFAULT 'essencial',
  atendimentos_mes INTEGER NOT NULL DEFAULT 0,
  limite_atendimentos INTEGER NOT NULL DEFAULT 5,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;

-- Chamados sequence for display numbers
CREATE SEQUENCE public.chamado_numero_seq START 1;

-- Chamados table
CREATE TABLE public.chamados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL DEFAULT nextval('public.chamado_numero_seq'),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id),
  sindico_id UUID NOT NULL REFERENCES public.profiles(id),
  tecnico_id UUID REFERENCES public.profiles(id),
  tipo chamado_tipo NOT NULL,
  local TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prioridade chamado_prioridade NOT NULL DEFAULT 'normal',
  status chamado_status NOT NULL DEFAULT 'aguardando',
  foto_antes_url TEXT,
  foto_depois_url TEXT,
  observacoes_tecnico TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluded_at TIMESTAMPTZ
);
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

-- Mensagens table
CREATE TABLE public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Pagamentos table
CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id),
  mes_referencia TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  status pagamento_status NOT NULL DEFAULT 'pendente',
  vencimento DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_chamados_updated_at
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can read all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- planos
CREATE POLICY "Planos readable by all" ON public.planos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage planos" ON public.planos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- condominios
CREATE POLICY "Sindico can view own condo" ON public.condominios
  FOR SELECT USING (sindico_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tecnico'));
CREATE POLICY "Admin can manage condominios" ON public.condominios
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- chamados
CREATE POLICY "Sindico can view own chamados" ON public.chamados
  FOR SELECT USING (
    sindico_id = auth.uid()
    OR tecnico_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'tecnico') AND status = 'aguardando')
  );
CREATE POLICY "Sindico can create chamados" ON public.chamados
  FOR INSERT WITH CHECK (sindico_id = auth.uid());
CREATE POLICY "Tecnico can update assigned chamados" ON public.chamados
  FOR UPDATE USING (
    tecnico_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'tecnico') AND status = 'aguardando')
  );
CREATE POLICY "Admin can manage all chamados" ON public.chamados
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- mensagens
CREATE POLICY "Users can view messages of their chamados" ON public.mensagens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id
      AND (c.sindico_id = auth.uid() OR c.tecnico_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "Users can send messages to their chamados" ON public.mensagens
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id
      AND (c.sindico_id = auth.uid() OR c.tecnico_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- pagamentos
CREATE POLICY "Sindico can view own payments" ON public.pagamentos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.condominios co
      WHERE co.id = condominio_id AND co.sindico_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admin can manage payments" ON public.pagamentos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed planos
INSERT INTO public.planos (nome, preco, limite_atendimentos, descricao) VALUES
  ('essencial', 490, 5, ARRAY['Até 5 atendimentos/mês', 'Suporte por chat', 'Relatório mensal básico']),
  ('profissional', 890, 15, ARRAY['Até 15 atendimentos/mês', 'Suporte prioritário', 'Relatórios detalhados', 'Técnico dedicado']),
  ('premium', 1490, 999, ARRAY['Atendimentos ilimitados', 'Suporte 24/7', 'Relatórios avançados', 'Equipe dedicada', 'Manutenção preventiva']);

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('chamados', 'chamados', true);

CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chamados');
CREATE POLICY "Anyone can view chamado photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'chamados');