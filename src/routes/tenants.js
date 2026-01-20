const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const router = express.Router();

// Get all tenants
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, p.address as property_address, p.id as property_id
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
      ORDER BY t.created_at DESC
    `);
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
