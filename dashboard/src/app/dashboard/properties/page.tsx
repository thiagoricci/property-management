"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Property, PropertyAnalytics } from "@/types";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  Phone,
  Mail,
  Search,
  Filter,
  Calendar,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AddPropertyModal } from "@/components/modals/AddPropertyModal";
import { DeleteConfirmation } from "@/components/modals/DeleteConfirmation";
import Link from "next/link";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [analytics, setAnalytics] = useState<PropertyAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    propertyId: number | null;
  }>({ isOpen: false, propertyId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    hasTenants: "",
    dateRange: "",
    sortBy: "created_at",
    sortOrder: "desc" as "asc" | "desc",
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [searchQuery, filters]);

  const fetchAnalytics = async () => {
    try {
      const response = await apiClient.get<PropertyAnalytics>("/properties/analytics");
      setAnalytics(response.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append("search", searchQuery);
      if (filters.hasTenants) queryParams.append("has_tenants", filters.hasTenants);
      if (filters.dateRange) queryParams.append("date_range", filters.dateRange);
      queryParams.append("sort", filters.sortBy);
      queryParams.append("order", filters.sortOrder);

      const response = await apiClient.get<Property[]>(
        `/properties?${queryParams.toString()}`
      );
      setProperties(response.data);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteDialog({ isOpen: true, propertyId: id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.propertyId) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/properties/${deleteDialog.propertyId}`);
      setProperties(properties.filter((p) => p.id !== deleteDialog.propertyId));
      setDeleteDialog({ isOpen: false, propertyId: null });
      // Refresh analytics after deletion
      fetchAnalytics();
    } catch (error) {
      console.error("Failed to delete property:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = searchQuery || filters.hasTenants || filters.dateRange;

  const clearFilters = () => {
    setSearchQuery("");
    setFilters({
      hasTenants: "",
      dateRange: "",
      sortBy: "created_at",
      sortOrder: "desc",
    });
  };

  if (isLoading || isLoadingAnalytics) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Analytics Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filters Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Property Cards Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-10 w-full mt-4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Properties
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your properties and associated tenants
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Properties
                  </p>
                  <p className="text-3xl font-bold mt-2">
                    {analytics.total_properties}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Properties with Tenants
                  </p>
                  <p className="text-3xl font-bold mt-2">
                    {analytics.properties_with_tenants}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Tenants
                  </p>
                  <p className="text-3xl font-bold mt-2">
                    {analytics.total_tenants}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Recently Added
                  </p>
                  <p className="text-3xl font-bold mt-2">
                    {analytics.recently_added}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search properties by address or owner name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {[searchQuery, filters.hasTenants, filters.dateRange].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Tenants</label>
                  <Select
                    value={filters.hasTenants}
                    onValueChange={(value) =>
                      setFilters({ ...filters, hasTenants: value })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="All Properties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Properties</SelectItem>
                      <SelectItem value="true">With Tenants</SelectItem>
                      <SelectItem value="false">Without Tenants</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Date Added</label>
                  <Select
                    value={filters.dateRange}
                    onValueChange={(value) =>
                      setFilters({ ...filters, dateRange: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Time</SelectItem>
                      <SelectItem value="7">Last 7 Days</SelectItem>
                      <SelectItem value="30">Last 30 Days</SelectItem>
                      <SelectItem value="90">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Sort By</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        value={filters.sortBy}
                        onValueChange={(value) =>
                          setFilters({ ...filters, sortBy: value })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="created_at">Date Added</SelectItem>
                          <SelectItem value="address">Address</SelectItem>
                          <SelectItem value="tenant_count">Tenant Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Select
                        value={filters.sortOrder}
                        onValueChange={(value) =>
                          setFilters({ ...filters, sortOrder: value as "asc" | "desc" })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Newest First</SelectItem>
                          <SelectItem value="asc">Oldest First</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <>
                  <Separator className="my-4" />
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    Clear All Filters
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Properties List */}
      {properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {hasActiveFilters ? "No properties found" : "No properties yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Get started by adding your first property to the system"}
            </p>
            <div className="flex gap-3">
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {hasActiveFilters ? "Add New Property" : "Add Your First Property"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card key={property.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex items-start justify-between pb-3">
                <CardTitle className="text-lg font-semibold line-clamp-2">
                  {property.address}
                </CardTitle>
                <div className="flex gap-2">
                  <Link href={`/dashboard/properties/${property.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(property.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-medium">{property.owner_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">
                    {property.owner_email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">
                    {property.owner_phone}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {property.tenant_count || 0} {property.tenant_count === 1 ? "tenant" : "tenants"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">
                      {new Date(property.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Link href={`/dashboard/properties/${property.id}`} className="block mt-4">
                  <Button variant="outline" className="w-full">
                    View Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchProperties();
            fetchAnalytics();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmation
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, propertyId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Property"
        description="Are you sure you want to delete this property? This action cannot be undone and will also remove all associated tenants and data."
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
