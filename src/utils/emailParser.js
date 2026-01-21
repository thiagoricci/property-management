/**
 * Email parsing utilities for inbound email processing
 */

/**
 * Normalize email address to consistent format
 * @param {String} email - Email address
 * @returns {String} Normalized email address
 */
function normalizeEmailAddress(email) {
  if (!email) return '';
  
  // Extract email from "Name <email>" format if present
  const emailMatch = email.match(/<([^>]+)>/);
  const extractedEmail = emailMatch ? emailMatch[1] : email;
  
  return extractedEmail.toLowerCase().trim();
}

/**
 * Strip email signatures and thread history
 * @param {String} emailBody - Full email body
 * @returns {String} Cleaned email body
 */
function stripEmailSignatures(emailBody) {
  if (!emailBody) return '';
  
  // Common signature patterns (in order of priority)
  const signaturePatterns = [
    /-----Original Message-----/i, // Thread history marker
    /On .* wrote:/i, // Thread history marker
    /From:.*\nSent:.*\nTo:.*\nSubject:/i, // Email headers
    /--\s*$/m, // Standard signature delimiter
    /--\s*$/gm, // Multi-line signature
    /___/m, // Underscore signature
    /Best regards,?$/im,
    /Regards,?$/im,
    /Sincerely,?$/im,
    /Thanks,?$/im,
    /Thank you,?$/im,
    /Sent from my (iPhone|Android|BlackBerry|iPad)/i, // Mobile signatures
    /Get Outlook for (Android|iOS)/i, // Outlook signature
  ];
  
  let cleaned = emailBody;
  
  // Remove signatures and thread history
  for (const pattern of signaturePatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      cleaned = cleaned.substring(0, match.index).trim();
      break;
    }
  }
  
  // Remove extra whitespace but preserve paragraph structure
  cleaned = cleaned.replace(/[ \t]+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Build unrecognized sender email message
 * @returns {String} Friendly error message
 */
function buildUnrecognizedEmailMessage() {
  return `Hello!

I'm Alice, your AI property manager. I don't recognize your email address.

If you're a tenant, please contact your property manager to update your email address in our system.

Best regards,
Alice - AI Property Manager`;
}

/**
 * Build email response from AI response
 * @param {String} aiResponse - AI response text
 * @param {String} subject - Original email subject (optional)
 * @returns {String} Formatted email body
 */
function buildEmailResponse(aiResponse, subject = null) {
  const subjectLine = subject ? `Re: ${subject}` : 'Property Manager Inquiry';
  
  return `${aiResponse}

---
Best regards,
Alice - AI Property Manager

If you need immediate assistance, please contact your property manager directly.`;
}

/**
 * Extract email address from various formats
 * @param {String} fromField - From field value
 * @returns {String} Clean email address
 */
function extractEmailAddress(fromField) {
  if (!fromField) return '';
  
  // Handle "Name <email>" format
  const emailMatch = fromField.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1].trim();
  }
  
  // Handle plain email
  const plainEmailMatch = fromField.match(/[\w\.-]+@[\w\.-]+\.\w+/);
  if (plainEmailMatch) {
    return plainEmailMatch[0].trim();
  }
  
  return fromField.trim();
}

/**
 * Extract name from email address
 * @param {String} fromField - From field value
 * @returns {String} Extracted name or empty string
 */
function extractNameFromEmail(fromField) {
  if (!fromField) return '';
  
  // Handle "Name <email>" format
  const nameMatch = fromField.match(/^"?([^"<>]+)"?\s*<[^>]+>$/);
  if (nameMatch) {
    return nameMatch[1].trim();
  }
  
  return '';
}

/**
 * Validate email format
 * @param {String} email - Email address to validate
 * @returns {Boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  normalizeEmailAddress,
  stripEmailSignatures,
  buildUnrecognizedEmailMessage,
  buildEmailResponse,
  extractEmailAddress,
  extractNameFromEmail,
  isValidEmail,
};
