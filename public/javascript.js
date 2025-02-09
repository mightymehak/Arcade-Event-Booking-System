document.addEventListener('DOMContentLoaded', () => {
    const eventImages = document.querySelectorAll('.event-img');
    eventImages.forEach((img, index) => {
        if (index === 0) {
            img.style.display = 'block'; 
        } else {
            img.style.display = 'none'; 
        }
    });
});

var navlinks = document.getElementById("navlinks");

        function showMenu(){
            navlinks.style.right = "0";
        }

        function hideMenu(){
            navlinks.style.right = "-200px";
        }

function toggleEvent(eventId) {
            const eventImages = document.querySelectorAll('.event-img');
            eventImages.forEach((img) => {
                img.style.display = 'none';
            });
        
            const eventImg = document.getElementById(eventId);
            eventImg.style.display = 'block';
        }

document.addEventListener("DOMContentLoaded", async () => {
            try {
                let response = await fetch("http://localhost:3000/api/user", {
                    credentials: "include",
                });
                let userData = await response.json();
        
                document.getElementById("username").textContent = userData.name;
                document.getElementById("email").textContent = userData.email;
                document.getElementById("phone").textContent = userData.phone;
        
                const passwordField = document.getElementById("password");
                const togglePasswordButton = document.getElementById("togglePassword");
        
                togglePasswordButton.addEventListener("click", () => {
                    if (passwordField.textContent === "********") {
                        passwordField.textContent = userData.normal_password;
                        togglePasswordButton.innerHTML = '<i class="fa fa-eye-slash"></i>';
                    } else {
                        passwordField.textContent = "********";
                        togglePasswordButton.innerHTML = '<i class="fa fa-eye"></i>';
                    }
                });
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        });
        