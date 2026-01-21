"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { Property, Tenant } from "@/types";
import {
  ArrowLeft,
  Building2,
  Users,
  Phone,
  Mail,
  Plus,
  Edit,
  Trash2,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PropertyDetail extends Property {
  tenants: Tenant[];
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);

  useEffect(() => {
    fetchProperty();
  }, [params.id]);

  const fetchProperty = async () => {
    try {
      const response = await apiClient.get<PropertyDetail>(`/properties/${params.id}`);
      setProperty(response.data);
    } catch (error) {
      console.error("Failed to fetch property:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTenant = async (tenantId: number) => {
    if (!confirm("Are you sure you want to remove this tenant?")) return;

    try {
      await apiClient.delete(`/tenants/${tenantId}`);
      setProperty({
        ...property!,
        tenants: property!.tenants.filter((t) => t.id !== tenantId),
      });
    } catch (error) {
      console.error("Failed to delete tenant:", error);
      alert("Failed to delete tenant");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading property...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Property not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/properties">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Property Details
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage property information and tenants
          </p>
        </div>
        <Link href={`/dashboard/properties/${property.id}/edit`}>
          <Button variant="outline" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit Property
          </Button>
        </Link>
      </div>

      {/* Property Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Property Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Address
            </label>
            <p className="text-lg font-semibold mt-1">{property.address}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Owner Name
              </label>
              <p className="font-medium mt-1">{property.owner_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Owner Email
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{property.owner_email}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Owner Phone
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{property.owner_phone}</span>
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Added on {new Date(property.created_at).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>

      {/* Tenants Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Tenants ({property.tenants.length})
            </CardTitle>
            <Button
              onClick={() => setShowAddTenantModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Tenant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {property.tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tenants added yet</p>
              <p className="text-sm mt-2">
                Add tenants to enable AI communication
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {property.tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{tenant.name}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{tenant.phone}</span>
                          </div>
                          {tenant.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="text-xs">{tenant.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {tenant.move_in_date && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Moved in{" "}
                          {new Date(tenant.move_in_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTenant(tenant.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAddTenantModal && (
        <AddTenantModal
          propertyId={property.id}
          onClose={() => setShowAddTenantModal(false)}
          onSuccess={() => {
            setShowAddTenantModal(false);
            fetchProperty();
          }}
        />
      )}
    </div>
  );
}

function AddTenantModal({
  propertyId,
  onClose,
  onSuccess,
}: {
  propertyId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    move_in_date: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.post("/tenants", {
        ...formData,
        property_id: propertyId,
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to create tenant:", error);
      alert("Failed to create tenant");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Add New Tenant</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Tenant Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="tenant@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Move-in Date
              </label>
              <input
                type="date"
                value={formData.move_in_date}
                onChange={(e) =>
                  setFormData({ ...formData, move_in_date: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Adding..." : "Add Tenant"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
