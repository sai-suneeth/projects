var REDIRECT_URL = null;
// Your web app's Firebase configuration
const firebaseConfig = {
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-button').addEventListener('click', loginUser);
    document.getElementById('register-link').addEventListener('click', () => {
        window.location.href = './register.html';
    });
    document.getElementById('forgot-password-link').addEventListener('click', () => {
        window.location.href = './forgot-password.html';
    });
    document.getElementById('back-button').addEventListener('click', () => {
        window.location.href = './index.html'; // Redirect to index.html
    });
});

function loginUser() {
    const email = document.getElementById('login-email-phone').value;
    const password = document.getElementById('login-password').value;
    const message = document.getElementById('message');
    message.textContent = ''; // Clear any previous message

    if (!email || !password) {
        message.textContent = 'Please enter both email and password';
        return;
    }

    // Sign in with email and password
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            message.textContent = 'Login successful!';
            message.style.color = 'green';
            window.location.href = REDIRECT_URL;
        })
        .catch((error) => {
            console.error('Error logging in:', error);
            message.textContent = 'Invalid email or password';
        });

    function redirectToHomePage() {
        window.location.href = './dashboard.html';
    }
}
setTimeout(()=>{
    var params = new URLSearchParams(window.location.search);
    REDIRECT_URL = params.get('type') || './dashboard.html';

},200)
