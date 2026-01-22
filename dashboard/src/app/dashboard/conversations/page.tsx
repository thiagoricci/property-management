"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Conversation, PaginationMetadata } from "@/types";
import {
  MessageSquare,
  Search,
  Clock,
  User,
  Building2,
  ArrowRight,
  Mail,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Filter,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

interface ConversationAnalytics {
  total: number;
  by_channel: {
    sms: number;
    email: number;
    whatsapp: number;
    other: number;
  };
  by_status?: {
    active: number;
    resolved: number;
    escalated: number;
  };
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [analytics, setAnalytics] = useState<ConversationAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  useEffect(() => {
    fetchConversations();
  }, [searchQuery, page, statusFilter, channelFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await apiClient.get<ConversationAnalytics>('/conversations/analytics');
      setAnalytics(response.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append("search", searchQuery);
      if (statusFilter !== "all") queryParams.append("status", statusFilter);
      if (channelFilter !== "all") queryParams.append("channel", channelFilter);
      queryParams.append("page", page.toString());
      queryParams.append("limit", "20");

      const response = await apiClient.get<{ data: Conversation[], pagination: PaginationMetadata }>(
        `/conversations?${queryParams.toString()}`
      );
      setConversations(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Active</Badge>;
      case 'resolved':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Resolved</Badge>;
      case 'escalated':
        return <Badge variant="destructive">Escalated</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'escalated':
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms':
        return <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'email':
        return <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'sms':
        return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">SMS</Badge>;
      case 'email':
        return <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">Email</Badge>;
      case 'whatsapp':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">WhatsApp</Badge>;
      default:
        return <Badge variant="outline">{channel}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Analytics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>

        {/* Conversations Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Conversations
          </h1>
          <p className="text-muted-foreground mt-2">
            Review all AI interactions with tenants
          </p>
        </div>
      </div>

      {/* Analytics Cards */}
      {!isLoadingAnalytics && analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="min-h-[120px]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Conversations
                  </p>
                  <p className="text-3xl font-bold mt-2">{analytics.total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[120px]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    SMS Conversations
                  </p>
                  <p className="text-3xl font-bold mt-2">{analytics.by_channel.sms}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[120px]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    WhatsApp Conversations
                  </p>
                  <p className="text-3xl font-bold mt-2">{analytics.by_channel.whatsapp}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[120px]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Email Conversations
                  </p>
                  <p className="text-3xl font-bold mt-2">{analytics.by_channel.email}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by tenant name or conversation subject..."
                  className="pl-10"
                />
              </div>
              <Button type="submit" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Search
              </Button>
            </div>
            <Separator />
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Channel</label>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery || statusFilter !== "all" || channelFilter !== "all"
                ? "No conversations found"
                : "No conversations yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {searchQuery || statusFilter !== "all" || channelFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Conversations will appear here when tenants interact with AI"}
            </p>
            {(searchQuery || statusFilter !== "all" || channelFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setChannelFilter("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-4 pr-4">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className="block group"
              >
                <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer hover:bg-muted/50 hover:-translate-y-1 border-l-4 border-l-transparent hover:border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          {getChannelIcon(conv.channel)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusIcon(conv.status)}
                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{conv.subject}</h3>
                            {getStatusBadge(conv.status)}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getChannelBadge(conv.channel)}
                            <span className="text-xs text-muted-foreground">
                              {new Date(conv.last_activity_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">{conv.tenant_name || "Unknown Tenant"}</span>
                          {conv.property_address && (
                            <>
                              <span>•</span>
                              <Building2 className="h-4 w-4" />
                              <span className="truncate max-w-[200px]">{conv.property_address}</span>
                            </>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {conv.last_message || "No messages yet"}
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {conv.message_count || 0} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Created {new Date(conv.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Pagination */}
      {conversations.length > 0 && pagination && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="min-w-[100px]"
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {page} of {pagination.totalPages}
            </span>
            <span className="text-sm text-muted-foreground">
              ({pagination.total} total)
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasMore}
            className="min-w-[100px]"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
