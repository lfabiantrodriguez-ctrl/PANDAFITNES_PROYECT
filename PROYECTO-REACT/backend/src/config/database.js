require("dotenv").config({ quiet: true });

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "panda_fitness",
    waitForConnections: true,
    connectionLimit: 10,
});

module.exports = pool;
