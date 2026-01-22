export interface Property {
  id: number;
  address: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  tenant_count?: number;
  amenities?: any;
  rules?: any;
  created_at: string;
}

export interface PropertyAnalytics {
  total_properties: number;
  properties_with_tenants: number;
  total_tenants: number;
  recently_added: number;
}

export interface Tenant {
  id: number;
  property_id: number;
  name: string;
  phone: string;
  email?: string;
  lease_terms?: any;
  move_in_date?: string;
  property_address?: string;
  created_at: string;
}

export interface TenantAnalytics {
  total_tenants: number;
  active_tenants: number;
  properties_with_tenants: number;
  new_this_month: number;
}

export interface Message {
  id: number;
  thread_id: number;
  tenant_id: number;
  channel: 'sms' | 'email' | 'whatsapp';
  message: string;
  response?: string;
  ai_actions?: any;
  message_type: 'user_message' | 'ai_response';
  timestamp: string;
  display_text?: string;
  flagged?: boolean;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  property_address?: string;
}

export interface Conversation {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  tenant_email?: string;
  property_address?: string;
  channel: 'sms' | 'email' | 'whatsapp';
  message_count?: number; // Total number of messages in thread
  last_message?: string; // Last user message preview
  last_message_time?: string; // Timestamp of last message
  subject: string; // Thread subject/topic
  status: 'active' | 'resolved' | 'escalated'; // Thread status
  created_at: string;
  resolved_at?: string;
  last_activity_at: string;
  summary?: string;
  messages?: Message[]; // All messages in thread (for detail view)
  related_maintenance?: MaintenanceRequest[];
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  message_id: number;
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
  message_id?: number;
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
  total_requests: number;
  total_conversations: number;
}

export interface RecentConversation {
  id: number;
  tenant_id: number;
  channel: "sms" | "email" | "whatsapp";
  message: string;
  response: string;
  timestamp: string;
  subject?: string;
  tenant_name: string;
  property_address?: string;
  urgency?: "emergency" | "urgent" | "normal" | "low" | null;
  request_status?: "open" | "in_progress" | "resolved" | null;
}

export interface RecentRequest {
  id: number;
  property_id: number;
  tenant_id: number;
  issue_description: string;
  priority: "emergency" | "urgent" | "normal" | "low";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  resolved_at?: string | null;
  tenant_name: string;
  property_address?: string;
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

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ConversationsResponse {
  data: Conversation[];
  pagination: PaginationMetadata;
}
