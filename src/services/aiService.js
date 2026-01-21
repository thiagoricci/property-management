const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class AIService {
  /**
   * Generate AI response for tenant message
   * @param {Object} propertyInfo - Property details
   * @param {Object} tenantInfo - Tenant details
   * @param {Array} conversationHistory - Previous messages
   * @param {String} newMessage - New message from tenant
   * @param {Array} openMaintenanceRequests - Open maintenance requests for tenant
   * @returns {String} AI response
   */
  async generateResponse(propertyInfo, tenantInfo, conversationHistory, newMessage, openMaintenanceRequests = []) {
    try {
      const systemPrompt = this.buildSystemPrompt(propertyInfo, tenantInfo, openMaintenanceRequests);

      // Apply context truncation to stay within token limits
      const truncatedHistory = this.truncateContext(conversationHistory, systemPrompt, newMessage);

      const messages = [
        { role: "system", content: systemPrompt },
        ...truncatedHistory,
        { role: "user", content: newMessage },
      ];

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error("OpenAI API error:", error);
      
      // Return fallback response on error
      return "I apologize, but I'm having trouble processing your request right now. Please try again later or contact your property manager directly for assistance.";
    }
  }

  /**
   * Build system prompt with property and tenant context
   * @param {Object} propertyInfo - Property details
   * @param {Object} tenantInfo - Tenant details
   * @param {Array} openMaintenanceRequests - Open maintenance requests for tenant
   * @returns {String} System prompt
   */
  buildSystemPrompt(propertyInfo, tenantInfo, openMaintenanceRequests = []) {
    const propertyContext = propertyInfo ? `
Property: ${propertyInfo.address}
Owner: ${propertyInfo.owner_name}
Amenities: ${JSON.stringify(propertyInfo.amenities || {})}
Rules: ${JSON.stringify(propertyInfo.rules || {})}
    ` : "Property information not available";

    const tenantContext = tenantInfo ? `
Tenant: ${tenantInfo.name}
Email: ${tenantInfo.email || "Not provided"}
Phone: ${tenantInfo.phone || "Not provided"}
Lease Terms: ${JSON.stringify(tenantInfo.lease_terms || {})}
Move-in Date: ${tenantInfo.move_in_date || "Not specified"}
    ` : "Tenant information not available";

    // Build open maintenance requests context
    let maintenanceContext = "";
    if (openMaintenanceRequests && openMaintenanceRequests.length > 0) {
      maintenanceContext = "\n\nOpen Maintenance Requests:\n";
      openMaintenanceRequests.forEach((req, index) => {
        maintenanceContext += `${index + 1}. ${req.issue_description} (Priority: ${req.priority}, Status: ${req.status})\n`;
      });
    }

    // Build FAQ context
    let faqContext = "";
    if (propertyInfo && propertyInfo.faq && Object.keys(propertyInfo.faq).length > 0) {
      faqContext = "\n\nProperty-Specific FAQ:\n";
      Object.entries(propertyInfo.faq).forEach(([key, value]) => {
        faqContext += `- ${key}: ${value}\n`;
      });
    }

    return `You are Alice, an AI property manager. Your role is to assist tenants with their questions, concerns, and requests.

${propertyContext}

${tenantContext}

Your responsibilities:
- Answer tenant questions professionally and helpfully
- Log maintenance requests with appropriate priority levels
- Escalate emergencies immediately to property manager
- Provide information about the property and lease terms
- Be friendly, professional, and helpful at all times

IMPORTANT: When you identify a maintenance issue, you MUST include a JSON object at the END of your response:
{
  "action": "maintenance_request",
  "priority": "emergency|urgent|normal|low",
  "description": "detailed description of the issue"
}

Priority Guidelines:
- Emergency: No heat in winter, flooding, gas leak, break-in, fire, no water
- Urgent: No AC in summer, major leak, electrical issues, security concerns
- Normal: Leaky faucet, broken appliance, minor repairs
- Low: Cosmetic issues, minor inconveniences

For emergency situations, you MUST also include this JSON object at the END of your response:
{
  "action": "alert_manager",
  "urgency": "immediate",
  "reason": "brief reason for emergency"
}

CRITICAL INSTRUCTIONS:
1. Include ONLY ONE JSON block per action type. Do not repeat the same action multiple times.
2. Do NOT include conversational text like "Maintenance Request:" or "I'll create a maintenance request" in your response.
3. Simply provide your helpful response, and include the JSON action block at the very END.

Examples:
✅ CORRECT (one maintenance request):
"I understand you're having an electrical issue. I'll have our maintenance team investigate this promptly.
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Power outage in unit"
}"

❌ INCORRECT (duplicate maintenance requests):
"I'll create a maintenance request for your issue.
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Power outage in unit"
}
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Electrical outage in apartment"
}"

Always be friendly, professional, and helpful. If you're unsure about something, ask clarifying questions rather than making assumptions.

Remember: Always include the JSON action block at the very END of your response, after your conversational text.`;
  }

  /**
   * Extract structured actions from AI response
   * @param {String} aiResponse - AI response text
   * @returns {Array} Array of extracted actions
   */
  extractActions(aiResponse) {
    const actions = [];
    
    // Try to find JSON blocks in the response
    const jsonRegex = /\{[\s\S]*?\}/g;
    const matches = aiResponse.match(jsonRegex);

    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.action) {
            actions.push(parsed);
          }
        } catch (e) {
          // Not valid JSON, skip
          console.warn("Failed to parse JSON action:", match);
        }
      }
    }

    return actions;
  }

  /**
   * Deduplicate actions to prevent duplicate maintenance requests
   * @param {Array} actions - Array of extracted actions
   * @returns {Array} Deduplicated array of actions
   */
  deduplicateActions(actions) {
    const uniqueActions = [];
    const seen = new Set();

    for (const action of actions) {
      // Create unique key based on action type, description, and priority
      const key = `${action.action}:${action.description || ''}:${action.priority || ''}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueActions.push(action);
      } else {
        console.log(`[Action Deduplication] Removing duplicate action: ${key}`);
      }
    }

    // Log deduplication statistics
    if (actions.length > uniqueActions.length) {
      console.log(`[Action Deduplication] Removed ${actions.length - uniqueActions.length} duplicate action(s) from ${actions.length} total`);
    }

    return uniqueActions;
  }

  /**
   * Format conversation history for OpenAI API
   * @param {Array} conversations - Array of conversation records
   * @returns {Array} Formatted message array
   */
  formatConversationHistory(conversations) {
    const history = [];
    
    // Reverse to get chronological order
    const reversed = [...conversations].reverse();
    
    for (const conv of reversed) {
      history.push(
        { role: "user", content: conv.message },
        { role: "assistant", content: conv.response }
      );
    }

    return history;
  }

  /**
   * Validate if tenant message is an emergency
   * @param {String} message - Tenant message
   * @returns {Boolean} True if emergency
   */
  isEmergency(message) {
    const emergencyKeywords = [
      "emergency",
      "flood",
      "fire",
      "gas leak",
      "no heat",
      "no water",
      "break in",
      "break-in",
      "burst pipe",
      "carbon monoxide",
      "power outage",
      "electrical fire",
      "smoke",
    ];

    const lowerMessage = message.toLowerCase();
    return emergencyKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Strip JSON action blocks from AI response for user display
   * @param {String} response - Full AI response with JSON blocks
   * @returns {String} Clean response without JSON blocks
   */
  stripJSONFromResponse(response) {
    // Remove JSON action blocks (all JSON objects in the response)
    let cleaned = response.replace(/\{[\s\S]*?\}/g, "").trim();
    
    // Remove specific phrases that indicate maintenance request creation
    // These are the exact phrases we want to remove, not broader patterns
    const phrasesToRemove = [
      /Maintenance Request:?\s*$/gi,  // At end of sentence, with optional trailing spaces
      /I'll create a maintenance request for your issue\./gi,  // Specific phrase
      /I am creating a maintenance request for your issue\./gi,  // Specific phrase
      /I will create a maintenance request for your issue\./gi,  // Specific phrase
      /I'm creating a maintenance request for your issue\./gi,  // Specific phrase
      /Creating maintenance request for your issue\./gi,  // Specific phrase
      /Maintenance request created for your issue\./gi,  // Specific phrase
    ];

    phrasesToRemove.forEach(regex => {
      cleaned = cleaned.replace(regex, "");
    });

    // Remove extra whitespace and newlines
    cleaned = cleaned.replace(/\s+/g, " ");
    
    return cleaned;
  }

  /**
   * Truncate conversation history to stay within token limits
   * @param {Array} conversationHistory - Previous messages
   * @param {String} systemPrompt - System prompt
   * @param {String} newMessage - New message from tenant
   * @returns {Array} Truncated conversation history
   */
  truncateContext(conversationHistory, systemPrompt, newMessage) {
    // Approximate token count (rough estimate: 1 token ≈ 4 characters)
    const systemTokens = (systemPrompt.length / 4);
    const messageTokens = (newMessage.length / 4);
    
    // GPT-3.5-turbo has 16,385 tokens, reserve 2,000 for response
    const maxHistoryTokens = 16385 - systemTokens - messageTokens - 2000;
    
    // Calculate how many conversation messages we can include
    let currentTokens = 0;
    const truncatedHistory = [];
    
    for (const msg of conversationHistory) {
      const msgTokens = (msg.content.length / 4);
      
      if (currentTokens + msgTokens > maxHistoryTokens) {
        break;
      }
      
      truncatedHistory.push(msg);
      currentTokens += msgTokens;
    }
    
    // Log truncation for monitoring
    if (truncatedHistory.length < conversationHistory.length) {
      console.log(`Context truncated: ${conversationHistory.length} messages → ${truncatedHistory.length} messages`);
    }
    
    return truncatedHistory;
  }
}

module.exports = new AIService();
