const twilio = require("../config/twilio");
const resend = require("../config/resend");
const db = require("../config/database");

/**
 * Fetch user settings from database
 * @param {Number} userId - User ID
 * @returns {Promise<Object|null>} User settings or null
 */
async function getUserSettings(userId) {
  try {
    const result = await db.query(
      "SELECT * FROM user_settings WHERE user_id = $1",
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    return null;
  }
}

class NotificationService {
  /**
   * Send notification based on priority
   * @param {String} priority - Priority level (emergency, urgent, normal, low)
   * @param {String} recipientPhone - Manager phone number
   * @param {String} recipientEmail - Manager email address
   * @param {String} message - Notification message
   * @param {String} subject - Email subject (for email notifications)
   * @returns {Promise<Object>} Notification result
   */
  async sendNotification(priority, recipientPhone, recipientEmail, message, subject = "Property Manager Alert", userId = null) {
    const channel = this.determineChannel(priority);
    let result;

    console.log(`[Notification] Sending ${channel} notification (priority: ${priority}, userId: ${userId})`);

    try {
      // Check if we have the required contact information for the chosen channel
      if (channel === "sms" && !recipientPhone) {
        console.error("[Notification] ERROR: Recipient phone number is missing for SMS notification");
        throw new Error("Recipient phone number is missing for SMS notification");
      }
      if (channel === "email" && !recipientEmail) {
        console.error("[Notification] ERROR: Recipient email address is missing for email notification");
        throw new Error("Recipient email address is missing for email notification");
      }

      if (channel === "sms") {
        console.log(`[Notification] Attempting to send SMS to ${recipientPhone}`);
        // Try to use user-specific Twilio settings first
        if (userId) {
          const userSettings = await getUserSettings(userId);
          if (userSettings && userSettings.twilio_account_sid && userSettings.twilio_auth_token_encrypted) {
            console.log("[Notification] Using user-specific Twilio settings");
            result = await twilio.sendSMSWithUserSettings(recipientPhone, message, userSettings);
          } else {
            // Fallback to legacy .env configuration
            console.warn("[Notification] Twilio not configured in user settings, using legacy .env configuration");
            result = await twilio.sendSMSLegacy(recipientPhone, message);
          }
        } else {
          // No userId provided, use legacy .env configuration
          console.warn("[Notification] No userId provided, using legacy .env configuration");
          result = await twilio.sendSMSLegacy(recipientPhone, message);
        }
      } else if (channel === "email") {
        console.log(`[Notification] Attempting to send email to ${recipientEmail}`);
        result = await resend.sendEmail(recipientEmail, subject, message);
      }

      // Log notification to database
      await this.logNotification(
        channel === "sms" ? recipientPhone : recipientEmail,
        message,
        channel,
        "sent"
      );

      console.log(`[Notification] SUCCESS: ${channel} notification sent successfully`);
      return {
        success: true,
        channel,
        result,
      };
    } catch (error) {
      console.error(`[Notification] FAILED: ${channel} notification error:`, error);

      // Log failed notification
      await this.logNotification(
        channel === "sms" ? recipientPhone : recipientEmail,
        message,
        channel,
        "failed",
        error.message
      );

      return {
        success: false,
        channel,
        error: error.message,
      };
    }
  }

  /**
   * Determine notification channel based on priority
   * @param {String} priority - Priority level
   * @returns {String} Channel ('sms' or 'email')
   */
  determineChannel(priority) {
    // Emergency and urgent get SMS for immediate attention
    if (priority === "emergency" || priority === "urgent") {
      return "sms";
    }

    // Normal and low get email
    return "email";
  }

  /**
   * Log notification to database
   * @param {String} recipient - Recipient (phone or email)
   * @param {String} message - Message content
   * @param {String} channel - Channel used
   * @param {String} status - Status (sent, failed)
   * @param {String} errorMessage - Error message if failed
   */
  async logNotification(recipient, message, channel, status, errorMessage = null) {
    try {
      await db.query(
        `INSERT INTO notifications (recipient, message, channel, status, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [recipient, message, channel, status, errorMessage]
      );
    } catch (error) {
      console.error("Failed to log notification:", error);
    }
  }

  /**
   * Send maintenance request notification to manager
   * @param {Object} maintenanceRequest - Maintenance request details
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @param {String} managerPhone - Admin user's phone number
   * @param {String} managerEmail - Admin user's email address
   * @param {Number} userId - User ID for user-specific settings (optional)
   * @returns {Promise<Object>} Notification result
   */
  async notifyManagerOfMaintenanceRequest(maintenanceRequest, tenant, property, managerPhone, managerEmail, userId = null) {
    const priority = maintenanceRequest.priority;
    const message = this.buildMaintenanceMessage(maintenanceRequest, tenant, property);
    const subject = `Maintenance Request: ${priority.toUpperCase()} - ${property.address}`;

    return await this.sendNotification(
      priority,
      managerPhone,
      managerEmail,
      message,
      subject,
      userId
    );
  }

  /**
   * Build maintenance request notification message
   * @param {Object} maintenanceRequest - Maintenance request details
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @returns {String} Formatted message
   */
  buildMaintenanceMessage(maintenanceRequest, tenant, property) {
    const priorityEmoji = {
      emergency: "🚨",
      urgent: "⚠️",
      normal: "🔧",
      low: "📝",
    };

    return `${priorityEmoji[maintenanceRequest.priority] || ""} Maintenance Request

Property: ${property.address}
Priority: ${maintenanceRequest.priority.toUpperCase()}
Tenant: ${tenant.name}
Phone: ${tenant.phone}

Issue: ${maintenanceRequest.issue_description}

Request ID: ${maintenanceRequest.id}
Created: ${new Date(maintenanceRequest.created_at).toLocaleString()}

Please review and take action in the dashboard.`;
  }

  /**
   * Send emergency alert to manager
   * @param {String} reason - Emergency reason
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @param {String} managerPhone - Admin user's phone number
   * @param {String} managerEmail - Admin user's email address
   * @param {Number} userId - User ID for user-specific settings (optional)
   * @returns {Promise<Object>} Notification result
   */
  async notifyManagerOfEmergency(reason, tenant, property, managerPhone, managerEmail, userId = null) {
    const message = this.buildEmergencyMessage(reason, tenant, property);
    const subject = `🚨 EMERGENCY ALERT - ${property.address}`;

    // Always use SMS for emergencies
    return await this.sendNotification(
      "emergency",
      managerPhone,
      managerEmail,
      message,
      subject,
      userId
    );
  }

  /**
   * Build emergency alert message
   * @param {String} reason - Emergency reason
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @returns {String} Formatted message
   */
  buildEmergencyMessage(reason, tenant, property) {
    return `🚨 EMERGENCY ALERT 🚨

Property: ${property.address}
Tenant: ${tenant.name}
Phone: ${tenant.phone}

Reason: ${reason}

Time: ${new Date().toLocaleString()}

IMMEDIATE ACTION REQUIRED!`;
  }

  /**
   * Send confirmation message to tenant
   * @param {String} tenantPhone - Tenant phone number
   * @param {String} tenantEmail - Tenant email
   * @param {String} message - Confirmation message
   * @param {String} channel - Preferred channel
   * @returns {Promise<Object>} Notification result
   */
  async sendTenantConfirmation(tenantPhone, tenantEmail, message, channel = "sms", userId = null) {
    try {
      let result;

      if (channel === "sms" && tenantPhone) {
        // Try to use user-specific Twilio settings first
        if (userId) {
          const userSettings = await getUserSettings(userId);
          if (userSettings && userSettings.twilio_account_sid && userSettings.twilio_auth_token_encrypted) {
            result = await twilio.sendSMSWithUserSettings(tenantPhone, message, userSettings);
          } else {
            // Fallback to legacy .env configuration
            console.warn("Twilio not configured in user settings, using legacy .env configuration");
            result = await twilio.sendSMSLegacy(tenantPhone, message);
          }
        } else {
          // No userId provided, use legacy .env configuration
          console.warn("No userId provided, using legacy .env configuration");
          result = await twilio.sendSMSLegacy(tenantPhone, message);
        }
      } else if (channel === "email" && tenantEmail) {
        result = await resend.sendEmail(tenantEmail, "Confirmation", message);
      } else {
        // Fallback to SMS if preferred channel not available
        if (tenantPhone) {
          // Try to use user-specific Twilio settings first
          if (userId) {
            const userSettings = await getUserSettings(userId);
            if (userSettings && userSettings.twilio_account_sid && userSettings.twilio_auth_token_encrypted) {
              result = await twilio.sendSMSWithUserSettings(tenantPhone, message, userSettings);
            } else {
              console.warn("Twilio not configured in user settings, using legacy .env configuration");
              result = await twilio.sendSMSLegacy(tenantPhone, message);
            }
          } else {
            // No userId provided, use legacy .env configuration
            console.warn("No userId provided, using legacy .env configuration");
            result = await twilio.sendSMSLegacy(tenantPhone, message);
          }
        } else {
          throw new Error("No valid contact method available for tenant");
        }
      }

      return {
        success: true,
        channel,
        result,
      };
    } catch (error) {
      console.error("Failed to send tenant confirmation:", error);
      return {
        success: false,
        channel,
        error: error.message,
      };
    }
  }

  /**
   * Send escalation notification to manager
   * @param {Object} thread - Thread details
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @param {String} reasoning - AI reasoning for escalation
   * @param {String} managerPhone - Admin user's phone number
   * @param {String} managerEmail - Admin user's email address
   * @param {Number} userId - User ID for user-specific settings (optional)
   * @returns {Promise<Object>} Notification result
   */
  async notifyManagerOfEscalation(thread, tenant, property, reasoning, managerPhone, managerEmail, userId = null) {
    const message = this.buildEscalationMessage(thread, tenant, property, reasoning);
    const subject = `⚠️ Conversation Escalation - ${property.address}`;

    // Always use SMS for escalation alerts
    return await this.sendNotification(
      "urgent",
      managerPhone,
      managerEmail,
      message,
      subject,
      userId
    );
  }

  /**
   * Build escalation notification message
   * @param {Object} thread - Thread details
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @param {String} reasoning - AI reasoning for escalation
   * @returns {String} Formatted message
   */
  buildEscalationMessage(thread, tenant, property, reasoning) {
    return `⚠️ Conversation Escalation Alert

Property: ${property.address}
Tenant: ${tenant.name}
Thread: "${thread.subject}"
Reasoning: ${reasoning}

Time: ${new Date().toLocaleString()}

This conversation may require human intervention. Please review in the dashboard.`;
  }
}

module.exports = new NotificationService();
