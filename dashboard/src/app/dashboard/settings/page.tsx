"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { UserProfile, TwilioConfig } from "@/types";
import { Settings as SettingsIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProfileSettings from "./components/ProfileSettings";
import PasswordChange from "./components/PasswordChange";
import TwilioSettings from "./components/TwilioSettings";

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchTwilioConfig();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get<UserProfile>("/user/profile");
      setProfile(response.data);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTwilioConfig = async () => {
    try {
      const response = await apiClient.get<TwilioConfig>("/settings/twilio");
      setTwilioConfig(response.data);
    } catch (error) {
      console.error("Failed to fetch Twilio config:", error);
    }
  };

  const handleProfileUpdate = async (data: { name: string; email: string; phone?: string }) => {
    try {
      await apiClient.put("/user/profile", data);
      await fetchProfile();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to update profile",
      };
    }
  };

  const handlePasswordChange = async (data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) => {
    try {
      await apiClient.put("/user/password", data);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to change password",
      };
    }
  };

  const handleTwilioConfig = async (data: {
    account_sid: string;
    auth_token: string;
    phone_number: string;
  }) => {
    try {
      await apiClient.put("/settings/twilio", data);
      await fetchTwilioConfig();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to save Twilio configuration",
      };
    }
  };

  const handleTwilioTest = async (data: {
    account_sid: string;
    auth_token: string;
    phone_number: string;
  }) => {
    try {
      const response = await apiClient.post("/settings/twilio/test", data);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to test Twilio connection",
      };
    }
  };

  const handleTwilioDelete = async () => {
    try {
      await apiClient.delete("/settings/twilio");
      await fetchTwilioConfig();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to remove Twilio configuration",
      };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
        </div>
        <p className="text-muted-foreground">
          Manage your account settings and integrations
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="twilio">Twilio</TabsTrigger>
        </TabsList>

        {/* Profile Settings Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profile && (
                <ProfileSettings
                  profile={profile}
                  onUpdate={handleProfileUpdate}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Change Tab */}
        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordChange onChange={handlePasswordChange} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Twilio Configuration Tab */}
        <TabsContent value="twilio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Twilio Configuration</CardTitle>
              <CardDescription>
                Configure your Twilio account for SMS notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {twilioConfig && (
                <TwilioSettings
                  config={twilioConfig}
                  onSave={handleTwilioConfig}
                  onTest={handleTwilioTest}
                  onDelete={handleTwilioDelete}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
