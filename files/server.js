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


// ============================================================
// MUSARRAT FEATURE 1
// Keep vaccination and medical records
// ============================================================


// Get vaccination records for a pet

app.get("/pets/:petId/vaccinations", async (req, res) => {
    try {

        const petId = req.params.petId;

        const [rows] = await db.query(`
            SELECT
                Vaccination_name,
                Pet_id,
                Initial_date,
                Next_due_date
            FROM vaccination
            WHERE Pet_id = ?
            ORDER BY Next_due_date
        `, [petId]);

        res.json(rows);

    } catch (error) {
        console.error("Vaccination error:", error);

        res.status(500).json({
            error: "Failed to fetch vaccination records"
        });
    }
});


// Add vaccination record

app.post("/pets/:petId/vaccinations", async (req, res) => {
    try {

        const petId = req.params.petId;

        const {
            Vaccination_name,
            Initial_date,
            Next_due_date
        } = req.body;

        const [result] = await db.query(`
            INSERT INTO vaccination
            (
                Vaccination_name,
                Pet_id,
                Initial_date,
                Next_due_date
            )
            VALUES (?, ?, ?, ?)
        `, [
            Vaccination_name,
            petId,
            Initial_date,
            Next_due_date
        ]);

        res.json({
            message: "Vaccination record added successfully",
            id: result.insertId
        });

    } catch (error) {
        console.error("Vaccination insert error:", error);

        res.status(500).json({
            error: "Failed to add vaccination record"
        });
    }
});


// Get medical records for a pet

app.get("/pets/:petId/medical", async (req, res) => {
    try {

        const petId = req.params.petId;

        const [rows] = await db.query(`
            SELECT
                Medical_id,
                Checkup_date,
                Pet_id,
                Diagnosis,
                Treatment_status
            FROM medical_record
            WHERE Pet_id = ?
            ORDER BY Checkup_date DESC
        `, [petId]);

        res.json(rows);

    } catch (error) {
        console.error("Medical record error:", error);

        res.status(500).json({
            error: "Failed to fetch medical records"
        });
    }
});


// Add medical record

app.post("/pets/:petId/medical", async (req, res) => {
    try {

        const petId = req.params.petId;

        const {
            Checkup_date,
            Diagnosis,
            Treatment_status
        } = req.body;

        const [result] = await db.query(`
            INSERT INTO medical_record
            (
                Checkup_date,
                Pet_id,
                Diagnosis,
                Treatment_status
            )
            VALUES (?, ?, ?, ?)
        `, [
            Checkup_date,
            petId,
            Diagnosis,
            Treatment_status
        ]);

        res.json({
            message: "Medical record added successfully",
            id: result.insertId
        });

    } catch (error) {
        console.error("Medical record insert error:", error);

        res.status(500).json({
            error: "Failed to add medical record"
        });
    }
});


// Get all health information of a pet

app.get("/pets/:petId/health", async (req, res) => {
    try {

        const petId = req.params.petId;

        const [pet] = await db.query(`
            SELECT *
            FROM pet
            WHERE Pet_id = ?
        `, [petId]);


        const [vaccinations] = await db.query(`
            SELECT *
            FROM vaccination
            WHERE Pet_id = ?
            ORDER BY Next_due_date
        `, [petId]);


        const [medical] = await db.query(`
            SELECT *
            FROM medical_record
            WHERE Pet_id = ?
            ORDER BY Checkup_date DESC
        `, [petId]);


        res.json({
            pet: pet[0],
            vaccinations: vaccinations,
            medical_records: medical
        });

    } catch (error) {
        console.error("Health records error:", error);

        res.status(500).json({
            error: "Failed to fetch health records"
        });
    }
});



// ============================================================
// MUSARRAT FEATURE 2
// Find nearby veterinarians
// ============================================================


// Get veterinarians

app.get("/veterinarians", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                Vet_ID,
                Clinic_Name,
                Doctor_Name,
                Website,
                Specialization,
                Email,
                Phone_Number,
                Street_Address,
                City,
                Zip_Code
            FROM veterinarian
            ORDER BY Clinic_Name
        `);

        res.json(rows);

    } catch (error) {
        console.error("Veterinarian error:", error);

        res.status(500).json({
            error: "Failed to fetch veterinarians"
        });
    }
});


// Find veterinarians by city

app.get("/veterinarians/city/:city", async (req, res) => {
    try {

        const city = req.params.city;

        const [rows] = await db.query(`
            SELECT
                Vet_ID,
                Clinic_Name,
                Doctor_Name,
                Website,
                Specialization,
                Email,
                Phone_Number,
                Street_Address,
                City,
                Zip_Code
            FROM veterinarian
            WHERE LOWER(City) = LOWER(?)
            ORDER BY Clinic_Name
        `, [city]);

        res.json(rows);

    } catch (error) {
        console.error("Veterinarian city search error:", error);

        res.status(500).json({
            error: "Failed to find veterinarians"
        });
    }
});


// Find veterinarians by area/address

app.get("/veterinarians/area/:area", async (req, res) => {
    try {

        const area = req.params.area;

        const [rows] = await db.query(`
            SELECT
                Vet_ID,
                Clinic_Name,
                Doctor_Name,
                Website,
                Specialization,
                Email,
                Phone_Number,
                Street_Address,
                City,
                Zip_Code
            FROM veterinarian
            WHERE LOWER(Street_Address) LIKE LOWER(?)
            ORDER BY Clinic_Name
        `, [`%${area}%`]);

        res.json(rows);

    } catch (error) {
        console.error("Veterinarian area search error:", error);

        res.status(500).json({
            error: "Failed to find veterinarians"
        });
    }
});



// ============================================================
// MUSARRAT FEATURE 3
// Report lost and found pets
// ============================================================


// Get all lost and found pet reports

app.get("/pet-reports", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                pet_report.*,
                pet.Name AS Pet_name,
                pet.Species,
                pet.Gender,
                user.Name AS Reporter_name,
                user.Phone AS Reporter_phone
            FROM pet_report

            LEFT JOIN pet
                ON pet_report.Pet_ID = pet.Pet_id

            LEFT JOIN user
                ON pet_report.User_ID = user.User_id

            ORDER BY pet_report.Report_Date DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error("Pet report error:", error);

        res.status(500).json({
            error: "Failed to fetch pet reports"
        });
    }
});


// Get only lost pets

app.get("/pet-reports/lost", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                pet_report.*,
                pet.Name AS Pet_name,
                pet.Species,
                pet.Gender
            FROM pet_report

            LEFT JOIN pet
                ON pet_report.Pet_ID = pet.Pet_id

            WHERE pet_report.Report_Type = 'Lost'

            ORDER BY pet_report.Report_Date DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error("Lost pet error:", error);

        res.status(500).json({
            error: "Failed to fetch lost pets"
        });
    }
});


// Get only found pets

app.get("/pet-reports/found", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                pet_report.*,
                pet.Name AS Pet_name,
                pet.Species,
                pet.Gender
            FROM pet_report

            LEFT JOIN pet
                ON pet_report.Pet_ID = pet.Pet_id

            WHERE pet_report.Report_Type = 'Found'

            ORDER BY pet_report.Report_Date DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error("Found pet error:", error);

        res.status(500).json({
            error: "Failed to fetch found pets"
        });
    }
});


// Report a lost or found pet

app.post("/pet-reports", async (req, res) => {
    try {

        const {
            Last_seen_Date,
            Description,
            User_ID,
            Pet_ID,
            Report_Type,
            Status,
            Report_Date,
            Pet_pic_url,
            Identifying_mark,
            Zip_code,
            City,
            AreaName,
            Share_location_url
        } = req.body;


        const [result] = await db.query(`
            INSERT INTO pet_report
            (
                Last_seen_Date,
                Description,
                User_ID,
                Pet_ID,
                Report_Type,
                Status,
                Report_Date,
                Pet_pic_url,
                Identifying_mark,
                Zip_code,
                City,
                AreaName,
                Share_location_url
            )

            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            Last_seen_Date,
            Description,
            User_ID,
            Pet_ID,
            Report_Type,
            Status,
            Report_Date,
            Pet_pic_url,
            Identifying_mark,
            Zip_code,
            City,
            AreaName,
            Share_location_url
        ]);


        res.json({

            message:
                "Lost/Found pet report added successfully",

            Report_ID:
                result.insertId

        });

    } catch (error) {
        console.error("Pet report insert error:", error);

        res.status(500).json({
            error: "Failed to create pet report"
        });
    }
});


// Update lost/found report status

app.put("/pet-reports/:reportId/status", async (req, res) => {
    try {

        const reportId = req.params.reportId;

        const {
            Status
        } = req.body;


        const [result] = await db.query(`
            UPDATE pet_report

            SET Status = ?

            WHERE Report_ID = ?
        `, [
            Status,
            reportId
        ]);


        res.json({

            message:
                "Pet report status updated successfully",

            affectedRows:
                result.affectedRows

        });

    } catch (error) {
        console.error("Pet report update error:", error);

        res.status(500).json({
            error: "Failed to update pet report"
        });
    }
});


app.listen(PORT, () => {
    console.log("Server running on http://localhost:"+PORT);
});
 
