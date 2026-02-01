import pyudev
import os
import json

# Path to the file where device paths and their identifiers are stored
DEVICE_PATH_FILE = "/home/kaboom-gaming/my_rfid_project/device_paths.json"

# Dictionary to map device paths to their identifiers
device_mapping = {}

def get_base_device_path(device_path):
    """Extract the base device path by keeping everything up to the second colon."""
    parts = device_path.split(':')
    return ':'.join(parts[:4])  # Join up to the second colon


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

def write_device_paths_to_file(mapping):
    """Write the device paths and their identifiers to the file."""
    with open(DEVICE_PATH_FILE, 'w') as file:
        json.dump(mapping, file, indent=4)
    print(f"Written device mappings to file: {mapping}")
    
def get_device_identifier(device_path):
    """Get or assign an identifier for the device path."""
    if device_path not in device_mapping:
        identifier = f"Device {len(device_mapping) + 1}"
        device_mapping[device_path] = identifier
        write_device_paths_to_file(device_mapping)
        print(f"{device_path} stored as {identifier}")
    else:
        print(f"{device_path} already registered as {device_mapping[device_path]}")
    return device_mapping[device_path]

def store_dualsense_paths():
    context = pyudev.Context()

    # Load existing device paths and their identifiers from file
    global device_mapping
    device_mapping = read_device_paths_from_file()
    print(f"Initial device mapping: {device_mapping}")

    # Check for already connected devices
    for device in context.list_devices(subsystem='usb', DEVTYPE='usb_device'):
        vendor_id = device.get('ID_VENDOR_ID')
        model_id = device.get('ID_MODEL_ID')
        print(f"Device connected with Vendor ID: {vendor_id}, Model ID: {model_id}, Device_Path:{device.get('ID_PATH')}")
        if (vendor_id == '054c' and model_id == '0ce6') or (vendor_id == '17ef' and model_id == '608d'):
            device_path = device.get('ID_PATH')
            base_device_path = get_base_device_path(device_path) if device_path else None
            if base_device_path:
                get_device_identifier(base_device_path)

    print("Finished storing DualSense device paths.")

if __name__ == "__main__":
    store_dualsense_paths()
