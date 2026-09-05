export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          display_name: string | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: number
          next_state: string | null
          previous_state: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          id?: never
          next_state?: string | null
          previous_state?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: never
          next_state?: string | null
          previous_state?: string | null
        }
        Relationships: []
      }
      proposal_photos: {
        Row: {
          byte_size: number | null
          created_at: string
          credit: string | null
          detected_mime_type: string | null
          display_order: number
          height: number | null
          id: string
          metadata_stripped_at: string | null
          moderation_state: Database["public"]["Enums"]["photo_moderation_state"]
          original_object_path: string
          processed_object_path: string | null
          proposal_id: string
          rights_declared: boolean
          width: number | null
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          credit?: string | null
          detected_mime_type?: string | null
          display_order: number
          height?: number | null
          id?: string
          metadata_stripped_at?: string | null
          moderation_state?: Database["public"]["Enums"]["photo_moderation_state"]
          original_object_path: string
          processed_object_path?: string | null
          proposal_id: string
          rights_declared?: boolean
          width?: number | null
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          credit?: string | null
          detected_mime_type?: string | null
          display_order?: number
          height?: number | null
          id?: string
          metadata_stripped_at?: string | null
          moderation_state?: Database["public"]["Enums"]["photo_moderation_state"]
          original_object_path?: string
          processed_object_path?: string | null
          proposal_id?: string
          rights_declared?: boolean
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_photos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          charter_version: string | null
          confirmation_sent_at: string | null
          contribution_terms_version: string | null
          contributor_email: string
          created_at: string
          decided_at: string | null
          email_verification_expires_at: string | null
          email_verification_token_hash: string | null
          email_verified_at: string | null
          id: string
          image_rights_accepted_at: string | null
          moderation_comment: string | null
          payload: Json
          privacy_notice_version: string | null
          public_pseudonym: string | null
          recognizable_people_confirmed_at: string | null
          state: Database["public"]["Enums"]["proposal_state"]
          submitted_at: string | null
          tracking_id: string
          updated_at: string
          upload_secret_hash: string | null
        }
        Insert: {
          charter_version?: string | null
          confirmation_sent_at?: string | null
          contribution_terms_version?: string | null
          contributor_email: string
          created_at?: string
          decided_at?: string | null
          email_verification_expires_at?: string | null
          email_verification_token_hash?: string | null
          email_verified_at?: string | null
          id?: string
          image_rights_accepted_at?: string | null
          moderation_comment?: string | null
          payload?: Json
          privacy_notice_version?: string | null
          public_pseudonym?: string | null
          recognizable_people_confirmed_at?: string | null
          state?: Database["public"]["Enums"]["proposal_state"]
          submitted_at?: string | null
          tracking_id?: string
          updated_at?: string
          upload_secret_hash?: string | null
        }
        Update: {
          charter_version?: string | null
          confirmation_sent_at?: string | null
          contribution_terms_version?: string | null
          contributor_email?: string
          created_at?: string
          decided_at?: string | null
          email_verification_expires_at?: string | null
          email_verification_token_hash?: string | null
          email_verified_at?: string | null
          id?: string
          image_rights_accepted_at?: string | null
          moderation_comment?: string | null
          payload?: Json
          privacy_notice_version?: string | null
          public_pseudonym?: string | null
          recognizable_people_confirmed_at?: string | null
          state?: Database["public"]["Enums"]["proposal_state"]
          submitted_at?: string | null
          tracking_id?: string
          updated_at?: string
          upload_secret_hash?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          comment: string
          created_at: string
          decision: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          internal_note: string | null
          priority: Database["public"]["Enums"]["report_priority"]
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email: string | null
          spot_id: string
          state: Database["public"]["Enums"]["report_state"]
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          decision?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          priority?: Database["public"]["Enums"]["report_priority"]
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          spot_id: string
          state?: Database["public"]["Enums"]["report_state"]
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          decision?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          priority?: Database["public"]["Enums"]["report_priority"]
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          spot_id?: string
          state?: Database["public"]["Enums"]["report_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_categories: {
        Row: {
          category_id: string
          spot_id: string
        }
        Insert: {
          category_id: string
          spot_id: string
        }
        Update: {
          category_id?: string
          spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_categories_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_photos: {
        Row: {
          alt_text: string | null
          created_at: string
          credit: string | null
          display_order: number
          id: string
          metadata_stripped_at: string | null
          moderation_state: Database["public"]["Enums"]["photo_moderation_state"]
          original_object_path: string
          public_url: string | null
          published_object_path: string | null
          removed_at: string | null
          rights_declared: boolean
          spot_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          credit?: string | null
          display_order?: number
          id?: string
          metadata_stripped_at?: string | null
          moderation_state?: Database["public"]["Enums"]["photo_moderation_state"]
          original_object_path: string
          public_url?: string | null
          published_object_path?: string | null
          removed_at?: string | null
          rights_declared?: boolean
          spot_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          credit?: string | null
          display_order?: number
          id?: string
          metadata_stripped_at?: string | null
          moderation_state?: Database["public"]["Enums"]["photo_moderation_state"]
          original_object_path?: string
          public_url?: string | null
          published_object_path?: string | null
          removed_at?: string | null
          rights_declared?: boolean
          spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_photos_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      spots: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          address: string | null
          attendance: Database["public"]["Enums"]["attendance_level"]
          best_times: Database["public"]["Enums"]["best_time"][]
          created_at: string
          display_precision: Database["public"]["Enums"]["display_precision"]
          id: string
          last_verified_at: string
          last_verified_by: string | null
          light_orientation: string | null
          location: unknown
          location_status: Database["public"]["Enums"]["location_status"]
          municipality: string
          name: string
          parking: string
          postal_code: string
          publication_state: Database["public"]["Enums"]["spot_state"]
          search_radius_meters: number
          short_description: string
          slug: string
          surface_type: Database["public"]["Enums"]["surface_type"]
          updated_at: string
          walking_approach: string
          warnings: string[]
        }
        Insert: {
          access_level: Database["public"]["Enums"]["access_level"]
          address?: string | null
          attendance: Database["public"]["Enums"]["attendance_level"]
          best_times?: Database["public"]["Enums"]["best_time"][]
          created_at?: string
          display_precision?: Database["public"]["Enums"]["display_precision"]
          id?: string
          last_verified_at: string
          last_verified_by?: string | null
          light_orientation?: string | null
          location: unknown
          location_status: Database["public"]["Enums"]["location_status"]
          municipality: string
          name: string
          parking: string
          postal_code: string
          publication_state?: Database["public"]["Enums"]["spot_state"]
          search_radius_meters?: number
          short_description: string
          slug: string
          surface_type: Database["public"]["Enums"]["surface_type"]
          updated_at?: string
          walking_approach: string
          warnings?: string[]
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          address?: string | null
          attendance?: Database["public"]["Enums"]["attendance_level"]
          best_times?: Database["public"]["Enums"]["best_time"][]
          created_at?: string
          display_precision?: Database["public"]["Enums"]["display_precision"]
          id?: string
          last_verified_at?: string
          last_verified_by?: string | null
          light_orientation?: string | null
          location?: unknown
          location_status?: Database["public"]["Enums"]["location_status"]
          municipality?: string
          name?: string
          parking?: string
          postal_code?: string
          publication_state?: Database["public"]["Enums"]["spot_state"]
          search_radius_meters?: number
          short_description?: string
          slug?: string
          surface_type?: Database["public"]["Enums"]["surface_type"]
          updated_at?: string
          walking_approach?: string
          warnings?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_public_proposal: {
        Args: { p_proposal_id: string; p_upload_secret: string }
        Returns: boolean
      }
      admin_change_spot_state: {
        Args: { p_next_state: string; p_note: string; p_spot_id: string }
        Returns: string
      }
      admin_correct_proposal: {
        Args: {
          p_access_level: string
          p_address: string
          p_attendance: string
          p_best_times: string[]
          p_categories: string[]
          p_internal_note?: string
          p_latitude: number
          p_location_status: string
          p_longitude: number
          p_municipality: string
          p_name: string
          p_parking: string
          p_payload_display_precision: string
          p_postal_code: string
          p_proposal_id: string
          p_risks: string
          p_short_description: string
          p_surface_type: string
          p_traffic: string
          p_visual_features: string
          p_walking_approach: string
        }
        Returns: string
      }
      admin_create_spot: {
        Args: {
          p_access_level: string
          p_attendance: string
          p_best_time: string
          p_category_slug: string
          p_display_precision: string
          p_latitude: number
          p_location_status: string
          p_longitude: number
          p_municipality: string
          p_name: string
          p_parking: string
          p_postal_code: string
          p_short_description: string
          p_slug: string
          p_surface_type: string
          p_walking_approach: string
          p_warnings?: string[]
        }
        Returns: string
      }
      admin_delete_spot: {
        Args: { p_confirmation: string; p_spot_id: string }
        Returns: {
          deleted_slug: string
          original_paths: string[]
          published_paths: string[]
        }[]
      }
      admin_get_spot: {
        Args: { p_spot_id: string }
        Returns: {
          access_level: string
          attendance: string
          best_times: string[]
          categories: string[]
          display_precision: string
          id: string
          last_verified_at: string
          latitude: number
          light_orientation: string
          location_status: string
          longitude: number
          municipality: string
          name: string
          parking: string
          postal_code: string
          publication_state: string
          short_description: string
          slug: string
          surface_type: string
          updated_at: string
          walking_approach: string
          warnings: string[]
        }[]
      }
      admin_list_spots: {
        Args: never
        Returns: {
          categories: string[]
          display_precision: string
          id: string
          last_verified_at: string
          municipality: string
          name: string
          open_report_count: number
          postal_code: string
          publication_state: string
          slug: string
          updated_at: string
        }[]
      }
      admin_refresh_review_due_spots: { Args: never; Returns: number }
      admin_review_proposal: {
        Args: {
          p_decision: string
          p_display_precision?: string
          p_internal_note: string
          p_proposal_id: string
          p_public_urls?: string[]
          p_published_paths?: string[]
          p_sensitive?: boolean
        }
        Returns: string
      }
      admin_review_report: {
        Args: {
          p_decision: string
          p_hide_spot?: boolean
          p_internal_note: string
          p_next_state: string
          p_report_id: string
        }
        Returns: string
      }
      admin_set_proposal_photo_state: {
        Args: { p_moderation_state: string; p_photo_id: string }
        Returns: string
      }
      admin_set_spot_address: {
        Args: { p_address: string; p_spot_id: string }
        Returns: boolean
      }
      admin_update_spot: {
        Args: {
          p_access_level: string
          p_attendance: string
          p_best_times: string[]
          p_category_slugs: string[]
          p_display_precision: string
          p_latitude: number
          p_light_orientation: string
          p_location_status: string
          p_longitude: number
          p_mark_verified?: boolean
          p_municipality: string
          p_name: string
          p_parking: string
          p_postal_code: string
          p_short_description: string
          p_spot_id: string
          p_surface_type: string
          p_walking_approach: string
          p_warnings: string[]
        }
        Returns: string
      }
      attach_proposal_photo: {
        Args: {
          p_byte_size: number
          p_credit: string
          p_detected_mime_type: string
          p_display_order: number
          p_height: number
          p_original_path: string
          p_processed_path: string
          p_proposal_id: string
          p_upload_secret: string
          p_width: number
        }
        Returns: string
      }
      confirm_proposal_email: {
        Args: { p_token: string }
        Returns: {
          proposal_id: string
          tracking_id: string
        }[]
      }
      create_public_proposal: {
        Args: {
          p_charter_accepted: boolean
          p_email: string
          p_email_token_hash: string
          p_payload: Json
          p_people_confirmed: boolean
          p_privacy_accepted: boolean
          p_pseudonym: string
          p_rights_declared: boolean
          p_terms_accepted: boolean
          p_upload_secret_hash: string
        }
        Returns: {
          proposal_id: string
          tracking_id: string
        }[]
      }
      create_public_report: {
        Args: {
          p_comment: string
          p_email?: string
          p_reason: string
          p_spot_id: string
          p_website?: string
        }
        Returns: string
      }
      get_public_spot_unavailability: {
        Args: { p_slug: string }
        Returns: {
          name: string
          publication_state: string
        }[]
      }
      list_public_spots: {
        Args: never
        Returns: {
          access_level: string
          attendance: string
          best_times: string[]
          categories: string[]
          cover_image_url: string
          display_precision: Database["public"]["Enums"]["display_precision"]
          id: string
          last_verified_at: string
          latitude: number
          light_orientation: string
          location_status: string
          longitude: number
          municipality: string
          name: string
          parking: string
          photo_urls: string[]
          postal_code: string
          short_description: string
          slug: string
          surface_type: string
          walking_approach: string
          warnings: string[]
        }[]
      }
      mark_proposal_confirmation_sent: {
        Args: { p_proposal_id: string; p_upload_secret: string }
        Returns: boolean
      }
      refresh_proposal_confirmation: {
        Args: {
          p_email: string
          p_email_token_hash: string
          p_tracking_id: string
        }
        Returns: string
      }
    }
    Enums: {
      access_level: "easy" | "intermediate" | "difficult"
      admin_role: "moderator" | "administrator"
      attendance_level: "quiet" | "variable" | "busy"
      best_time: "morning" | "day" | "golden_hour" | "sunset" | "night"
      display_precision: "exact" | "approximate" | "hidden"
      location_status:
        | "public"
        | "private_with_permission"
        | "to_confirm"
        | "sensitive"
      photo_moderation_state: "pending" | "approved" | "hidden" | "rejected"
      proposal_state:
        | "draft"
        | "email_pending"
        | "submitted"
        | "changes_requested"
        | "approved"
        | "rejected"
        | "duplicate"
        | "withdrawn"
      report_priority: "normal" | "high"
      report_reason:
        | "access_forbidden"
        | "immediate_danger"
        | "incorrect_information"
        | "image_or_identifiable_person"
        | "private_property_or_nuisance"
        | "duplicate"
        | "other"
      report_state: "open" | "in_review" | "resolved" | "dismissed"
      spot_state:
        | "published"
        | "hidden"
        | "sensitive"
        | "archived"
        | "review_due"
      surface_type: "asphalt" | "gravel" | "earth" | "mixed"
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
      access_level: ["easy", "intermediate", "difficult"],
      admin_role: ["moderator", "administrator"],
      attendance_level: ["quiet", "variable", "busy"],
      best_time: ["morning", "day", "golden_hour", "sunset", "night"],
      display_precision: ["exact", "approximate", "hidden"],
      location_status: [
        "public",
        "private_with_permission",
        "to_confirm",
        "sensitive",
      ],
      photo_moderation_state: ["pending", "approved", "hidden", "rejected"],
      proposal_state: [
        "draft",
        "email_pending",
        "submitted",
        "changes_requested",
        "approved",
        "rejected",
        "duplicate",
        "withdrawn",
      ],
      report_priority: ["normal", "high"],
      report_reason: [
        "access_forbidden",
        "immediate_danger",
        "incorrect_information",
        "image_or_identifiable_person",
        "private_property_or_nuisance",
        "duplicate",
        "other",
      ],
      report_state: ["open", "in_review", "resolved", "dismissed"],
      spot_state: [
        "published",
        "hidden",
        "sensitive",
        "archived",
        "review_due",
      ],
      surface_type: ["asphalt", "gravel", "earth", "mixed"],
    },
  },
} as const

