"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { Conversation, MaintenanceRequest } from "@/types";
import {
  ArrowLeft,
  MessageSquare,
  User,
  Clock,
  Phone,
  Mail,
  Building2,
  Send,
  Flag,
  AlertTriangle,
  Wrench,
  Paperclip,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ConversationDetail extends Conversation {
  tenant_phone?: string;
  tenant_email?: string;
  property_address?: string;
  response_display?: string;
  related_maintenance: MaintenanceRequest[];
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [isTogglingFlag, setIsTogglingFlag] = useState(false);

  useEffect(() => {
    fetchConversation();
  }, [params.id]);

  const fetchConversation = async () => {
    try {
      const response = await apiClient.get<ConversationDetail>(
        `/conversations/${params.id}`
      );
      setConversation(response.data);
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFlag = async () => {
    if (!conversation) return;

    setIsTogglingFlag(true);

    try {
      await apiClient.patch(`/conversations/${conversation.id}/flag`, {
        flagged: !conversation.flagged,
      });
      setConversation({
        ...conversation,
        flagged: !conversation.flagged,
      });
    } catch (error) {
      console.error("Failed to toggle flag:", error);
      alert("Failed to update flag status");
    } finally {
      setIsTogglingFlag(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !replyMessage.trim()) return;

    setIsSendingReply(true);

    try {
      await apiClient.post(`/conversations/${conversation.id}/reply`, {
        message: replyMessage,
      });
      alert("Reply sent successfully!");
      setReplyMessage("");
    } catch (error) {
      console.error("Failed to send reply:", error);
      alert("Failed to send reply");
    } finally {
      setIsSendingReply(false);
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
      <div className="flex items-center gap-4">
        <Link href="/dashboard/conversations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Conversation Details
          </h1>
          <p className="text-muted-foreground mt-1">
            Review AI interaction and respond if needed
          </p>
        </div>
        <Button
          variant={conversation.flagged ? "destructive" : "outline"}
          onClick={toggleFlag}
          disabled={isTogglingFlag}
          className="flex items-center gap-2"
        >
          <Flag className="h-4 w-4" />
          {conversation.flagged ? "Unflag" : "Flag"}
        </Button>
      </div>

      {/* Conversation Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tenant</p>
                <p className="font-medium">{conversation.tenant_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Date & Time</p>
                <p className="font-medium">
                  {new Date(conversation.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            {conversation.tenant_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-sm">
                    {conversation.tenant_phone}
                  </p>
                </div>
              </div>
            )}
            {conversation.tenant_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-sm">
                    {conversation.tenant_email}
                  </p>
                </div>
              </div>
            )}
            {conversation.property_address && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="font-medium text-sm">
                    {conversation.property_address}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Channel</p>
                <p className="font-medium uppercase text-sm">
                  {conversation.channel}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <div className="space-y-4">
        {/* Tenant Message */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">
                    {conversation.tenant_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(conversation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {conversation.channel === "email" && conversation.subject && (
                  <div className="mb-2 p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground font-medium">Subject: {conversation.subject}</p>
                  </div>
                )}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">{conversation.message}</p>
                </div>
                {conversation.attachments && conversation.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      <span>Attachments ({conversation.attachments.length})</span>
                    </div>
                    <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                      {conversation.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 bg-muted/50 rounded hover:bg-muted/80 transition-colors"
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {attachment.filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Response */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">AI Assistant</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(conversation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-sm">{conversation.response_display || conversation.response}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Related Maintenance Requests */}
      {conversation.related_maintenance &&
        conversation.related_maintenance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Related Maintenance Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversation.related_maintenance.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            req.priority === "emergency"
                              ? "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400"
                              : req.priority === "urgent"
                              ? "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400"
                              : "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                          }`}
                        >
                          {req.priority}
                        </div>
                        <div
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            req.status === "open"
                              ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400"
                              : req.status === "in_progress"
                              ? "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                              : "text-gray-600 bg-gray-50 dark:bg-gray-950 dark:text-gray-400"
                          }`}
                        >
                          {req.status.replace("_", " ")}
                        </div>
                      </div>
                      <p className="text-sm line-clamp-2">
                        {req.issue_description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created{" "}
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link href={`/dashboard/maintenance/${req.id}`}>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Send Reply */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Manual Reply
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendReply} className="space-y-4">
            <div>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your message to send to the tenant..."
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                disabled={isSendingReply}
              />
            </div>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground flex-1">
                Manual replies will be sent via the configured communication channel
                (SMS/Email). This feature requires Twilio/Resend integration.
              </p>
            </div>
            <Button
              type="submit"
              disabled={isSendingReply || !replyMessage.trim()}
              className="w-full flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              {isSendingReply ? "Sending..." : "Send Reply"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
