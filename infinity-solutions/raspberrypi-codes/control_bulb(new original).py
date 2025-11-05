import sys
import os

#Activate virtual environment
venv_path = "/home/kaboom-gaming/my_rfid_project/venv"
site_packages_path = os.path.join(venv_path, "lib", "python3.11", "site-packages")
sys.path.insert(0, site_packages_path)

import firebase_admin
from firebase_admin import credentials, db as realtime_db
import RPi.GPIO as GPIO
import time
from datetime import datetime, timedelta
import threading
import pytz
import logging
from queue import Queue
from google.cloud import firestore
import json
import tkinter as tk
import pyinotify
import subprocess
import requests



# Path to your virtual environment's site-packages
site_packages_path = "/home/kaboom-gaming/my_rfid_project/myenv/lib/python3.11/site-packages"
sys.path.insert(0, site_packages_path)

#import asyncio
#from telegram import Bot

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

# Firebase and GPIO setup
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/home/kaboom-gaming/my_rfid_project/kaboom-gaming-d326a-firebase-adminsdk-ps88s-63aae2a3f0.json"

try:
    cred = credentials.Certificate("/home/kaboom-gaming/my_rfid_project/kaboom-gaming-d326a-firebase-adminsdk-ps88s-63aae2a3f0.json")
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://kaboom-gaming-d326a-default-rtdb.firebaseio.com/'
    })
    logging.info("Firebase initialized successfully.")
except Exception as e:
    logging.error(f"Failed to initialize Firebase: {e}")
    exit(1)

# Initialize Firestore
db = firestore.Client()

# Setup GPIO for SSR
GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
relay_pin = 17
GPIO.setup(relay_pin, GPIO.OUT)

# Set timezone to IST
IST = pytz.timezone('Asia/Kolkata')

# Global variables
current_booking = None
booking_queue = Queue()
end_times_queue = Queue()
hidden_timer_delays = Queue()
active_booking_timer = None
total_downtime = timedelta()
booking_status=False
allowed_controllers_updated = False

# Paths to device files
DEVICE_PATHS_FILE = "/home/kaboom-gaming/my_rfid_project/device_paths.json"
TIMER_CONTROLLERS_FILE = "/home/kaboom-gaming/my_rfid_project/timer_controllers.json"

if not subprocess.run(["pgrep", "-f", "list_dualsense_controllers.py"]).returncode == 0:
    subprocess.Popen(["python3", "/home/kaboom-gaming/my_rfid_project/list_dualsense_controllers.py"])

# Timer constants
TIMER_DURATION = 30
timer = TIMER_DURATION
hidden_timer_seconds = 0
countdown_active = False
ps5_on = True
session_user = "no user"
controllers = "0"
REQUIRED_CONTROLLERS = 3

# Lock to prevent concurrent updates
update_lock = threading.Lock()

# Telegram Bot setup
TELEGRAM_BOT_TOKEN_1 = '7492087492:AAEBzZtVew7v3RrljxDel-bWhCTXWHi2K3o'
CHAT_ID_1 = '-1002244589597'
TELEGRAM_BOT_TOKEN_2 = '7007979375:AAFQ_u6-mFhfOyA4h__5221qvNoyTQCr4oA'
CHAT_ID_2 = '-1002244589597'

def send_telegram_notification(message, bot_number=1):
    """Send Telegram notification via the chosen bot."""
    if bot_number == 1:
        bot_token = TELEGRAM_BOT_TOKEN_1
        chat_id = CHAT_ID_1
    elif bot_number == 2:
        bot_token = TELEGRAM_BOT_TOKEN_2
        chat_id = CHAT_ID_2

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {'chat_id': chat_id, 'text': message}

    try:
        response = requests.post(url, data=payload)
        if response.status_code == 200:
            print(f"Message sent successfully to chat {chat_id}")
        else:
            print(f"Failed to send message. Status code: {response.status_code}")
    except Exception as e:
        print(f"Error sending message: {e}")

def send_telegram_notification_in_background(message, bot_number=1):
    """Send Telegram notification in a separate thread."""
    thread = threading.Thread(target=send_telegram_notification, args=(message, bot_number))
    thread.daemon = True  # Ensures the thread will not prevent program exit
    thread.start()

# Tkinter GUI setup
root = tk.Tk()
root.title("Controller Timer")
root.configure(bg='black')
root.attributes('-fullscreen', True)
root.bind("<Escape>", lambda event: root.attributes('-fullscreen', False))

# GUI frames and labels
top_frame = tk.Frame(root, bg='black')
top_frame.pack(side=tk.TOP, fill=tk.X)

top_frame.grid_columnconfigure(0, weight=1)
top_frame.grid_columnconfigure(1, weight=1)

timer_frame = tk.Frame(root, bg='black')
timer_frame.pack(pady=5)

bottom_frame = tk.Frame(root, bg='black')
bottom_frame.pack(pady=5)

session_user_label = tk.Label(top_frame, text=f"Session user: {session_user}", font=("Helvetica", 25), fg='#00FF00', bg='black')
session_user_label.grid(row=0, column=1, sticky='e', padx=10)

allowed_controllers_label = tk.Label(top_frame, text=f"Allowed controllers: {controllers}", font=("Helvetica", 25), fg='#00FF00', bg='black')
allowed_controllers_label.grid(row=0, column=0, sticky='w', padx=10)

center_frame = tk.Frame(root, bg='black')
center_frame.pack(expand=True)

hidden_timer_label = tk.Label(center_frame, text="", font=("Helvetica", 40), fg="#00FF00", bg='black')
hidden_timer_label.pack(pady=(10, 0))

timer_label = tk.Label(center_frame, text=f"{timer} seconds", font=("Helvetica", 30), fg="#00FF00", bg='black')
timer_label.pack(pady=(0, 20))

controllers_label = tk.Label(center_frame, text="Connected controllers:", font=("Helvetica", 22), fg='#00FF00', bg='black')
controllers_label.pack(pady=5)

replacement_message_label = tk.Label(center_frame, text="", font=("Helvetica", 20), fg="#FF0000", bg='black')
replacement_message_label.pack()

session_ended_label = tk.Label(center_frame, text="Session Ended", font=("Helvetica", 40), fg="#FF0000", bg='black')
connect_back_label = tk.Label(center_frame, text="Please connect back the controllers to the charging cables", font=("Helvetica", 20), fg="#FF0000", bg='black')


def control_ps5(turn_on):
    """Control the PS5 power state."""
    global ps5_on
    ps5_on = turn_on
    if turn_on:
        logging.info("Turning PS5 ON")
        GPIO.output(relay_pin, GPIO.HIGH)
    else:
        logging.info("Turning PS5 OFF")
        GPIO.output(relay_pin, GPIO.LOW)


def read_device_paths_file():
    """Read the device paths data from the file."""
    if not os.path.exists(DEVICE_PATHS_FILE):
        return {}
    with open(DEVICE_PATHS_FILE, 'r') as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError:
            data = {}
    return data


def read_timer_controllers_file():
    """Read the current connected controllers from the timer controllers file."""
    if not os.path.exists(TIMER_CONTROLLERS_FILE):
        return []
    with open(TIMER_CONTROLLERS_FILE, 'r') as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError:
            data = []
    return data


def update_timer():
    """Update the timer display and connected controllers in the GUI."""
    global timer, countdown_active, ps5_on, controllers#,allowed_controllers_updated
    #if not allowed_controllers_updated:
        #print(f"not allowed")
        #return
        
    with update_lock:
        connected_controllers = read_timer_controllers_file()
        device_mapping = read_device_paths_file()
        num_controllers = len(connected_controllers)
        
        try:
            # Convert controllers from string to int
            controllers_int = int(controllers)
        except ValueError:
            # Handle case where controllers is not a valid integer
            logging.error(f"Invalid controllers value: {controllers}")
            controllers_int = 0


        logging.info(f"Connected controllers: {connected_controllers}")
        logging.info(f"Number of controllers: {num_controllers}")

        if booking_status:
            if num_controllers >= (REQUIRED_CONTROLLERS - controllers_int):
                print(f"first if controllersvalue{controllers_int}")                
                print(f"first if value{REQUIRED_CONTROLLERS - controllers_int}")
                print(f"if booking status{booking_status}")
                timer = TIMER_DURATION
                #logging.info(booking_status)
                countdown_active = False  # Stop countdown when sufficient controllers are connected
                if not ps5_on:
                    control_ps5(True)
            else:
                if timer > 0:
                    print(f"first else controllerers{controllers_int}")
                    countdown_active = True  # Activate countdown when controllers are less than required
                elif ps5_on:
                    print(f"this is called")
                    control_ps5(False)
        else:
            print(f"second else {booking_status}")
            if num_controllers >= (REQUIRED_CONTROLLERS - controllers_int):
                print(f"second else controllersvalue{controllers_int}")   
                print(f"second else value{REQUIRED_CONTROLLERS - controllers_int}")
                timer = TIMER_DURATION
                print(f"very new controllerers{controllers_int}")
                countdown_active = False
                print("Controllers re-connected after booking session is over.")
                send_telegram_notification_in_background("Controllers re-connected after booking session is over.", bot_number=1)
            else:
                if timer > 0:
                    print(f"very new controllerers{controllers_int}")
                    countdown_active = True 

        timer_label.config(text=f"{timer} seconds")
        #allowed_controllers_label.config(text=f"Allowed controllers: {controllers}")

        status_text = ""
        for device_path, device_name in device_mapping.items():
            if device_path in connected_controllers:
                status_text += f"{device_name} connected\n"
            else:
                status_text += f"{device_name} disconnected\n"

        controllers_label.config(text=status_text.strip())

        if countdown_active:
            if not hasattr(update_timer, 'countdown_running') or not update_timer.countdown_running:
                update_timer.countdown_running = True
                if booking_status:
                    replacement_message_label.config(text="Replace the unused controllers to prevent PS5 from turning off in 30 seconds")
                else:
                    replacement_message_label.config(text="Replace the controllers to prevent sending alert message to warden within 30 seconds")
                replacement_message_label.pack()
                root.after(1000, countdown)  # Continue countdown
        else:
            replacement_message_label.config(text="")
            #replacement_message_label.pack_forget()
            


def countdown():
    """Handle the countdown process."""
    global timer, countdown_active, ps5_on
    with update_lock:
        if countdown_active and timer > 0:
            timer -= 1
            logging.info(f"Counting down: {timer} seconds remaining")
            if timer == 0:
                if booking_status:
                    print("Warning: Controllers disconnected during booking.")
                    send_telegram_notification_in_background("Warning: Controllers disconnected during booking.", bot_number=2)
                    control_ps5(False)
                else:
                    print("Warning: Controllers disconnected after booking.")
                    send_telegram_notification_in_background("Warning: Controllers disconnected after booking.", bot_number=2)
                    control_ps5(False)
            timer_label.config(text=f"{timer} seconds")
            root.after(1000, countdown)
        else:
            update_timer.countdown_running = False


def schedule_hidden_timer(end_time):
    """Schedule a hidden timer to activate 10 minutes before the end time."""
    hidden_timer_delay = (end_time - timedelta(minutes=10) - datetime.now(IST)).total_seconds()

    def hidden_timer_action():
        if datetime.now(IST) < end_time + timedelta(minutes=5):
            logging.info("Activating hidden timer 10 minutes before end time")
            #start_hidden_timer(hidden_timer_delay)
            duration = (end_time - datetime.now(IST)).total_seconds()
            if duration > 0:
                    print(f"Starting hidden timer with a countdown of {int(duration)} seconds")
                    start_hidden_timer(int(duration))
        else:
            logging.info("Not sending any request as session has ended")

    if hidden_timer_delay > 0:
        hidden_timer_delays.put(hidden_timer_delay)
        logging.info(f"Added hidden timer delay: {hidden_timer_delay} seconds. Current queue: {[delay for delay in list(hidden_timer_delays.queue)]}")
        threading.Timer(hidden_timer_delay, hidden_timer_action).start()
    else:
        hidden_timer_action()


def start_hidden_timer(duration):
    """Start the hidden timer."""
    global hidden_timer_seconds
    hidden_timer_seconds = duration
    timer_action()

    if sender_delay > 0:
        logging.info(f"Scheduling userName_sender with delay: {sender_delay} seconds.")
        threading.Timer(sender_delay, sender_action).start()
    else:
        sender_action()
    



def timer_action():
    global hidden_timer_seconds
    if hidden_timer_seconds > 0:
        hidden_timer_seconds -= 1
        hidden_timer_label.config(text=f"Session ends in {hidden_timer_seconds // 60}:{hidden_timer_seconds % 60}")
        hidden_timer_label.pack()  # Show hidden timer label
        root.after(1000, timer_action)
    else:
        hidden_timer_label.config(text="")
        hidden_timer_label.pack_forget()
        session_ended_label.pack()
        connect_back_label.pack()
        session_user_label.pack_forget()
        allowed_controllers_label.pack_forget()
        timer_label.pack_forget()
        controllers_label.pack_forget()
        root.after(10000, end_session)



def end_session():
    """Handle the end of the session."""
    session_ended_label.pack_forget()
    connect_back_label.pack_forget()
    session_user_label.grid(row=0, column=1, sticky='e', padx=10)
    allowed_controllers_label.grid(row=0, column=0, sticky='w', padx=10)
    timer_label.pack()
    controllers_label.pack()


class EventHandler(pyinotify.ProcessEvent):
    interrupt_counter = 0

    def process_IN_CLOSE_WRITE(self, event):
        """Handle file close write event."""
        EventHandler.interrupt_counter += 1
        logging.info(f"Interrupt #{EventHandler.interrupt_counter}: IN_CLOSE_WRITE event for file {event.pathname}")
        update_timer()


def schedule_start_stop_timers(start_time, end_time):
    """Schedule start and stop timers for booking."""
    global active_booking_timer, total_downtime ,controllers , booking_status

    start_time_early = start_time - timedelta(seconds=30)
    start_delay = (start_time_early - datetime.now(IST)).total_seconds()
    end_delay = (end_time +timedelta(minutes=5) - datetime.now(IST)).total_seconds()
    print(f"ggggggggggggggggggggggggggggggggggg{end_delay}")

    if active_booking_timer:
        active_booking_timer.cancel()

    def start_action():
        global controllers,booking_status
        logging.info(f"Starting booking from {start_time.isoformat()} to {end_time.isoformat()}")
        logging.info(f"{current_booking[4] }")
        session_user = current_booking[2]
        controllers = current_booking[3]
        session_user_label.config(text=f"Session user: {current_booking[2]}") 
        allowed_controllers_label.config(text=f"Allowed controllers: {current_booking[3]}")
        if not booking_status==True:
            booking_status=True
        control_ps5(True)
        update_timer()
        print(f"start action timer")
        while not end_times_queue.empty():
            next_end_time = end_times_queue.get()
            schedule_hidden_timer(next_end_time)
        global active_booking_timer
        active_booking_timer = threading.Timer(end_delay, stop_action)
        active_booking_timer.start()

    def stop_action():
        global total_downtime,controllers,booking_status
        uid = current_booking[4]
        controllers = "0"
        allowed_controllers_label.config(text=f"Allowed controllers: {controllers}")
        session_user_label.config(text="Session user: no user") 
        print(f"moment")
        logging.info(f"{current_booking[4] }")
        """if not booking_queue.empty():
            next_booking = booking_queue.queue[0]  # Peek at the next booking in the queue
            next_start_time = next_booking[0]
            if next_start_time <= end_time + timedelta(minutes=5):
                 logging.info(f"Next booking starts within 5 minutes at {next_start_time.isoformat()}, keeping PS5 on.")
                 process_next_booking()  # Directly process the next booking without turning off the PS5
                 return"""

        delete_bookings(start_time, end_time)  # Call delete_bookings before logging the stop message
        logging.info(f"Stopping booking from {start_time.isoformat()} to {end_time.isoformat()}, total downtime: {total_downtime}")
        if not booking_status==False:
            booking_status=False
        control_ps5(False)
        process_next_booking()

    if start_delay > 0:
        active_booking_timer = threading.Timer(start_delay, start_action)
        active_booking_timer.start()
    else:
        start_action()

def delete_bookings(start_time, end_time):
    """Delete all slots associated with the expired booking in the Realtime Database."""
    start_slot = start_time.strftime('%Y%m%d_%H%M')
    end_slot = end_time.strftime('%Y%m%d_%H%M')
    ref = realtime_db.reference('public/slots')
    current_time = start_time

    while current_time <= end_time:
        slot_key = current_time.strftime('%Y%m%d_%H%M')
        slot_ref = ref.child(slot_key)
        slot_ref.delete()
        logging.info(f"Deleted slot: {slot_key}")
        current_time += timedelta(minutes=5)

def process_next_booking():
    """Process the next booking in the queue."""
    global current_booking, total_downtime, active_booking_timer

    if active_booking_timer:
        active_booking_timer.cancel()
        update_timer()
        print(f"used first if timer")

    if not booking_queue.empty():
        current_booking = booking_queue.get()
        start_time, end_time, user_name, controllers, userid, start_slot, end_slot = current_booking
        total_downtime = timedelta()  # Reset total downtime for the new booking
        schedule_start_stop_timers(start_time, end_time)
        update_timer()
        print(f"timer updated")
    else:
        current_booking = None


def listener(event):
    global booking_status
    """Handle changes in Firebase data."""
    logging.info(f"Received event: {event.event_type}")
    if event.event_type == 'put':
        bookings = event.data
    elif event.event_type == 'patch':
        # Re-fetch the full list of bookings to ensure consistency
        ref = realtime_db.reference('public/slots')
        bookings = ref.get()
    if not bookings:
        logging.info("No bookings found")
        control_ps5(False)
        booking_status=False
        return
    booking_status=True
    update_active_bookings(bookings)


def monitor_file():
    """Monitor the file for changes and trigger an interrupt."""
    wm = pyinotify.WatchManager()
    handler = EventHandler()
    notifier = pyinotify.Notifier(wm, handler)
    wm.add_watch(TIMER_CONTROLLERS_FILE, pyinotify.IN_CLOSE_WRITE)
    notifier.loop()


def update_active_bookings(bookings):
    """Update the active bookings based on the Firebase data."""
    booking_list = []
    #global controllers

    start_time = None
    end_time = None

    # Collect all bookings in a list
    for slot_time, slot_data in bookings.items():
        slot_number = slot_data['slotnumber']
        user_name = slot_data.get('userName', 'Unknown')
        controllers = slot_data.get('controllers')
        slot_time_dt = IST.localize(datetime.strptime(slot_time, '%Y%m%d_%H%M'))
        userid = slot_data.get('userId', 'Unknown')

        if slot_number == 1:
            start_time = slot_time_dt
        elif slot_number == 0:
            end_time = slot_time_dt
            if start_time and end_time:
                booking_list.append((start_time, end_time, user_name, controllers, userid, start_time.strftime('%Y%m%d_%H%M'), end_time.strftime('%Y%m%d_%H%M')))

    # Clear current queue and add new bookings
    while not booking_queue.empty():
        booking_queue.get()

    for booking in booking_list:
        start_time, end_time, user_name, controllers, userid, start_slot, end_slot = booking
        logging.info(f"Queuing booking from {start_time.isoformat()} to {end_time.isoformat()} for user {user_name}")
        booking_queue.put(booking)
        end_times_queue.put(end_time + timedelta(minutes=5))

    # Process the next booking if no current booking exists or if new booking has earlier start time
    if not current_booking or (current_booking and booking_list and booking_list[0][0] < current_booking[0]):
        process_next_booking()



# Monitor Firebase Database
today_date = datetime.now(IST).strftime('%Y-%m-%d')
ref = realtime_db.reference(f'public/slots')
logging.info(f"Listening to Firebase reference: public/slots")
ref.listen(listener)


if __name__ == "__main__":
    # Start the file monitor in a separate thread
    monitor_thread = threading.Thread(target=monitor_file)
    monitor_thread.daemon = True
    monitor_thread.start()

    # Start the timer function
    root.after(1000, update_timer)

    # Run the Tkinter main loop
    root.mainloop()

