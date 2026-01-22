const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const router = express.Router();

// Get tenant analytics
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    // Get total tenants
    const totalResult = await db.query("SELECT COUNT(*) as count FROM tenants");
    const totalTenants = parseInt(totalResult.rows[0].count);

    // Get active tenants (tenants with conversations in last 30 days)
    const activeResult = await db.query(`
      SELECT COUNT(DISTINCT t.id) as count
      FROM tenants t
      INNER JOIN messages m ON t.id = m.tenant_id
      WHERE m.timestamp >= NOW() - INTERVAL '30 days'
    `);
    const activeTenants = parseInt(activeResult.rows[0].count);

    // Get properties with tenants
    const propertiesResult = await db.query(`
      SELECT COUNT(DISTINCT property_id) as count
      FROM tenants
      WHERE property_id IS NOT NULL
    `);
    const propertiesWithTenants = parseInt(propertiesResult.rows[0].count);

    // Get new tenants this month
    const newResult = await db.query(`
      SELECT COUNT(*) as count
      FROM tenants
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    `);
    const newThisMonth = parseInt(newResult.rows[0].count);

    res.json({
      total_tenants: totalTenants,
      active_tenants: activeTenants,
      properties_with_tenants: propertiesWithTenants,
      new_this_month: newThisMonth,
    });
  } catch (error) {
    console.error("Get tenant analytics error:", error);
    res.status(500).json({ error: "Failed to fetch tenant analytics" });
  }
});

// Get all tenants
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { property_id } = req.query;
    
    let query = `
      SELECT t.*, p.address as property_address, p.id as property_id
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
    `;
    
    const params = [];
    
    if (property_id) {
      query += " WHERE t.property_id = $1";
      params.push(property_id);
    }
    
    query += " ORDER BY t.created_at DESC";
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get tenants error:", error);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// Get single tenant
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT t.*, p.address as property_address, p.id as property_id
       FROM tenants t
       LEFT JOIN properties p ON t.property_id = p.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get tenant error:", error);
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

// Create new tenant
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { property_id, name, phone, email, lease_terms, move_in_date } =
      req.body;

    if (!property_id || !name || !phone) {
      return res
        .status(400)
        .json({ error: "Missing required fields" });
    }

    const result = await db.query(
      `INSERT INTO tenants (property_id, name, phone, email, lease_terms, move_in_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [property_id, name, phone, email || null, lease_terms || {}, move_in_date || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create tenant error:", error);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// Update tenant
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { property_id, name, phone, email, lease_terms, move_in_date } =
      req.body;

    const result = await db.query(
      `UPDATE tenants 
       SET property_id = $1, name = $2, phone = $3, email = $4, lease_terms = $5, move_in_date = $6
       WHERE id = $7
       RETURNING *`,
      [property_id, name, phone, email, lease_terms, move_in_date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update tenant error:", error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// Delete tenant
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM tenants WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({ message: "Tenant deleted successfully" });
  } catch (error) {
    console.error("Delete tenant error:", error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

module.exports = router;
