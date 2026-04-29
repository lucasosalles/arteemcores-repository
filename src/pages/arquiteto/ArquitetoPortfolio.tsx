import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, ImageOff, X } from 'lucide-react';

const TIPOS = ['Residencial', 'Comercial', 'Corporativo', 'Condomínio', 'Reforma', 'Interiores', 'Paisagismo', 'Outro'];

interface Projeto {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo_servico: string | null;
  foto_url: string | null;
  data_conclusao: string | null;
  created_at: string;
}

interface FormState {
  titulo: string;
  descricao: string;
  tipo_servico: string;
  foto_url: string;
  data_conclusao: string;
}

const EMPTY_FORM: FormState = { titulo: '', descricao: '', tipo_servico: '', foto_url: '', data_conclusao: '' };

export default function ArquitetoPortfolio() {
  const { profile } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Projeto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Projeto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjetos = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('portfolio_arquiteto')
      .select('*')
      .eq('arquiteto_id', profile.id)
      .order('data_conclusao', { ascending: false });
    setProjetos(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchProjetos(); }, [fetchProjetos]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setModalOpen(true);
  };

  const openEdit = (p: Projeto) => {
    setEditTarget(p);
    setForm({
      titulo: p.titulo,
      descricao: p.descricao || '',
      tipo_servico: p.tipo_servico || '',
      foto_url: p.foto_url || '',
      data_conclusao: p.data_conclusao || '',
    });
    setSaveError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { setSaveError('Título obrigatório.'); return; }
    if (!profile?.id) return;
    setSaving(true);
    setSaveError('');

    const payload = {
      arquiteto_id: profile.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      tipo_servico: form.tipo_servico || null,
      foto_url: form.foto_url.trim() || null,
      data_conclusao: form.data_conclusao || null,
    };

    let error: any;
    if (editTarget) {
      ({ error } = await supabase.from('portfolio_arquiteto').update(payload).eq('id', editTarget.id));
    } else {
      ({ error } = await supabase.from('portfolio_arquiteto').insert(payload));
    }

    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setModalOpen(false);
    fetchProjetos();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('portfolio_arquiteto').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchProjetos();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfólio</h1>
          <p className="text-muted-foreground">Seus projetos e serviços realizados</p>
        </div>
        <Button variant="golden" size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar projeto
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : projetos.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <p className="text-sm">Nenhum projeto no portfólio ainda.</p>
          <p className="text-xs mt-1">Clique em "Adicionar projeto" para começar.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projetos.map(p => (
            <div key={p.id} className="glass-card overflow-hidden flex flex-col">
              {/* Foto */}
              <div className="h-44 bg-muted flex items-center justify-center overflow-hidden relative">
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.titulo} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                ) : (
                  <ImageOff className="w-8 h-8 text-muted-foreground/40" />
                )}
                {p.tipo_servico && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-black/50 text-white backdrop-blur-sm">
                    {p.tipo_servico}
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <h3 className="font-semibold text-foreground text-sm leading-tight">{p.titulo}</h3>
                {p.descricao && <p className="text-xs text-muted-foreground line-clamp-3">{p.descricao}</p>}
                {p.data_conclusao && (
                  <p className="text-xs text-muted-foreground/70 mt-auto">
                    Conclusão: {new Date(p.data_conclusao + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="px-4 pb-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openEdit(p)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs px-3" onClick={() => setDeleteTarget(p)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {editTarget ? 'Editar projeto' : 'Adicionar projeto'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Título *</label>
                <Input placeholder="Ex: Reforma residencial Vila Mariana" value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de serviço</label>
                <select className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 text-sm"
                  value={form.tipo_servico} onChange={e => setForm(f => ({ ...f, tipo_servico: e.target.value }))}>
                  <option value="">Selecionar tipo</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <Textarea placeholder="Descreva o projeto, materiais usados, desafios..." rows={4}
                  value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">URL da foto</label>
                <Input placeholder="https://..." value={form.foto_url}
                  onChange={e => setForm(f => ({ ...f, foto_url: e.target.value }))} />
                {form.foto_url && (
                  <div className="mt-2 h-28 rounded-lg overflow-hidden bg-muted">
                    <img src={form.foto_url} alt="preview" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data de conclusão</label>
                <Input type="date" value={form.data_conclusao}
                  onChange={e => setForm(f => ({ ...f, data_conclusao: e.target.value }))} />
              </div>

              {saveError && <p className="text-xs text-destructive">{saveError}</p>}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button variant="golden" className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : editTarget ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Remover projeto</h2>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja remover <strong className="text-foreground">"{deleteTarget.titulo}"</strong> do portfólio?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
