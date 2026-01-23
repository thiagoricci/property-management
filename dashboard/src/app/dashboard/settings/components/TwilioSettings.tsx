"use client";

import { useState } from "react";
import { TwilioConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Key, 
  Phone, 
  Check, 
  X, 
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Trash2
} from "lucide-react";

interface TwilioSettingsProps {
  config: TwilioConfig;
  onSave: (data: {
    account_sid: string;
    auth_token: string;
    phone_number: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onTest: (data: {
    account_sid: string;
    auth_token: string;
    phone_number: string;
  }) => Promise<{ success: boolean; error?: string; data?: any }>;
  onDelete: () => Promise<{ success: boolean; error?: string }>;
}

export default function TwilioSettings({
  config,
  onSave,
  onTest,
  onDelete,
}: TwilioSettingsProps) {
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    test_message_sid?: string;
  } | null>(null);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, "");
    // Add + if not present
    if (cleaned && !cleaned.startsWith("+")) {
      return "+" + cleaned;
    }
    return cleaned;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setTestResult(null);
    setIsSaving(true);

    const result = await onSave({
      account_sid: accountSid.trim(),
      auth_token: authToken.trim(),
      phone_number: phoneNumber.trim(),
    });

    setIsSaving(false);

    if (result.success) {
      setSuccess(true);
      setAccountSid("");
      setAuthToken("");
      setPhoneNumber("");
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || "Failed to save Twilio configuration");
    }
  };

  const handleTest = async () => {
    setError(null);
    setTestResult(null);
    setIsTesting(true);

    const result = await onTest({
      account_sid: accountSid.trim(),
      auth_token: authToken.trim(),
      phone_number: phoneNumber.trim(),
    });

    setIsTesting(false);

    if (result.success) {
      setTestResult({
        success: true,
        message: result.data?.message || "Test SMS sent successfully",
        test_message_sid: result.data?.test_message_sid,
      });
    } else {
      setTestResult({
        success: false,
        message: result.error || "Test failed",
      });
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to remove your Twilio configuration? This will disable SMS notifications."
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(false);
    setIsDeleting(true);

    const result = await onDelete();

    setIsDeleting(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || "Failed to remove Twilio configuration");
    }
  };

  const isValidForm =
    accountSid.length === 34 &&
    accountSid.startsWith("AC") &&
    authToken.length >= 32 &&
    phoneNumber.length >= 10;

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-3">
          {config.configured ? (
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
          )}
          <div>
            <p className="font-medium">
              {config.configured ? "Twilio Configured" : "Not Configured"}
            </p>
            {config.configured && config.twilio_phone_number && (
              <p className="text-sm text-muted-foreground">
                Phone: {config.twilio_phone_number}
              </p>
            )}
          </div>
        </div>
        {config.configured && (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
            Active
          </Badge>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-300 flex items-center gap-2">
            <Check className="h-4 w-4" />
            {config.configured
              ? "Twilio configuration saved successfully!"
              : "Twilio configuration removed successfully!"}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-2">
            <X className="h-4 w-4" />
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Test Result */}
      {testResult && (
        <Alert
          className={
            testResult.success
              ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
              : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
          }
        >
          <AlertDescription
            className={
              testResult.success
                ? "text-blue-800 dark:text-blue-300"
                : "text-red-800 dark:text-red-300"
            }
          >
            {testResult.success ? (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>{testResult.message}</span>
                {testResult.test_message_sid && (
                  <span className="text-xs ml-2">
                    (SID: {testResult.test_message_sid})
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <X className="h-4 w-4" />
                <span>{testResult.message}</span>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Form */}
      {!config.configured && (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Account SID Field */}
          <div className="space-y-2">
            <Label htmlFor="account_sid">Account SID</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="account_sid"
                type="text"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value.toUpperCase())}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="pl-10 font-mono"
                required
                minLength={34}
                maxLength={34}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Found in your Twilio Console dashboard
            </p>
          </div>

          {/* Auth Token Field */}
          <div className="space-y-2">
            <Label htmlFor="auth_token">Auth Token</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth_token"
                type={showAuthToken ? "text" : "password"}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Your Twilio Auth Token"
                className="pl-10 pr-10 font-mono"
                required
                minLength={32}
              />
              <button
                type="button"
                onClick={() => setShowAuthToken(!showAuthToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAuthToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Found in your Twilio Console dashboard. Keep this secret!
            </p>
          </div>

          {/* Phone Number Field */}
          <div className="space-y-2">
            <Label htmlFor="phone_number">Twilio Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone_number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                placeholder="+1 (555) 123-4567"
                className="pl-10 font-mono"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The Twilio phone number you want to use for SMS notifications
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!isValidForm || isTesting}
              className="flex-1"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
            <Button
              type="submit"
              disabled={!isValidForm || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Delete Configuration */}
      {config.configured && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Twilio Configuration
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This will disable SMS notifications for all properties
          </p>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <AlertTitle className="text-blue-900 dark:text-blue-300 mb-2">
          Need help finding your Twilio credentials?
        </AlertTitle>
        <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>Log in to your Twilio Console</li>
          <li>Navigate to Settings & General</li>
          <li>Copy your Account SID and Auth Token</li>
          <li>Go to Phone Numbers & Manage Numbers</li>
          <li>Copy your Twilio phone number</li>
        </ol>
      </div>
    </div>
  );
}
