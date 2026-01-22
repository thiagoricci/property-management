const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const router = express.Router();

// Get properties analytics
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    // Total properties
    const totalResult = await db.query("SELECT COUNT(*) FROM properties");
    const total_properties = parseInt(totalResult.rows[0].count);

    // Properties with tenants
    const withTenantsResult = await db.query(
      "SELECT COUNT(DISTINCT property_id) FROM tenants"
    );
    const properties_with_tenants = parseInt(withTenantsResult.rows[0].count);

    // Total tenants
    const tenantsResult = await db.query("SELECT COUNT(*) FROM tenants");
    const total_tenants = parseInt(tenantsResult.rows[0].count);

    // Recently added (last 30 days)
    const recentResult = await db.query(
      "SELECT COUNT(*) FROM properties WHERE created_at >= NOW() - INTERVAL '30 days'"
    );
    const recently_added = parseInt(recentResult.rows[0].count);

    res.json({
      total_properties,
      properties_with_tenants,
      total_tenants,
      recently_added,
    });
  } catch (error) {
    console.error("Get properties analytics error:", error);
    res.status(500).json({ error: "Failed to fetch properties analytics" });
  }
});

// Get all properties with optional search and filters
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { search, has_tenants, date_from, date_to, sort, order } = req.query;

    // Build query dynamically
    let query = `
      SELECT p.*, COUNT(t.id) as tenant_count
      FROM properties p
      LEFT JOIN tenants t ON p.id = t.property_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Add search filter
    if (search) {
      query += ` AND (p.address ILIKE $${paramIndex} OR p.owner_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add tenant filter
    if (has_tenants === "true") {
      query += ` AND t.id IS NOT NULL`;
    } else if (has_tenants === "false") {
      query += ` AND t.id IS NULL`;
    }

    // Add date filters
    if (date_from) {
      query += ` AND p.created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      query += ` AND p.created_at <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }

    // Add GROUP BY for COUNT
    query += ` GROUP BY p.id`;

    // Add sorting
    const sortField = sort === "address" ? "p.address" : 
                    sort === "tenant_count" ? "COUNT(t.id)" : 
                    "p.created_at";
    const sortOrder = order === "asc" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const result = await db.query(query, params);
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
