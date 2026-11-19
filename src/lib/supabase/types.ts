export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agreement_acceptances: {
        Row: {
          article_id: string | null
          created_at: string
          id: number
          ip_hash: string | null
          kind: Database["public"]["Enums"]["agreement_kind"]
          user_id: string | null
          version: number
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          kind: Database["public"]["Enums"]["agreement_kind"]
          user_id?: string | null
          version: number
        }
        Update: {
          article_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          kind?: Database["public"]["Enums"]["agreement_kind"]
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreement_acceptances_article_fk"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_acceptances_kind_version_fkey"
            columns: ["kind", "version"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["kind", "version"]
          },
        ]
      }
      agreement_versions: {
        Row: {
          effective_at: string
          kind: Database["public"]["Enums"]["agreement_kind"]
          text_sha256: string
          version: number
        }
        Insert: {
          effective_at?: string
          kind: Database["public"]["Enums"]["agreement_kind"]
          text_sha256: string
          version: number
        }
        Update: {
          effective_at?: string
          kind?: Database["public"]["Enums"]["agreement_kind"]
          text_sha256?: string
          version?: number
        }
        Relationships: []
      }
      article_images: {
        Row: {
          alt_text: string
          article_id: string
          caption: string | null
          credit: string | null
          id: number
          position: number
          storage_path: string
        }
        Insert: {
          alt_text?: string
          article_id: string
          caption?: string | null
          credit?: string | null
          id?: never
          position: number
          storage_path: string
        }
        Update: {
          alt_text?: string
          article_id?: string
          caption?: string | null
          credit?: string | null
          id?: never
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_images_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_revisions: {
        Row: {
          article_id: string
          body_json: Json
          created_at: string
          dek: string | null
          edited_by: string | null
          id: number
          title: string
        }
        Insert: {
          article_id: string
          body_json: Json
          created_at?: string
          dek?: string | null
          edited_by?: string | null
          id?: never
          title: string
        }
        Update: {
          article_id?: string
          body_json?: Json
          created_at?: string
          dek?: string | null
          edited_by?: string | null
          id?: never
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_revisions_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_sources: {
        Row: {
          article_id: string
          id: number
          label: string | null
          position: number
          url: string
        }
        Insert: {
          article_id: string
          id?: never
          label?: string | null
          position: number
          url: string
        }
        Update: {
          article_id?: string
          id?: never
          label?: string | null
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_sources_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string | null
          body_json: Json
          body_text: string
          category: string | null
          comments_locked: boolean
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          dek: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          published_at: string | null
          search: unknown
          slug: string | null
          status: Database["public"]["Enums"]["article_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_json?: Json
          body_text?: string
          category?: string | null
          comments_locked?: boolean
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          dek?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          published_at?: string | null
          search?: unknown
          slug?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_json?: Json
          body_text?: string
          category?: string | null
          comments_locked?: boolean
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          dek?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          published_at?: string | null
          search?: unknown
          slug?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      categories: {
        Row: {
          name: string
          slug: string
          sort: number
        }
        Insert: {
          name: string
          slug: string
          sort: number
        }
        Update: {
          name?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      corrections: {
        Row: {
          article_id: string
          body: string
          created_at: string
          created_by: string | null
          id: number
        }
        Insert: {
          article_id: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: never
        }
        Update: {
          article_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "corrections_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_confirmed_at: string | null
          approved_article_count: number
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          handle: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          suspended_until: string | null
          updated_at: string
        }
        Insert: {
          age_confirmed_at?: string | null
          approved_article_count?: number
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          handle: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          suspended_until?: string | null
          updated_at?: string
        }
        Update: {
          age_confirmed_at?: string | null
          approved_article_count?: number
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          suspended_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_correct_article: { Args: { p_article_id: string }; Returns: boolean }
      can_edit_article: { Args: { p_article_id: string }; Returns: boolean }
      can_publish_directly: { Args: never; Returns: boolean }
      can_view_article: { Args: { p_article_id: string }; Returns: boolean }
      can_write: { Args: never; Returns: boolean }
      current_agreement_version: {
        Args: { k: Database["public"]["Enums"]["agreement_kind"] }
        Returns: number
      }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      feed_latest: {
        Args: {
          p_before_id?: string
          p_before_published_at?: string
          p_category?: string
          p_limit?: number
        }
        Returns: {
          author_display_name: string
          author_handle: string
          category: string
          content_type: Database["public"]["Enums"]["content_type"]
          dek: string
          excerpt: string
          id: string
          image_alt: string
          image_path: string
          published_at: string
          slug: string
          title: string
        }[]
      }
      has_accepted_current: {
        Args: { k: Database["public"]["Enums"]["agreement_kind"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_suspended: { Args: never; Returns: boolean }
      is_valid_handle: { Args: { h: string }; Returns: boolean }
      my_account: {
        Args: never
        Returns: {
          age_confirmed: boolean
          approved_article_count: number
          can_write: boolean
          handle: string
          id: string
          needs_privacy: boolean
          needs_terms: boolean
          role: Database["public"]["Enums"]["user_role"]
          suspended_until: string
        }[]
      }
      richtext_plain: { Args: { node: Json }; Returns: string }
      save_article: {
        Args: {
          p_article_id?: string
          p_body_json?: Json
          p_category?: string
          p_content_type?: Database["public"]["Enums"]["content_type"]
          p_dek?: string
          p_images?: Json
          p_sources?: Json
          p_title?: string
        }
        Returns: Json
      }
      slugify: { Args: { t: string }; Returns: string }
      submit_article: {
        Args: { p_article_id: string }
        Returns: Database["public"]["Enums"]["article_status"]
      }
      withdraw_article: {
        Args: { p_article_id: string }
        Returns: Database["public"]["Enums"]["article_status"]
      }
    }
    Enums: {
      agreement_kind: "terms" | "privacy" | "contributor"
      article_status:
        | "draft"
        | "pending_review"
        | "published"
        | "hidden"
        | "archived"
      content_type:
        | "news"
        | "community"
        | "opinion"
        | "event"
        | "sports"
        | "business"
      user_role: "user" | "moderator" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agreement_kind: ["terms", "privacy", "contributor"],
      article_status: [
        "draft",
        "pending_review",
        "published",
        "hidden",
        "archived",
      ],
      content_type: [
        "news",
        "community",
        "opinion",
        "event",
        "sports",
        "business",
      ],
      user_role: ["user", "moderator", "admin"],
    },
  },
} as const

