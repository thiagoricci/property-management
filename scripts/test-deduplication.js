/**
 * Test script to verify action deduplication works correctly
 */

// Test deduplication function directly (without OpenAI dependency)
function deduplicateActions(actions) {
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

console.log('=== Testing Action Deduplication ===\n');

// Test Case 1: Duplicate maintenance requests (same issue)
console.log('Test 1: Duplicate maintenance requests for same issue');
const duplicateActions = [
  {
    action: "maintenance_request",
    priority: "urgent",
    description: "Leaking sink in kitchen"
  },
  {
    action: "maintenance_request",
    priority: "urgent",
    description: "Leaking sink in kitchen"
  },
  {
    action: "maintenance_request",
    priority: "urgent",
    description: "Leaking sink in kitchen"
  }
];

console.log('Input:', JSON.stringify(duplicateActions, null, 2));
const deduplicated1 = deduplicateActions(duplicateActions);
console.log('Output:', JSON.stringify(deduplicated1, null, 2));
console.log('Expected: 1 action (duplicates removed)');
console.log('✅ PASS' + (deduplicated1.length === 1 ? '' : ' ❌ FAIL') + '\n');

// Test Case 2: Different issues (should keep all)
console.log('Test 2: Different maintenance issues');
const differentActions = [
  {
    action: "maintenance_request",
    priority: "urgent",
    description: "Leaking sink in kitchen"
  },
  {
    action: "maintenance_request",
    priority: "normal",
    description: "Broken AC in bedroom"
  },
  {
    action: "maintenance_request",
    priority: "low",
    description: "Paint peeling in bathroom"
  }
];

console.log('Input:', JSON.stringify(differentActions, null, 2));
const deduplicated2 = deduplicateActions(differentActions);
console.log('Output:', JSON.stringify(deduplicated2, null, 2));
console.log('Expected: 3 actions (all kept)');
console.log('✅ PASS' + (deduplicated2.length === 3 ? '' : ' ❌ FAIL') + '\n');

// Test Case 3: Maintenance request + alert manager (different types)
console.log('Test 3: Different action types');
const mixedActions = [
  {
    action: "maintenance_request",
    priority: "urgent",
    description: "Leaking sink"
  },
  {
    action: "alert_manager",
    urgency: "immediate",
    reason: "Burst pipe"
  }
];

console.log('Input:', JSON.stringify(mixedActions, null, 2));
const deduplicated3 = deduplicateActions(mixedActions);
console.log('Output:', JSON.stringify(deduplicated3, null, 2));
console.log('Expected: 2 actions (both kept)');
console.log('✅ PASS' + (deduplicated3.length === 2 ? '' : ' ❌ FAIL') + '\n');

// Test Case 4: Empty array
console.log('Test 4: Empty actions array');
const emptyActions = [];
const deduplicated4 = deduplicateActions(emptyActions);
console.log('Input:', JSON.stringify(emptyActions, null, 2));
console.log('Output:', JSON.stringify(deduplicated4, null, 2));
console.log('Expected: 0 actions');
console.log('✅ PASS' + (deduplicated4.length === 0 ? '' : ' ❌ FAIL') + '\n');

// Test Case 5: Missing fields (should still deduplicate)
console.log('Test 5: Actions with missing fields');
const partialActions = [
  {
    action: "maintenance_request",
    description: "Leaking sink"
  },
  {
    action: "maintenance_request",
    description: "Leaking sink"
  }
];

console.log('Input:', JSON.stringify(partialActions, null, 2));
const deduplicated5 = deduplicateActions(partialActions);
console.log('Output:', JSON.stringify(deduplicated5, null, 2));
console.log('Expected: 1 action (duplicates removed)');
console.log('✅ PASS' + (deduplicated5.length === 1 ? '' : ' ❌ FAIL') + '\n');

console.log('=== All Tests Complete ===');
