const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const router = express.Router();

// Get all properties
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM properties ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get properties error:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// Get single property with tenants
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get property
    const propertyResult = await db.query(
      "SELECT * FROM properties WHERE id = $1",
      [id]
    );

    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Get tenants for this property
    const tenantsResult = await db.query(
      "SELECT * FROM tenants WHERE property_id = $1 ORDER BY created_at DESC",
      [id]
    );

    res.json({
      ...propertyResult.rows[0],
      tenants: tenantsResult.rows,
    });
  } catch (error) {
    console.error("Get property error:", error);
    res.status(500).json({ error: "Failed to fetch property" });
  }
});

// Create new property
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { address, owner_name, owner_email, owner_phone, amenities, rules } =
      req.body;

    if (!address || !owner_name || !owner_email || !owner_phone) {
      return res
        .status(400)
        .json({ error: "Missing required fields" });
    }

    const result = await db.query(
      `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [address, owner_name, owner_email, owner_phone, amenities || {}, rules || {}]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create property error:", error);
    res.status(500).json({ error: "Failed to create property" });
  }
});

// Update property
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { address, owner_name, owner_email, owner_phone, amenities, rules } =
      req.body;

    const result = await db.query(
      `UPDATE properties 
       SET address = $1, owner_name = $2, owner_email = $3, owner_phone = $4, amenities = $5, rules = $6
       WHERE id = $7
       RETURNING *`,
      [address, owner_name, owner_email, owner_phone, amenities, rules, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update property error:", error);
    res.status(500).json({ error: "Failed to update property" });
  }
});

// Delete property
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM properties WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json({ message: "Property deleted successfully" });
  } catch (error) {
    console.error("Delete property error:", error);
    res.status(500).json({ error: "Failed to delete property" });
  }
});

module.exports = router;
