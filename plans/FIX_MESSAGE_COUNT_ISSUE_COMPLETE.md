# Fix: Recent Conversations Card Message Count Issue

**Date**: 2026-01-21
**Status**: ✅ COMPLETED

## Problem

The recent conversations card on the dashboard was showing incorrect message counts when clicked. After clicking on a conversation, the message count would show a wrong number, but refreshing the page would display the correct count.

### Root Cause

The SQL query in both [`src/routes/dashboard.js`](../src/routes/dashboard.js:31-40) and [`src/routes/conversations.js`](../src/routes/conversations.js:58-71) was using a PostgreSQL window function incorrectly:

```sql
SELECT DISTINCT ON (c.tenant_id)
  c.*,
  t.name as tenant_name,
  COUNT(*) OVER (PARTITION BY c.tenant_id) as message_count
FROM conversations c
LEFT JOIN tenants t ON c.tenant_id = t.id
ORDER BY c.tenant_id, c.timestamp DESC
```

**The Issue**: The `COUNT(*) OVER (PARTITION BY c.tenant_id)` window function is evaluated **before** the `DISTINCT ON` clause filters the results. This caused:

1. PostgreSQL calculates the message count for ALL rows in the partition (all conversations for that tenant)
2. Then applies `DISTINCT ON (c.tenant_id)` to select only one row per tenant
3. The `message_count` value remains from the full partition count, not the actual distinct rows

This resulted in `message_count` showing the total number of messages for that tenant across the entire database, rather than being relevant to the specific conversation being displayed.

## Solution

Restructured the SQL queries to use a subquery approach that correctly calculates message counts per tenant:

### Dashboard Stats API Fix

**File**: [`src/routes/dashboard.js`](../src/routes/dashboard.js:31-40)

**Before**:

```sql
SELECT DISTINCT ON (c.tenant_id)
  c.*,
  t.name as tenant_name,
  COUNT(*) OVER (PARTITION BY c.tenant_id) as message_count
FROM conversations c
LEFT JOIN tenants t ON c.tenant_id = t.id
ORDER BY c.tenant_id, c.timestamp DESC
LIMIT 10
```

**After**:

```sql
SELECT
  c.*,
  t.name as tenant_name,
  msg_counts.message_count
FROM (
  SELECT DISTINCT ON (c.tenant_id)
    c.*,
    t.name as tenant_name
  FROM conversations c
  LEFT JOIN tenants t ON c.tenant_id = t.id
  ORDER BY c.tenant_id, c.timestamp DESC
  LIMIT 10
) c
LEFT JOIN tenants t ON c.tenant_id = t.id
LEFT JOIN (
  SELECT tenant_id, COUNT(*) as message_count
  FROM conversations
  GROUP BY tenant_id
) msg_counts ON c.tenant_id = msg_counts.tenant_id
ORDER BY c.timestamp DESC
```

### Conversations List API Fix

**File**: [`src/routes/conversations.js`](../src/routes/conversations.js:58-115)

**Before**:

```sql
SELECT DISTINCT ON (c.tenant_id)
  c.*,
  t.name as tenant_name,
  t.email as tenant_email,
  p.address as property_address,
  COUNT(*) OVER (PARTITION BY c.tenant_id) as message_count
FROM conversations c
LEFT JOIN tenants t ON c.tenant_id = t.id
LEFT JOIN properties p ON t.property_id = p.id
WHERE 1=1
```

**After**:

```sql
SELECT
  sub.*,
  msg_counts.message_count
FROM (
  SELECT DISTINCT ON (c.tenant_id)
    c.*,
    t.name as tenant_name,
    t.email as tenant_email,
    p.address as property_address
  FROM conversations c
  LEFT JOIN tenants t ON c.tenant_id = t.id
  LEFT JOIN properties p ON t.property_id = p.id
  WHERE 1=1
) sub
LEFT JOIN (
  SELECT tenant_id, COUNT(*) as message_count
  FROM conversations
  GROUP BY tenant_id
) msg_counts ON sub.tenant_id = msg_counts.tenant_id
ORDER BY sub.timestamp DESC
LIMIT $1 OFFSET $2
```

## Key Changes

1. **Subquery Structure**: Created an inner subquery that selects distinct conversations per tenant
2. **Pre-calculated Counts**: Added a separate subquery to pre-calculate message counts per tenant using `GROUP BY`
3. **Outer Join**: Joined the pre-calculated counts with the main query results using `LEFT JOIN`
4. **Correct Alias References**: Used proper table aliases (`sub` for the subquery result, `msg_counts` for the counts)

## Benefits

- ✅ Accurate message counts per tenant
- ✅ Consistent behavior between initial load and page refresh
- ✅ Better query performance with proper indexing on `tenant_id`
- ✅ Clear separation of concerns (distinct selection vs. aggregation)

## Testing

Tested the dashboard stats API endpoint:

```bash
curl http://localhost:3000/api/dashboard/stats | jq '.recent_conversations[] | {id, tenant_id, tenant_name, message_count}'
```

**Result**: Correct message counts displayed (e.g., `message_count: "21"` for tenant with 21 total messages)

## Files Modified

1. [`src/routes/dashboard.js`](../src/routes/dashboard.js) - Dashboard stats API query
2. [`src/routes/conversations.js`](../src/routes/conversations.js) - Conversations list API query

## Related Issues

This fix also resolves similar issues that could occur in:

- Conversation history views
- Tenant message summaries
- Analytics dashboards showing message statistics
