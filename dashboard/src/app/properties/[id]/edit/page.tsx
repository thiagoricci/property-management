"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { Property } from "@/types";
import { ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProperty();
  }, [params.id]);

  const fetchProperty = async () => {
    try {
      const response = await apiClient.get<Property>(`/properties/${params.id}`);
      setProperty(response.data);
    } catch (error) {
      console.error("Failed to fetch property:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;

    setIsSaving(true);

    try {
      await apiClient.put(`/properties/${property.id}`, {
        address: property.address,
        owner_name: property.owner_name,
        owner_email: property.owner_email,
        owner_phone: property.owner_phone,
        amenities: property.amenities,
        rules: property.rules,
      });
      router.push(`/properties/${property.id}`);
    } catch (error) {
      console.error("Failed to update property:", error);
      alert("Failed to update property");
    } finally {
      setIsSaving(false);
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
        <Link href={`/properties/${property.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit Property
          </h1>
          <p className="text-muted-foreground mt-1">
            Update property information
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Address *
              </label>
              <input
                type="text"
                required
                value={property.address}
                onChange={(e) =>
                  setProperty({ ...property, address: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="123 Main St, City, State 12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Owner Name *
              </label>
              <input
                type="text"
                required
                value={property.owner_name}
                onChange={(e) =>
                  setProperty({ ...property, owner_name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Owner Email *
              </label>
              <input
                type="email"
                required
                value={property.owner_email}
                onChange={(e) =>
                  setProperty({ ...property, owner_email: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="owner@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Owner Phone *
              </label>
              <input
                type="tel"
                required
                value={property.owner_phone}
                onChange={(e) =>
                  setProperty({ ...property, owner_phone: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Amenities (JSON)
              </label>
              <textarea
                value={
                  typeof property.amenities === "string"
                    ? property.amenities
                    : JSON.stringify(property.amenities || {}, null, 2)
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setProperty({ ...property, amenities: parsed });
                  } catch {
                    // Invalid JSON, just update as string
                    setProperty({ ...property, amenities: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                placeholder='{"wifi": true, "parking": true}'
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter as JSON object (e.g., {`{"wifi": true, "parking": true}`})
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Rules (JSON)
              </label>
              <textarea
                value={
                  typeof property.rules === "string"
                    ? property.rules
                    : JSON.stringify(property.rules || {}, null, 2)
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setProperty({ ...property, rules: parsed });
                  } catch {
                    // Invalid JSON, just update as string
                    setProperty({ ...property, rules: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                placeholder='{"no_pets": true, "quiet_hours": "10pm-8am"}'
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter as JSON object (e.g., {`{"no_pets": true, "quiet_hours": "10pm-8am"}`})
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Link href={`/properties/${property.id}`} className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
