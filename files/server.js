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

// FEATURE 1 Adoption analytics based on breed

app.get("/analytics/adoption-breed", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT 
                pet.Breed_Name,
                COUNT(adoption_application.Application_id) AS Applications
            FROM pet
            JOIN adoption_application
                ON pet.Pet_id = adoption_application.Pet_id
            GROUP BY pet.Breed_Name
            ORDER BY Applications DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error("Adoption analytics error:", error);

        res.status(500).json({
            error: "Failed to load adoption analytics"
        });
    }
});

// FEATURE 2  Compare each pet's medical status with other pets

app.get("/analytics/medical", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                pet.Pet_id,
                pet.Name,
                medical_record.Diagnosis,
                medical_record.Treatment_status,

                (
                    SELECT COUNT(*)
                    FROM medical_record mr
                    WHERE mr.Treatment_status = medical_record.Treatment_status
                ) AS Pets_with_same_status,

                (
                    SELECT COUNT(*)
                    FROM medical_record
                ) AS Total_medical_records

            FROM pet
            JOIN medical_record
                ON pet.Pet_id = medical_record.Pet_id

            ORDER BY pet.Pet_id
        `);

        res.json(rows);

    } catch (error) {
        console.error("Medical analytics error:", error);

        res.status(500).json({
            error: "Failed to load medical analytics"
        });
    }
});



// FEATURE 3 Categories with above-average spending

app.get("/analytics/expenses", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                Category_name,
                SUM(Amount) AS Total_spending
            FROM expense
            GROUP BY Category_name
            HAVING SUM(Amount) > (
                SELECT AVG(category_total)
                FROM (
                    SELECT SUM(Amount) AS category_total
                    FROM expense
                    GROUP BY Category_name
                ) AS category_spending
            )
            ORDER BY Total_spending DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error("Expense analytics error:", error);

        res.status(500).json({
            error: "Failed to load expense analytics"
        });
    }
});
app.listen(PORT, () => {
    console.log("Server running on http://localhost:"+PORT);
});
 
