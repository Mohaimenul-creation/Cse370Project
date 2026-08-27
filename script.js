// ==========================================
// FIND MY PAW - script.js
// ==========================================

console.log("Find My Paw JavaScript is working!");


// ==========================================
// 1. TEST BACKEND CONNECTION
// ==========================================

async function testBackend() {
    try {
        const response = await fetch("/api/test");

        const data = await response.json();

        console.log("Backend response:", data);

    } catch (error) {
        console.error("Backend connection failed:", error);
    }
}


// ==========================================
// 2. GET PETS
// ==========================================

async function loadPets() {
    try {
        const response = await fetch("/pet");

        const pets = await response.json();

        console.log("Pets from database:", pets);

        return pets;

    } catch (error) {
        console.error("Could not load pets:", error);
    }
}


// ==========================================
// 3. UPCOMING VACCINATIONS
// ==========================================

async function loadUpcomingVaccinations() {
    try {
        const response = await fetch("/api/health/upcoming");

        const data = await response.json();

        console.log("Upcoming vaccinations:", data);

        return data;

    } catch (error) {
        console.error(
            "Could not load vaccination records:",
            error
        );
    }
}


// ==========================================
// 4. FIND VETERINARIANS
// ==========================================

async function findVeterinarians(city) {

    try {

        const response = await fetch(
            `/api/veterinarians?city=${encodeURIComponent(city)}`
        );

        const data = await response.json();

        console.log("Veterinarians:", data);

        return data;

    } catch (error) {

        console.error(
            "Could not find veterinarians:",
            error
        );

    }
}


// ==========================================
// 5. GET LOST / FOUND PET REPORTS
// ==========================================

async function loadPetReports() {

    try {

        const response = await fetch(
            "/api/pet-reports"
        );

        const reports = await response.json();

        console.log(
            "Lost/found pet reports:",
            reports
        );

        return reports;

    } catch (error) {

        console.error(
            "Could not load pet reports:",
            error
        );

    }
}


// ==========================================
// 6. REPORT A LOST/FOUND PET
// ==========================================

async function reportPet(reportData) {

    try {

        const response = await fetch(
            "/api/pet-reports",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(reportData)
            }
        );

        const result = await response.json();

        console.log(
            "Report submitted:",
            result
        );

        return result;

    } catch (error) {

        console.error(
            "Could not submit pet report:",
            error
        );

    }
}


// ==========================================
// RUN BASIC TESTS
// ==========================================

testBackend();

loadPets();
