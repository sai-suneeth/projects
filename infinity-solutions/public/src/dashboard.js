document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const firestore = firebase.firestore();

    const dashboardSection = document.getElementById('dashboard');
    const transactionsSection = document.getElementById('transactions');
    const accountSettingsSection = document.getElementById('account-settings');
    const logoutSection = document.getElementById('logout');
    const menuItems = document.querySelectorAll('.menu-item');
    const bookingButton = document.getElementById('booking-button');
    const consoleMessages = document.getElementById('console-messages');
    const userNameDisplay = document.querySelector('.user-name');
    const logoutButton = document.getElementById('logout-button');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const body = document.body;

    const changeEmailButton = document.getElementById('change-email-button');
    const changeEmailDialog = document.getElementById('change-email-dialog');
    const closeEmailDialog = document.getElementById('close-email-dialog');
    const verifyEmailButton = document.getElementById('verify-email-button');
    const newEmailInput = document.getElementById('new-email');
    const updateUsernameButton = document.getElementById('update-username-button');
    const newUsernameInput = document.getElementById('new-username');
    const changeUsernameButton = document.getElementById('change-username-button');
    const changeUsernameDialog = document.getElementById('change-username-dialog');

    const sections = {
        'dashboard': dashboardSection,
        'transactions': transactionsSection,
        'account-settings': accountSettingsSection,
        'logout': logoutSection,
    };

    // Set dashboard as the initial active section
    dashboardSection.classList.add('active');

    // Toggle sections
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            Object.values(sections).forEach(section => section.classList.remove('active'));
            sections[target].classList.add('active');
            sidebar.classList.remove('active'); // Hide sidebar after selection
        });
        item.addEventListener('mousedown', () => item.classList.add('pressed'));
        item.addEventListener('mouseup', () => item.classList.remove('pressed'));
    });

    changeUsernameButton.addEventListener('click', () => {
        changeUsernameDialog.style.display = 'block';
    });

    // Close the dialog when close button is clicked
    const closeUsernameDialog = document.getElementById('close-username-dialog');
    closeUsernameDialog.addEventListener('click', () => {
        changeUsernameDialog.style.display = 'none';
    });

    function applyBackgroundClass() {
        if (window.innerWidth <= 768) {
            body.classList.add('mobile-background');
            body.classList.remove('desktop-background');
        } else {
            body.classList.add('desktop-background');
            body.classList.remove('mobile-background');
        }
    }

    // Apply the appropriate class on page load
    applyBackgroundClass();
    window.addEventListener('resize', applyBackgroundClass);

    // Booking button event listener
    bookingButton.addEventListener('click', () => {
        window.location.href = 'booking.html';
    });

    // Logout button event listener
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = './login.html';
        }).catch(error => {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        });
    });

    const userEmailDisplay = document.querySelector('.user-email');

    auth.onAuthStateChanged(user => {
        if (user) {
            const currentUserId = user.uid;
            firestore.collection("users").doc(currentUserId).get()
                .then(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        userNameDisplay.textContent = data.username || 'User'; // Display username from Firestore
                        userEmailDisplay.textContent = user.email || 'Email not available'; // Display email from Auth
                        addMessageToConsole(`Welcome, ${data.username}`);
                    } else {
                        console.error('User data not found');
                        alert('User data not found. Please log in again.');
                        window.location.href = './login.html'; // Redirect to login page
                    }
                })
                .catch(error => {
                    console.error('Error fetching user data:', error);
                    alert('Error fetching user data. Please try again.');
                });

            fetchBookings(currentUserId);
            fetchTransactions(currentUserId);
        } else {
            alert('Please log in to access the dashboard.');
            window.location.href = './login.html'; // Redirect to login page
        }
    });

    // Sidebar toggle event listener
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    // Close sidebar when clicking outside of it on mobile
    document.addEventListener('click', (event) => {
        const isClickInsideSidebar = sidebar.contains(event.target);
        const isClickInsideToggle = sidebarToggle.contains(event.target);

        if (!isClickInsideSidebar && !isClickInsideToggle && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });

    // Show change email dialog
    changeEmailButton.addEventListener('click', () => {
        changeEmailDialog.style.display = 'block';
    });

    // Close dialogs
    closeEmailDialog.addEventListener('click', () => {
        changeEmailDialog.style.display = 'none';
    });

    // Verify new email
    verifyEmailButton.addEventListener('click', () => {
        const newEmail = newEmailInput.value;
        if (newEmail) {
            auth.currentUser.verifyBeforeUpdateEmail(newEmail).then(() => {
                alert(`A verification email has been sent to ${newEmail}. Please verify to complete the email update.`);
                changeEmailDialog.style.display = 'none';
            }).catch(error => {
                if (error.code === 'auth/requires-recent-login') {
                    window.location.href = `./login.html?Redirect_Url=${window.location.hostname}/dashboard.html#accountsettings;`
                    return;
                }
                console.error('Error updating email:', error);
                alert('Error updating email. Please try again.');
            });
        } else {
            alert('Please enter a valid email address.');
        }
    });
        // Update username
        updateUsernameButton.addEventListener('click', () => {
            const newUsername = newUsernameInput.value;
            if (newUsername.length >= 6) {
                const user = auth.currentUser;
                const currentUserId = user.uid;
                firestore.collection("users").doc(currentUserId).update({
                    username: newUsername
                }).then(() => {
                    userNameDisplay.textContent = newUsername;
                    alert(`Username has been updated to ${newUsername}`);
                    changeUsernameDialog.style.display = 'none';
                }).catch(error => {
                    console.error('Error updating username:', error);
                    alert('Error updating username. Please try again.');
                });
            } else {
                alert('Username must be at least 6 characters.');
            }
        });


    // Fetch bookings from Firestore
    function fetchBookings(userId) {
        const bookingsList = document.getElementById('bookings-list');
        firestore.collection('transactions').doc(userId).collection('dashboardDetails')
            .get()
            .then(snapshot => {
                bookingsList.innerHTML = ''; // Clear existing bookings
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const startTime = new Date(data.start_time.seconds * 1000).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) + ' ' + new Date(data.start_time.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const endTime = new Date(data.end_time.seconds * 1000).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) + ' ' + new Date(data.end_time.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    bookingsList.innerHTML += `
                        <tr>
                            <td>${startTime}</td>
                            <td>${endTime}</td>
                            <td>${data.controllers}</td>
                        </tr>
                    `;
                });
            })
            .catch(error => {
                console.error('Error fetching bookings:', error);
                addMessageToConsole('Error fetching bookings. Please try again.');
            });
    }

    // Fetch transactions from Firestore
    function fetchTransactions(userId) {
        const transactionsList = document.getElementById('transactions-list');
        firestore.collection('transactions').doc(userId).collection('dashboardDetails')
            .get()
            .then(snapshot => {
                transactionsList.innerHTML = ''; // Clear existing transactions
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.status !== 'failed') { // Filter out failed transactions
                        const startTime = new Date(data.start_time.seconds * 1000).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) + ' ' + new Date(data.start_time.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const endTime = new Date(data.end_time.seconds * 1000).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) + ' ' + new Date(data.end_time.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const bookingTime = new Date(data.end_time.seconds * 1000).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) + ' ' + new Date(data.end_time.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        transactionsList.innerHTML += `
                            <tr>
                                <td>${startTime}</td>
                                <td>${endTime}</td>
                                <td>${data.price}</td>
                                <td>${bookingTime}</td>
                            </tr>
                        `;
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching transactions:', error);
                addMessageToConsole('Error fetching transactions. Please try again.');
            });
    }

    function addMessageToConsole(message) {
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        if (isMobile) {
            const messageElement = document.createElement('div');
            messageElement.textContent = message;
            messageElement.style.color = 'red';
            messageElement.style.position = 'fixed';
            messageElement.style.bottom = '20px';
            messageElement.style.left = '20px';
            messageElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            messageElement.style.padding = '10px';
            messageElement.style.borderRadius = '5px';
            document.body.appendChild(messageElement);

            // Remove message after 4 seconds
            setTimeout(() => {
                messageElement.remove();
            }, 4000);
        } else {
            const messageElement = document.createElement('div');
            messageElement.textContent = message;
            messageElement.style.color = 'red';
            consoleMessages.appendChild(messageElement);
        }
    }

    // Example usage
    addMessageToConsole('Dashboard loaded successfully.');
    addMessageToConsole('User authenticated.');
});

