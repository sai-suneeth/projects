// Firebase configuration
const firebaseConfig = {
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginBtn');
    if (loginButton) {
        loginButton.addEventListener('click', function() {
            window.location.href = './login.html';
        });
    }
});

// Handle form submission
document.querySelector('.contact-form form').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Get form values
    const name = document.querySelector('input[name="Name"]').value;
    const phoneNumber = document.querySelector('input[name="Phone-number"]').value;
    const email = document.querySelector('input[name="email"]').value;
    const message = document.querySelector('textarea[name="message"]').value;

    try {
        // Fetch the documents to find the highest ID
        const querySnapshot = await db.collection('queries').get();

        // Find the highest numeric ID
        let newId = 1;
        querySnapshot.forEach(doc => {
            const docId = parseInt(doc.id);
            if (docId >= newId) {
                newId = docId + 1;
            }
        });

        // Add the new document with the incremented ID
        await db.collection('queries').doc(String(newId)).set({
            name: name,
            phoneNumber: phoneNumber,
            email: email,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Your message has been sent!');
        // Clear the form
        document.querySelector('.contact-form form').reset();

    } catch (error) {
        console.error('Error saving message: ', error);
        alert('Failed to send message. Please try again.');
    }
});

