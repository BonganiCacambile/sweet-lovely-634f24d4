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
      admin_presence: {
        Row: {
          assigned_zone_id: string | null
          last_active_at: string
          last_heartbeat_at: string
          login_at: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          assigned_zone_id?: string | null
          last_active_at?: string
          last_heartbeat_at?: string
          login_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          assigned_zone_id?: string | null
          last_active_at?: string
          last_heartbeat_at?: string
          login_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_presence_assigned_zone_id_fkey"
            columns: ["assigned_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_presence_assigned_zone_id_fkey"
            columns: ["assigned_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
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
      banners: {
        Row: {
          created_at: string
          cta_href: string | null
          cta_label: string | null
          ends_at: string | null
          id: string
          image: string | null
          is_active: boolean
          placement: string
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          placement?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          placement?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
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
      delivery_zones: {
        Row: {
          collection_address: string | null
          collection_enabled: boolean
          collection_instructions: string | null
          collection_prep_minutes: number
          color: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          delivery_enabled: boolean
          description: string | null
          eta_minutes: number
          fee_zar: number
          free_delivery_threshold_zar: number
          hours_text: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_order_zar: number
          name: string
          postal_codes: string[]
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          collection_address?: string | null
          collection_enabled?: boolean
          collection_instructions?: string | null
          collection_prep_minutes?: number
          color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_enabled?: boolean
          description?: string | null
          eta_minutes?: number
          fee_zar?: number
          free_delivery_threshold_zar?: number
          hours_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_order_zar?: number
          name: string
          postal_codes?: string[]
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          collection_address?: string | null
          collection_enabled?: boolean
          collection_instructions?: string | null
          collection_prep_minutes?: number
          color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_enabled?: boolean
          description?: string | null
          eta_minutes?: number
          fee_zar?: number
          free_delivery_threshold_zar?: number
          hours_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_order_zar?: number
          name?: string
          postal_codes?: string[]
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          percent_off: number
          starts_at: string | null
          target_slug: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          percent_off: number
          starts_at?: string | null
          target_slug: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          percent_off?: number
          starts_at?: string | null
          target_slug?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      featured_items: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          placement: string
          product_slug: string
          sort_order: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          placement?: string
          product_slug: string
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          placement?: string
          product_slug?: string
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_items_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["slug"]
          },
        ]
      }
      home_banners: {
        Row: {
          created_at: string
          cta_href: string | null
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          position: number
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_banners_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_banners_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
      home_content_events: {
        Row: {
          content_id: string
          content_type: string
          event_type: string
          id: number
          occurred_at: string
          zone_id: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          event_type: string
          id?: number
          occurred_at?: string
          zone_id?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          event_type?: string
          id?: number
          occurred_at?: string
          zone_id?: string | null
        }
        Relationships: []
      }
      home_desserts: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          position: number
          price: string | null
          product_slug: string | null
          starts_at: string | null
          title: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          price?: string | null
          product_slug?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          price?: string | null
          product_slug?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_desserts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_desserts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
      home_hot_deals: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number | null
          discounted_price: number | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          label: string | null
          original_price: number | null
          position: number
          product_slug: string | null
          starts_at: string | null
          title: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number | null
          discounted_price?: number | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label?: string | null
          original_price?: number | null
          position?: number
          product_slug?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number | null
          discounted_price?: number | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label?: string | null
          original_price?: number | null
          position?: number
          product_slug?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_hot_deals_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "home_hot_deals_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_hot_deals_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
      home_popular_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          position: number
          price: string | null
          product_slug: string | null
          starts_at: string | null
          title: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          price?: string | null
          product_slug?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          price?: string | null
          product_slug?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_popular_items_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "home_popular_items_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_popular_items_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
      home_section_visibility: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          section: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          section: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          section?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_section_visibility_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_section_visibility_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
      home_specials: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          position: number
          price: string | null
          product_slugs: string[]
          starts_at: string | null
          title: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          position?: number
          price?: string | null
          product_slugs?: string[]
          starts_at?: string | null
          title: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          position?: number
          price?: string | null
          product_slugs?: string[]
          starts_at?: string | null
          title?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_specials_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_specials_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
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
      loyalty_accounts: {
        Row: {
          created_at: string
          lifetime_points: number
          points_balance: number
          program_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lifetime_points?: number
          points_balance?: number
          program_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          lifetime_points?: number
          points_balance?: number
          program_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          points_per_zar: number
          redemption_rate_zar: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          points_per_zar?: number
          redemption_rate_zar?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          points_per_zar?: number
          redemption_rate_zar?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          extras: Json
          extras_total_zar: number
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
          extras?: Json
          extras_total_zar?: number
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
          extras?: Json
          extras_total_zar?: number
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
          collection_location: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_zar: number
          delivery_zone_id: string | null
          delivery_zone_name: string | null
          estimated_minutes: number | null
          fulfillment_method: string
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
          collection_location?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_zar?: number
          delivery_zone_id?: string | null
          delivery_zone_name?: string | null
          estimated_minutes?: number | null
          fulfillment_method?: string
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
          collection_location?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_zar?: number
          delivery_zone_id?: string | null
          delivery_zone_name?: string | null
          estimated_minutes?: number | null
          fulfillment_method?: string
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
        Relationships: [
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_toppings: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          name: string
          price_zar: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name: string
          price_zar?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name?: string
          price_zar?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_sizes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          name: string
          portion: string | null
          price_zar: number
          product_slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name: string
          portion?: string | null
          price_zar?: number
          product_slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name?: string
          portion?: string | null
          price_zar?: number
          product_slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["slug"]
          },
        ]
      }
      products: {
        Row: {
          allergens: string | null
          calories: number | null
          carbs_g: number | null
          category_slug: string
          created_at: string
          description: string | null
          fat_g: number | null
          image: string | null
          ingredients: string[]
          is_active: boolean
          low_stock_threshold: number
          nutrition: string | null
          portion: string | null
          price_large_zar: number | null
          price_medium_zar: number | null
          price_zar: number
          protein_g: number | null
          size_selection_enabled: boolean
          slug: string
          sort_order: number
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          allergens?: string | null
          calories?: number | null
          carbs_g?: number | null
          category_slug: string
          created_at?: string
          description?: string | null
          fat_g?: number | null
          image?: string | null
          ingredients?: string[]
          is_active?: boolean
          low_stock_threshold?: number
          nutrition?: string | null
          portion?: string | null
          price_large_zar?: number | null
          price_medium_zar?: number | null
          price_zar?: number
          protein_g?: number | null
          size_selection_enabled?: boolean
          slug: string
          sort_order?: number
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          allergens?: string | null
          calories?: number | null
          carbs_g?: number | null
          category_slug?: string
          created_at?: string
          description?: string | null
          fat_g?: number | null
          image?: string | null
          ingredients?: string[]
          is_active?: boolean
          low_stock_threshold?: number
          nutrition?: string | null
          portion?: string | null
          price_large_zar?: number | null
          price_medium_zar?: number | null
          price_zar?: number
          protein_g?: number | null
          size_selection_enabled?: boolean
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
          locale: string
          marketing_opt_in: boolean
          notification_prefs: Json
          phone: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          marketing_opt_in?: boolean
          notification_prefs?: Json
          phone?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          marketing_opt_in?: boolean
          notification_prefs?: Json
          phone?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          min_subtotal_zar: number
          name: string
          starts_at: string | null
          times_used: number
          type: string
          updated_at: string
          usage_limit: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal_zar?: number
          name: string
          starts_at?: string | null
          times_used?: number
          type: string
          updated_at?: string
          usage_limit?: number | null
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal_zar?: number
          name?: string
          starts_at?: string | null
          times_used?: number
          type?: string
          updated_at?: string
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          party_size: number
          phone: string | null
          reserved_at: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          party_size: number
          phone?: string | null
          reserved_at: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          reserved_at?: string
          status?: string
          updated_at?: string
          user_id?: string | null
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
      store_hours: {
        Row: {
          closes_at: string | null
          day_of_week: number
          is_closed: boolean
          note: string | null
          opens_at: string | null
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          day_of_week: number
          is_closed?: boolean
          note?: string | null
          opens_at?: string | null
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          day_of_week?: number
          is_closed?: boolean
          note?: string | null
          opens_at?: string | null
          updated_at?: string
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
      user_addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          recipient: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1: string
          line2?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          recipient?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1?: string
          line2?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          recipient?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_zone_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_zone_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_zone_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_zone_id_fkey"
            columns: ["assigned_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_assigned_zone_id_fkey"
            columns: ["assigned_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      delivery_zones_public: {
        Row: {
          collection_address: string | null
          collection_enabled: boolean | null
          collection_instructions: string | null
          collection_prep_minutes: number | null
          color: string | null
          delivery_enabled: boolean | null
          description: string | null
          eta_minutes: number | null
          fee_zar: number | null
          hours_text: string | null
          id: string | null
          image_url: string | null
          min_order_zar: number | null
          name: string | null
          postal_codes: string[] | null
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          collection_address?: string | null
          collection_enabled?: boolean | null
          collection_instructions?: string | null
          collection_prep_minutes?: number | null
          color?: string | null
          delivery_enabled?: boolean | null
          description?: string | null
          eta_minutes?: number | null
          fee_zar?: number | null
          hours_text?: string | null
          id?: string | null
          image_url?: string | null
          min_order_zar?: number | null
          name?: string | null
          postal_codes?: string[] | null
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          collection_address?: string | null
          collection_enabled?: boolean | null
          collection_instructions?: string | null
          collection_prep_minutes?: number | null
          color?: string | null
          delivery_enabled?: boolean | null
          description?: string | null
          eta_minutes?: number | null
          fee_zar?: number | null
          hours_text?: string | null
          id?: string | null
          image_url?: string | null
          min_order_zar?: number | null
          name?: string | null
          postal_codes?: string[] | null
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
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
      check_stock_availability: { Args: { _items: Json }; Returns: Json }
      get_user_zone: { Args: { _uid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_main_admin: { Args: { _uid: string }; Returns: boolean }
      is_zone_admin: { Args: { _uid: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _entity?: string
          _entity_id?: string
          _metadata?: Json
        }
        Returns: string
      }
      process_order_stock_deduction: {
        Args: { _items: Json; _order_id: string }
        Returns: Json
      }
      rollback_order_stock: { Args: { _order_id: string }; Returns: Json }
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
      app_role: "admin" | "user" | "zone_admin"
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
      app_role: ["admin", "user", "zone_admin"],
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
