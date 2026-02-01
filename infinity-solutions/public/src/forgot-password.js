// Initialize Firebase
var firebaseConfig = {

};
firebase.initializeApp(firebaseConfig);

let confirmationResult;
let otpTimeout;

// Get references to the elements
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const resetPasswordButton = document.getElementById('reset-password-button');
const messageElement = document.getElementById('message');

// Utility function to get URL parameters
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[[]]/g, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
          results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// Utility functions
function showLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'block';
}

function hideLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'none';
}

function handleError(error, element) {
    element.textContent = error.message;
}

// Password validation function
function validatePassword(password) {
    return password.length >= 8;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('send-phone-otp-button').addEventListener('click', sendOtp);
    document.getElementById('verify-otp-button').addEventListener('click', verifyOtp);
    document.getElementById('resend-otp-button').addEventListener('click', resendOtp);
    document.getElementById('send-email-otp-button').addEventListener('click', sendEmailOtp);
    document.getElementById('verify-phone-link').addEventListener('click', () => {
        document.getElementById('phone-group').classList.remove('hidden');
        document.getElementById('verify-phone-link').classList.add('hidden');
        document.getElementById('username-email-group').classList.add('hidden');
        document.getElementById('verify-email-link').classList.remove('hidden');
    });
    document.getElementById('verify-email-link').addEventListener('click', () => {
        document.getElementById('phone-group').classList.add('hidden');
        document.getElementById('username-email-group').classList.remove('hidden');
        document.getElementById('verify-phone-link').classList.remove('hidden');
    });
    document.getElementById('reset-password-button').addEventListener('click', resetPassword);

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

    // Check if there's an oobCode parameter in the URL
    const oobCode = getParameterByName('oobCode');
    const mode = getParameterByName('mode');
    if (oobCode && mode === 'resetPassword') {
        document.getElementById('forgot-password-section').classList.add('hidden');
        document.getElementById('reset-password-section').classList.remove('hidden');
        document.getElementById('verify-phone-link').classList.add('hidden');
    }
    hideLoadingIndicator();
});

async function sendOtp() {
    showLoadingIndicator();
    const phone = document.getElementById('forgot-phone').value.trim();
    const phoneMessage = document.getElementById('phone-message');
    const otpMessage = document.getElementById('otp-message');
    phoneMessage.textContent = ''; // Clear any previous message
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
            const appVerifier = window.recaptchaVerifier;

            firebase.auth().signInWithPhoneNumber(fullPhoneNumber, appVerifier)
                .then((result) => {
                    confirmationResult = result;
                    console.log('OTP sent successfully', result);
                    document.getElementById('otp-group').classList.remove('hidden');
                    document.getElementById('send-phone-otp-button').classList.add('hidden');
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
        } else {
            phoneMessage.textContent = 'User not registered.';
            hideLoadingIndicator();
        }
    } catch (error) {
        console.error('Error checking phone number:', error);
        phoneMessage.textContent = 'Failed to check phone number';
        hideLoadingIndicator();
    }
}

function verifyOtp() {
    showLoadingIndicator();
    const otp = document.getElementById('otp').value.trim();
    const otpMessage = document.getElementById('otp-message');
    otpMessage.textContent = ''; // Clear any previous message

    if (!otp) {
        otpMessage.textContent = 'Please enter the OTP';
        hideLoadingIndicator();
        return;
    }

    confirmationResult.confirm(otp)
        .then(async (result) => {
            console.log('OTP verified successfully', result);
            document.getElementById('otp-group').classList.add('hidden');
            otpMessage.textContent = 'OTP verified successfully!';
            document.getElementById('send-phone-otp-button').disabled = true;
            document.getElementById('verify-otp-button').disabled = true;
            clearTimeout(otpTimeout); // Clear the timeout if OTP is verified

            // Get email associated with the phone number
            const user = result.user;
            const email = user.email;

            if (email) {
                // Store email in local storage to use in reset-password.html
                localStorage.setItem('emailForPhoneReset', email);
                const linkedEmailElement = document.getElementById('linked-email');
                linkedEmailElement.textContent = `The email linked to this phone number is: ${email}`;
                linkedEmailElement.style.display = 'block';

                // Display the reset password form
                document.getElementById('forgot-password-section').classList.add('hidden');
                document.getElementById('reset-password-section').classList.remove('hidden');
                document.getElementById('verify-email-link').classList.add('hidden');
            } else {
                otpMessage.textContent = 'No email associated with this phone number.';
            }

            hideLoadingIndicator();
        })
        .catch((error) => {
            handleError(error, otpMessage);
            console.error('Error verifying OTP:', error);

            document.getElementById('resend-otp-button').classList.remove('hidden');
            hideLoadingIndicator();
        });
}

async function resendOtp() {
    showLoadingIndicator();
    const phone = document.getElementById('forgot-phone').value.trim();
    const phoneMessage = document.getElementById('phone-message');
    const otpMessage = document.getElementById('otp-message');
    phoneMessage.textContent = ''; // Clear any previous message
    otpMessage.textContent = ''; // Clear any previous message

    const fullPhoneNumber = `+91${phone}`;

    try {
        const appVerifier = window.recaptchaVerifier;

        firebase.auth().signInWithPhoneNumber(fullPhoneNumber, appVerifier)
            .then((result) => {
                confirmationResult = result;
                console.log('OTP resent successfully', result);
                document.getElementById('resend-otp-button').classList.remove('hidden');
                otpMessage.textContent = `OTP resent to ${fullPhoneNumber}`;
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
        console.error('Error resending OTP:', error);
        phoneMessage.textContent = 'Failed to resend OTP';
        hideLoadingIndicator();
    }
}

function sendEmailOtp() {
    showLoadingIndicator();
    const email = document.getElementById('forgot-username-email').value.trim();
    const messageElement = document.getElementById('message');

    if (email === '') {
        messageElement.textContent = 'Please enter an email address.';
        hideLoadingIndicator();
        return;
    }

    // Check if the email is registered
    firebase.auth().fetchSignInMethodsForEmail(email)
        .then(function(signInMethods) {
            if (signInMethods.length === 0) {
                // Email is not registered
                hideLoadingIndicator();
                messageElement.textContent = 'User not registered.';
            } else {
                // Email is registered, send password reset email
                firebase.auth().sendPasswordResetEmail(email)
                    .then(function() {
                        hideLoadingIndicator();
                        messageElement.textContent = 'Verification link has been sent to your email to reset your password.';
                        document.getElementById('send-email-otp-button').classList.add('hidden');
                        document.getElementById('verify-phone-link').classList.add('hidden');
                        document.getElementById('verify-email-link').classList.remove('hidden');
                        setTimeout(function() {
                            window.location.href = './login.html';
                        }, 5000);
                    })
                    .catch(function(error) {
                        hideLoadingIndicator();
                        messageElement.textContent = error.message;
                    });
            }
        })
        .catch(function(error) {
            hideLoadingIndicator();
            messageElement.textContent = error.message;
        });
}

function resetPassword() {
    showLoadingIndicator();
    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (newPassword === '' || confirmPassword === '') {
        messageElement.textContent = 'Please enter and confirm your new password.';
        hideLoadingIndicator();
        return;
    }

    if (!validatePassword(newPassword)) {
        messageElement.textContent = 'Password must be at least 8 characters long.';
        hideLoadingIndicator();
        return;
    }

    if (newPassword !== confirmPassword) {
        messageElement.textContent = 'Passwords do not match.';
        hideLoadingIndicator();
        return;
    }

    const oobCode = getParameterByName('oobCode');
    if (oobCode) {
        resetPasswordWithEmail(oobCode, newPassword);
    } else {
        const email = localStorage.getItem('emailForPhoneReset');
        if (!email) {
            messageElement.textContent = 'No email found for phone verification. Please retry the process.';
            hideLoadingIndicator();
            return;
        }
        resetPasswordWithPhone(newPassword);
    }
}

// Function to reset password using email link
function resetPasswordWithEmail(oobCode, newPassword) {
    firebase.auth().confirmPasswordReset(oobCode, newPassword)
        .then(() => {
            messageElement.textContent = 'Password has been reset successfully. Redirecting to login...';
            // Redirect to login page after 5 seconds
            setTimeout(() => {
                window.location.href = './login.html';
            }, 5000);
        })
        .catch((error) => {
            messageElement.textContent = `Error resetting password: ${error.message}`;
            hideLoadingIndicator();
        });
}

// Function to reset password using phone verification
function resetPasswordWithPhone(newPassword) {
    const user = firebase.auth().currentUser;
    if (user) {
        user.updatePassword(newPassword)
            .then(() => {
                messageElement.textContent = 'Password has been reset successfully. Redirecting to login...';
                // Redirect to login page after 5 seconds
                setTimeout(() => {
                    window.location.href = './login.html';
                }, 3000);
            })
            .catch((error) => {
                messageElement.textContent = `Error resetting password: ${error.message}`;
                hideLoadingIndicator();
            });
    } else {
        messageElement.textContent = 'User is not authenticated. Please retry the process.';
        messageElement.textContent = `Error resetting password: ${error.message}`;
        hideLoadingIndicator();
    }
}

