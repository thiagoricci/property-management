export interface Property {
  id: number;
  address: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  amenities?: any;
  rules?: any;
  created_at: string;
}

export interface Tenant {
  id: number;
  property_id: number;
  name: string;
  phone: string;
  email?: string;
  lease_terms?: any;
  move_in_date?: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  tenant_email?: string;
  property_address?: string;
  channel: "sms" | "email" | "whatsapp";
  message: string;
  response: string;
  response_display?: string;
  ai_actions?: any;
  timestamp: string;
  flagged?: boolean;
  subject?: string;
  attachments?: Attachment[];
  message_count?: number; // Total number of messages from this tenant
}

export interface Attachment {
  id: number;
  conversation_id: number;
  filename: string;
  stored_filename: string;
  content_type: string;
  size: number;
  url: string;
  created_at: string;
}

export interface MaintenanceRequest {
  id: number;
  property_id: number;
  tenant_id: number;
  tenant_name?: string;
  property_address?: string;
  conversation_id?: number;
  issue_description: string;
  priority: "emergency" | "urgent" | "normal" | "low";
  status: "open" | "in_progress" | "resolved";
  notes?: string;
  created_at: string;
  resolved_at?: string;
}

export interface DashboardStats {
  total_properties: number;
  total_tenants: number;
  open_requests: number;
  urgent_requests: number;
  recent_conversations: Conversation[];
}

export interface User {
  id: number;
  email: string;
  name?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}
