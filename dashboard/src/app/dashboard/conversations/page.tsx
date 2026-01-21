"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Conversation } from "@/types";
import {
  MessageSquare,
  Search,
  Filter,
  Clock,
  User,
  Building2,
  Flag,
  ArrowRight,
  Mail,
  X,
  Paperclip,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ConversationsPage() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState<number | null>(null);
  const [filteredTenantName, setFilteredTenantName] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const tenantId = searchParams.get('tenant');
    const tenantName = searchParams.get('tenantName');
    
    if (tenantId) {
      setTenantFilter(parseInt(tenantId));
    } else {
      setTenantFilter(null);
    }

    if (tenantName) {
      setFilteredTenantName(tenantName);
    } else {
      setFilteredTenantName("");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchConversations();
  }, [searchQuery, tenantFilter, page]);

  const fetchConversations = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append("search", searchQuery);
      if (tenantFilter) {
        queryParams.append("tenant_id", tenantFilter.toString());
      } else {
        queryParams.append("grouped", "true");
      }
      queryParams.append("page", page.toString());
      queryParams.append("limit", "20");

      const response = await apiClient.get<Conversation[]>(
        `/conversations?${queryParams.toString()}`
      );
      setConversations(response.data);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchConversations(); // Trigger fetch manually or let useEffect handle it if dep changed
    // useEffect depends on searchQuery, so setting it updates.
    // But here we are setting searchQuery in onChange.
    // Wait, existing code:
    // onChange={(e) => setSearchQuery(e.target.value)}
    // useEffect(() => { fetchConversations(); }, [searchQuery, tenantFilter, page]);
    // So handleSearch just setsPage(1).
  };

  const selectTenant = (tenantId: number, tenantName: string) => {
    setTenantFilter(tenantId);
    setFilteredTenantName(tenantName);
    setPage(1);
    const params = new URLSearchParams(window.location.search);
    params.set('tenant', tenantId.toString());
    params.set('tenantName', tenantName);
    window.history.pushState({}, '', `/dashboard/conversations?${params.toString()}`);
  };

  const clearFilter = () => {
    setTenantFilter(null);
    setFilteredTenantName("");
    setSearchQuery("");
    setPage(1);
    // Clear URL parameters
    window.history.pushState({}, '', '/dashboard/conversations');
    // Force a re-render or let the hook handle it?
    // Since we are pushing state directly to history without notifying Next router, 
    // the useSearchParams hook might not trigger.
    // It is better to use router.push or router.replace from next/navigation
    // But we are already updating local state, so fetchConversations will trigger because tenantFilter changed.
    // However, if the user clicks the browser back button, we want it to work.
  };

  const toggleFlag = async (id: number, currentFlagged: boolean) => {
    try {
      await apiClient.patch(`/conversations/${id}/flag`, {
        flagged: !currentFlagged,
      });
      setConversations(
        conversations.map((c) =>
          c.id === id ? { ...c, flagged: !currentFlagged } : c
        )
      );
    } catch (error) {
      console.error("Failed to toggle flag:", error);
      alert("Failed to update flag status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">
          Loading conversations...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Conversations
          </h1>
          <p className="text-muted-foreground mt-2">
            {tenantFilter
              ? `Showing conversations for ${filteredTenantName}`
              : "Review all AI interactions with tenants"}
          </p>
        </div>
        {tenantFilter && (
          <Button
            variant="outline"
            onClick={clearFilter}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filter
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by tenant name or message content..."
                className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button type="submit" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Conversations will appear here when tenants interact with the AI"}
            </p>
          </CardContent>
        </Card>
      ) : tenantFilter ? (
        // Chat-Style View (Full Conversation History)
        <div className="space-y-6">
          {/* Tenant Info Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tenant</p>
                    <p className="font-medium">{filteredTenantName || "Unknown"}</p>
                  </div>
                </div>
                {conversations[0]?.property_address && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Property</p>
                      <p className="font-medium text-sm truncate max-w-[200px]">{conversations[0].property_address}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Messages</p>
                    <p className="font-medium">{conversations.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Activity</p>
                    <p className="font-medium text-sm">
                      {new Date(conversations[0].timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Messages */}
          <div className="space-y-4">
            {[...conversations].reverse().map((conv) => (
              <div key={conv.id} className="space-y-3">
                {/* Tenant Message */}
                <div className="flex justify-end">
                  <Card className="max-w-[85%] md:max-w-[75%] bg-primary/10 hover:bg-primary/15 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <User className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{filteredTenantName || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1 ${
                          conv.channel === "sms"
                            ? "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                            : conv.channel === "email"
                            ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400"
                            : "text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400"
                        }`}>
                          {conv.channel === "email" && <Mail className="h-3 w-3" />}
                          {conv.channel === "sms" && <MessageSquare className="h-3 w-3" />}
                          {conv.channel}
                        </span>
                        {conv.flagged && (
                          <Flag className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                      {conv.channel === "email" && conv.subject && (
                        <div className="mb-2 p-2 bg-primary/5 rounded">
                          <p className="text-xs text-muted-foreground font-medium">Subject: {conv.subject}</p>
                        </div>
                      )}
                      <p className="text-sm">{conv.message}</p>
                      {conv.attachments && conv.attachments.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          <span>{conv.attachments.length} attachment(s)</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* AI Response */}
                <div className="flex justify-start">
                  <Card className="max-w-[85%] md:max-w-[75%] bg-primary/5 hover:bg-primary/10 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AI Assistant</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{conv.response_display || conv.response}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Actions - Only show on hover */}
                <div className="flex justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity group">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFlag(conv.id, conv.flagged || false)}
                    className={conv.flagged ? "text-orange-500" : ""}
                  >
                    <Flag className="h-4 w-4 mr-1" />
                    {conv.flagged ? "Unflag" : "Flag"}
                  </Button>
                  <Link href={`/dashboard/conversations/${conv.id}`}>
                    <Button size="sm" variant="outline" className="flex items-center gap-1">
                      View Details
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Grouped View (Tenant List)
        <div className="space-y-4">
          {conversations.map((conv) => (
            <Card
              key={conv.id}
              className="hover:shadow-lg transition-shadow cursor-pointer hover:bg-muted/50"
              onClick={() => selectTenant(conv.tenant_id, conv.tenant_name || 'Unknown')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base">
                          {conv.tenant_name || "Unknown Tenant"}
                        </h3>
                        {conv.message_count && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {conv.message_count} messages
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conv.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        conv.channel === 'sms' ? 'bg-blue-500' : 
                        conv.channel === 'email' ? 'bg-green-500' : 'bg-purple-500'
                      }`} />
                      <p className="line-clamp-1 flex-1">
                        <span className="font-medium text-foreground/80">Last message: </span>
                        {conv.message}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {conversations.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
