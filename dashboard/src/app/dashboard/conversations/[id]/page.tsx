"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Conversation, Message, MaintenanceRequest, Attachment } from "@/types";
import {
  MessageSquare,
  User,
  Building2,
  Clock,
  Flag,
  ArrowLeft,
  Paperclip,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ConversationDetailPage() {
  const params = useParams();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (id) {
      fetchConversation(id);
    }
  }, [params.id]);

  const fetchConversation = async (id: string) => {
    try {
      const response = await apiClient.get<Conversation>(`/conversations/${id}`);
      setConversation(response.data);
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFlag = async (messageId: number, currentFlagged: boolean) => {
    try {
      await apiClient.patch(`/conversations/${messageId}/flag`, {
        flagged: !currentFlagged,
      });
      if (conversation && conversation.messages) {
        setConversation({
          ...conversation,
          messages: conversation.messages.map((m) =>
            m.id === messageId ? { ...m, flagged: !currentFlagged } : m
          ),
        });
      }
    } catch (error) {
      console.error("Failed to toggle flag:", error);
      alert("Failed to update flag status");
    }
  };

  const updateThreadStatus = async (newStatus: 'active' | 'resolved' | 'escalated') => {
    if (!conversation) return;

    try {
      await apiClient.patch(`/conversations/${conversation.id}/status`, { status: newStatus });
      setConversation({ ...conversation, status: newStatus });
    } catch (error) {
      console.error("Failed to update thread status:", error);
      alert("Failed to update thread status");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Active
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Resolved
          </span>
        );
      case 'escalated':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Escalated
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">
          Loading conversation...
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">
          Conversation not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Conversation Details
          </h1>
          <p className="text-muted-foreground mt-2">
            {conversation.tenant_name ? `Conversation with ${conversation.tenant_name}` : "Conversation details"}
          </p>
        </div>
        <Link href="/dashboard/conversations">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Conversations
          </Button>
        </Link>
      </div>

      {/* Thread Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Thread Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Tenant */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tenant</p>
                <p className="font-medium">{conversation.tenant_name || "Unknown"}</p>
              </div>
            </div>

            {/* Property */}
            {conversation.property_address && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="font-medium text-sm truncate max-w-[200px]">{conversation.property_address}</p>
                </div>
              </div>
            )}

            {/* Channel */}
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Channel</p>
                <p className="font-medium capitalize">{conversation.channel}</p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                {getStatusBadge(conversation.status)}
              </div>
            </div>

            {/* Created */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium text-sm">
                  {new Date(conversation.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Messages Count */}
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Messages</p>
                <p className="font-medium">{conversation.messages?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground mb-1">Subject</p>
            <p className="text-lg font-semibold">{conversation.subject}</p>
          </div>

          {/* Status Actions */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground mb-2">Thread Status</p>
            <div className="flex gap-2">
              {conversation.status === 'active' && (
                <Button
                  onClick={() => updateThreadStatus('resolved')}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark as Resolved
                </Button>
              )}
              {conversation.status === 'resolved' && (
                <Button
                  variant="outline"
                  onClick={() => updateThreadStatus('active')}
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Reopen Thread
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => updateThreadStatus('escalated')}
                className="flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Escalate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Chat */}
      {conversation.messages && conversation.messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {conversation.messages.map((msg) => (
                <div key={msg.id} className="group relative">
                  {/* User Message */}
                  {msg.message_type === 'user_message' && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] md:max-w-[75%]">
                        <div className="flex items-center justify-end gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1 ${
                            msg.channel === "sms"
                              ? "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                              : msg.channel === "email"
                              ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400"
                              : "text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400"
                          }`}>
                            {msg.channel}
                          </span>
                          {msg.flagged && (
                            <Flag className="h-3.5 w-3.5 text-orange-500" />
                          )}
                        </div>
                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">{conversation.tenant_name || "Unknown"}</span>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{msg.message}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* AI Response */}
                  {msg.message_type === 'ai_response' && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] md:max-w-[75%]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                          {msg.flagged && (
                            <Flag className="h-3.5 w-3.5 text-orange-500" />
                          )}
                        </div>
                        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">AI Assistant</span>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{msg.display_text || msg.response}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Action Button - Only show on hover */}
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFlag(msg.id, msg.flagged || false)}
                      className={`bg-white dark:bg-gray-800 shadow-lg border ${
                        msg.flagged ? "text-orange-500 border-orange-300 dark:border-orange-700" : ""
                      }`}
                    >
                      <Flag className={`h-4 w-4 ${msg.flagged ? "fill-current" : ""}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Maintenance Requests */}
      {conversation.related_maintenance && conversation.related_maintenance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Maintenance Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {conversation.related_maintenance.map((req) => (
              <div
                key={req.id}
                className="p-4 border rounded-lg mb-4 last:mb-0 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                      req.priority === 'emergency'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : req.priority === 'urgent'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        : req.priority === 'normal'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {req.priority}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                      req.status === 'open'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : req.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-medium mb-2">{req.issue_description}</p>
                  {req.notes && (
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Manager Notes:</p>
                      <p className="text-sm">{req.notes}</p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Property: {req.property_address || "N/A"}</p>
                  <p>Tenant: {req.tenant_name || "N/A"}</p>
                  {req.resolved_at && (
                    <p>Resolved: {new Date(req.resolved_at).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ))}
            {conversation.related_maintenance.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No maintenance requests related to this conversation
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {conversation.attachments && conversation.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conversation.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{att.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {(att.size / 1024).toFixed(1)} KB • {att.content_type}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(att.url, '_blank')}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
