document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {

    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const auth = firebase.auth();
    const firestore = firebase.firestore();
    const functions = firebase.functions();


    const slotsContainer = document.getElementById('slots');
    const bookButton = document.getElementById('book-button');
    const message = document.getElementById('message');
    const logoutButton = document.getElementById('logout-button');
    const dateButtonsContainer = document.getElementById('date-buttons');
    const dateButton1 = document.getElementById('date-button-1');
    const dateButton2 = document.getElementById('date-button-2');
    const dateButton3 = document.getElementById('date-button-3');
    const dateButton4 = document.getElementById('date-button-4');
    const dateButton5 = document.getElementById('date-button-5');
    const dateButton6 = document.getElementById('date-button-6');
    const dateButton7 = document.getElementById('date-button-7');
    const weekdaysButton = document.getElementById('weekdays-button');
    const weekendsButton = document.getElementById('weekends-button');



    let selectedSlots = [];
    let currentUserId = null;
    let selectedDuration = null;
    let selectedController = null;
    let slotStatus = {};
    let userData = null;
    let bookingPrice = null;
    let lockTimeout = null;
    let currentDateButton = null;
    let nextDaySlotsRequired = false;
    let currentFilter = 'weekdays';
    let initialSelection = false;
    let slotContainerOpen = false;
    let lastSelectedFilter = null;
    let isFirstSelection = true;
    let weekbuttonchange =false;
    let intervalTimer;

    function showDateButtons() {
        dateButtonsContainer.classList.remove('hidden');
    }

    function hideDateButtons() {
        dateButtonsContainer.classList.add('hidden');
    }


    function showLoadingIndicator() {
        document.getElementById('loading').style.display = 'block';
    }

    function hideLoadingIndicator() {
        document.getElementById('loading').style.display = 'none';
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            message.textContent = `Logged in as ${user.email}`;
            if (weekdaysButton) weekdaysButton.disabled = false;
            if (weekendsButton) weekendsButton.disabled = false;
            if (logoutButton) logoutButton.disabled = false;

            showLoadingIndicator();
            firestore.collection("users").doc(currentUserId).get()
                .then(doc => {
                    hideLoadingIndicator();
                    if (doc.exists) {
                        const data = doc.data();
                        userData = {
                            userName: data.username,
                            userPhone: data.phoneNumber,
                            userEmail: user.email
                        };

                        // Check if the user is an admin and enable the 15-minute button if so
                        const adminEmails = ['sakkurusai@gmail.com', 'venuvamsi2005@gmail.com'];
                        const duration10Button = document.getElementById('duration-10');
                        const duration15Button = document.getElementById('duration-15');
                        const duration30Button = document.getElementById('duration-30');
                        const duration40Button = document.getElementById('duration-40');

                        if (adminEmails.includes(userData.userEmail)) {
                            duration10Button.style.display = 'block';
                            duration15Button.style.display = 'block';
                            duration30Button.style.display = 'block';
                            duration40Button.style.display = 'block';
                        } else {
                            // Keep the 15-minute button disabled for non-admin users
                            duration10Button.style.display = 'none';
                            duration15Button.style.display = 'none';
                            duration30Button.style.display = 'none';
                            duration40Button.style.display = 'none';
                        }

                    } else {
                        console.error('User data not found');
                        alert('User data not found. Please log in again.');
                        window.location.href = './login.html'; // Redirect to login page
                    }
                })
                .catch(error => {
                    hideLoadingIndicator();
                    console.error('Error fetching user data:', error);
                    alert('Error fetching user data. Please try again.');
                });
        } else {
            message.textContent = 'Please log in to book a slot.';
            window.location.href = './login.html'; // Redirect to login page
        }
    });


    function loadAndUpdateSlots(selectedDate) {
        console.log("Loading and updating slots for:", selectedDate);
        showLoadingIndicator();

        const slotsRef = db.ref('public/slots');
        const locksRef = db.ref('public/locks');

        const loadSlotsBasedOnTime = () => {
            const slotsContainer = document.getElementById('slots-container');
            slotsContainer.innerHTML = '';

            // Get the current date to compare with selectedDate
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to midnight for comparison

            let currentTime;
            let endTime;

            // If selectedDate is today, start from the nearest 5-minute interval
            if (selectedDate.toDateString() === today.toDateString()) {
                currentTime = new Date();
                currentTime.setMinutes(Math.floor(currentTime.getMinutes() / 5) * 5, 0, 0);

                // Convert to IST (if necessary based on your environment)
                currentTime.setHours(currentTime.getHours(), currentTime.getMinutes());

                endTime = new Date(currentTime);
                endTime.setHours(23);
                endTime.setMinutes(55);
            } else {
                // If it's tomorrow or the day after tomorrow, start from 12:00 AM
                currentTime = new Date(selectedDate);
                currentTime.setHours(0, 0, 0, 0);

                endTime = new Date(selectedDate);
                endTime.setHours(23, 55, 0, 0);
            }


            // Generate slots based on currentTime and endTime
            const slotTimes = [];
            while (currentTime <= endTime) {
                const slotTime = new Date(currentTime);
                slotTimes.push(slotTime);
                const slotId = formatDateToSlotId(slotTime);
                const slotButton = document.createElement('button');
                //if (slotTime.getHours() >= 22 && slotTime.getMinutes() > 30) {
                slotButton.classList.add('slot');
                slotButton.innerText = slotTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
                slotButton.onclick = () => selectSlot(slotButton, slotId);
                slotButton.id = slotId;
                slotsContainer.appendChild(slotButton);

                if (slotStatus[slotId]) {
                    applySlotStatus(slotButton, slotStatus[slotId]);
                } else {
                    slotButton.classList.add('available');
                }
                currentTime.setMinutes(currentTime.getMinutes() + 5);
            }
            updateContainerHeight(slotsContainer);
            hideLoadingIndicator();
        };

        const updateSlotStatus = (slotId, booking) => {
            const slotButton = document.getElementById(slotId);
            if (slotButton) {
                slotStatus[slotId] = booking;
                applySlotStatus(slotButton, booking);
            }
        };

        const updateSlotLockStatus = (slotId, lock) => {
            const slotButton = document.getElementById(slotId);
            if (slotButton) {
                if (lock) {
                    slotButton.classList.add('locked');
                    slotButton.style.backgroundColor = 'orange';
                    slotButton.style.color = 'white';
                    slotButton.disabled = true;
                } else {
                    slotButton.classList.remove('locked');
                    slotButton.style.backgroundColor = '';
                    slotButton.style.color = '';
                    slotButton.disabled = false;
                }
            }
        };

        const applySlotStatus = (slotButton, booking) => {
            if (booking) {
                if (booking.userId === currentUserId) {
                    slotButton.classList.add('selected');
                    console.log("destroyer");
                    slotButton.style.backgroundColor = 'rgb(25, 160, 108)';
                    slotButton.style.color = 'white';
                } else {
                    slotButton.classList.add('booked');
                    slotButton.style.backgroundColor = 'red';
                    slotButton.style.color = 'white';
                }
                slotButton.classList.remove('available');
                slotButton.disabled = true;
            } else {
                slotButton.classList.remove('selected', 'booked');
                slotButton.classList.add('available');
                slotButton.style.backgroundColor = '';
                slotButton.style.color = '';
                slotButton.disabled = false;
            }
        };

        loadSlotsBasedOnTime();
        applyFilter(currentFilter);

        slotsRef.on('child_added', snapshot => {
            const slotId = snapshot.key;
            const booking = snapshot.val();
            updateSlotStatus(slotId, booking);
        });

        slotsRef.on('child_changed', snapshot => {
            const slotId = snapshot.key;
            const booking = snapshot.val();
            updateSlotStatus(slotId, booking);
        });

        slotsRef.on('child_removed', snapshot => {
            const slotId = snapshot.key;
            updateSlotStatus(slotId, null);
        });

        locksRef.on('child_added', snapshot => {
            const slotId = snapshot.key;
            const lock = snapshot.val();
            updateSlotLockStatus(slotId, lock);
        });

        locksRef.on('child_removed', snapshot => {
            const slotId = snapshot.key;
            updateSlotLockStatus(slotId, null);
        });

        setTimerForNextInterval(() => loadAndUpdateSlots(selectedDate));
    }

    function setTimerForNextInterval(callback) {
        clearTimeout(intervalTimer);
        const now = new Date();
        const minutes = now.getMinutes();
        const millisecondsUntilNextInterval = ((5 - (minutes % 5)) * 60 * 1000) - (now.getSeconds() * 1000 + now.getMilliseconds());

        setTimeout(() => {
            callback();
            setTimerForNextInterval(callback);
        }, millisecondsUntilNextInterval);
    }

    function updateContainerHeight(container) {
        const slotCount = container.children.length;
        const slotHeight = 50; // Approximate height of each slot including padding/margin
        const maxContainerHeight = 359; // Maximum height as defined in CSS

     // Calculate the new height
     const newHeight = (slotCount/5) * slotHeight;

     // Apply the new height only if it is less than the max height
    if (newHeight < maxContainerHeight) {
        container.style.height = `${newHeight}px`;
    } else {
        container.style.height = `${maxContainerHeight}px`; // Ensure the max height is maintained
    }
    }


    function formatDateToSlotId(date) {
        const istDate = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000); // Convert to IST by adding 5 hours 30 minutes
        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        const hours = String(istDate.getUTCHours()).padStart(2, '0');
        const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}`;
    }

    function selectSlot(slotButton, slotId) {
        const slotsContainer = document.getElementById('slots-container');
        const duration = parseInt(selectedDuration);
        const startIndex = Array.from(slotsContainer.children).indexOf(slotButton);
        const slotsToSelect = Math.ceil(duration / 5);

        selectedSlots.forEach(slot => slot.classList.remove('selected'));
        selectedSlots = [];

        nextDaySlotsRequired = false; // Initialize the flag


        for (let i = startIndex; i < startIndex + slotsToSelect; i++) {
            const slot = slotsContainer.children[i];

            if (i === startIndex + slotsToSelect - 1) {
        const slotTime = new Date(slot.id.substring(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") + "T" +
                         slot.id.substring(9, 13).replace(/(\d{2})(\d{2})/, "$1:$2") + ":00");

        const cutoffTime = new Date(slotTime);
        cutoffTime.setHours(22, 0, 30, 0); // 11:00 PM

    }
             if (slot && slot.classList.contains('available')) {
                selectedSlots.push(slot);
                slot.classList.add('selected');
            } else if (slot && slot.classList.contains('selected')) {
                alert('Selected duration intersects with booked slots. Please choose a different time or duration.');
                selectedSlots.forEach(slot => slot.classList.remove('selected'));
                selectedSlots = [];
                bookButton.classList.add('hidden');
                return;
            } else {
                nextDaySlotsRequired = true;
            }
        }
        console.log(slotsContainer.children);
        if (nextDaySlotsRequired) {
            const selectedDateIndex = [
                dateButton1, dateButton2, dateButton3,
                dateButton4, dateButton5, dateButton6,
                dateButton7
            ].indexOf(currentDateButton);

            if (selectedDateIndex < 6) {
                const nextDateButton = document.getElementById(`date-button-${selectedDateIndex + 2}`);

                // Open the next date slot container without hiding the current one
                toggleDateButton(nextDateButton, selectedDateIndex + 1, false);
                console.log(nextDateButton);
                console.log(selectedDateIndex)

                // Calculate remaining slots needed from the next day
                const remainingSlotsToSelect = slotsToSelect - selectedSlots.length;
                const nextSlotsContainer = document.getElementById('slots-container');
                for (let i = 0; i < remainingSlotsToSelect; i++) {
                    const slot = nextSlotsContainer.children[i];
                    if (slot && slot.classList.contains('available')) {
                        selectedSlots.push(slot);
                        slot.classList.add('selected');
                    } else if (slot && slot.classList.contains('booked')) {
                        alert('Selected duration intersects with booked slots. Please choose a different time or duration.');
                        selectedSlots.forEach(slot => slot.classList.remove('selected'));
                        selectedSlots = [];
                        bookButton.classList.add('hidden');
                        return;
                    }
                }
            }
        }

        if (selectedSlots.length > 0) {
            bookButton.classList.remove('hidden');
        } else {
            bookButton.classList.add('hidden');
        }
    }



    function setupEventListeners() {
        if (bookButton) {
            bookButton.addEventListener('click', () => {
                if (selectedSlots.length > 0) {
                    const controllers = selectedController;
                    const firstSlot = selectedSlots[0];
                    const lastSlot = selectedSlots[selectedSlots.length - 1];

                    const startTimeStr = firstSlot.id;
                    const endTimeStr = lastSlot.id;
                    const format = 'YYYYMMDD_HHmm';
                    const startTime = moment.tz(startTimeStr, format, 'Asia/Kolkata').toDate();
                    const endTime = new Date(startTime);
                    endTime.setMinutes(endTime.getMinutes() + selectedSlots.length * 5);

                    const formattedStartTime = moment(startTime).format('hh:mm A');
                    const formattedEndTime = moment(endTime).format('hh:mm A');
                    console.log(currentFilter,"nothing");

                    const price = calculatePrice(controllers, (selectedSlots.length) * 5); // Add your price calculation logic here
                    bookingPrice = price; // Store the booking price

                    const confirmationMessage = `Do you want to proceed with booking?\n\nStart Time: ${formattedStartTime}\nEnd Time: ${formattedEndTime}\nNumber of Controllers: ${controllers}\nBooking price: ₹${bookingPrice}`;
                    const adminEmails = ['sakkurusai@gmail.com', 'venuvamsi2005@gmail.com'];
                    if (userData && adminEmails.includes(userData.userEmail)) {
                        // Bypass Razorpay and book directly
                        alert('Booking directly for admin user.');
                        handleCallbackBooking(); // Call your booking function directly
                    } else {
                        // For other users, show the confirmation dialog and proceed with Razorpay payment
                        if (confirm(confirmationMessage)) {
                            disableAllBookingButtons();
                            handlePayment(); // Continue with the payment process for other users
                        } else {
                            selectedSlots.forEach(slot => slot.classList.remove('selected'));
                            selectedSlots = [];
                            bookButton.classList.add('hidden');
                        }
                    }
                }
            });
        }

        const backButton = document.getElementById('back-button');
        backButton.addEventListener('click', () => {
            window.location.href = './dashboard.html';
        });

        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                auth.signOut().then(() => {
                    message.textContent = 'You have logged out. Please login to book a slot.';
                    currentUserId = null;
                    slotsContainer.innerHTML = '';
                    window.location.href = './login.html'; // Redirect to login page after logout
                }).catch((error) => {
                    console.error('Error logging out:', error);
                });
            });
        }

        const durationButtons = document.querySelectorAll('.duration-button');
        const controllerButtons = document.querySelectorAll('.controller-button');

        durationButtons.forEach(button => {
            button.addEventListener('click', () => {
                durationButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                selectedDuration = button.getAttribute('data-duration');
                checkIfAllOptionsSelected();
            });
        });

        controllerButtons.forEach(button => {
            button.addEventListener('click', () => {
                controllerButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                selectedController = button.getAttribute('data-value');
                checkIfAllOptionsSelected();
            });
        });

        dateButton1.addEventListener('click', () => {
            toggleDateButton(dateButton1, 0);
            trackSlotContainerStatus();
        });

        dateButton2.addEventListener('click', () => {
            toggleDateButton(dateButton2, 1);
            trackSlotContainerStatus();
        });

        dateButton3.addEventListener('click', () => {
            toggleDateButton(dateButton3, 2);
            trackSlotContainerStatus();
        });

        dateButton4.addEventListener('click', () => {
            toggleDateButton(dateButton4, 3);
            trackSlotContainerStatus();
        });

        dateButton5.addEventListener('click', () => {
            toggleDateButton(dateButton5, 4);
            trackSlotContainerStatus();
        });

        dateButton6.addEventListener('click', () => {
            toggleDateButton(dateButton6, 5);
            trackSlotContainerStatus();
        });

        dateButton7.addEventListener('click', () => {
            toggleDateButton(dateButton7, 6);
            trackSlotContainerStatus();
        });

        weekdaysButton.addEventListener('click', () => {
            // Apply the weekdays filter
            applyFilter('weekdays');
            trackWeekButtonChange('weekdays');
            closeslotcontaineronswitch();
            // Update button classes
            weekdaysButton.classList.add('selected');
            weekendsButton.classList.remove('selected');
            initialSelection = true;
        });

        weekendsButton.addEventListener('click', () => {
            // Apply the weekends filter
            applyFilter('weekends');
            trackWeekButtonChange('weekends');
            closeslotcontaineronswitch();
            // Update button classes
            weekendsButton.classList.add('selected');
            weekdaysButton.classList.remove('selected');
            initialSelection = true;
        });



    }
    function trackSlotContainerStatus() {
        const slotsContainer = document.getElementById('slots-container');

        if (slotsContainer.style.display === 'block') {
            slotContainerOpen=true;
            console.log('SlotContainer Open');
        } else {
            slotContainerOpen=false;
            console.log('SlotContainer Close');
        }
    }

    function enableAllBookingButtons() {
        // Enable duration buttons
        const durationButtons = document.querySelectorAll('.duration-button');
        durationButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');
        });

        // Enable controller buttons
        const controllerButtons = document.querySelectorAll('.controller-button');
        controllerButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');
        });

        // Enable date buttons
        const dateButtons = [dateButton1, dateButton2, dateButton3, dateButton4, dateButton5, dateButton6, dateButton7];
        dateButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');
        });

        // Enable slots inside the slot container
        const slotsContainer = document.getElementById('slots-container');
        if (slotsContainer) {
            const slotButtons = slotsContainer.querySelectorAll('.slot');
            slotButtons.forEach(slotButton => {
                slotButton.disabled = false;
                slotButton.classList.remove('disabled');
            });
        }

        // Optionally enable the book button
        if (bookButton) {
            bookButton.disabled = false;
            bookButton.classList.remove('disabled');
        }
    }


    function disableAllBookingButtons() {
        // Disable duration buttons
        const durationButtons = document.querySelectorAll('.duration-button');
        durationButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled'); // Add a class for styling if needed
        });

        // Disable controller buttons
        const controllerButtons = document.querySelectorAll('.controller-button');
        controllerButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
        });

        // Disable date buttons
        const dateButtons = [dateButton1, dateButton2, dateButton3, dateButton4, dateButton5, dateButton6, dateButton7];
        dateButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
        });

        // Disable slots inside the slot container
        const slotsContainer = document.getElementById('slots-container');
        if (slotsContainer) {
            const slotButtons = slotsContainer.querySelectorAll('.slot');
            slotButtons.forEach(slotButton => {
                slotButton.disabled = true;
                slotButton.classList.add('disabled');
            });
        }

        // Optionally disable the book button
        if (bookButton) {
            bookButton.disabled = true;
            bookButton.classList.add('disabled');
        }
    }


    function trackWeekButtonChange(newFilter) {
        if (isFirstSelection) {
            isFirstSelection = false; // Mark the first selection as done
        } else if (lastSelectedFilter !== newFilter) {
            console.log('WeekButtons Changed');
            weekbuttonchange=true;
        }
        lastSelectedFilter = newFilter; // Update the last selected filter
    }

    function closeslotcontaineronswitch()
    {
    const slotsContainer = document.getElementById('slots-container');
    if (slotContainerOpen===true && weekbuttonchange===true) {
        console.log("done");
        if (slotsContainer) {
            slotsContainer.innerHTML = '';  // Clear the container content
            slotsContainer.style.display = 'none';  // Hide the container
            selectedSlots.forEach(slot => slot.classList.remove('selected'));
            selectedSlots = [];
            bookButton.classList.add('hidden');  // Hide the book button

        }
    }

    }
    function filterDateButtons(filter) {
        const dateButtons = [
            dateButton1, dateButton2, dateButton3,
            dateButton4, dateButton5, dateButton6,
            dateButton7
        ];

        dateButtons.forEach(button => {
            const date = moment(button.textContent, 'D MMMM');
            const day = date.day();

            if (filter === 'weekdays' && (day === 0 || day === 6)) { // Sunday (0) or Saturday (6)
                button.style.display = 'none';
            } else if (filter === 'weekends' && day >= 1 && day <= 5) { // Monday to Friday
                button.style.display = 'none';
            } else {
                button.style.display = 'block';
            }
        });
        updatePrices();

    }

    function toggleDateButton(button, index, closePrevious = true) {
        const slotsContainer = document.getElementById('slots-container');

        // Handle the case where the same button is clicked again and no next-day slots are required
        if (currentDateButton === button && !nextDaySlotsRequired) {
            if (closePrevious) {
                console.log("b");
                slotsContainer.innerHTML = '';
                slotsContainer.style.display = 'none';  // Hide the container when the same date button is clicked again
                currentDateButton = null;

                selectedSlots.forEach(slot => slot.classList.remove('selected'));
                selectedSlots = [];
                bookButton.classList.add('hidden');  // Hide the book button as no slots are selected
            }
        } else {
            // Check i next day slots are required and prevent closing the previous container
            if (nextDaySlotsRequired == true) {
                console.log("nextdayslots are true");
                closePrevious = false;  // Prevent closing the previous container
            }

            // Handle the closing of previous slots container when not extending into the next day
            if (closePrevious) {
                console.log("a");
                selectedSlots.forEach(slot => slot.classList.remove('selected'));
                selectedSlots = [];
                bookButton.classList.add('hidden');  // Hide the book button as no slots are selected
                if (slotsContainer.parentNode) {
                    console.log("c");
                    slotsContainer.parentNode.removeChild(slotsContainer);
                }
            }

            // Manage slots container positioning for both current and next day
            const dateButtons = [dateButton1, dateButton2, dateButton3, dateButton4, dateButton5, dateButton6, dateButton7];
            const nextButton = dateButtons[index + 1];

            if (nextButton) {
                console.log("d");
                nextButton.parentNode.insertBefore(slotsContainer, nextButton);
            } else {
                console.log("e");
                button.parentNode.appendChild(slotsContainer);
            }

            // Load slots for the selected date
            const selectedDate = new Date();
            selectedDate.setDate(selectedDate.getDate() + index);
            loadAndUpdateSlots(selectedDate);

            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

                    // Get the current and next day names
        const currentDayName = dayNames[selectedDate.getDay()];
        const nextDayName = dayNames[(selectedDate.getDay() + 1) % 7];
        console.log(currentDayName)
        console.log(nextDayName)
        console.log(nextDaySlotsRequired)

        // Check for weekend to weekday or weekday to weekend transition
        if (nextDaySlotsRequired && ((currentDayName === 'saturday' && nextDayName === 'sunday') ||(currentDayName === 'monday' && nextDayName === 'tuesday'))) {
            // Apply filter based on transition
            if (currentDayName === 'saturday' && nextDayName === 'sunday') {
                applyFilter('weekends');
                console.log("weekends")
            } else if (currentDayName === 'monday' && nextDayName === 'tuesday') {
                applyFilter('weekdays');
                console.log("weekdays")
            }
        }

            currentDateButton = button;
            slotsContainer.style.display = 'block';  // Make it visible
            slotsContainer.style.marginTop = '10px'; // Add spacing above

            // Reset the nextDaySlotsRequired flag to handle future interactions
            nextDaySlotsRequired = false;
        }
    }


    function applyFilter(filter)
    {
        currentFilter = filter;
        console.log(currentFilter,"s");
        weekdaysButton.classList.toggle('selected', filter === 'weekdays');
        weekendsButton.classList.toggle('selected', filter === 'weekends');
        initialSelection = true;
        checkIfAllOptionsSelected();
    }

    function checkIfAllOptionsSelected() {
        if (selectedController && selectedDuration && currentFilter && initialSelection) {
            updateDateButtonLabels();
            filterDateButtons(currentFilter);
            updatePrices();
            showDateButtons();

        } else {
            hideDateButtons(); // Hide date buttons if not all options are selected
        }
    }

    function updateDateButtonLabels() {
        const today = moment().format('D MMMM dddd');
        const tomorrow = moment().add(1, 'days').format('D MMMM dddd');
        const dayAfterTomorrow = moment().add(2, 'days').format('D MMMM dddd');
        const fourthDay = moment().add(3, 'days').format('D MMMM dddd');
        const fifthDay = moment().add(4, 'days').format('D MMMM dddd');
        const sixthDay = moment().add(5, 'days').format('D MMMM dddd');
        const seventhDay = moment().add(6, 'days').format('D MMMM dddd');

        dateButton1.textContent = today;
        dateButton2.textContent = tomorrow;
        dateButton3.textContent = dayAfterTomorrow;
        dateButton4.textContent = fourthDay;
        dateButton5.textContent = fifthDay;
        dateButton6.textContent = sixthDay;
        dateButton7.textContent = seventhDay;

    // List of dates to disable (in 'YYYY-MM-DD' format)
    const disabledDates = [
        '2024-09-29',
        '2024-09-30',
        '2024-10-01',
        '2024-10-02',
    ];

    // Disable buttons for the specific dates
    const dateButtons = [dateButton1, dateButton2, dateButton3, dateButton4, dateButton5, dateButton6, dateButton7];
    dateButtons.forEach((button, index) => {
        const buttonDate = moment().add(index, 'days').format('YYYY-MM-DD');
        if (disabledDates.includes(buttonDate)&&(userData && userData.userEmail !== 'sakkurusai@gmail.com')) {
            button.disabled = true; // Disable the button
            button.classList.add('disabled'); // Optionally, add a class for styling the disabled state
        } else {
            button.disabled = false; // Enable the button if it's not in the disabled list
            button.classList.remove('disabled');
        }
    });
    }



    function updatePrices() {
        const controllers = selectedController;
        const custompriceMappingWeekdays = {
            1: {60: 50, 120: 75},
            2: {60: 50, 120: 90},
            4: {60: 80, 120: 140}
        };

        const custompriceMappingWeekends = {
            1: {60: 50, 120: 75},
            2: {60: 75, 120: 115},
            4: {60: 100, 120: 180}
        };
        const priceMappingWeekdays = {
            1: {60: 50, 120: 75},
            2: { 10: 1, 15: 1, 30: 1, 40: 40, 60: 75, 120: 115},
            4: { 10: 1, 15: 1, 30: 1, 40: 70, 60: 100, 120: 180}
        };

        const priceMappingWeekends = {
            1: {60: 100, 120: 150},
            2: { 10: 1, 15: 1, 30: 1, 40: 40, 60: 65, 120: 115},
            4: { 10: 1, 15: 1, 30: 1, 40: 70, 60: 100, 120: 180}
        };

        let priceMapping;

        const specificEmail = "kaboomsadhana@gmail.com";
        if (userData && userData.userEmail === specificEmail)
        {
            if (currentFilter === 'weekends') {
            priceMapping = custompriceMappingWeekends;
        } else {
            priceMapping = custompriceMappingWeekdays;
        }
    }
    else {
        console.log(currentFilter,"123");
        if (currentFilter === 'weekends') {
        priceMapping = priceMappingWeekends;
    } else {
        priceMapping = priceMappingWeekdays;
    }
    }

        const durationButtons = document.querySelectorAll('.duration-button');
        durationButtons.forEach(button => {
            const duration = button.getAttribute('data-duration');
            let durationText = `${duration} min`;
            if (duration == 60) {
                durationText = "1 hour";
            }
            if (duration == 120) {
                durationText = "2 hours";
            }
            const price = priceMapping[controllers][duration];
            button.innerHTML = `${durationText}<br>₹${price}`;
        });
    }

    function calculatePrice(controllers, duration) {
        const custompriceMappingWeekdays = {
            1: {60: 50, 120: 75},
            2: {60: 50, 120: 90},
            4: {60: 80, 120: 140}
        };

        const custompriceMappingWeekends = {
            1: {60: 50, 120: 75},
            2: {60: 65, 120: 115},
            4: {60: 100, 120: 180}
        };
        const priceMappingWeekdays = {
            1: { 60: 50, 120: 75},
            2: { 10: 1, 15: 1, 30: 1, 40: 80, 60: 65, 120: 115},
            4: { 10: 1, 15: 1, 30: 1, 40: 70, 60: 100, 120: 180}
        };

        const priceMappingWeekends = {
            1: { 60: 50, 120: 75},
            2: { 10: 1, 15: 1, 30: 1, 40: 80, 60: 65, 120: 115},
            4: { 10: 1, 15: 1, 30: 1, 40: 70, 60: 100, 120: 180}
        };

        let priceMapping;

        // Determine which pricing to use based on the current filter
        const specificEmail = "kaboomsadhana@gmail.com";
        if (userData && userData.userEmail === specificEmail)
        {
            if (currentFilter === 'weekends') {
            priceMapping = custompriceMappingWeekends;
        } else {
            priceMapping = custompriceMappingWeekdays;
        }
    }
    else {
        if (currentFilter === 'weekends') {
        priceMapping = priceMappingWeekends;
    } else {
        priceMapping = priceMappingWeekdays;
        console.log(priceMappingWeekdays);
        console.log(duration);
    }
    }
    console.log(controllers);
    console.log(duration);
        return priceMapping[controllers][duration];
    }


    // Payment integration
    const generateOrderId = () => {
        const timestamp = Date.now().toString();
        const randomNum = Math.floor(Math.random() * 1000000).toString();
        return 'order_' + timestamp + randomNum;
    };

    const createOrder = async (userName, bookingPrice, receipt) => {
        console.log("Creating order...");
        try {
            await lockSlotsTemporarily();

            showLoadingIndicator();

            const response = await fetch('https://us-central1-kaboom-gaming-d326a.cloudfunctions.net/app/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: bookingPrice,
                    receipt: receipt,
                    notes: { username: userName,
                        userId: currentUserId,
                        controllers: selectedController,
                        slotIds: selectedSlots.map(slot => slot.id),
                        startTime: selectedSlots[0].id,
                        endTime: selectedSlots[selectedSlots.length - 1].id }
                })
            });

            hideLoadingIndicator();

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const order = await response.json();
            console.log("Order created:", order);

            const options = {
                amount: order.amount,
                currency: order.currency,
                order_id: order.id,
                name: 'Kaboom-Gaming',
                description: 'PS5 Slot Booking',
                image: 'https://storage.googleapis.com/kaboom-gaming/Kaboom-Gaming.png',
                prefill: {
                    name: userName,
                    email: userData.userEmail,
                    contact: userData.userPhone,
                },
                notes: {
                    address: "Razorpay Corporate Office",
                },
                theme: {
                    color: '#F37254',
                },
                handler: function (response) {

                    console.log("Payment successful. Razorpay Payment ID:", response.razorpay_payment_id);
                    enableAllBookingButtons();
                    /*handleCallbackBooking().catch(error => {
                        console.error("Error during handleCallbackBooking:", error);
                        alert("Error during booking callback. Please trvjjvjry again.");

                    });
                    */
                },
                modal: {
                    ondismiss: function() {
                        console.log('Checkout form closed');
                        releaseLockedSlots().catch(error => {
                            console.error("Error releasing slots:", error);
                        });
                    }
                }
            };

            const rzp1 = new Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                alert("payment failed");
                //alert(response.error.code);
                //alert(response.error.description);
                //alert(response.error.source);
                //alert(response.error.step);
                //alert(response.error.reason);
                //alert(response.error.metadata.order_id);
                //alert(response.error.metadata.payment_id);
            });

            rzp1.open();

            lockTimeout = setTimeout(() => {
                releaseLockedSlots().catch(console.error);
            }, 3 * 60 * 1000);

        } catch (error) {
            hideLoadingIndicator();
            console.error('Error creating order:', error);
            alert('Error creating order. Please try again.');
        }
    };

    const handlePayment = () => {
        console.log("Handling payment...");

        if (!userData || !bookingPrice) {
            console.error('User data or booking price is missing.');
            alert('Error: selected slots intersecting with the booked slots.');
            return;
        }

        const receipt = generateOrderId();

        createOrder(userData.userName, bookingPrice, receipt);
    };

    async function successBookingDetails(startTime, endTime, controllers, price, successTime) {
        const userId = auth.currentUser.uid;

        // Structure the data
        const bookingDetails = {
            start_time: startTime,
            end_time: endTime,
            controllers: controllers,
            price: price,
            success_booking_time: successTime
        };

        // Reference to user's transactions
        const userTransactionsRef = firestore.collection('transactions').doc(userId);

        // Get all document IDs
        try {
            const dashboardDetailsRef = userTransactionsRef.collection('dashboardDetails');
            const querySnapshot = await dashboardDetailsRef.get();

            let newId = 1;
            querySnapshot.forEach(doc => {
                const docId = parseInt(doc.id);
                if (docId >= newId) {
                    newId = docId + 1;
                }
            });
            const paddedId = newId.toString().padStart(2, '0');
            // Set the new document with incremented ID
            await dashboardDetailsRef.doc(paddedId).set(bookingDetails);
            console.log('Dashboard details successfully written with ID:', paddedId);
        } catch (error) {
            console.error('Error writing dashboard details: ', error);
        }
    }

    const handleCallbackBooking = () => {
        return new Promise((resolve, reject) => {
            const userId = auth.currentUser.uid;
            const controllers = selectedController;
            const userName = userData.userName;
            const updates = {};

            // Loop through selectedSlots and assign slot numbers
            selectedSlots.forEach((slotButton, index) => {
                const slotId = slotButton.id;
                const slotNumber = index === selectedSlots.length - 1 ? 0 : index + 1; // Assign 0 to the last slot, 1-based index to others

                updates[`public/slots/${slotId}`] = {
                    userId,
                    controllers,
                    userName,
                    slotnumber: slotNumber
                };
            });

            db.ref().update(updates)
                .then(() => {
                    console.log('Slots successfully updated');
                    return releaseLockedSlots();
                })
                .then(() => {
                    console.log('Locks released after successful booking');

                    // Collect booking details
                    const startTimeStr = selectedSlots[0].id;
                    const endTimeStr = selectedSlots[selectedSlots.length - 1].id;
                    const format = 'YYYYMMDD_HHmm';
                    const startTime = moment.tz(startTimeStr, format, 'Asia/Kolkata').toDate();
                    const endTime = new Date(startTime);
                    endTime.setMinutes(endTime.getMinutes() + selectedSlots.length * 5);
                    const successTime = new Date();

                    // Call the successBookingDetails function
                    successBookingDetails(startTime, endTime, controllers, `₹${bookingPrice}`, successTime);
                    console.log("saved successfully");

                    resolve();
                })
                .catch((error) => {
                    console.error('Error updating slots:', error);
                    reject(error);
                });
        });
    };

    const lockSlotsTemporarily = () => {
        const selectedSlotIds = selectedSlots.map(slot => slot.id); // Collect selected slot IDs
        const userId = auth.currentUser.uid;

        // Call the Cloud Function to lock the slots and set the timer
        return firebase.functions().httpsCallable('lockSlotsTemporarily')({
            selectedSlots: selectedSlotIds,
            userId
        }).then(result => {
            if (result.data.success) {
                console.log(result.data.message);
            } else {
                console.error(result.data.error);
            }
        }).catch(error => {
            console.error('Error calling lockSlotsTemporarily function:', error);
        });
    };


    const releaseLockedSlots = () => {
        const selectedSlotIds = selectedSlots.map(slot => slot.id);
        return firebase.functions().httpsCallable('releaseLockedSlots')({
            selectedSlots: selectedSlotIds
        }).then(result => {
            if (result.data.success) {
                console.log(result.data.message);
                enableAllBookingButtons();
            } else {
                console.error(result.data.error);
               enableAllBookingButtons();
            }
        }).catch(error => {
            console.error('Error calling releaseLockedSlots function:', error);
        });
    };

    const hideCustomAlert = (alertDiv) => {
        if (alertDiv) {
            document.body.removeChild(alertDiv);
        }
    };


    const parseSlotIdToDate = (slotId) => {
        const format = 'YYYYMMDD_HHmm';
        const slotTime = moment.tz(slotId, format, 'Asia/Kolkata');
        return slotTime.isValid() ? slotTime.toDate() : null;
    };

    window.addEventListener('beforeunload', () => {
        clearTimeout(lockTimeout);
        releaseLockedSlots().catch(console.error);
    });

    setupEventListeners();
});

