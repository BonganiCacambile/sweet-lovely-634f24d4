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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          image: string | null
          intro: string | null
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          image?: string | null
          intro?: string | null
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          image?: string | null
          intro?: string | null
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_pages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          publish_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          publish_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          publish_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          category: string
          config: Json
          created_at: string
          display_name: string
          id: string
          last_checked_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          last_checked_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          last_checked_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          balance_after: number
          created_at: string
          id: string
          order_id: string | null
          product_slug: string
          quantity: number
          reason: string | null
          type: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          balance_after: number
          created_at?: string
          id?: string
          order_id?: string | null
          product_slug: string
          quantity: number
          reason?: string | null
          type: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          balance_after?: number
          created_at?: string
          id?: string
          order_id?: string | null
          product_slug?: string
          quantity?: number
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["slug"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_zar: number
          order_id: string
          product_slug: string | null
          quantity: number
          title_snapshot: string
          unit_price_zar: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_zar: number
          order_id: string
          product_slug?: string | null
          quantity: number
          title_snapshot: string
          unit_price_zar: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_zar?: number
          order_id?: string
          product_slug?: string | null
          quantity?: number
          title_snapshot?: string
          unit_price_zar?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["slug"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_zar: number
          id: string
          notes: string | null
          order_number: string
          paystack_reference: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_zar: number
          total_zar: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_zar?: number
          id?: string
          notes?: string | null
          order_number?: string
          paystack_reference?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_zar?: number
          total_zar?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_zar?: number
          id?: string
          notes?: string | null
          order_number?: string
          paystack_reference?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_zar?: number
          total_zar?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          allergens: string | null
          category_slug: string
          created_at: string
          description: string | null
          image: string | null
          is_active: boolean
          low_stock_threshold: number
          nutrition: string | null
          portion: string | null
          price_zar: number
          slug: string
          sort_order: number
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          allergens?: string | null
          category_slug: string
          created_at?: string
          description?: string | null
          image?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          nutrition?: string | null
          portion?: string | null
          price_zar?: number
          slug: string
          sort_order?: number
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          allergens?: string | null
          category_slug?: string
          created_at?: string
          description?: string | null
          image?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          nutrition?: string | null
          portion?: string | null
          price_zar?: number
          slug?: string
          sort_order?: number
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          id: string
          product_slug: string | null
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          author_name: string
          comment?: string | null
          created_at?: string
          id?: string
          product_slug?: string | null
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          product_slug?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["slug"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          group_key: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_key: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          group_key?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      adjust_product_stock: {
        Args: {
          _delta: number
          _order_id?: string
          _reason?: string
          _slug: string
          _type: string
        }
        Returns: number
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action: string
          _entity?: string
          _entity_id?: string
          _metadata?: Json
        }
        Returns: string
      }
    }
    Enums: {
      app_permission:
        | "orders.read"
        | "orders.write"
        | "orders.refund"
        | "products.read"
        | "products.write"
        | "categories.read"
        | "categories.write"
        | "inventory.read"
        | "inventory.write"
        | "reviews.read"
        | "reviews.moderate"
        | "users.read"
        | "users.write"
        | "roles.read"
        | "roles.write"
        | "audit.read"
        | "content.read"
        | "content.write"
        | "notifications.read"
        | "notifications.write"
        | "reports.read"
        | "analytics.read"
        | "integrations.read"
        | "integrations.write"
        | "security.read"
        | "security.write"
        | "settings.read"
        | "settings.write"
      app_role: "admin" | "user"
      order_status:
        | "pending"
        | "preparing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "processing"
        | "completed"
        | "refunded"
      review_status: "pending" | "approved" | "rejected"
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
      app_permission: [
        "orders.read",
        "orders.write",
        "orders.refund",
        "products.read",
        "products.write",
        "categories.read",
        "categories.write",
        "inventory.read",
        "inventory.write",
        "reviews.read",
        "reviews.moderate",
        "users.read",
        "users.write",
        "roles.read",
        "roles.write",
        "audit.read",
        "content.read",
        "content.write",
        "notifications.read",
        "notifications.write",
        "reports.read",
        "analytics.read",
        "integrations.read",
        "integrations.write",
        "security.read",
        "security.write",
        "settings.read",
        "settings.write",
      ],
      app_role: ["admin", "user"],
      order_status: [
        "pending",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "processing",
        "completed",
        "refunded",
      ],
      review_status: ["pending", "approved", "rejected"],
    },
  },
} as const
