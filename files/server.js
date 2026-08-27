const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
 
const app = express();
const PORT = 3000;
 

app.use(express.static(path.join(__dirname, "public")));
 
// Database connection pool
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",             
    database: "pet_platform"     
});
 
// pulls  data from the MariaDB database
app.get("/pet", async (req, res) => {
    try {
        res.set("Cache-Control", "no-store");
        const [rows] = await db.query("SELECT * FROM pet");
        res.json(rows);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to fetch pets" });
    }
});
 
app.listen(PORT, () => {
    console.log("Server running on http://localhost:"+PORT);
});
 
