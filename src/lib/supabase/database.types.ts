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
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      asset_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      asset_register: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          decommission_date: string | null
          depreciation_method: string | null
          disposal_date: string | null
          expected_replacement_date: string | null
          id: string
          install_date: string | null
          manufacturer: string | null
          model: string | null
          needs_review: boolean
          po_or_invoice_number: string | null
          purchase_cost: number | null
          purchase_date: string | null
          residual_value: number | null
          serial_number: string | null
          site_id: string | null
          source: Database["public"]["Enums"]["asset_source"]
          status: Database["public"]["Enums"]["asset_status"]
          stock_item_id: string | null
          supplier: string | null
          support_contract_ref: string | null
          support_sla: string | null
          updated_at: string
          updated_by: string | null
          useful_life_years: number | null
          warranty_end: string | null
          warranty_provider: string | null
          warranty_start: string | null
          weee_reference: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          decommission_date?: string | null
          depreciation_method?: string | null
          disposal_date?: string | null
          expected_replacement_date?: string | null
          id?: string
          install_date?: string | null
          manufacturer?: string | null
          model?: string | null
          needs_review?: boolean
          po_or_invoice_number?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          residual_value?: number | null
          serial_number?: string | null
          site_id?: string | null
          source: Database["public"]["Enums"]["asset_source"]
          status?: Database["public"]["Enums"]["asset_status"]
          stock_item_id?: string | null
          supplier?: string | null
          support_contract_ref?: string | null
          support_sla?: string | null
          updated_at?: string
          updated_by?: string | null
          useful_life_years?: number | null
          warranty_end?: string | null
          warranty_provider?: string | null
          warranty_start?: string | null
          weee_reference?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          decommission_date?: string | null
          depreciation_method?: string | null
          disposal_date?: string | null
          expected_replacement_date?: string | null
          id?: string
          install_date?: string | null
          manufacturer?: string | null
          model?: string | null
          needs_review?: boolean
          po_or_invoice_number?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          residual_value?: number | null
          serial_number?: string | null
          site_id?: string | null
          source?: Database["public"]["Enums"]["asset_source"]
          status?: Database["public"]["Enums"]["asset_status"]
          stock_item_id?: string | null
          supplier?: string | null
          support_contract_ref?: string | null
          support_sla?: string | null
          updated_at?: string
          updated_by?: string | null
          useful_life_years?: number | null
          warranty_end?: string | null
          warranty_provider?: string | null
          warranty_start?: string | null
          weee_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_register_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_register_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_register_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_register_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_register_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: string | null
          created_at: string | null
          id: string
          install_date: string | null
          model: string | null
          serial: string | null
          site_id: string | null
          warranty_end: string | null
        }
        Insert: {
          asset_type?: string | null
          created_at?: string | null
          id?: string
          install_date?: string | null
          model?: string | null
          serial?: string | null
          site_id?: string | null
          warranty_end?: string | null
        }
        Update: {
          asset_type?: string | null
          created_at?: string | null
          id?: string
          install_date?: string | null
          model?: string | null
          serial?: string | null
          site_id?: string | null
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sla_fixture_types: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sla_fixture_types_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sla_reasons: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sla_reasons_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          drive_folder_id: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      damaged_equipment: {
        Row: {
          asset_register_id: string | null
          created_at: string
          created_by: string | null
          damage_notes: string | null
          description: string | null
          id: string
          manufacturer: string | null
          model: string | null
          next_step: Database["public"]["Enums"]["damage_resolution"]
          photo_path: string | null
          serial_number: string | null
          site_id: string | null
          stock_item_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asset_register_id?: string | null
          created_at?: string
          created_by?: string | null
          damage_notes?: string | null
          description?: string | null
          id?: string
          manufacturer?: string | null
          model?: string | null
          next_step?: Database["public"]["Enums"]["damage_resolution"]
          photo_path?: string | null
          serial_number?: string | null
          site_id?: string | null
          stock_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asset_register_id?: string | null
          created_at?: string
          created_by?: string | null
          damage_notes?: string | null
          description?: string | null
          id?: string
          manufacturer?: string | null
          model?: string | null
          next_step?: Database["public"]["Enums"]["damage_resolution"]
          photo_path?: string | null
          serial_number?: string | null
          site_id?: string | null
          stock_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damaged_equipment_asset_register_id_fkey"
            columns: ["asset_register_id"]
            isOneToOne: false
            referencedRelation: "asset_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_equipment_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_equipment_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_equipment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      help_article_images: {
        Row: {
          article_id: string
          caption: string | null
          created_at: string | null
          id: string
          position: number
          storage_path: string
        }
        Insert: {
          article_id: string
          caption?: string | null
          created_at?: string | null
          id?: string
          position?: number
          storage_path: string
        }
        Update: {
          article_id?: string
          caption?: string | null
          created_at?: string | null
          id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_article_images_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          body: string
          category_id: string
          created_at: string | null
          created_by: string | null
          id: string
          position: number
          title: string
          updated_at: string | null
          updated_by: string | null
          video_path: string | null
        }
        Insert: {
          body: string
          category_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          position?: number
          title: string
          updated_at?: string | null
          updated_by?: string | null
          video_path?: string | null
        }
        Update: {
          body?: string
          category_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          position?: number
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_articles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "help_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      install_forms: {
        Row: {
          client_name: string | null
          content_displaying: Database["public"]["Enums"]["pass_fail"] | null
          created_at: string | null
          engineer_notes: string | null
          equipment_damage:
            | Database["public"]["Enums"]["equipment_damage_status"]
            | null
          id: string
          issue_detail: string | null
          issues_found: boolean | null
          job_id: string | null
          mount_type: string | null
          network_port: string | null
          network_type: string | null
          player_boot_test: Database["public"]["Enums"]["pass_fail"] | null
          player_serial: string | null
          power_source: string | null
          screen_serial: string | null
          submitted_at: string | null
          wifi_signal: string | null
        }
        Insert: {
          client_name?: string | null
          content_displaying?: Database["public"]["Enums"]["pass_fail"] | null
          created_at?: string | null
          engineer_notes?: string | null
          equipment_damage?:
            | Database["public"]["Enums"]["equipment_damage_status"]
            | null
          id?: string
          issue_detail?: string | null
          issues_found?: boolean | null
          job_id?: string | null
          mount_type?: string | null
          network_port?: string | null
          network_type?: string | null
          player_boot_test?: Database["public"]["Enums"]["pass_fail"] | null
          player_serial?: string | null
          power_source?: string | null
          screen_serial?: string | null
          submitted_at?: string | null
          wifi_signal?: string | null
        }
        Update: {
          client_name?: string | null
          content_displaying?: Database["public"]["Enums"]["pass_fail"] | null
          created_at?: string | null
          engineer_notes?: string | null
          equipment_damage?:
            | Database["public"]["Enums"]["equipment_damage_status"]
            | null
          id?: string
          issue_detail?: string | null
          issues_found?: boolean | null
          job_id?: string | null
          mount_type?: string | null
          network_port?: string | null
          network_type?: string | null
          player_boot_test?: Database["public"]["Enums"]["pass_fail"] | null
          player_serial?: string | null
          power_source?: string | null
          screen_serial?: string | null
          submitted_at?: string | null
          wifi_signal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "install_forms_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          blocks_completion: boolean | null
          category: string | null
          created_at: string | null
          description: string
          id: string
          job_id: string | null
          raised_by: string | null
          resolved_at: string | null
          revisit_job_id: string | null
          severity: string
          site_id: string | null
          status: string | null
        }
        Insert: {
          blocks_completion?: boolean | null
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          job_id?: string | null
          raised_by?: string | null
          resolved_at?: string | null
          revisit_job_id?: string | null
          severity: string
          site_id?: string | null
          status?: string | null
        }
        Update: {
          blocks_completion?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          job_id?: string | null
          raised_by?: string | null
          resolved_at?: string | null
          revisit_job_id?: string | null
          severity?: string
          site_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_revisit_job_id_fkey"
            columns: ["revisit_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      job_details: {
        Row: {
          arrival_notes: string | null
          content_displaying: Database["public"]["Enums"]["pass_fail"] | null
          created_at: string | null
          design_pack_storage_path: string | null
          engineer_notes: string | null
          equipment_damage:
            | Database["public"]["Enums"]["equipment_damage_status"]
            | null
          fixture_type_id: string | null
          id: string
          issue_detail: string | null
          issues_found: boolean | null
          job_id: string | null
          job_information: string | null
          mount_type: string | null
          network_port: string | null
          network_type: string | null
          parking_notes: string | null
          parking_notified: boolean | null
          parking_permit_storage_path: string | null
          player_boot_test: Database["public"]["Enums"]["pass_fail"] | null
          player_serial: string | null
          power_source: string | null
          rams_storage_path: string | null
          reason_id: string | null
          reported_to_site_manager: boolean | null
          revisit_required: boolean | null
          screen_serial: string | null
          site_manager_name: string | null
          site_manager_phone: string | null
          site_plan_storage_path: string | null
          sla_requirement_detail: string | null
          submitted_at: string | null
          wifi_signal: string | null
        }
        Insert: {
          arrival_notes?: string | null
          content_displaying?: Database["public"]["Enums"]["pass_fail"] | null
          created_at?: string | null
          design_pack_storage_path?: string | null
          engineer_notes?: string | null
          equipment_damage?:
            | Database["public"]["Enums"]["equipment_damage_status"]
            | null
          fixture_type_id?: string | null
          id?: string
          issue_detail?: string | null
          issues_found?: boolean | null
          job_id?: string | null
          job_information?: string | null
          mount_type?: string | null
          network_port?: string | null
          network_type?: string | null
          parking_notes?: string | null
          parking_notified?: boolean | null
          parking_permit_storage_path?: string | null
          player_boot_test?: Database["public"]["Enums"]["pass_fail"] | null
          player_serial?: string | null
          power_source?: string | null
          rams_storage_path?: string | null
          reason_id?: string | null
          reported_to_site_manager?: boolean | null
          revisit_required?: boolean | null
          screen_serial?: string | null
          site_manager_name?: string | null
          site_manager_phone?: string | null
          site_plan_storage_path?: string | null
          sla_requirement_detail?: string | null
          submitted_at?: string | null
          wifi_signal?: string | null
        }
        Update: {
          arrival_notes?: string | null
          content_displaying?: Database["public"]["Enums"]["pass_fail"] | null
          created_at?: string | null
          design_pack_storage_path?: string | null
          engineer_notes?: string | null
          equipment_damage?:
            | Database["public"]["Enums"]["equipment_damage_status"]
            | null
          fixture_type_id?: string | null
          id?: string
          issue_detail?: string | null
          issues_found?: boolean | null
          job_id?: string | null
          job_information?: string | null
          mount_type?: string | null
          network_port?: string | null
          network_type?: string | null
          parking_notes?: string | null
          parking_notified?: boolean | null
          parking_permit_storage_path?: string | null
          player_boot_test?: Database["public"]["Enums"]["pass_fail"] | null
          player_serial?: string | null
          power_source?: string | null
          rams_storage_path?: string | null
          reason_id?: string | null
          reported_to_site_manager?: boolean | null
          revisit_required?: boolean | null
          screen_serial?: string | null
          site_manager_name?: string | null
          site_manager_phone?: string | null
          site_plan_storage_path?: string | null
          sla_requirement_detail?: string | null
          submitted_at?: string | null
          wifi_signal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_details_fixture_type_id_fkey"
            columns: ["fixture_type_id"]
            isOneToOne: false
            referencedRelation: "client_sla_fixture_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_details_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_details_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "client_sla_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      job_equipment: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          model: string
          position: number
          serial: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          model: string
          position?: number
          serial?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          model?: string
          position?: number
          serial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_equipment_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_optional_fields: {
        Row: {
          created_at: string | null
          field_key: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string | null
          field_key: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string | null
          field_key?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_optional_fields_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sheet_tests: {
        Row: {
          added_to_uxg_account: boolean | null
          created_at: string | null
          id: string
          item_description: string | null
          job_sheet_id: string
          licence_added: boolean | null
          notes: string | null
          outcome: string | null
          philips_wave_added: boolean | null
          position: number
          stock_item_id: string | null
          teamviewer_added: boolean | null
          tested: boolean | null
          tested_by: string | null
          wifi_dongle: string | null
        }
        Insert: {
          added_to_uxg_account?: boolean | null
          created_at?: string | null
          id?: string
          item_description?: string | null
          job_sheet_id: string
          licence_added?: boolean | null
          notes?: string | null
          outcome?: string | null
          philips_wave_added?: boolean | null
          position: number
          stock_item_id?: string | null
          teamviewer_added?: boolean | null
          tested?: boolean | null
          tested_by?: string | null
          wifi_dongle?: string | null
        }
        Update: {
          added_to_uxg_account?: boolean | null
          created_at?: string | null
          id?: string
          item_description?: string | null
          job_sheet_id?: string
          licence_added?: boolean | null
          notes?: string | null
          outcome?: string | null
          philips_wave_added?: boolean | null
          position?: number
          stock_item_id?: string | null
          teamviewer_added?: boolean | null
          tested?: boolean | null
          tested_by?: string | null
          wifi_dongle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sheet_tests_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheet_tests_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheet_tests_tested_by_fkey"
            columns: ["tested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sheets: {
        Row: {
          cms_name: string | null
          created_at: string | null
          created_by: string | null
          defects: boolean | null
          defects_detail: string | null
          defects_photo: boolean | null
          defects_photo_path: string | null
          id: string
          job_description: string | null
          linked_job_id: string | null
          missing_items: boolean | null
          missing_items_detail: string | null
          missing_items_photo: boolean | null
          missing_items_photo_path: string | null
          other_issues: boolean | null
          other_issues_detail: string | null
          other_issues_photo: boolean | null
          other_issues_photo_path: string | null
          other_parts_used: boolean | null
          other_parts_used_detail: string | null
          other_parts_used_photo: boolean | null
          other_parts_used_photo_path: string | null
          packed_correctly: boolean | null
          packed_correctly_detail: string | null
          packed_correctly_photo: boolean | null
          packed_correctly_photo_path: string | null
          po_number: string | null
          project_id: string | null
          proposed_install_date: string | null
          reference: string
          signed_off_at: string | null
          signed_off_by: string | null
          site_id: string
          software_notes: string | null
          status: Database["public"]["Enums"]["job_sheet_status"]
          updated_at: string | null
          work_area_tidy: boolean | null
        }
        Insert: {
          cms_name?: string | null
          created_at?: string | null
          created_by?: string | null
          defects?: boolean | null
          defects_detail?: string | null
          defects_photo?: boolean | null
          defects_photo_path?: string | null
          id?: string
          job_description?: string | null
          linked_job_id?: string | null
          missing_items?: boolean | null
          missing_items_detail?: string | null
          missing_items_photo?: boolean | null
          missing_items_photo_path?: string | null
          other_issues?: boolean | null
          other_issues_detail?: string | null
          other_issues_photo?: boolean | null
          other_issues_photo_path?: string | null
          other_parts_used?: boolean | null
          other_parts_used_detail?: string | null
          other_parts_used_photo?: boolean | null
          other_parts_used_photo_path?: string | null
          packed_correctly?: boolean | null
          packed_correctly_detail?: string | null
          packed_correctly_photo?: boolean | null
          packed_correctly_photo_path?: string | null
          po_number?: string | null
          project_id?: string | null
          proposed_install_date?: string | null
          reference: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          site_id: string
          software_notes?: string | null
          status?: Database["public"]["Enums"]["job_sheet_status"]
          updated_at?: string | null
          work_area_tidy?: boolean | null
        }
        Update: {
          cms_name?: string | null
          created_at?: string | null
          created_by?: string | null
          defects?: boolean | null
          defects_detail?: string | null
          defects_photo?: boolean | null
          defects_photo_path?: string | null
          id?: string
          job_description?: string | null
          linked_job_id?: string | null
          missing_items?: boolean | null
          missing_items_detail?: string | null
          missing_items_photo?: boolean | null
          missing_items_photo_path?: string | null
          other_issues?: boolean | null
          other_issues_detail?: string | null
          other_issues_photo?: boolean | null
          other_issues_photo_path?: string | null
          other_parts_used?: boolean | null
          other_parts_used_detail?: string | null
          other_parts_used_photo?: boolean | null
          other_parts_used_photo_path?: string | null
          packed_correctly?: boolean | null
          packed_correctly_detail?: string | null
          packed_correctly_photo?: boolean | null
          packed_correctly_photo_path?: string | null
          po_number?: string | null
          project_id?: string | null
          proposed_install_date?: string | null
          reference?: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          site_id?: string
          software_notes?: string | null
          status?: Database["public"]["Enums"]["job_sheet_status"]
          updated_at?: string | null
          work_area_tidy?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_linked_job_id_fkey"
            columns: ["linked_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_signed_off_by_fkey"
            columns: ["signed_off_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      job_tasks: {
        Row: {
          created_at: string | null
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          job_id: string
          label: string
          position: number
        }
        Insert: {
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          job_id: string
          label: string
          position: number
        }
        Update: {
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          job_id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_tasks_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_template_tasks: {
        Row: {
          created_at: string | null
          id: string
          label: string
          position: number
          template_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          position: number
          template_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          actual_travel_start: string | null
          assigned_to: string | null
          calendar_event_id: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          completion_pdf_url: string | null
          created_at: string | null
          description: string | null
          email_thread_id: string | null
          geofence_variance_m: number | null
          id: string
          job_number: string
          job_type: string
          media_pending: number | null
          parent_job_id: string | null
          priority: string | null
          project_id: string | null
          qa_notes: string | null
          qa_status: Database["public"]["Enums"]["qa_status"] | null
          quickbooks_no: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          site_id: string
          source_issue_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          travel_start_lat: number | null
          travel_start_lng: number | null
          updated_at: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          actual_travel_start?: string | null
          assigned_to?: string | null
          calendar_event_id?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          completion_pdf_url?: string | null
          created_at?: string | null
          description?: string | null
          email_thread_id?: string | null
          geofence_variance_m?: number | null
          id?: string
          job_number: string
          job_type: string
          media_pending?: number | null
          parent_job_id?: string | null
          priority?: string | null
          project_id?: string | null
          qa_notes?: string | null
          qa_status?: Database["public"]["Enums"]["qa_status"] | null
          quickbooks_no?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          site_id: string
          source_issue_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          actual_travel_start?: string | null
          assigned_to?: string | null
          calendar_event_id?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          completion_pdf_url?: string | null
          created_at?: string | null
          description?: string | null
          email_thread_id?: string | null
          geofence_variance_m?: number | null
          id?: string
          job_number?: string
          job_type?: string
          media_pending?: number | null
          parent_job_id?: string | null
          priority?: string | null
          project_id?: string | null
          qa_notes?: string | null
          qa_status?: Database["public"]["Enums"]["qa_status"] | null
          quickbooks_no?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          site_id?: string
          source_issue_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          travel_start_lat?: number | null
          travel_start_lng?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_attachments: {
        Row: {
          article_id: string
          created_at: string | null
          filename: string
          id: string
          storage_path: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          filename: string
          id?: string
          storage_path: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          filename?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_attachments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string
          body: string
          category_id: string
          created_at: string | null
          decline_reason: string | null
          id: string
          manufacturer_id: string | null
          model_range_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kb_article_status"]
          tags: string[]
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          body: string
          category_id: string
          created_at?: string | null
          decline_reason?: string | null
          id?: string
          manufacturer_id?: string | null
          model_range_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kb_article_status"]
          tags?: string[]
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          category_id?: string
          created_at?: string | null
          decline_reason?: string | null
          id?: string
          manufacturer_id?: string | null
          model_range_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kb_article_status"]
          tags?: string[]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "kb_manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_model_range_id_fkey"
            columns: ["model_range_id"]
            isOneToOne: false
            referencedRelation: "kb_model_ranges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      kb_manufacturers: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_manufacturers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_model_ranges: {
        Row: {
          created_at: string | null
          id: string
          manufacturer_id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          manufacturer_id: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          manufacturer_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_model_ranges_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "kb_manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          accuracy_m: number | null
          bytes: number | null
          caption: string | null
          captured_at: string
          captured_by: string | null
          id: string
          job_id: string | null
          latitude: number | null
          longitude: number | null
          media_type: string
          mime: string | null
          sha256: string | null
          slot: string
          storage_path: string
          thumb_path: string | null
          uploaded_at: string | null
        }
        Insert: {
          accuracy_m?: number | null
          bytes?: number | null
          caption?: string | null
          captured_at: string
          captured_by?: string | null
          id?: string
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          media_type: string
          mime?: string | null
          sha256?: string | null
          slot: string
          storage_path: string
          thumb_path?: string | null
          uploaded_at?: string | null
        }
        Update: {
          accuracy_m?: number | null
          bytes?: number | null
          caption?: string | null
          captured_at?: string
          captured_by?: string | null
          id?: string
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          media_type?: string
          mime?: string | null
          sha256?: string | null
          slot?: string
          storage_path?: string
          thumb_path?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string | null
          drive_folder_id: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          job_id: string | null
          project_id: string | null
          revoked: boolean | null
          token: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          job_id?: string | null
          project_id?: string | null
          revoked?: boolean | null
          token: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          job_id?: string | null
          project_id?: string | null
          revoked?: boolean | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          id: string
          job_id: string | null
          latitude: number | null
          longitude: number | null
          signed_at: string
          signer_name: string
          signer_role: string
          storage_path: string
        }
        Insert: {
          id?: string
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          signed_at: string
          signer_name: string
          signer_role: string
          storage_path: string
        }
        Update: {
          id?: string
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          signed_at?: string
          signer_name?: string
          signer_role?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          access_notes: string | null
          address_line1: string | null
          address_line2: string | null
          client_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          postcode: string | null
          store_id: string | null
          town: string | null
        }
        Insert: {
          access_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          client_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          postcode?: string | null
          store_id?: string | null
          town?: string | null
        }
        Update: {
          access_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          client_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          postcode?: string | null
          store_id?: string | null
          town?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      status_events: {
        Row: {
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string | null
          latitude: number | null
          longitude: number | null
          occurred_at: string
          reason: string | null
          to_status: Database["public"]["Enums"]["job_status"]
          user_id: string | null
        }
        Insert: {
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          occurred_at?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
          user_id?: string | null
        }
        Update: {
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          occurred_at?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["job_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          damage_notes: string | null
          damaged: boolean
          description: string | null
          firmware_update: string | null
          hw_id: string | null
          id: string
          image_path: string | null
          job_sheet_id: string | null
          manufacturer: string | null
          model: string | null
          received_at: string | null
          received_by: string | null
          serial_no: string | null
          status: Database["public"]["Enums"]["stock_item_status"]
          tested: boolean
          tested_at: string | null
          tested_by: string | null
          warranty_end: string | null
        }
        Insert: {
          damage_notes?: string | null
          damaged?: boolean
          description?: string | null
          firmware_update?: string | null
          hw_id?: string | null
          id?: string
          image_path?: string | null
          job_sheet_id?: string | null
          manufacturer?: string | null
          model?: string | null
          received_at?: string | null
          received_by?: string | null
          serial_no?: string | null
          status?: Database["public"]["Enums"]["stock_item_status"]
          tested?: boolean
          tested_at?: string | null
          tested_by?: string | null
          warranty_end?: string | null
        }
        Update: {
          damage_notes?: string | null
          damaged?: boolean
          description?: string | null
          firmware_update?: string | null
          hw_id?: string | null
          id?: string
          image_path?: string | null
          job_sheet_id?: string | null
          manufacturer?: string | null
          model?: string | null
          received_at?: string | null
          received_by?: string | null
          serial_no?: string | null
          status?: Database["public"]["Enums"]["stock_item_status"]
          tested?: boolean
          tested_at?: string | null
          tested_by?: string | null
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_tested_by_fkey"
            columns: ["tested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_manufacturers: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      stock_models: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          manufacturer_id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          manufacturer_id: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          manufacturer_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_models_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "stock_manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_software_providers: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      survey_actions: {
        Row: {
          action: string
          created_at: string | null
          done: boolean | null
          due_date: string | null
          id: string
          owner: string | null
          position: number
          survey_form_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          done?: boolean | null
          due_date?: string | null
          id?: string
          owner?: string | null
          position?: number
          survey_form_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          done?: boolean | null
          due_date?: string | null
          id?: string
          owner?: string | null
          position?: number
          survey_form_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_actions_survey_form_id_fkey"
            columns: ["survey_form_id"]
            isOneToOne: false
            referencedRelation: "survey_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_forms: {
        Row: {
          access_notes: string | null
          asbestos_checked: boolean | null
          cable_concealment: string | null
          cable_route_notes: string | null
          containment_present: string | null
          created_at: string | null
          dda_compliant: boolean | null
          delivery_notes: string | null
          direct_sunlight: boolean | null
          enclosure_required: boolean | null
          engineer_notes: string | null
          escort_required: boolean | null
          firestopping_notes: string | null
          floor_boxes_required: boolean | null
          floor_plan_captured: boolean | null
          id: string
          it_contact_name: string | null
          job_id: string | null
          measurements_checked: boolean | null
          network_summary_notes: string | null
          other_trades_notes: string | null
          outstanding_items: string | null
          ppe_required: string | null
          project: string | null
          rams_required: boolean | null
          screen_count: number | null
          site_contact_name: string | null
          site_contact_phone: string | null
          site_contact_role: string | null
          site_induction_required: boolean | null
          submitted_at: string | null
          survey_date: string | null
          surveyor: string | null
          temp_humidity_ok: boolean | null
          ventilation_adequate: boolean | null
          working_at_height: string | null
          working_hours: string | null
        }
        Insert: {
          access_notes?: string | null
          asbestos_checked?: boolean | null
          cable_concealment?: string | null
          cable_route_notes?: string | null
          containment_present?: string | null
          created_at?: string | null
          dda_compliant?: boolean | null
          delivery_notes?: string | null
          direct_sunlight?: boolean | null
          enclosure_required?: boolean | null
          engineer_notes?: string | null
          escort_required?: boolean | null
          firestopping_notes?: string | null
          floor_boxes_required?: boolean | null
          floor_plan_captured?: boolean | null
          id?: string
          it_contact_name?: string | null
          job_id?: string | null
          measurements_checked?: boolean | null
          network_summary_notes?: string | null
          other_trades_notes?: string | null
          outstanding_items?: string | null
          ppe_required?: string | null
          project?: string | null
          rams_required?: boolean | null
          screen_count?: number | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_contact_role?: string | null
          site_induction_required?: boolean | null
          submitted_at?: string | null
          survey_date?: string | null
          surveyor?: string | null
          temp_humidity_ok?: boolean | null
          ventilation_adequate?: boolean | null
          working_at_height?: string | null
          working_hours?: string | null
        }
        Update: {
          access_notes?: string | null
          asbestos_checked?: boolean | null
          cable_concealment?: string | null
          cable_route_notes?: string | null
          containment_present?: string | null
          created_at?: string | null
          dda_compliant?: boolean | null
          delivery_notes?: string | null
          direct_sunlight?: boolean | null
          enclosure_required?: boolean | null
          engineer_notes?: string | null
          escort_required?: boolean | null
          firestopping_notes?: string | null
          floor_boxes_required?: boolean | null
          floor_plan_captured?: boolean | null
          id?: string
          it_contact_name?: string | null
          job_id?: string | null
          measurements_checked?: boolean | null
          network_summary_notes?: string | null
          other_trades_notes?: string | null
          outstanding_items?: string | null
          ppe_required?: string | null
          project?: string | null
          rams_required?: boolean | null
          screen_count?: number | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_contact_role?: string | null
          site_induction_required?: boolean | null
          submitted_at?: string | null
          survey_date?: string | null
          surveyor?: string | null
          temp_humidity_ok?: boolean | null
          ventilation_adequate?: boolean | null
          working_at_height?: string | null
          working_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_forms_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_screens: {
        Row: {
          brightness_tier: string | null
          commercial_grade_required: boolean | null
          connection_method: string | null
          created_at: string | null
          display_make_model: string | null
          distance_to_socket: string | null
          environment: string | null
          estimated_weight: number | null
          existing_bracket_reusable: boolean | null
          existing_display_detail: string | null
          existing_player_detail: string | null
          fixing_type: string | null
          glare_assessed: boolean | null
          hdmi_run_length: string | null
          id: string
          ip_mode: string | null
          isolation_notes: string | null
          live_data_point: boolean | null
          location: string | null
          mac_address: string | null
          maintenance_access_ok: boolean | null
          mount_surface: string | null
          mounting_height: string | null
          new_spur_required: boolean | null
          orientation: string | null
          overhead_obstructions: boolean | null
          photo_taken: boolean | null
          player_location: string | null
          player_make_model: string | null
          player_required: boolean | null
          position: number
          position_agreed: boolean | null
          reuse_existing_display: boolean | null
          reuse_existing_player: boolean | null
          screen_label: string | null
          screen_size: string | null
          serial_number: string | null
          shared_power_socket: boolean | null
          socket_count: number | null
          socket_sufficient: boolean | null
          stud_checked: boolean | null
          survey_form_id: string
          switched_with_lighting: boolean | null
          tamper_proof_required: boolean | null
          ventilation_ok: boolean | null
          vlan: string | null
          wifi_security: string | null
          wifi_signal_checked: boolean | null
          wifi_ssid: string | null
        }
        Insert: {
          brightness_tier?: string | null
          commercial_grade_required?: boolean | null
          connection_method?: string | null
          created_at?: string | null
          display_make_model?: string | null
          distance_to_socket?: string | null
          environment?: string | null
          estimated_weight?: number | null
          existing_bracket_reusable?: boolean | null
          existing_display_detail?: string | null
          existing_player_detail?: string | null
          fixing_type?: string | null
          glare_assessed?: boolean | null
          hdmi_run_length?: string | null
          id?: string
          ip_mode?: string | null
          isolation_notes?: string | null
          live_data_point?: boolean | null
          location?: string | null
          mac_address?: string | null
          maintenance_access_ok?: boolean | null
          mount_surface?: string | null
          mounting_height?: string | null
          new_spur_required?: boolean | null
          orientation?: string | null
          overhead_obstructions?: boolean | null
          photo_taken?: boolean | null
          player_location?: string | null
          player_make_model?: string | null
          player_required?: boolean | null
          position?: number
          position_agreed?: boolean | null
          reuse_existing_display?: boolean | null
          reuse_existing_player?: boolean | null
          screen_label?: string | null
          screen_size?: string | null
          serial_number?: string | null
          shared_power_socket?: boolean | null
          socket_count?: number | null
          socket_sufficient?: boolean | null
          stud_checked?: boolean | null
          survey_form_id: string
          switched_with_lighting?: boolean | null
          tamper_proof_required?: boolean | null
          ventilation_ok?: boolean | null
          vlan?: string | null
          wifi_security?: string | null
          wifi_signal_checked?: boolean | null
          wifi_ssid?: string | null
        }
        Update: {
          brightness_tier?: string | null
          commercial_grade_required?: boolean | null
          connection_method?: string | null
          created_at?: string | null
          display_make_model?: string | null
          distance_to_socket?: string | null
          environment?: string | null
          estimated_weight?: number | null
          existing_bracket_reusable?: boolean | null
          existing_display_detail?: string | null
          existing_player_detail?: string | null
          fixing_type?: string | null
          glare_assessed?: boolean | null
          hdmi_run_length?: string | null
          id?: string
          ip_mode?: string | null
          isolation_notes?: string | null
          live_data_point?: boolean | null
          location?: string | null
          mac_address?: string | null
          maintenance_access_ok?: boolean | null
          mount_surface?: string | null
          mounting_height?: string | null
          new_spur_required?: boolean | null
          orientation?: string | null
          overhead_obstructions?: boolean | null
          photo_taken?: boolean | null
          player_location?: string | null
          player_make_model?: string | null
          player_required?: boolean | null
          position?: number
          position_agreed?: boolean | null
          reuse_existing_display?: boolean | null
          reuse_existing_player?: boolean | null
          screen_label?: string | null
          screen_size?: string | null
          serial_number?: string | null
          shared_power_socket?: boolean | null
          socket_count?: number | null
          socket_sufficient?: boolean | null
          stud_checked?: boolean | null
          survey_form_id?: string
          switched_with_lighting?: boolean | null
          tamper_proof_required?: boolean | null
          ventilation_ok?: boolean | null
          vlan?: string | null
          wifi_security?: string | null
          wifi_signal_checked?: boolean | null
          wifi_ssid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_screens_survey_form_id_fkey"
            columns: ["survey_form_id"]
            isOneToOne: false
            referencedRelation: "survey_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          allow_password_login: boolean
          company: string | null
          created_at: string | null
          email: string
          id: string
          max_jobs_per_day: number | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          theme: string
        }
        Insert: {
          active?: boolean
          allow_password_login?: boolean
          company?: string | null
          created_at?: string | null
          email: string
          id: string
          max_jobs_per_day?: number | null
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
        }
        Update: {
          active?: boolean
          allow_password_login?: boolean
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          max_jobs_per_day?: number | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_media_pending: {
        Args: { p_delta: number; p_job_id: string }
        Returns: undefined
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      set_own_theme: { Args: { new_theme: string }; Returns: undefined }
    }
    Enums: {
      asset_source: "goods_in" | "import" | "manual"
      asset_status: "spare" | "in_use" | "faulty" | "in_repair" | "retired"
      damage_resolution:
        | "pending"
        | "replace"
        | "warranty_claim"
        | "repair"
        | "write_off"
        | "other"
      equipment_damage_status: "na" | "yes" | "accidental" | "customer"
      job_sheet_status:
        | "building"
        | "receiving"
        | "configuring"
        | "ready"
        | "assigned"
        | "complete"
      job_status:
        | "draft"
        | "provisional"
        | "scheduled"
        | "dispatched"
        | "accepted"
        | "travelling"
        | "on_site"
        | "in_progress"
        | "submitted"
        | "under_review"
        | "approved"
        | "closed"
        | "on_hold"
        | "cancelled"
        | "revisit"
      kb_article_status: "draft" | "pending_review" | "published" | "declined"
      pass_fail: "pass" | "fail" | "na"
      qa_status: "pending" | "approved" | "rejected"
      stock_item_status: "received" | "configured" | "installed" | "returned"
      user_role: "superadmin" | "manager" | "engineer" | "warehouse" | "finance"
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
      asset_source: ["goods_in", "import", "manual"],
      asset_status: ["spare", "in_use", "faulty", "in_repair", "retired"],
      damage_resolution: [
        "pending",
        "replace",
        "warranty_claim",
        "repair",
        "write_off",
        "other",
      ],
      equipment_damage_status: ["na", "yes", "accidental", "customer"],
      job_sheet_status: [
        "building",
        "receiving",
        "configuring",
        "ready",
        "assigned",
        "complete",
      ],
      job_status: [
        "draft",
        "provisional",
        "scheduled",
        "dispatched",
        "accepted",
        "travelling",
        "on_site",
        "in_progress",
        "submitted",
        "under_review",
        "approved",
        "closed",
        "on_hold",
        "cancelled",
        "revisit",
      ],
      kb_article_status: ["draft", "pending_review", "published", "declined"],
      pass_fail: ["pass", "fail", "na"],
      qa_status: ["pending", "approved", "rejected"],
      stock_item_status: ["received", "configured", "installed", "returned"],
      user_role: ["superadmin", "manager", "engineer", "warehouse", "finance"],
    },
  },
} as const

