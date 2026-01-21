/**
 * Test script for duplicate maintenance request fixes and text cleaning
 *
 * Tests:
 * 1. Text Cleaning - Remove "Maintenance Request:" phrases
 * 2. Exact Duplicate Deduplication (already implemented)
 * 3. Time-Based Deduplication (requires database - manual verification)
 */

// Test 1: Text Cleaning
console.log("=".repeat(60));
console.log("TEST 1: Text Cleaning - Remove 'Maintenance Request:' Phrases");
console.log("=".repeat(60));

const testResponses = [
  {
    name: "Response with 'Maintenance Request:'",
    input: "Thank you for confirming that the electrical outage is specific to your unit, Thiago. Since it's isolated to your home, I recommend refraining from attempting any electrical fixes yourself to ensure safety. I will escalate this as an urgent maintenance request to have our team address the electrical outage in your unit promptly. Our maintenance staff will investigate the cause and work to restore power to your home as soon as possible. Maintenance Request:",
    expected: "Thank you for confirming that the electrical outage is specific to your unit, Thiago. Since it's isolated to your home, I recommend refraining from attempting any electrical fixes yourself to ensure safety. I will escalate this as an urgent maintenance request to have our team address the electrical outage in your unit promptly. Our maintenance staff will investigate the cause and work to restore power to your home as soon as possible.",
  },
  {
    name: "Response with 'I'll create a maintenance request'",
    input: "I'll create a maintenance request for your issue.",
    expected: "I'll create a maintenance request for your issue.",
  },
  {
    name: "Response with 'Creating maintenance request'",
    input: "Creating maintenance request for broken AC.",
    expected: "Creating maintenance request for broken AC.",
  },
  {
    name: "Response with 'Maintenance request created'",
    input: "Maintenance request created successfully.",
    expected: "Maintenance request created successfully.",
  },
];

let passedTests = 0;
let failedTests = 0;

testResponses.forEach((test, index) => {
  // Simulate stripJSONFromResponse logic
  let cleaned = test.input.replace(/\{[\s\S]*?\}/g, "").trim();
  
  // Remove specific phrases that indicate maintenance request creation
  // These are exact phrases we want to remove, not broader patterns
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

  const passed = cleaned === test.expected;

  console.log(`\nTest ${index + 1}: ${test.name}`);
  console.log(`Input: "${test.input.substring(0, 100)}..."`);
  console.log(`Expected: "${test.expected}"`);
  console.log(`Actual: "${cleaned}"`);
  console.log(`Result: ${passed ? "✅ PASS" : "❌ FAIL"}`);

  if (passed) {
    passedTests++;
  } else {
    failedTests++;
    console.log(`  Expected length: ${test.expected.length}`);
    console.log(`  Actual length: ${cleaned.length}`);
  }
});

console.log("\n" + "-".repeat(60));
console.log(`Text Cleaning Tests: ${passedTests}/${testResponses.length} passed`);

// Test 2: Exact Duplicate Deduplication
console.log("\n[TEST 2] Exact Duplicate Deduplication");
console.log("-".repeat(60));

const duplicateActions = [
  { action: "maintenance_request", priority: "urgent", description: "Leaking sink in kitchen" },
  { action: "maintenance_request", priority: "urgent", description: "Leaking sink in kitchen" },
  { action: "maintenance_request", priority: "urgent", description: "Leaking sink in kitchen" },
];

// Simulate deduplicateActions logic
const uniqueActions = [];
const seen = new Set();

for (const action of duplicateActions) {
  const key = `${action.action}:${action.description || ''}:${action.priority || ''}`;
  
  if (!seen.has(key)) {
    seen.add(key);
    uniqueActions.push(action);
  } else {
    console.log(`[Action Deduplication] Removing duplicate action: ${key}`);
  }
}

const exactDuplicationPassed = uniqueActions.length === 1;

console.log(`Input: ${duplicateActions.length} identical maintenance request actions`);
console.log(`Expected: 1 action (2 duplicates removed)`);
console.log(`Actual: ${uniqueActions.length} action(s)`);
console.log(`Result: ${exactDuplicationPassed ? "✅ PASS" : "❌ FAIL"}`);

if (exactDuplicationPassed) {
  passedTests++;
} else {
  failedTests++;
}

// Test 3: Time-Based Deduplication (Manual Verification Required)
console.log("\n[TEST 3] Time-Based Deduplication");
console.log("-".repeat(60));
console.log("⚠️  This test requires a running database connection");
console.log("⚠️  Skipping automated test - manual verification required");
console.log("\nTo test time-based deduplication manually:");
console.log("1. Send a maintenance request via SMS/email");
console.log("2. Wait 1 minute");
console.log("3. Send another maintenance request with similar description");
console.log("4. Check that only ONE request was created (not two)");
console.log("5. Check logs for '[Time-Based Deduplication]' message");

// Summary
console.log("\n" + "=".repeat(60));
console.log("TEST SUMMARY");
console.log("=".repeat(60));
console.log(`Total Tests: ${testResponses.length + 1} (2 automated + 1 manual)`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Success Rate: ${((passedTests / (testResponses.length + 1)) * 100).toFixed(0)}%`);

if (failedTests === 0) {
  console.log("\n✅ All automated tests passed!");
  console.log("\nNext steps:");
  console.log("1. Start the server: npm run dev");
  console.log("2. Test time-based deduplication manually using SMS/email");
  console.log("3. Monitor logs for deduplication messages");
  process.exit(0);
} else {
  console.log("\n❌ Some tests failed. Please review the output above.");
  process.exit(1);
}
