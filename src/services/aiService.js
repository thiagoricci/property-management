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
   * @returns {String} AI response
   */
  async generateResponse(propertyInfo, tenantInfo, conversationHistory, newMessage) {
    try {
      const systemPrompt = this.buildSystemPrompt(propertyInfo, tenantInfo);

      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
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
   * @returns {String} System prompt
   */
  buildSystemPrompt(propertyInfo, tenantInfo) {
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
}

module.exports = new AIService();
