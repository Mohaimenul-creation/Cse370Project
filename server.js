const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

// Allow JSON data from frontend
app.use(express.json());

// Serve HTML, CSS and JavaScript from public folder
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// DATABASE CONNECTION
// ===============================

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",              // Put your MySQL password here
    database: "find_my_paw",   // Your database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testDatabase() {
    try {
        const connection = await db.getConnection();
        console.log("MySQL connected successfully!");
        connection.release();
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
    }
}

testDatabase();


// =====================================================
// BASIC PET ROUTE
// =====================================================

// Get all pets
app.get("/pet", async (req, res) => {

    try {

        res.set("Cache-Control", "no-store");

        const [rows] = await db.query(`
            SELECT *
            FROM Pet
        `);

        res.json(rows);

    } catch (error) {

        console.error("Database error:", error);

        res.status(500).json({
            error: "Failed to fetch pets"
        });

    }

});


// =====================================================
// FEATURE 1: VACCINATION AND MEDICAL RECORDS
// =====================================================


// Get all vaccination records of a particular pet
app.get("/api/health/pet/:petId", async (req, res) => {

    try {

        const petId = req.params.petId;

        const [rows] = await db.query(`

            SELECT
                p.pet_id,
                p.name AS pet_name,
                p.species,
                p.breed_name,

                v.vaccination_name,
                v.initial_date,
                v.next_due_date,

                m.checkup_date,
                m.diagnosis,
                m.treatment_status

            FROM Pet p

            LEFT JOIN Vaccination v
                ON p.pet_id = v.pet_id

            LEFT JOIN Medical_record m
                ON p.pet_id = m.pet_id

            WHERE p.pet_id = ?

            ORDER BY
                v.next_due_date ASC,
                m.checkup_date DESC

        `, [petId]);

        res.json(rows);

    } catch (error) {

        console.error("Health database error:", error);

        res.status(500).json({
            error: "Failed to fetch health records"
        });

    }

});


// Add vaccination record
app.post("/api/vaccinations", async (req, res) => {

    try {

        const {
            vaccination_name,
            pet_id,
            initial_date,
            next_due_date
        } = req.body;

        const [result] = await db.query(`

            INSERT INTO Vaccination
            (
                vaccination_name,
                pet_id,
                initial_date,
                next_due_date
            )

            VALUES (?, ?, ?, ?)

        `, [
            vaccination_name,
            pet_id,
            initial_date,
            next_due_date
        ]);

        res.json({
            message: "Vaccination record added successfully!",
            vaccination_id: result.insertId
        });

    } catch (error) {

        console.error("Vaccination error:", error);

        res.status(500).json({
            error: "Failed to add vaccination"
        });

    }

});


// Add medical record
app.post("/api/medical-records", async (req, res) => {

    try {

        const {
            checkup_date,
            pet_id,
            diagnosis,
            treatment_status
        } = req.body;

        const [result] = await db.query(`

            INSERT INTO Medical_record
            (
                checkup_date,
                pet_id,
                diagnosis,
                treatment_status
            )

            VALUES (?, ?, ?, ?)

        `, [
            checkup_date,
            pet_id,
            diagnosis,
            treatment_status
        ]);

        res.json({
            message: "Medical record added successfully!",
            medical_id: result.insertId
        });

    } catch (error) {

        console.error("Medical record error:", error);

        res.status(500).json({
            error: "Failed to add medical record"
        });

    }

});


// =====================================================
// COMPLEX QUERY 1
// UPCOMING VACCINATION + LATEST MEDICAL RECORD
// =====================================================

app.get("/api/health/upcoming", async (req, res) => {

    try {

        const [rows] = await db.query(`

            SELECT

                p.pet_id,
                p.name AS pet_name,
                p.species,
                p.breed_name,

                u.name AS owner_name,
                u.phone AS owner_phone,

                v.vaccination_name,
                v.next_due_date,

                m.checkup_date AS last_checkup,
                m.diagnosis AS last_diagnosis,
                m.treatment_status

            FROM Pet p

            JOIN User u
                ON p.owner_id = u.user_id

            JOIN Vaccination v
                ON p.pet_id = v.pet_id

            LEFT JOIN Medical_record m

                ON m.pet_id = p.pet_id

                AND m.checkup_date = (

                    SELECT MAX(m2.checkup_date)

                    FROM Medical_record m2

                    WHERE m2.pet_id = p.pet_id

                )

            WHERE v.next_due_date

                BETWEEN CURDATE()

                AND DATE_ADD(
                    CURDATE(),
                    INTERVAL 30 DAY
                )

            ORDER BY v.next_due_date ASC

        `);

        res.json(rows);

    } catch (error) {

        console.error("Upcoming vaccination error:", error);

        res.status(500).json({
            error: "Failed to fetch upcoming vaccinations"
        });

    }

});


// =====================================================
// FEATURE 2: FIND NEARBY VETERINARIANS
// =====================================================

app.get("/api/veterinarians", async (req, res) => {

    try {

        const city = req.query.city;
        const zip = req.query.zip_code;
        const specialization = req.query.specialization;

        let sql = `

            SELECT
                vet_id,
                clinic_name,
                doctor_name,
                specialization,
                email,
                phone_number,
                street_address,
                city,
                zip_code

            FROM Veterinarian

            WHERE 1 = 1

        `;

        const values = [];

        if (city) {

            sql += ` AND city LIKE ? `;
            values.push(`%${city}%`);

        }

        if (zip) {

            sql += ` AND zip_code = ? `;
            values.push(zip);

        }

        if (specialization) {

            sql += ` AND specialization LIKE ? `;
            values.push(`%${specialization}%`);

        }

        sql += ` ORDER BY clinic_name `;

        const [rows] = await db.query(sql, values);

        res.json(rows);

    } catch (error) {

        console.error("Veterinarian error:", error);

        res.status(500).json({
            error: "Failed to find veterinarians"
        });

    }

});


// =====================================================
// FEATURE 3: LOST AND FOUND PET REPORT
// =====================================================

app.post("/api/pet-reports", async (req, res) => {

    try {

        const {
            last_seen_date,
            description,
            user_id,
            pet_id,
            report_type,
            pet_picture,
            identifying_mark,
            zip_code,
            city,
            area_name,
            share_location_url
        } = req.body;


        const [result] = await db.query(`

            INSERT INTO Pet_report

            (
                last_seen_date,
                description,
                user_id,
                pet_id,
                report_type,
                pet_picture,
                identifying_mark,
                zip_code,
                city,
                area_name,
                share_location_url
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

        `, [

            last_seen_date,
            description,
            user_id,
            pet_id,
            report_type,
            pet_picture,
            identifying_mark,
            zip_code,
            city,
            area_name,
            share_location_url

        ]);

        res.json({

            message: "Lost/Found report submitted successfully!",

            report_id: result.insertId

        });

    } catch (error) {

        console.error("Pet report error:", error);

        res.status(500).json({

            error: "Failed to submit pet report"

        });

    }

});


// Get lost/found reports
app.get("/api/pet-reports", async (req, res) => {

    try {

        const [rows] = await db.query(`

            SELECT

                pr.report_id,
                pr.report_type,
                pr.last_seen_date,
                pr.description,
                pr.city,
                pr.area_name,
                pr.status,

                p.name AS pet_name,
                p.species,
                p.breed_name,
                p.color

            FROM Pet_report pr

            LEFT JOIN Pet p
                ON pr.pet_id = p.pet_id

            WHERE pr.status = 'Active'

            ORDER BY pr.report_date DESC

        `);

        res.json(rows);

    } catch (error) {

        console.error("Pet report error:", error);

        res.status(500).json({

            error: "Failed to fetch reports"

        });

    }

});


// =====================================================
// COMPLEX QUERY 2
// LOST AND FOUND PET MATCHING
// =====================================================

app.get("/api/pet-reports/matches", async (req, res) => {

    try {

        const [rows] = await db.query(`

            SELECT

                l.report_id AS lost_report_id,
                f.report_id AS found_report_id,

                lp.name AS lost_pet_name,
                fp.name AS found_pet_name,

                lp.species,
                lp.breed_name,
                lp.color,

                l.city AS lost_city,
                f.city AS found_city,

                l.area_name AS lost_area,
                f.area_name AS found_area,

                CASE

                    WHEN
                        lp.species = fp.species
                        AND lp.breed_name = fp.breed_name
                        AND lp.color = fp.color
                        AND l.city = f.city

                    THEN 'Strong Match'


                    WHEN
                        lp.species = fp.species
                        AND lp.color = fp.color
                        AND l.city = f.city

                    THEN 'Possible Match'


                    ELSE 'Weak Match'

                END AS match_status


            FROM Pet_report l


            JOIN Pet_report f

                ON l.report_type = 'Lost'
                AND f.report_type = 'Found'


            JOIN Pet lp
                ON l.pet_id = lp.pet_id


            JOIN Pet fp
                ON f.pet_id = fp.pet_id


            WHERE

                l.status = 'Active'
                AND f.status = 'Active'

                AND lp.species = fp.species

                AND (
                    lp.breed_name = fp.breed_name
                    OR lp.color = fp.color
                )

                AND l.city = f.city


            ORDER BY

                CASE

                    WHEN
                        lp.breed_name = fp.breed_name
                        AND lp.color = fp.color

                    THEN 1

                    WHEN lp.color = fp.color

                    THEN 2

                    ELSE 3

                END

        `);

        res.json(rows);

    } catch (error) {

        console.error("Matching error:", error);

        res.status(500).json({

            error: "Failed to find possible matches"

        });

    }

});


// =====================================================
// COMPLEX QUERY 3
// VETERINARIANS WITH ABOVE-AVERAGE VISITS
// =====================================================

app.get("/api/veterinarians/analytics", async (req, res) => {

    try {

        const city = req.query.city || "Dhaka";


        const [rows] = await db.query(`

            SELECT

                v.vet_id,
                v.clinic_name,
                v.doctor_name,
                v.specialization,
                v.city,

                COUNT(DISTINCT vv.visit_id)
                    AS total_visits


            FROM Veterinarian v


            LEFT JOIN Vet_Visit vv

                ON v.vet_id = vv.vet_id


            WHERE v.city = ?


            GROUP BY

                v.vet_id,
                v.clinic_name,
                v.doctor_name,
                v.specialization,
                v.city


            HAVING

                COUNT(DISTINCT vv.visit_id)

                >

                (

                    SELECT AVG(visit_count)

                    FROM (

                        SELECT

                            v2.vet_id,

                            COUNT(DISTINCT vv2.visit_id)
                                AS visit_count


                        FROM Veterinarian v2


                        LEFT JOIN Vet_Visit vv2

                            ON v2.vet_id = vv2.vet_id


                        WHERE v2.city = ?


                        GROUP BY v2.vet_id

                    ) AS vet_statistics

                )


            ORDER BY total_visits DESC

        `, [city, city]);


        res.json(rows);


    } catch (error) {

        console.error("Veterinarian analytics error:", error);

        res.status(500).json({

            error: "Failed to calculate veterinarian analytics"

        });

    }

});


// =====================================================
// TEST API
// =====================================================

app.get("/api/test", async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT 1 AS result"
        );

        res.json({

            success: true,

            message:
                "Find My Paw backend and MySQL are connected!",

            result: rows

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Database connection failed"

        });

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

// FEATURE 2  Compare each pet's medical records with average


app.get("/analytics/medical", async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                pet.Pet_id,
                pet.Name,
                COUNT(medical_record.Medical_id) AS Medical_records,

                (
                    SELECT AVG(record_count)
                    FROM (
                        SELECT COUNT(Medical_id) AS record_count
                        FROM medical_record
                        GROUP BY Pet_id
                    ) AS medical_counts
                ) AS Average_records

            FROM pet
            LEFT JOIN medical_record
                ON pet.Pet_id = medical_record.Pet_id

            GROUP BY pet.Pet_id, pet.Name

            ORDER BY pet.Pet_id
        `);

        // Add comparison text
        rows.forEach(pet => {

            if (pet.Medical_records > pet.Average_records) {
                pet.Comparison = "Above Average";
            }
            else if (pet.Medical_records < pet.Average_records) {
                pet.Comparison = "Below Average";
            }
            else {
                pet.Comparison = "Average";
            }

        });

        res.json(rows);

    } catch (error) {
        console.error("Medical analytics error:", error);

        res.status(500).json({
            error: "Failed to load medical analytics"
        });
    }
});

// FEATURE 3  Categories with above average spending


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



// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});
