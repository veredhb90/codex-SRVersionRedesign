const API_URL = "http://localhost:8000"; // your backend

function loginUser() {
    const email = document.getElementById("email").value;
    const pass  = document.getElementById("password").value;

    fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: pass })
    })
    .then(res => res.json())
    .then(data => {
        if (data.token) {
            localStorage.setItem("token", data.token);
            window.location.href = "dashboard.html";
        } else {
            document.getElementById("error-msg").innerText = "Invalid login";
        }
    });
}

function sendMessage() {
    const msg = document.getElementById("userInput").value;

    fetch(`${API_URL}/chatbot`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ message: msg })
    })
    .then(res => res.json())
    .then(data => {
        appendMessage("Bot: " + data.reply);
    });
}

function appendMessage(text) {
    const box = document.getElementById("messages");
    box.innerHTML += `<p>${text}</p>`;
    box.scrollTop = box.scrollHeight;
}
