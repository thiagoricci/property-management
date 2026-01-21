const twilio = require("../config/twilio");
const resend = require("../config/resend");
const db = require("../config/database");

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
  async sendNotification(priority, recipientPhone, recipientEmail, message, subject = "Property Manager Alert") {
    const channel = this.determineChannel(priority);
    let result;

    try {
      if (channel === "sms") {
        result = await twilio.sendSMS(recipientPhone, message);
      } else if (channel === "email") {
        result = await resend.sendEmail(recipientEmail, subject, message);
      }

      // Log notification to database
      await this.logNotification(
        channel === "sms" ? recipientPhone : recipientEmail,
        message,
        channel,
        "sent"
      );

      return {
        success: true,
        channel,
        result,
      };
    } catch (error) {
      console.error(`Failed to send ${channel} notification:`, error);

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
   * @returns {Promise<Object>} Notification result
   */
  async notifyManagerOfMaintenanceRequest(maintenanceRequest, tenant, property) {
    const priority = maintenanceRequest.priority;
    const message = this.buildMaintenanceMessage(maintenanceRequest, tenant, property);
    const subject = `Maintenance Request: ${priority.toUpperCase()} - ${property.address}`;

    return await this.sendNotification(
      priority,
      property.owner_phone,
      property.owner_email,
      message,
      subject
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
   * @returns {Promise<Object>} Notification result
   */
  async notifyManagerOfEmergency(reason, tenant, property) {
    const message = this.buildEmergencyMessage(reason, tenant, property);
    const subject = `🚨 EMERGENCY ALERT - ${property.address}`;

    // Always use SMS for emergencies
    return await this.sendNotification(
      "emergency",
      property.owner_phone,
      property.owner_email,
      message,
      subject
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
  async sendTenantConfirmation(tenantPhone, tenantEmail, message, channel = "sms") {
    try {
      let result;

      if (channel === "sms" && tenantPhone) {
        result = await twilio.sendSMS(tenantPhone, message);
      } else if (channel === "email" && tenantEmail) {
        result = await resend.sendEmail(tenantEmail, "Confirmation", message);
      } else {
        // Fallback to SMS if preferred channel not available
        if (tenantPhone) {
          result = await twilio.sendSMS(tenantPhone, message);
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
}

module.exports = new NotificationService();
