import pyudev
import os
import json

# Paths to the files for device paths and their identifiers and timer controllers
DEVICE_PATH_FILE = "/home/kaboom-gaming/my_rfid_project/device_paths.json"
TIMER_CONTROLLERS_FILE = "/home/kaboom-gaming/my_rfid_project/timer_controllers.json"

# Dictionary to map device paths to their identifiers
device_mapping = {}

connected_controllers = set()

def read_device_paths_from_file():
    """Read device paths and their identifiers from the file."""
    if not os.path.exists(DEVICE_PATH_FILE):
        return {}
    
    with open(DEVICE_PATH_FILE, 'r') as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError:
            data = {}
    return data

def write_connected_controllers_to_file():
    """Write the current set of connected controllers to the timer controllers file."""
    with open(TIMER_CONTROLLERS_FILE, 'w') as file:
        json.dump(list(connected_controllers), file)

def extract_base_device_path(device_path):
    """Extract the base device path by keeping everything up to the second colon."""
    parts = device_path.split(':')
    return ':'.join(parts[:4])  # Join up to the second colon


def get_device_identifier(base_device_path):
    """Get the device identifier based on the base device path."""
    return device_mapping.get(base_device_path, None)

def print_connection_status(device_identifier, action):
    """Print the connection status of the device."""
    if action == 'add':
        print(f"{device_identifier} connected")
    elif action == 'remove':
        print(f"{device_identifier} disconnected")

def handle_event(device):
    """Handle the event for device connection or disconnection."""
    device_path = device.get('ID_PATH')
    print(f"yoyo {device_path}")
    base_device_path = extract_base_device_path(device_path) if device_path else None
    device_identifier = get_device_identifier(base_device_path) if base_device_path else None
        # Get vendor and model ID
    vendor_id = device.get('ID_VENDOR_ID')
    model_id = device.get('ID_MODEL_ID')
    print(f"Device connected with Vendor ID: {vendor_id}, Model ID: {model_id}")

    # Only process 'add' actions for DualSense controllers based on vendor and model ID
    if device_identifier and device.action == 'add':
        print(f"handle_event - device_path: {device_path}, base_device_path: {base_device_path}, action: {device.action}")
        if (device.get('ID_VENDOR_ID') == '054c' and device.get('ID_MODEL_ID') == '0ce6') or (device.get('ID_VENDOR_ID')== '17ef' and device.get('ID_MODEL_ID') == '608d'):
            if base_device_path not in connected_controllers:
                connected_controllers.add(base_device_path)
                write_connected_controllers_to_file()
                print_connection_status(device_identifier, 'add')
        print(f"Current connected controllers: {connected_controllers}")

    # Handle 'remove' actions based on device path only
    elif device_identifier and device.action == 'remove':
        print(f"handle_event - device_path: {device_path}, base_device_path: {base_device_path}, action: {device.action}")
        if base_device_path in connected_controllers:
            connected_controllers.remove(base_device_path)
            write_connected_controllers_to_file()
            print_connection_status(device_identifier, 'remove')
        print(f"Current connected controllers: {connected_controllers}")

def monitor_dualsense_controllers():
    """Monitor DualSense controllers and print their connection status."""
    context = pyudev.Context()
    monitor = pyudev.Monitor.from_netlink(context)
    monitor.filter_by(subsystem='usb')
    observer = pyudev.MonitorObserver(monitor, callback=handle_event, name='monitor-observer')
    observer.start()
    print("Monitor started")

    # Load device paths and their identifiers from file
    global device_mapping
    device_mapping = read_device_paths_from_file()
    #print(f"Initial device mapping: {device_mapping}")

    # Check for already connected devices at startup
    current_connected = set()
    for device in context.list_devices(subsystem='usb', DEVTYPE='usb_device'):
        if (device.get('ID_VENDOR_ID') == '054c' and device.get('ID_MODEL_ID') == '0ce6') or (device.get('ID_VENDOR_ID') == '17ef' and device.get('ID_MODEL_ID') == '608d'):
            device_path = device.get('ID_PATH')
            base_device_path = extract_base_device_path(device_path) if device_path else None
            device_identifier = get_device_identifier(base_device_path) if base_device_path else None
            if device_identifier:
                current_connected.add(base_device_path)
                print_connection_status(device_identifier, 'add')

    connected_controllers.update(current_connected)
    write_connected_controllers_to_file()
    if connected_controllers:
        print(f"Initially connected controllers: {connected_controllers}")
    else:
        print("No controllers connected at startup")

if __name__ == "__main__":
    print("Monitoring for DualSense controllers. Press Ctrl+C to exit.")
    monitor_dualsense_controllers()

    try:
        while True:
            pass  # Keep the script running
    except KeyboardInterrupt:
        print("Exiting...")


