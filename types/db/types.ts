export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      videos: {
        Row: {
          id: string
          owner_id: string | null
          source_type: 'upload' | 'youtube'
          source_url: string | null
          duration_sec: number | null
          size_bytes: number | null
          status: 'queued' | 'processing' | 'done' | 'error'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          source_type: 'upload' | 'youtube'
          source_url?: string | null
          duration_sec?: number | null
          size_bytes?: number | null
          status?: 'queued' | 'processing' | 'done' | 'error'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string | null
          source_type?: 'upload' | 'youtube'
          source_url?: string | null
          duration_sec?: number | null
          size_bytes?: number | null
          status?: 'queued' | 'processing' | 'done' | 'error'
          created_at?: string
          updated_at?: string
        }
      }
      transcripts: {
        Row: {
          id: string
          video_id: string
          markdown_key: string | null
          json_key: string | null
          words_jsonb: Json | null
          speaker_labels: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          markdown_key?: string | null
          json_key?: string | null
          words_jsonb?: Json | null
          speaker_labels?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          markdown_key?: string | null
          json_key?: string | null
          words_jsonb?: Json | null
          speaker_labels?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}