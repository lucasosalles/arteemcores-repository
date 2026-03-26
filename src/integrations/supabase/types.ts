export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chamados: {
        Row: {
          concluded_at: string | null
          condominio_id: string
          created_at: string
          descricao: string
          foto_antes_url: string | null
          foto_depois_url: string | null
          id: string
          local: string
          numero: number
          observacoes_tecnico: string | null
          prioridade: Database["public"]["Enums"]["chamado_prioridade"]
          sindico_id: string
          status: Database["public"]["Enums"]["chamado_status"]
          tecnico_id: string | null
          tipo: Database["public"]["Enums"]["chamado_tipo"]
          updated_at: string
        }
        Insert: {
          concluded_at?: string | null
          condominio_id: string
          created_at?: string
          descricao: string
          foto_antes_url?: string | null
          foto_depois_url?: string | null
          id?: string
          local: string
          numero?: number
          observacoes_tecnico?: string | null
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          sindico_id: string
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          tipo: Database["public"]["Enums"]["chamado_tipo"]
          updated_at?: string
        }
        Update: {
          concluded_at?: string | null
          condominio_id?: string
          created_at?: string
          descricao?: string
          foto_antes_url?: string | null
          foto_depois_url?: string | null
          id?: string
          local?: string
          numero?: number
          observacoes_tecnico?: string | null
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          sindico_id?: string
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          tipo?: Database["public"]["Enums"]["chamado_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_sindico_id_fkey"
            columns: ["sindico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      condominios: {
        Row: {
          address: string
          atendimentos_mes: number
          ativo: boolean
          created_at: string
          id: string
          limite_atendimentos: number
          name: string
          plano: Database["public"]["Enums"]["plano_tipo"]
          sindico_id: string | null
        }
        Insert: {
          address: string
          atendimentos_mes?: number
          ativo?: boolean
          created_at?: string
          id?: string
          limite_atendimentos?: number
          name: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          sindico_id?: string | null
        }
        Update: {
          address?: string
          atendimentos_mes?: number
          ativo?: boolean
          created_at?: string
          id?: string
          limite_atendimentos?: number
          name?: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          sindico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "condominios_sindico_id_fkey"
            columns: ["sindico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          chamado_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          chamado_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          chamado_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          mes_referencia: string
          status: Database["public"]["Enums"]["pagamento_status"]
          valor: number
          vencimento: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          mes_referencia: string
          status?: Database["public"]["Enums"]["pagamento_status"]
          valor: number
          vencimento: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          mes_referencia?: string
          status?: Database["public"]["Enums"]["pagamento_status"]
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          descricao: string[] | null
          id: string
          limite_atendimentos: number
          nome: Database["public"]["Enums"]["plano_tipo"]
          preco: number
        }
        Insert: {
          descricao?: string[] | null
          id?: string
          limite_atendimentos: number
          nome: Database["public"]["Enums"]["plano_tipo"]
          preco: number
        }
        Update: {
          descricao?: string[] | null
          id?: string
          limite_atendimentos?: number
          nome?: Database["public"]["Enums"]["plano_tipo"]
          preco?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "sindico" | "tecnico" | "admin"
      chamado_prioridade: "normal" | "alta" | "urgente"
      chamado_status:
        | "aguardando"
        | "aceito"
        | "a_caminho"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      chamado_tipo:
        | "pintura_interna"
        | "pintura_fachada"
        | "esquadria"
        | "teto"
        | "urgencia"
        | "outros"
      pagamento_status: "pago" | "pendente" | "atrasado"
      plano_tipo: "essencial" | "profissional" | "premium"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["sindico", "tecnico", "admin"],
      chamado_prioridade: ["normal", "alta", "urgente"],
      chamado_status: [
        "aguardando",
        "aceito",
        "a_caminho",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      chamado_tipo: [
        "pintura_interna",
        "pintura_fachada",
        "esquadria",
        "teto",
        "urgencia",
        "outros",
      ],
      pagamento_status: ["pago", "pendente", "atrasado"],
      plano_tipo: ["essencial", "profissional", "premium"],
    },
  },
} as const
