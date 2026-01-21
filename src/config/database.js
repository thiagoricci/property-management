const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

pool.on("connect", (client) => {
  console.log(`New client connected to database. Total clients: ${pool.totalCount}`);
});

pool.on("remove", (client) => {
  console.log(`Client removed from pool. Total clients: ${pool.totalCount}`);
});

module.exports = pool;
