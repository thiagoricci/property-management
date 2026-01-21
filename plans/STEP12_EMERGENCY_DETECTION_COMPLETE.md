# Step 12: Emergency Detection & Escalation - COMPLETED

**Date**: 2026-01-21

## Overview

Enhanced emergency detection and escalation system to ensure critical issues get immediate attention from property managers. This builds on the existing emergency keyword detection in the AI service and integrates with the notification service for real-time alerts.

## Changes Made

### 1. Emergency Keywords (Already Implemented)

The [`isEmergency()`](src/services/aiService.js:180) method in [`aiService.js`](src/services/aiService.js) already includes comprehensive emergency keyword detection:

**Emergency Keywords**:

- emergency
- flood
- fire
- gas leak
- no heat
- no water
- break in / break-in
- burst pipe
- carbon monoxide
- power outage
- electrical fire
- smoke

### 2. Updated Webhook Endpoint ([`src/routes/webhooks.js`](src/routes/webhooks.js))

#### Enhanced alertManager() Function

- Updated [`alertManager()`](src/routes/webhooks.js:251) function to use notification service
- Loads tenant and property details for notifications
- Calls [`notificationService.notifyManagerOfEmergency()`](src/services/notificationService.js:152) to send immediate SMS alerts
- Logs success/failure of notification

**Before**:

```javascript
async function alertManager(action, tenantId, propertyId) {
  const { urgency, reason } = action;
  console.log(`ALERT MANAGER: ${urgency} - ${reason}`);
  // TODO: Implement actual notification
  return { type: "alert_manager", urgency, reason, status: "logged" };
}
```

**After**:

```javascript
async function alertManager(action, tenantId, propertyId) {
  const { urgency, reason } = action;
  console.log(`ALERT MANAGER: ${urgency} - ${reason}`);

  // Load tenant and property details
  const tenantResult = await db.query("SELECT * FROM tenants WHERE id = $1", [
    tenantId,
  ]);
  const propertyResult = await db.query(
    "SELECT * FROM properties WHERE id = $1",
    [propertyId],
  );

  if (tenantResult.rows.length === 0 || propertyResult.rows.length === 0) {
    throw new Error("Tenant or property not found");
  }

  const tenant = tenantResult.rows[0];
  const property = propertyResult.rows[0];

  // Send emergency notification via notification service
  const result = await notificationService.notifyManagerOfEmergency(
    reason,
    tenant,
    property,
  );
  console.log(`Emergency alert sent: ${result.success ? "SUCCESS" : "FAILED"}`);

  return { type: "alert_manager", urgency, reason, notification: result };
}
```

### 3. Updated Messages Route ([`src/routes/messages.js`](src/routes/messages.js))

#### Enhanced alertManager() Function

- Same enhancement as webhook endpoint
- Ensures API endpoint also benefits from emergency notification service

### 4. AI System Prompt (Already Enhanced)

The [`buildSystemPrompt()`](src/services/aiService.js:53) method already includes emergency protocols:

**Priority Guidelines**:

- Emergency: No heat in winter, flooding, gas leak, break-in, fire, no water
- Urgent: No AC in summer, major leak, electrical issues, security concerns
- Normal: Leaky faucet, broken appliance, minor repairs
- Low: Cosmetic issues, minor inconveniences

**Emergency Response Requirements**:

- AI must include both maintenance_request AND alert_manager JSON objects for emergencies
- Alert manager immediately for emergency situations

## Benefits

### For Tenants

- Emergency situations are detected automatically
- Immediate AI response with emergency guidance
- Property manager gets notified instantly via SMS

### For Property Managers

- Immediate SMS alerts for all emergency situations
- Emergency keyword detection covers common scenarios
- Priority-based notification routing (emergency/urgent → SMS, normal/low → email)
- All notifications logged to database for audit trail

### For System

- Consistent emergency handling across all channels (SMS, API)
- Integration with notification service for reliable delivery
- Comprehensive logging for troubleshooting

## Files Modified

1. [`src/routes/webhooks.js`](src/routes/webhooks.js)
   - Updated [`alertManager()`](src/routes/webhooks.js:251) function
   - Loads tenant and property details
   - Calls notification service for emergency alerts
   - Logs notification success/failure

2. [`src/routes/messages.js`](src/routes/messages.js)
   - Updated [`alertManager()`](src/routes/messages.js:225) function
   - Same enhancement as webhook endpoint
   - Ensures API endpoint also benefits from emergency alerts

## Next Steps

### Required Before Testing

- [ ] Test emergency keyword detection with real SMS messages
- [ ] Verify emergency SMS notifications are sent to property managers
- [ ] Test with various emergency scenarios (fire, flood, gas leak, etc.)

### Testing Scenarios

Once ready, test with:

1. **Fire Emergency**:
   - Message: "There's a fire in my apartment!"
   - Expected: Emergency alert sent to manager, AI responds with safety guidance

2. **Flooding Emergency**:
   - Message: "My apartment is flooding!"
   - Expected: Emergency alert sent, AI provides immediate guidance

3. **Gas Leak**:
   - Message: "I smell gas in my apartment!"
   - Expected: Emergency alert, AI advises evacuation

4. **No Heat (Winter)**:
   - Message: "There's no heat in my apartment!"
   - Expected: Emergency alert sent, AI provides alternative heating options

5. **Burst Pipe**:
   - Message: "There's a burst pipe spraying water everywhere!"
   - Expected: Emergency alert, AI provides immediate guidance

6. **Break-in**:
   - Message: "Someone broke into my apartment!"
   - Expected: Emergency alert, AI advises contacting police

7. **Power Outage**:
   - Message: "The power is out!"
   - Expected: Emergency alert, AI provides guidance

## Validation Criteria

- [x] Emergency keywords defined in aiService.js
- [x] isEmergency() method implemented and functional
- [x] Emergency protocols in AI system prompt
- [x] alertManager() updated to use notificationService
- [x] Emergency SMS notifications sent via notificationService
- [x] All notifications logged to database
- [ ] All test scenarios pass
- [ ] Emergency alerts verified by property managers

## Notes

- Emergency keyword detection was already implemented in Step 4
- This step enhanced the integration with notification service
- notificationService.notifyManagerOfEmergency() was already implemented in Step 6
- No changes needed to AI service - emergency detection was already complete
- Webhook and messages routes now use notification service for emergency alerts
- Priority-based routing (emergency/urgent → SMS, normal/low → email) is already implemented

## Integration with Dashboard

To add emergency badge to maintenance requests in dashboard:

1. Update maintenance request detail page ([`dashboard/src/app/dashboard/maintenance/[id]/page.tsx`](dashboard/src/app/dashboard/maintenance/[id]/page.tsx))
2. Add emergency badge for requests with priority = 'emergency'
3. Use color-coded badges (red for emergency, orange for urgent, etc.)
4. Show emergency icon (🚨) for emergency requests

## Related Documentation

- [Step 4: ChatGPT AI Integration](plans/STEP4_AI_INTEGRATION_COMPLETE.md)
- [Step 6: Action Execution](plans/STEP6_ACTION_EXECUTION_COMPLETE.md)
- [Step 11: AI Context Awareness](plans/STEP11_AI_CONTEXT_AWARENESS_COMPLETE.md)
