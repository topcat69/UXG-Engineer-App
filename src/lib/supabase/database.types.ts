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
      clients: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      install_forms: {
        Row: {
          client_name: string | null
          content_displaying: Database["public"]["Enums"]["pass_fail"] | null
          created_at: string | null
          engineer_notes: string | null
          equipment_damage: Database["public"]["Enums"]["equipment_damage_status"] | null
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
          equipment_damage?: Database["public"]["Enums"]["equipment_damage_status"] | null
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
          equipment_damage?: Database["public"]["Enums"]["equipment_damage_status"] | null
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
          content_displaying: Database["public"]["Enums"]["pass_fail"] | null
          created_at: string | null
          design_pack_storage_path: string | null
          engineer_notes: string | null
          equipment_damage: Database["public"]["Enums"]["equipment_damage_status"] | null
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
          content_displaying?: Database["public"]["Enums"]["pass_fail"] | null
          created_at?: string | null
          design_pack_storage_path?: string | null
          engineer_notes?: string | null
          equipment_damage?: Database["public"]["Enums"]["equipment_damage_status"] | null
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
          content_displaying?: Database["public"]["Enums"]["pass_fail"] | null
          created_at?: string | null
          design_pack_storage_path?: string | null
          engineer_notes?: string | null
          equipment_damage?: Database["public"]["Enums"]["equipment_damage_status"] | null
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
            foreignKeyName: "job_details_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
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
          created_at: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string | null
        }
        Relationships: []
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
      survey_forms: {
        Row: {
          access_restrictions: string | null
          created_at: string | null
          engineer_notes: string | null
          id: string
          job_id: string | null
          measurements: string | null
          mounting_surface: string | null
          network_available: boolean | null
          power_available: boolean | null
          submitted_at: string | null
        }
        Insert: {
          access_restrictions?: string | null
          created_at?: string | null
          engineer_notes?: string | null
          id?: string
          job_id?: string | null
          measurements?: string | null
          mounting_surface?: string | null
          network_available?: boolean | null
          power_available?: boolean | null
          submitted_at?: string | null
        }
        Update: {
          access_restrictions?: string | null
          created_at?: string | null
          engineer_notes?: string | null
          id?: string
          job_id?: string | null
          measurements?: string | null
          mounting_surface?: string | null
          network_available?: boolean | null
          power_available?: boolean | null
          submitted_at?: string | null
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
      users: {
        Row: {
          active: boolean
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
      set_own_theme: {
        Args: { new_theme: string }
        Returns: undefined
      }
    }
    Enums: {
      equipment_damage_status: "na" | "yes" | "accidental" | "customer"
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
      pass_fail: "pass" | "fail" | "na"
      qa_status: "pending" | "approved" | "rejected"
      user_role: "superadmin" | "manager" | "engineer"
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
      equipment_damage_status: ["na", "yes", "accidental", "customer"],
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
      ],
      pass_fail: ["pass", "fail", "na"],
      qa_status: ["pending", "approved", "rejected"],
      user_role: ["superadmin", "manager", "engineer"],
    },
  },
} as const

