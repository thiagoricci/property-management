/**
 * Email attachment handler for processing and storing attachments
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Configuration
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/**
 * Handle email attachments (photos of maintenance issues)
 * @param {Array} attachments - Array of attachment objects from Resend
 * @param {Number} conversationId - Conversation ID
 * @param {Object} db - Database connection
 * @returns {Promise<Array>} Array of saved attachment metadata
 */
async function handleEmailAttachments(attachments, conversationId, db) {
  const uploadsDir = path.join(__dirname, "../../public/attachments");

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const savedAttachments = [];

  for (const attachment of attachments) {
    try {
      // Validate attachment has required fields
      if (!attachment.filename || !attachment.content) {
        console.error("Attachment missing required fields:", attachment);
        continue;
      }

      // Only process image attachments
      if (!isAllowedImageType(attachment.content_type)) {
        console.log(`Skipping non-image attachment: ${attachment.filename} (${attachment.content_type})`);
        continue;
      }

      // Decode base64 content
      const buffer = Buffer.from(attachment.content, "base64");

      // Validate file size
      if (buffer.length > MAX_ATTACHMENT_SIZE) {
        console.error(`Attachment too large: ${attachment.filename} (${buffer.length} bytes)`);
        continue;
      }

      // Generate unique filename
      const fileExtension = path.extname(attachment.filename);
      const uniqueFilename = generateUniqueFilename(fileExtension);
      const filePath = path.join(uploadsDir, uniqueFilename);

      // Save attachment to disk
      fs.writeFileSync(filePath, buffer);

      console.log(`Saved attachment: ${uniqueFilename} (${buffer.length} bytes)`);

      // Prepare attachment metadata
      const attachmentMetadata = {
        message_id: conversationId,
        filename: attachment.filename,
        stored_filename: uniqueFilename,
        content_type: attachment.content_type,
        size: buffer.length,
        url: `/attachments/${uniqueFilename}`,
      };

      // Store attachment metadata in database
      try {
        const result = await db.query(
          `INSERT INTO attachments (message_id, filename, stored_filename, content_type, size, url)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            conversationId,
            attachment.filename,
            uniqueFilename,
            attachment.content_type,
            buffer.length,
            `/attachments/${uniqueFilename}`,
          ]
        );

        savedAttachments.push(result.rows[0]);
        console.log(`Saved attachment metadata to database: ${result.rows[0].id}`);
      } catch (dbError) {
        console.error("Failed to save attachment metadata:", dbError);
        // Keep the file even if database save fails
        savedAttachments.push({ ...attachmentMetadata, id: null });
      }
    } catch (error) {
      console.error(`Failed to process attachment ${attachment.filename}:`, error);
    }
  }

  return savedAttachments;
}

/**
 * Check if content type is an allowed image type
 * @param {String} contentType - MIME type
 * @returns {Boolean} True if allowed
 */
function isAllowedImageType(contentType) {
  if (!contentType) return false;
  return ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase());
}

/**
 * Generate unique filename using crypto
 * @param {String} extension - File extension
 * @returns {String} Unique filename
 */
function generateUniqueFilename(extension) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `${timestamp}_${random}${extension}`;
}

/**
 * Delete attachment file from disk
 * @param {String} storedFilename - Stored filename
 * @returns {Boolean} True if deleted successfully
 */
function deleteAttachmentFile(storedFilename) {
  try {
    const filePath = path.join(__dirname, "../../public/attachments", storedFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted attachment file: ${storedFilename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to delete attachment file ${storedFilename}:`, error);
    return false;
  }
}

/**
 * Get attachment file path
 * @param {String} storedFilename - Stored filename
 * @returns {String} Full file path
 */
function getAttachmentPath(storedFilename) {
  return path.join(__dirname, "../../public/attachments", storedFilename);
}

/**
 * Validate attachment before processing
 * @param {Object} attachment - Attachment object
 * @returns {Object} Validation result { valid: boolean, error: string }
 */
function validateAttachment(attachment) {
  if (!attachment.filename) {
    return { valid: false, error: "Missing filename" };
  }

  if (!attachment.content) {
    return { valid: false, error: "Missing content" };
  }

  if (!isAllowedImageType(attachment.content_type)) {
    return {
      valid: false,
      error: `Invalid content type: ${attachment.content_type}. Only images are allowed.`,
    };
  }

  const buffer = Buffer.from(attachment.content, "base64");
  if (buffer.length > MAX_ATTACHMENT_SIZE) {
    return {
      valid: false,
      error: `File too large: ${buffer.length} bytes. Maximum size is ${MAX_ATTACHMENT_SIZE} bytes.`,
    };
  }

  return { valid: true, error: null };
}

module.exports = {
  handleEmailAttachments,
  isAllowedImageType,
  generateUniqueFilename,
  deleteAttachmentFile,
  getAttachmentPath,
  validateAttachment,
  MAX_ATTACHMENT_SIZE,
  ALLOWED_IMAGE_TYPES,
};
