// Your Firebase configuration
const firebaseConfig = {
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

let registrationInProgress = false;
let registrationTimeout;

document.addEventListener('DOMContentLoaded',() => {
    console.log('Initial state:', document.getElementById('serenity-group').classList.contains('hidden'));
    document.getElementById('send-otp-button').addEventListener('click', sendOtp);
    document.getElementById('verify-otp-button').addEventListener('click', verifyOtp);
    document.getElementById('resend-otp-button').addEventListener('click', resendOtp);
    document.getElementById('register-button').addEventListener('click', register);
    hideLoadingIndicator();


    // Initialize reCAPTCHA
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
            console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
            alert('reCAPTCHA expired, please try again.');
            window.recaptchaVerifier.render().then(widgetId => {
                window.recaptchaWidgetId = widgetId;
            });
        }
    });

    recaptchaVerifier.render().then((widgetId) => {
        window.recaptchaWidgetId = widgetId;
    });

    // Set up authentication state listener
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("User is authenticated", user);
        } else {
            console.log("No user is signed in.");
        }
    });
   /* window.addEventListener('beforeunload', async (event) => {
        const user = auth.currentUser;

        if (user && !registrationCompleted) {
            try {
                // Call the Cloud Function to delete the user on page unload
                const accountDeletion = firebase.functions().httpsCallable('AccountDeletion');
                await accountDeletion({ uid: user.uid });
                console.log('User deletion initiated due to page unload.');
            } catch (error) {
                console.error('Error initiating account deletion on page unload:', error);
            }
        }
    });*/
});

let confirmationResult;
let otpTimeout;

function showLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'block';
}

function hideLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'none';
}

async function sendOtp() {
    showLoadingIndicator();
    const phone = document.getElementById('register-phone').value;
    const phoneMessage = document.getElementById('phone-message');
    phoneMessage.textContent = ''; // Clear any previous message
    const otpMessage = document.getElementById('otp-message');
    otpMessage.textContent = ''; // Clear any previous message

    if (!phone || !/^\d{10}$/.test(phone)) {
        phoneMessage.textContent = 'Please enter a valid 10-digit Indian phone number';
        hideLoadingIndicator();
        return;
    }

    const fullPhoneNumber = `+91${phone}`;

    try {
        // Check if the phone number already exists
        const checkPhoneExists = firebase.functions().httpsCallable('checkPhoneExists');
        const result = await checkPhoneExists({ phoneNumber: fullPhoneNumber });
        if (result.data.exists) {
            phoneMessage.textContent = 'Phone number already in use';
            hideLoadingIndicator();
            return;
        }

        const appVerifier = window.recaptchaVerifier;

        auth.signInWithPhoneNumber(fullPhoneNumber, appVerifier)
            .then((result) => {
                confirmationResult = result;
                console.log('OTP sent successfully', result);
                document.getElementById('otp-group').classList.remove('hidden');
                document.getElementById('send-otp-button').classList.add('hidden');
                otpMessage.textContent = `OTP sent to ${fullPhoneNumber}`;

                otpTimeout = setTimeout(() => {
                    document.getElementById('resend-otp-button').classList.remove('hidden');
                }, 30000);
                hideLoadingIndicator();
            })
            .catch((error) => {
                console.error('Error sending OTP:', error);
                handleError(error, otpMessage);
                window.recaptchaVerifier.render().then(widgetId => {
                    window.recaptchaWidgetId = widgetId;
                });
                hideLoadingIndicator();
            });
    } catch (error) {
        console.error('Error checking phone number:', error);
        phoneMessage.textContent = 'Failed to check phone number';
        hideLoadingIndicator();
    }
}

async function verifyOtp() {
    showLoadingIndicator();
    const otp = document.getElementById('otp').value;
    const otpMessage = document.getElementById('otp-message');
    if (!otp) {
        otpMessage.textContent = 'Please enter the OTP';
        hideLoadingIndicator();
        return;
    }

    try {
        const result = await confirmationResult.confirm(otp);
        console.log('OTP verified successfully', result);

        const user = result.user;
            const accountDeletion = firebase.functions().httpsCallable('AccountDeletion');
            await accountDeletion({ uid: user.uid });

            // Update UI elements to show registration form
            document.getElementById('otp-group').classList.add('hidden');
            document.getElementById('email-group').classList.remove('hidden');
            document.getElementById('username-group').classList.remove('hidden');
            document.getElementById('password-group').classList.remove('hidden');
            document.getElementById('register-button').classList.remove('hidden');
            document.getElementById('serenity-group').classList.remove('hidden');
            otpMessage.textContent = 'OTP verified successfully!';

            document.getElementById('register-phone').disabled = true;
            document.getElementById('send-otp-button').disabled = true;
            document.getElementById('verify-otp-button').disabled = true;
            clearTimeout(otpTimeout); // Clear the timeout if OTP is verified

            registrationTimeout = setTimeout(() => {
                redirectToLogin();
            }, 4 * 60 * 1000);
            hideLoadingIndicator();
        }catch(error){
            handleError(error, otpMessage);
            console.error('Error verifying OTP:', error);

            document.getElementById('resend-otp-button').classList.remove('hidden');
            hideLoadingIndicator();
        }
}

async function resendOtp() {
    showLoadingIndicator();
    const phone = document.getElementById('register-phone').value;
    const otpMessage = document.getElementById('otp-message');
    otpMessage.textContent = ''; // Clear any previous message

    if (!phone || !/^\d{10}$/.test(phone)) {
        otpMessage.textContent = 'Please enter a valid 10-digit Indian phone number';
        hideLoadingIndicator();
        return;
    }

    const fullPhoneNumber = `+91${phone}`;
    otpMessage.textContent = ''; // Clear any previous message

    try {
        // Check if the phone number already exists
        const checkPhoneExists = firebase.functions().httpsCallable('checkPhoneExists');
        const result = await checkPhoneExists({ phoneNumber: fullPhoneNumber });
        if (result.data.exists) {
            otpMessage.textContent = 'Phone number already in use';
            hideLoadingIndicator();
            return;
        }

        const appVerifier = window.recaptchaVerifier;

        auth.signInWithPhoneNumber(fullPhoneNumber, appVerifier)
            .then((result) => {
                confirmationResult = result;
                console.log('OTP sent successfully', result);
                document.getElementById('resend-otp-button').classList.add('hidden');
                document.getElementById('verify-otp-button').classList.remove('hidden');
                otpMessage.textContent = `OTP sent to ${fullPhoneNumber}`;
                hideLoadingIndicator();
            })
            .catch((error) => {
                console.error('Error resending OTP:', error);
                handleError(error, otpMessage);
                window.recaptchaVerifier.render().then(widgetId => {
                    window.recaptchaWidgetId = widgetId;
                });
                hideLoadingIndicator();
            });
    } catch (error) {
        console.error('Error checking phone number:', error);
        otpMessage.textContent = 'Failed to check phone number';
        hideLoadingIndicator();
    }
}

async function register() {
    showLoadingIndicator();
    const email = document.getElementById('register-email').value;
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const phone = document.getElementById('register-phone').value;
    const fullPhoneNumber = `+91${phone}`;
    const registerMessage = document.getElementById('register-message');
    const serenity = document.getElementById('serenity-checkbox').checked;

    if (!email || !username || !password || !phone) {
        alert('Please fill in all the fields');
        hideLoadingIndicator();
        return;
    }

    if (username.length < 6) {
        alert('Username must be at least 6 characters long');
        hideLoadingIndicator();
        return;
    }

    if (!validatePassword(password)) {
        alert('Password must be at least 8 characters long.');
        hideLoadingIndicator();
        return;
    }

    if (!auth.currentUser) {
        alert('Please verify your phone number first.');
        hideLoadingIndicator();
        return;
    }

    try {
        // Create an email credential
        const emailCredential = firebase.auth.EmailAuthProvider.credential(email, password);

        // Link the email credential to the current phone number user
        await auth.currentUser.linkWithCredential(emailCredential);
        console.log('Email and password linked successfully');
        const cancelDeletion = firebase.functions().httpsCallable('cancelAccountDelete');
        await cancelDeletion({ uid: auth.currentUser.uid });

        // Save username and phoneNumber in Firestore AFTER successful email linking
        await db.collection('users').doc(auth.currentUser.uid).set({
            username: username,
            phoneNumber: fullPhoneNumber,
            serenity: serenity, // Save phone number after successful email link
        });

        registerMessage.textContent = 'Registration successful!';
        registrationInProgress = false; // Registration is complete
        registrationCompleted = true; // Mark registration as completed
        clearTimeout(registrationTimeout);

        setTimeout(() => {
            window.location.href = './login.html';
        }, 2000);
        hideLoadingIndicator();
    } catch (error) {
        console.error('Error during registration:', error);
        handleError(error, registerMessage);
        hideLoadingIndicator();
    }
}
function redirectToLogin() {
    if (!registrationCompleted) {
        alert('Session expired. Redirecting to login page.');
        auth.signOut().then(() => {
            window.location.href = './login.html';
        }).catch((error) => {
            console.error('Error signing out:', error);
        });
    }
}

function validatePassword(password) {
    return password.length >= 8;
}

function handleError(error, messageElement) {
    let errorMessage = 'An error occurred. Please try again.';
    switch (error.code) {
        case 'auth/invalid-phone-number':
            errorMessage = 'Invalid phone number format.';
            break;
        case 'auth/invalid-verification-code':
            errorMessage = 'Invalid verification code.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many requests. Please try again later.';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Check your internet connection.';
            break;
        case 'auth/email-already-in-use':
            errorMessage = 'The email address is already in use by another account.';
            break;
        case 'auth/invalid-email':
            errorMessage = 'The email address is invalid.';
            break;
        default:
            errorMessage = error.message;
    }
    alert(errorMessage);
    messageElement.textContent = errorMessage;
}

