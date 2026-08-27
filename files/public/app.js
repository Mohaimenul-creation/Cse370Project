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
