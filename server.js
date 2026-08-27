const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// DATABASE CONNECTION
// ============================================================

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "pet_platform",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// ============================================================
// HELPER FUNCTION
// ============================================================

async function petExists(petId) {
    const [rows] = await db.query(
        "SELECT Pet_id FROM pet WHERE Pet_id = ?",
        [petId]
    );

    return rows.length > 0;
}


// ============================================================
// EXISTING PET API
// ============================================================

app.get("/pet", async (req, res) => {
    try {
        res.set("Cache-Control", "no-store");

        const [rows] = await db.query(`
            SELECT
                p.*,
                u.Name AS Owner_name
            FROM pet p
            LEFT JOIN user u
                ON p.Owner_id = u.User_id
            ORDER BY p.Pet_id
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to load pets"
        });
    }
});


// ============================================================
// FEATURE 1
// KEEP VACCINATION AND MEDICAL RECORDS
// ============================================================


// ------------------------------------------------------------
// GET ALL HEALTH RECORDS FOR A PET
// ------------------------------------------------------------

app.get("/pets/:petId/health", async (req, res) => {

    try {

        const petId = Number(req.params.petId);

        if (!Number.isInteger(petId)) {
            return res.status(400).json({
                error: "Invalid pet ID"
            });
        }


        // Get pet

        const [petRows] = await db.query(`
            SELECT *
            FROM pet
            WHERE Pet_id = ?
        `, [petId]);


        if (petRows.length === 0) {
            return res.status(404).json({
                error: "Pet not found"
            });
        }


        // Get vaccination records

        const [vaccinations] = await db.query(`
            SELECT
                Vaccination_name,
                Pet_id,
                Initial_date,
                Next_due_date
            FROM vaccination
            WHERE Pet_id = ?
            ORDER BY Next_due_date ASC
        `, [petId]);


        // Get medical records

        const [medicalRecords] = await db.query(`
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


        res.json({
            pet: petRows[0],
            vaccinations: vaccinations,
            medicalRecords: medicalRecords
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to load health records"
        });

    }

});


// ------------------------------------------------------------
// GET VACCINATION RECORDS
// ------------------------------------------------------------

app.get("/pets/:petId/vaccinations", async (req, res) => {

    try {

        const petId = Number(req.params.petId);

        if (!Number.isInteger(petId)) {

            return res.status(400).json({
                error: "Invalid pet ID"
            });

        }


        if (!(await petExists(petId))) {

            return res.status(404).json({
                error: "Pet not found"
            });

        }


        const [rows] = await db.query(`
            SELECT
                Vaccination_name,
                Pet_id,
                Initial_date,
                Next_due_date,

                CASE

                    WHEN Next_due_date < CURDATE()
                    THEN 'Overdue'

                    WHEN Next_due_date <=
                        DATE_ADD(CURDATE(), INTERVAL 30 DAY)

                    THEN 'Due Soon'

                    ELSE 'Up to Date'

                END AS vaccine_status

            FROM vaccination

            WHERE Pet_id = ?

            ORDER BY Next_due_date ASC

        `, [petId]);


        res.json(rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to load vaccination records"
        });

    }

});


// ------------------------------------------------------------
// ADD VACCINATION RECORD
// ------------------------------------------------------------

app.post("/pets/:petId/vaccinations", async (req, res) => {

    try {

        const petId = Number(req.params.petId);

        const {
            vaccination_name,
            initial_date,
            next_due_date
        } = req.body;


        if (!Number.isInteger(petId)) {

            return res.status(400).json({
                error: "Invalid pet ID"
            });

        }


        if (
            !vaccination_name ||
            !initial_date ||
            !next_due_date
        ) {

            return res.status(400).json({

                error:
                    "Vaccination name, initial date and next due date are required"

            });

        }


        if (!(await petExists(petId))) {

            return res.status(404).json({
                error: "Pet not found"
            });

        }


        /*
         Your existing vaccination table uses
         Vaccination_name + Pet_id.

         Therefore we use INSERT ... ON DUPLICATE KEY UPDATE.
        */

        await db.query(`

            INSERT INTO vaccination
            (
                Vaccination_name,
                Pet_id,
                Initial_date,
                Next_due_date
            )

            VALUES (?, ?, ?, ?)

            ON DUPLICATE KEY UPDATE

                Initial_date = VALUES(Initial_date),
                Next_due_date = VALUES(Next_due_date)

        `, [
            vaccination_name,
            petId,
            initial_date,
            next_due_date
        ]);


        /*
         Keep the vaccination information already
         present in the pet table updated.
        */

        await db.query(`

            UPDATE pet

            SET
                Vaccine_name = ?,
                Due_date = ?

            WHERE Pet_id = ?

        `, [
            vaccination_name,
            next_due_date,
            petId
        ]);


        res.status(201).json({

            message:
                "Vaccination record saved successfully"

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to save vaccination record"
        });

    }

});


// ------------------------------------------------------------
// GET MEDICAL RECORDS
// ------------------------------------------------------------

app.get("/pets/:petId/medical", async (req, res) => {

    try {

        const petId = Number(req.params.petId);


        if (!Number.isInteger(petId)) {

            return res.status(400).json({
                error: "Invalid pet ID"
            });

        }


        if (!(await petExists(petId))) {

            return res.status(404).json({
                error: "Pet not found"
            });

        }


        const [rows] = await db.query(`

            SELECT

                Medical_id,
                Checkup_date,
                Pet_id,
                Diagnosis,
                Treatment_status

            FROM medical_record

            WHERE Pet_id = ?

            ORDER BY
                Checkup_date DESC

        `, [petId]);


        res.json(rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to load medical records"
        });

    }

});


// ------------------------------------------------------------
// ADD MEDICAL RECORD
// ------------------------------------------------------------

app.post("/pets/:petId/medical", async (req, res) => {

    try {

        const petId = Number(req.params.petId);


        const {
            checkup_date,
            diagnosis,
            treatment_status
        } = req.body;


        if (!Number.isInteger(petId)) {

            return res.status(400).json({
                error: "Invalid pet ID"
            });

        }


        if (
            !checkup_date ||
            !diagnosis ||
            !treatment_status
        ) {

            return res.status(400).json({

                error:
                    "Checkup date, diagnosis and treatment status are required"

            });

        }


        if (!(await petExists(petId))) {

            return res.status(404).json({
                error: "Pet not found"
            });

        }


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
            checkup_date,
            petId,
            diagnosis,
            treatment_status
        ]);


        res.status(201).json({

            message:
                "Medical record added successfully",

            medical_id:
                result.insertId

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to add medical record"
        });

    }

});


// ============================================================
// FEATURE 2
// FIND NEARBY VETERINARIANS
// ============================================================


// ------------------------------------------------------------
// GET ALL VETERINARIANS
// ------------------------------------------------------------

app.get("/veterinarians", async (req, res) => {

    try {

        const {
            city,
            area
        } = req.query;


        let sql = `

            SELECT *

            FROM veterinarian

            WHERE 1 = 1

        `;


        const params = [];


        // Search by city

        if (city) {

            sql += `

                AND LOWER(City)
                = LOWER(?)

            `;

            params.push(city);

        }


        // Search by area/address

        if (area) {

            sql += `

                AND LOWER(Street_Address)
                LIKE LOWER(?)

            `;

            params.push(`%${area}%`);

        }


        sql += `

            ORDER BY Clinic_Name ASC

        `;


        const [rows] =
            await db.query(
                sql,
                params
            );


        res.json(rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                "Failed to load veterinarians"

        });

    }

});


// ------------------------------------------------------------
// FIND NEARBY VETERINARIANS
//
// NOTE:
// This endpoint uses the latitude/longitude columns ONLY IF
// your existing veterinarian table already has them.
//
// If your existing SQL does NOT have Latitude/Longitude,
// use /veterinarians?city=Dhaka&area=Dhanmondi instead.
// ------------------------------------------------------------

app.get("/veterinarians/nearby", async (req, res) => {

    try {

        const lat =
            Number(req.query.lat);

        const lng =
            Number(req.query.lng);

        const radius =
            Number(req.query.radius || 10);


        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            !Number.isFinite(radius)
        ) {

            return res.status(400).json({

                error:
                    "Valid latitude, longitude and radius are required"

            });

        }


        /*
         IMPORTANT:

         This query assumes your EXISTING veterinarian table
         already contains Latitude and Longitude.

         If it does not, use the city/area endpoint above.
        */

        const [rows] = await db.query(`

            SELECT

                *,

                (
                    6371 *

                    ACOS(

                        LEAST(
                            1,

                            GREATEST(

                                -1,

                                COS(RADIANS(?))

                                *

                                COS(RADIANS(Latitude))

                                *

                                COS(

                                    RADIANS(Longitude)
                                    -
                                    RADIANS(?)

                                )

                                +

                                SIN(RADIANS(?))

                                *

                                SIN(RADIANS(Latitude))

                            )

                        )

                    )

                ) AS distance_km


            FROM veterinarian


            WHERE

                Latitude IS NOT NULL

                AND Longitude IS NOT NULL


            HAVING

                distance_km <= ?


            ORDER BY
                distance_km ASC

        `, [
            lat,
            lng,
            lat,
            radius
        ]);


        res.json(rows);


    } catch (error) {

        console.error(error);

        /*
         If Latitude/Longitude do not exist in your
         existing SQL, this endpoint will return an error.
        */

        res.status(500).json({

            error:
                "Nearby search requires Latitude and Longitude columns in the existing veterinarian table."

        });

    }

});


// ============================================================
// FEATURE 3
// REPORT LOST AND FOUND PETS
// ============================================================


// ------------------------------------------------------------
// GET ALL PET REPORTS
// ------------------------------------------------------------

app.get("/pet-reports", async (req, res) => {

    try {

        const {
            type,
            status,
            city,
            area
        } = req.query;


        let sql = `

            SELECT

                pr.*,

                p.Name AS Pet_name,
                p.Species,
                p.Gender,

                u.Name AS Reporter_name,
                u.Phone AS Reporter_phone,
                u.Email AS Reporter_email


            FROM pet_report pr


            LEFT JOIN pet p

                ON pr.Pet_ID = p.Pet_id


            LEFT JOIN user u

                ON pr.User_ID = u.User_id


            WHERE 1 = 1

        `;


        const params = [];


        // Lost / Found filter

        if (type) {

            sql += `

                AND LOWER(pr.Report_Type)
                = LOWER(?)

            `;

            params.push(type);

        }


        // Status filter

        if (status) {

            sql += `

                AND LOWER(pr.Status)
                = LOWER(?)

            `;

            params.push(status);

        }


        // City filter

        if (city) {

            sql += `

                AND LOWER(pr.City)
                = LOWER(?)

            `;

            params.push(city);

        }


        // Area filter

        if (area) {

            sql += `

                AND LOWER(pr.AreaName)
                LIKE LOWER(?)

            `;

            params.push(`%${area}%`);

        }


        sql += `

            ORDER BY

                pr.Report_Date DESC,
                pr.Report_ID DESC

        `;


        const [rows] =
            await db.query(
                sql,
                params
            );


        res.json(rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                "Failed to load pet reports"

        });

    }

});


// ------------------------------------------------------------
// GET ONE PET REPORT
// ------------------------------------------------------------

app.get("/pet-reports/:reportId", async (req, res) => {

    try {

        const reportId =
            Number(req.params.reportId);


        if (!Number.isInteger(reportId)) {

            return res.status(400).json({

                error:
                    "Invalid report ID"

            });

        }


        const [rows] =
            await db.query(`

                SELECT

                    pr.*,

                    p.Name AS Pet_name,
                    p.Species,
                    p.Gender,
                    p.Color,
                    p.Breed_Name,

                    u.Name AS Reporter_name,
                    u.Phone AS Reporter_phone,
                    u.Email AS Reporter_email


                FROM pet_report pr


                LEFT JOIN pet p

                    ON pr.Pet_ID = p.Pet_id


                LEFT JOIN user u

                    ON pr.User_ID = u.User_id


                WHERE

                    pr.Report_ID = ?

            `, [
                reportId
            ]);


        if (rows.length === 0) {

            return res.status(404).json({

                error:
                    "Pet report not found"

            });

        }


        res.json(rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                "Failed to load pet report"

        });

    }

});


// ------------------------------------------------------------
// CREATE LOST / FOUND PET REPORT
// ------------------------------------------------------------

app.post("/pet-reports", async (req, res) => {

    try {

        const {

            last_seen_date,
            description,

            user_id,
            pet_id,

            report_type,
            status,
            report_date,

            pet_pic_url,
            identifying_mark,

            zip_code,
            city,
            area_name,

            share_location_url

        } = req.body;


        // Report type must be Lost or Found

        if (
            !report_type ||
            !["Lost", "Found"].includes(report_type)
        ) {

            return res.status(400).json({

                error:
                    "Report type must be Lost or Found"

            });

        }


        // Required fields

        if (
            !description ||
            !city ||
            !area_name
        ) {

            return res.status(400).json({

                error:
                    "Description, city and area are required"

            });

        }


        // Check user if provided

        if (user_id != null) {

            const [users] =
                await db.query(`

                    SELECT User_id

                    FROM user

                    WHERE User_id = ?

                `, [
                    user_id
                ]);


            if (users.length === 0) {

                return res.status(400).json({

                    error:
                        "User not found"

                });

            }

        }


        // Check pet if provided

        if (pet_id != null) {

            if (
                !(await petExists(
                    Number(pet_id)
                ))
            ) {

                return res.status(400).json({

                    error:
                        "Pet not found"

                });

            }

        }


        const finalStatus =
            status || "Open";


        const finalReportDate =
            report_date ||
            new Date()
                .toISOString()
                .slice(0, 10);


        const [result] =
            await db.query(`

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

                (

                    ?,
                    ?,

                    ?,
                    ?,

                    ?,
                    ?,
                    ?,

                    ?,
                    ?,

                    ?,
                    ?,
                    ?,

                    ?

                )

            `, [

                last_seen_date || null,
                description,

                user_id || null,
                pet_id || null,

                report_type,
                finalStatus,
                finalReportDate,

                pet_pic_url || null,
                identifying_mark || null,

                zip_code || null,
                city,
                area_name,

                share_location_url || null

            ]);


        const [newReport] =
            await db.query(`

                SELECT *

                FROM pet_report

                WHERE Report_ID = ?

            `, [
                result.insertId
            ]);


        res.status(201).json({

            message:
                `${report_type} pet report created successfully`,

            report:
                newReport[0]

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                "Failed to create pet report"

        });

    }

});


// ------------------------------------------------------------
// UPDATE LOST/FOUND REPORT STATUS
// ------------------------------------------------------------

app.patch(
    "/pet-reports/:reportId/status",
    async (req, res) => {

        try {

            const reportId =
                Number(req.params.reportId);

            const {
                status
            } = req.body;


            if (!Number.isInteger(reportId)) {

                return res.status(400).json({

                    error:
                        "Invalid report ID"

                });

            }


            if (!status) {

                return res.status(400).json({

                    error:
                        "Status is required"

                });

            }


            const [result] =
                await db.query(`

                    UPDATE pet_report

                    SET Status = ?

                    WHERE Report_ID = ?

                `, [
                    status,
                    reportId
                ]);


            if (result.affectedRows === 0) {

                return res.status(404).json({

                    error:
                        "Pet report not found"

                });

            }


            res.json({

                message:
                    "Pet report status updated successfully"

            });


        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Failed to update report status"

            });

        }

    }
);


// ============================================================
// DATABASE HEALTH CHECK
// ============================================================

app.get("/api/health", async (req, res) => {

    try {

        await db.query("SELECT 1");

        res.json({

            status: "OK",

            database: "Connected"

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            status: "ERROR",

            database: "Disconnected"

        });

    }

});


// ============================================================
// 404
// ============================================================

app.use((req, res) => {

    res.status(404).json({

        error:
            "Endpoint not found"

    });

});


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});