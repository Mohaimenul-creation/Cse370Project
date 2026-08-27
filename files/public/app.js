function loadPets() {

    fetch("/pet")
    .then((res) => {
            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }
            return res.json();
        })
        .then((pet) => {

            const container = document.getElementById("pets");

            container.innerHTML =pet.map((pets)=> `
                <div class="pet">
                    <h3>${pets.Name}</h3>
                    <p>Pet ID: ${pets.Pet_id}</p>
                    
                </div>
            `).join("");

        })
        .catch(error => {
            console.log("Error:", error);
        });
}

function loadAdoptionAnalytics() {

    fetch("/analytics/adoption-breed")
        .then((res) => res.json())

        .then((data) => {

            const container =
                document.getElementById("adoptionAnalytics");

            container.innerHTML = data.map((breed) => `
                <div class="analytics">

                    <h3>${breed.Breed_Name}</h3>

                    <p>
                        Adoption Applications:
                        ${breed.Applications}
                    </p>

                </div>
            `).join("");

        })

        .catch(error => {
            console.log("Adoption analytics error:", error);
        });
}

function loadMedicalAnalytics() {

    fetch("/analytics/medical")
        .then((res) => res.json())

        .then((data) => {

            const container =
                document.getElementById("medicalAnalytics");

            container.innerHTML = data.map((pet) => `
                <div class="analytics">

                    <h3>${pet.Name}</h3>

                    <p>
                        Diagnosis:
                        ${pet.Diagnosis}
                    </p>

                    <p>
                        Medical Status:
                        ${pet.Treatment_status}
                    </p>

                    <p>
                        Pets with Same Status:
                        ${pet.Pets_with_same_status}
                    </p>

                    <p>
                        Total Medical Records:
                        ${pet.Total_medical_records}
                    </p>

                </div>
            `).join("");

        })

        .catch(error => {
            console.log("Medical analytics error:", error);
        });
}


function loadExpenseAnalytics() {

    fetch("/analytics/expenses")
        .then((res) => res.json())

        .then((data) => {

            const container =
                document.getElementById("expenseAnalytics");

            container.innerHTML = data.map((expense) => `
                <div class="analytics">

                    <h3>${expense.Category_name}</h3>

                    <p>
                        Total Spending:
                        ${expense.Total_spending}
                    </p>

                </div>
            `).join("");

        })

        .catch(error => {
            console.log("Expense analytics error:", error);
        });
}
