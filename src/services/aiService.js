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
   * Generate AI response with thread analysis
   * @param {Object} propertyInfo - Property details
   * @param {Object} tenantInfo - Tenant details
   * @param {Array} conversationHistory - Previous messages
   * @param {String} newMessage - New message from tenant
   * @param {Array} openMaintenanceRequests - Open maintenance requests for tenant
   * @param {Object} currentThread - Current active thread (if any)
   * @returns {Object} { response, topicAnalysis, resolutionAnalysis }
   */
  async generateResponseWithAnalysis(propertyInfo, tenantInfo, conversationHistory, newMessage, openMaintenanceRequests = [], currentThread) {
    // Generate AI response
    const response = await this.generateResponse(
      propertyInfo,
      tenantInfo,
      conversationHistory,
      newMessage,
      openMaintenanceRequests
    );

    // Analyze topic change (pass property for configurable time threshold)
    const topicAnalysis = await this.detectTopicChange(
      newMessage,
      currentThread,
      conversationHistory,
      propertyInfo
    );

    // Detect resolution
    const resolutionAnalysis = await this.detectConversationResolution(
      response,
      null, // No new message yet
      conversationHistory
    );

    return {
      response,
      topicAnalysis,
      resolutionAnalysis
    };
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

For emergency situations, you MUST include BOTH of these JSON objects at the END of your response:

First (maintenance request):
{
  "action": "maintenance_request",
  "priority": "emergency",
  "description": "detailed description of the emergency issue"
}

Second (manager alert):
{
  "action": "alert_manager",
  "urgency": "immediate",
  "reason": "brief reason for emergency"
}

CRITICAL: You MUST include BOTH JSON blocks for emergencies - one for maintenance_request and one for alert_manager.

Example of CORRECT emergency response:
"I understand this is an emergency. I'm immediately alerting your property manager and creating a maintenance ticket.

{
  "action": "maintenance_request",
  "priority": "emergency",
  "description": "Gas leak in apartment"
}

{
  "action": "alert_manager",
  "urgency": "immediate",
  "reason": "Gas leak reported by tenant"
}"

CRITICAL INSTRUCTIONS:
1. For emergencies: Include BOTH maintenance_request AND alert_manager JSON blocks (2 blocks total)
2. For non-emergencies: Include ONLY maintenance_request JSON block (1 block)
3. Do NOT include conversational text like "Maintenance Request:" or "I'll create a maintenance request" in your response.
4. Simply provide your helpful response, and include JSON action block(s) at the very END.

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
    
    // Try to find JSON blocks in response
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
   * @param {Array} messages - Array of message records
   * @returns {Array} Formatted message array
   */
  formatConversationHistory(messages) {
    const history = [];

    // Messages are already in chronological order from query
    for (const msg of messages) {
      if (msg.message_type === 'user_message') {
        history.push({ role: "user", content: msg.message });
      } else if (msg.message_type === 'ai_response') {
        history.push({ role: "assistant", content: msg.response });
      }
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
    // Remove JSON action blocks (all JSON objects in response)
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

  /**
   * Analyze if message continues current conversation or starts new topic
   * @param {String} newMessage - New tenant message
   * @param {Object} currentThread - Current active thread (if any)
   * @param {Array} recentMessages - Recent messages in current thread
   * @param {Object} propertyInfo - Property details (for configurable time threshold)
   * @returns {Object} { shouldContinue: boolean, newSubject: string|null, confidence: number }
   */
  async detectTopicChange(newMessage, currentThread, recentMessages, propertyInfo = null) {
    if (!currentThread) {
      // No active thread, create new one
      const subject = await this.extractSubject(newMessage);
      return { shouldContinue: false, newSubject: subject, confidence: 1.0 };
    }

    // Check time gap (use property-specific threshold, default to 48 hours)
    const lastMessageTime = new Date(currentThread.last_activity_at);
    const timeSinceLastMessage = Date.now() - lastMessageTime.getTime();
    const hoursSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60);
    
    // Use property-specific threshold or default to 48 hours
    const timeThreshold = propertyInfo?.thread_time_threshold_hours || 48;

    if (hoursSinceLastMessage > timeThreshold) {
      const subject = await this.extractSubject(newMessage);
      console.log(`[Topic Detection] Time gap (${hoursSinceLastMessage.toFixed(1)}h > ${timeThreshold}h) - creating new thread`);
      return { shouldContinue: false, newSubject: subject, confidence: 0.9 };
    }

    // Use AI to analyze topic similarity
    const analysis = await this.analyzeTopicSimilarity(
      newMessage,
      currentThread.subject,
      recentMessages
    );

    console.log(`[Topic Detection] ${analysis.shouldContinue ? 'Continue' : 'New thread'} (confidence: ${analysis.confidence})`);
    return analysis;
  }

  /**
   * Use AI to analyze if message continues current topic
   * @param {String} newMessage - New tenant message
   * @param {String} currentSubject - Current thread subject
   * @param {Array} recentMessages - Recent messages in thread
   * @returns {Object} { shouldContinue: boolean, confidence: number, newSubject: string|null }
   */
  async analyzeTopicSimilarity(newMessage, currentSubject, recentMessages) {
    const recentContext = recentMessages
      .slice(-5)  // Increased from 3 to 5 for better context
      .map(m => `${m.message_type}: ${m.message}`)
      .join('\n');

    const prompt = `You are analyzing conversation flow to determine if messages belong to the same thread.
  
Current conversation subject: "${currentSubject}"
  
Recent messages in this thread (last 5 messages):
${recentContext}
  
New tenant message: "${newMessage}"
  
CRITICAL INSTRUCTION: Be EXTREMELY LENIENT about continuing the same thread. Only create a new thread if the topic is COMPLETELY AND OBVIOUSLY DIFFERENT.
  
Analyze if this new message continues the same topic or starts a new subject.
  
Return JSON:
{
  "should_continue": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "new_subject": "new subject if should_continue is false, else null"
}
  
Guidelines for CONTINUING same thread (should_continue: true):
- Message asks clarifying questions about current issue
- Message provides more details about current issue
- Message confirms resolution or says thanks
- Message acknowledges information or says "ok"
- Message is related to same general topic (e.g., leak, plumbing, maintenance, heating, cooling)
- Message is a brief follow-up or acknowledgment
- Message is greeting or small talk
- Message is ANY follow-up to previous exchange, even if slightly different
- Message references or builds upon previous discussion
  
Guidelines for CREATING new thread (should_continue: false):
- Message discusses a COMPLETELY DIFFERENT topic (e.g., rent question after maintenance issue)
- Message starts a completely new unrelated conversation
- Message is about a different property/issue entirely
- Message explicitly changes subject (e.g., "Actually, I have another question about...")
  
Confidence thresholds:
- Confidence >= 0.3 → continue current thread (be very lenient)
- Confidence < 0.3 → create new thread (only if clearly different)

Remember: When in doubt, CONTINUE the current thread. It's better to group messages together than to split them unnecessarily.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300,
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Convert snake_case to camelCase for consistency
      const formattedResult = {
        shouldContinue: result.should_continue,
        confidence: result.confidence,
        reasoning: result.reasoning,
        newSubject: result.new_subject
      };
      
      console.log(`[Topic Analysis] Decision: ${formattedResult.shouldContinue ? 'Continue' : 'New thread'}, Confidence: ${formattedResult.confidence}, Reasoning: ${formattedResult.reasoning}`);
      return formattedResult;
    } catch (error) {
      console.error("Topic analysis error:", error);
      // On error, continue current thread (safer default)
      return { shouldContinue: true, confidence: 0.5, reasoning: "Analysis failed", newSubject: null };
    }
  }

  /**
   * Extract subject/topic from message
   * @param {String} message - Tenant message
   * @returns {String} Subject line
   */
  async extractSubject(message) {
    const prompt = `Extract a brief subject line (max 10 words) from this tenant message:

"${message}"

Return only the subject line, nothing else. Examples:
- "My sink is leaking" → "Leaky sink"
- "AC not working" → "AC not working"
- "Question about rent" → "Rent inquiry"
- "Parking spot issue" → "Parking issue"`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.3,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error("Subject extraction error:", error);
      // Fallback: use first 50 characters
      return message.substring(0, 50) + (message.length > 50 ? "..." : "");
    }
  }

  /**
   * Detect if conversation is resolved
   * @param {String} lastResponse - Last AI response
   * @param {String} newMessage - New tenant message (if any)
   * @param {Array} messages - All messages in thread
   * @returns {Object} { isResolved: boolean, confidence: number, status: string }
   */
  async detectConversationResolution(lastResponse, newMessage, messages) {
    // Enhanced closing phrases for better resolution detection
    if (newMessage) {
      const closingPhrases = [
        'thanks', 'thank you', 'ok', 'got it', 'understood',
        'appreciate it', 'perfect', 'great', 'sounds good',
        'that works', 'all set', 'good to know', 'that helps',
        'problem solved', 'fixed', 'working now', 'yes that fixed it',
        'all good', 'no problem', 'awesome', 'thanks again',
        'perfect thanks', 'great thanks', 'thanks for the help'
      ];
      const lowerMessage = newMessage.toLowerCase();
      if (closingPhrases.some(phrase => lowerMessage.includes(phrase))) {
        console.log(`[Resolution Detection] Closing phrase detected - marking as resolved`);
        return { isResolved: true, confidence: 0.9, status: 'resolved' };
      }
    }

    // Use AI to analyze if conversation is resolved
    const recentMessages = messages.slice(-5)
      .map(m => `${m.message_type}: ${m.message}`)
      .join('\n');

    const prompt = `Analyze if this conversation is resolved:

${recentMessages}

Return JSON:
{
  "is_resolved": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Consider resolved if:
- Tenant's issue was addressed
- AI provided solution or next steps
- Tenant confirmed understanding
- No follow-up questions pending`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 200,
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Convert snake_case to camelCase for consistency
      const formattedResult = {
        isResolved: result.is_resolved,
        confidence: result.confidence,
        reasoning: result.reasoning,
        status: result.is_resolved ? 'resolved' : 'active'
      };
      
      if (formattedResult.isResolved) {
        console.log(`[Resolution Detection] AI analysis - marking as resolved (confidence: ${formattedResult.confidence})`);
      }
      return formattedResult;
    } catch (error) {
      console.error("Resolution detection error:", error);
      return { isResolved: false, confidence: 0.0 };
    }
  }

  /**
   * Generate thread summary when conversation is resolved
   * @param {Array} messages - All messages in thread
   * @param {String} subject - Thread subject
   * @returns {String} Thread summary
   */
  async generateThreadSummary(messages, subject) {
    const prompt = `Summarize this conversation in 2-3 sentences:

Subject: "${subject}"
Messages: ${messages.map(m => `${m.message_type === 'user_message' ? 'Tenant' : 'AI'}: ${m.message || m.response}`).join('\n')}

Focus on:
1. What was the issue?
2. What was the solution?
3. Current status

Return only the summary, nothing else.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      });

      const summary = response.choices[0].message.content.trim();
      console.log(`[Thread Summary] Generated: ${summary}`);
      return summary;
    } catch (error) {
      console.error("Thread summary generation error:", error);
      // Fallback: use subject as summary
      return `Conversation about: ${subject}`;
    }
  }

  /**
   * Categorize thread by topic
   * @param {String} subject - Thread subject
   * @param {Array} messages - Messages in thread
   * @returns {Object} { category: string, subtopic: string }
   */
  async categorizeThread(subject, messages) {
    const recentMessages = messages.slice(-3)
      .map(m => m.message || m.response)
      .join(' | ');

    const prompt = `Categorize this conversation:

Subject: "${subject}"
Messages: ${recentMessages}

Return JSON:
{
  "category": "maintenance|rent|amenities|lease|general|other",
  "subtopic": "brief subtopic (e.g., plumbing, heating, parking)"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 100,
        temperature: 0.3,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error("Thread categorization error:", error);
      // Fallback: return general category
      return { category: 'general', subtopic: subject.substring(0, 30) };
    }
  }

  /**
   * Detect if conversation is escalating
   * @param {Array} messages - Recent messages in thread
   * @returns {Object} { isEscalating: boolean, confidence: number, reasoning: string }
   */
  async detectEscalation(messages) {
    const recentMessages = messages.slice(-5);
    const prompt = `Analyze if this conversation is escalating (tenant frustrated, issue unresolved):

${recentMessages.map(m => `${m.message_type}: ${m.message || m.response}`).join('\n')}

Return JSON:
{
  "is_escalating": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Escalation indicators:
- Repeated complaints about same issue
- Angry or frustrated language
- Threats to contact management
- Multiple follow-ups without resolution
- Expressions of dissatisfaction or urgency`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Convert snake_case to camelCase for consistency
      const formattedResult = {
        isEscalating: result.is_escalating,
        confidence: result.confidence,
        reasoning: result.reasoning
      };
      
      if (formattedResult.isEscalating) {
        console.log(`[Escalation Detection] Conversation escalating (confidence: ${formattedResult.confidence}): ${formattedResult.reasoning}`);
      }
      return formattedResult;
    } catch (error) {
      console.error("Escalation detection error:", error);
      return { isEscalating: false, confidence: 0.0, reasoning: "Detection failed" };
    }
  }

  /**
   * Analyze if new maintenance request is about same issue
   * @param {String} newMessage - New tenant message
   * @param {Array} existingRequests - Existing maintenance requests in thread
   * @param {String} newDescription - New issue description
   * @returns {Object} { isSameIssue: boolean, confidence: number, existingRequestId: number|null }
   */
  async analyzeMaintenanceRequestSimilarity(newMessage, existingRequests, newDescription) {
    const existingDescriptions = existingRequests
      .map(req => req.issue_description)
      .join('\n');

    const prompt = `You are analyzing maintenance requests to detect duplicates.

Existing maintenance requests in this conversation:
${existingDescriptions}

New tenant message: "${newMessage}"
New issue description: "${newDescription}"

Analyze if this new message is about the SAME issue or a DIFFERENT issue.

Return JSON:
{
  "is_same_issue": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "existing_request_id": ID if same issue, else null
}

Guidelines:
- Same issue if: describing same problem, providing more details, confirming issue, escalating, de-escalating
- Different issue if: completely different problem, different location, different property
- Confidence >= 0.7 → same issue
- Confidence < 0.7 → different issue`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error("Maintenance request similarity error:", error);
      return { isSameIssue: false, confidence: 0.5, existingRequestId: null };
    }
  }

  /**
   * Analyze similarity between two threads
   * @param {Object} thread1 - First thread
   * @param {Object} thread2 - Second thread
   * @returns {Object} { relationship_type: string, confidence: number, reasoning: string }
   */
  async analyzeThreadSimilarity(thread1, thread2) {
    const prompt = `Analyze if these two conversations are related:

Thread 1:
Subject: "${thread1.subject}"
Status: ${thread1.status}
Created: ${thread1.created_at}

Thread 2:
Subject: "${thread2.subject}"
Status: ${thread2.status}
Created: ${thread2.created_at}

Return JSON:
{
  "relationship_type": "similar|related|follow-up",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Relationship types:
- similar: Same issue or problem (e.g., both about leaky sink)
- related: Connected topic (e.g., plumbing issues in different rooms)
- follow-up: Continuation of previous conversation

Confidence thresholds:
- Confidence >= 0.7 → relationship exists
- Confidence < 0.7 → no relationship`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.3,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error("Thread similarity analysis error:", error);
      return { relationship_type: null, confidence: 0.0, reasoning: "Analysis failed" };
    }
  }

  /**
   * Detect if message starts a new conversation or continues existing one
   * @param {String} newMessage - New tenant message
   * @param {Object} currentThread - Current active thread (if any)
   * @param {Number} tenantId - Tenant ID
   * @returns {Object} { isNewConversation: boolean, confidence: number, reasoning: string, suggestedSubject: string|null }
   */
  async detectConversationStart(newMessage, currentThread, tenantId) {
    // Check if this is a new conversation start
    const analysis = await this.analyzeConversationStart(
      newMessage,
      currentThread,
      tenantId
    );

    return {
      isNewConversation: analysis.is_new_conversation,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      suggestedSubject: analysis.suggested_subject
    };
  }

  /**
   * Use AI to analyze if message starts new conversation
   * @param {String} newMessage - New tenant message
   * @param {Object} lastThread - Last active thread (if any)
   * @param {Number} tenantId - Tenant ID
   * @returns {Object} AI analysis result
   */
  async analyzeConversationStart(newMessage, lastThread, tenantId) {
    const lastActivity = lastThread ? new Date(lastThread.last_activity_at) : null;
    const hoursSinceLastActivity = lastActivity 
      ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
      : Infinity;

    const prompt = `Analyze if this message starts a NEW conversation or continues an EXISTING one.

Last thread activity: ${hoursSinceLastActivity.toFixed(1)} hours ago
Last thread subject: "${lastThread?.subject || 'None'}"
Last thread status: "${lastThread?.status || 'None'}"

New tenant message: "${newMessage}"

Return JSON:
{
  "is_new_conversation": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggested_subject": "subject if new conversation, else null"
}

NEW CONVERSATION indicators:
- First message ever from tenant
- More than 24 hours since last message
- Completely different topic from previous conversation
- Greeting or new inquiry ("Hi", "Hello", "Question about...")
- Explicitly starts new topic ("I have another question", "Actually, about...")

CONTINUE EXISTING indicators:
- Follow-up to previous discussion
- Clarification question
- Related to same topic
- Acknowledgment or confirmation
- "Thanks", "OK", "Got it" responses

Confidence thresholds:
- Confidence >= 0.7 → new conversation
- Confidence < 0.7 → continue existing`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300,
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Convert snake_case to camelCase for consistency
      const formattedResult = {
        isNewConversation: result.is_new_conversation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        suggestedSubject: result.suggested_subject
      };
      
      console.log(`[Conversation Start] Decision: ${formattedResult.isNewConversation ? 'New conversation' : 'Continue existing'}, Confidence: ${formattedResult.confidence}, Reasoning: ${formattedResult.reasoning}`);
      return formattedResult;
    } catch (error) {
      console.error("Conversation start analysis error:", error);
      // On error, default to continuing if there's an active thread
      return { 
        isNewConversation: !lastThread, 
        confidence: 0.5, 
        reasoning: "Analysis failed", 
        suggestedSubject: null 
      };
    }
  }

  /**
   * Detect if conversation should close using multi-factor analysis
   * @param {String} lastResponse - Last AI response
   * @param {String} newMessage - New tenant message (if any)
   * @param {Array} messages - All messages in thread
   * @param {Object} thread - Thread object
   * @returns {Object} { shouldClose: boolean, confidence: number, factors: object, reasoning: string, suggestedStatus: string }
   */
  async detectConversationClosure(lastResponse, newMessage, messages, thread) {
    // Factor 1: Closing phrases in tenant message
    const closingScore = this.detectClosingPhrases(newMessage);

    // Factor 2: AI analysis of conversation state
    const aiAnalysis = await this.analyzeConversationState(messages, lastResponse);

    // Factor 3: Inactivity period
    const inactivityScore = this.calculateInactivityScore(thread);

    // Factor 4: Resolution indicators in AI response
    const resolutionScore = this.detectResolutionIndicators(lastResponse);

    // Combine scores with weights
    const totalScore = (
      closingScore * 0.3 +
      aiAnalysis.confidence * 0.4 +
      inactivityScore * 0.2 +
      resolutionScore * 0.1
    );

    return {
      shouldClose: totalScore >= 0.7,
      confidence: totalScore,
      factors: {
        closing: closingScore,
        aiAnalysis: aiAnalysis.confidence,
        inactivity: inactivityScore,
        resolution: resolutionScore
      },
      reasoning: aiAnalysis.reasoning,
      suggestedStatus: totalScore >= 0.9 ? 'closed' : 'closing'
    };
  }

  /**
   * Detect closing phrases in message
   * @param {String} message - Message to analyze
   * @returns {Number} Score 0.0-1.0
   */
  detectClosingPhrases(message) {
    if (!message) return 0;

    const strongClosings = [
      'thank you', 'thanks again', 'appreciate your help',
      'problem solved', 'all set', 'that works perfectly',
      'goodbye', 'talk to you later'
    ];

    const moderateClosings = [
      'thanks', 'ok', 'got it', 'understood',
      'perfect', 'great', 'sounds good',
      'that helps', 'good to know'
    ];

    const lowerMessage = message.toLowerCase();

    if (strongClosings.some(phrase => lowerMessage.includes(phrase))) {
      return 0.9;
    }

    if (moderateClosings.some(phrase => lowerMessage.includes(phrase))) {
      return 0.6;
    }

    return 0;
  }

  /**
   * Detect resolution indicators in AI response
   * @param {String} response - AI response to analyze
   * @returns {Number} Score 0.0-1.0
   */
  detectResolutionIndicators(response) {
    if (!response) return 0;

    const resolutionPhrases = [
      'issue resolved', 'problem fixed', 'solution provided',
      'ticket created', 'maintenance scheduled',
      'request submitted', 'escalated to manager'
    ];

    const lowerResponse = response.toLowerCase();
    const matches = resolutionPhrases.filter(phrase => lowerResponse.includes(phrase));

    return Math.min(matches.length * 0.3, 1.0);
  }

  /**
   * Calculate inactivity score for thread
   * @param {Object} thread - Thread object
   * @returns {Number} Score 0.0-1.0
   */
  calculateInactivityScore(thread) {
    if (!thread) return 0;

    const lastActivity = new Date(thread.last_activity_at);
    const hoursInactive = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);

    // 24+ hours = 0.5, 48+ hours = 0.8, 72+ hours = 1.0
    if (hoursInactive >= 72) return 1.0;
    if (hoursInactive >= 48) return 0.8;
    if (hoursInactive >= 24) return 0.5;
    return 0;
  }

  /**
   * Use AI to analyze conversation state
   * @param {Array} messages - Messages in thread
   * @param {String} lastResponse - Last AI response
   * @returns {Object} { isConcluded: boolean, confidence: number, reasoning: string }
   */
  async analyzeConversationState(messages, lastResponse) {
    const recentMessages = messages.slice(-5)
      .map(m => `${m.message_type}: ${m.message || m.response}`)
      .join('\n');

    const prompt = `Analyze if this conversation has reached a natural conclusion.

${recentMessages}

Return JSON:
{
  "is_concluded": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

CONCLUDED indicators:
- Tenant's issue was addressed or resolved
- AI provided solution or next steps
- Tenant confirmed understanding or satisfaction
- No pending questions or follow-ups
- Maintenance request was created/updated
- Action items were completed

ONGOING indicators:
- Tenant has unanswered questions
- AI asked for clarification
- Issue still unresolved
- Tenant expressed dissatisfaction
- Follow-up needed
- Multiple exchanges about same problem`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 200,
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Convert snake_case to camelCase for consistency
      const formattedResult = {
        isConcluded: result.is_concluded,
        confidence: result.confidence,
        reasoning: result.reasoning
      };
      
      return formattedResult;
    } catch (error) {
      console.error("Conversation state analysis error:", error);
      return { 
        isConcluded: false, 
        confidence: 0.0,
        reasoning: "Analysis failed"
      };
    }
  }
}

module.exports = new AIService();
