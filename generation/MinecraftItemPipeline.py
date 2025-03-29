"""
Minecraft Item Pipeline Script

This script automates the entire process of:
1. Generating Minecraft item screenshots
2. Creating a list of items
3. Generating a manifest file
4. Creating transparent versions of the images

The script maintains two separate folders:
- raw_images/: Contains the original screenshots from Minecraft
- transparent_images/: Contains the processed transparent versions

Requirements:
- Python 3.6+
- pyautogui
- keyboard
- pyperclip
- PIL (Pillow)

Usage:
1. Configure the settings below
2. Run the script
3. Switch to your Minecraft window during the countdown
4. The script will automatically do the rest
5. Hold CAPS LOCK at any time to stop the script

Created by: tinytank800
"""

import pyautogui
import time
import keyboard
import pyperclip
import os
import json
from pathlib import Path
from PIL import Image
from datetime import datetime

# =============================================================================
# CONFIGURATION SETTINGS
# =============================================================================

# Player and screenshot settings
PLAYER_NAME = "tinytank800"  #CHANGE ME - Your Minecraft username
SCREENSHOT_REGION = (1208, 1410, 128, 128)  # (x, y, width, height) of screenshot region

# File paths
BASE_DIRECTORY = r"E:\moreBackups\Backups\MinecraftAllItemImages" #CHANGE ME - Main folder with the python script
RAW_IMAGES_DIR = os.path.join(BASE_DIRECTORY, "raw_images")
TRANSPARENT_IMAGES_DIR = os.path.join(BASE_DIRECTORY, "transparent_images")
PROGRESS_FILE = os.path.join(BASE_DIRECTORY, "progress.json")
MANIFEST_FILE = os.path.join(BASE_DIRECTORY, "manifest.json")

# Timing settings (in seconds)
STARTING_DELAY = 10      # Time to wait before starting the script
COMMAND_DELAY = 0.1      # Delay after typing commands
SCREENSHOT_DELAY = 0.1   # Delay before taking screenshots
INVENTORY_DELAY = 0.1    # Delay after opening inventory
TAB_DELAY = 0.1          # Delay after pressing tab
NAVIGATION_DELAY = 0.001  # Delay for navigation keys

# Starting position
START_LETTER = "a"       # Which letter to start with
START_ITEM_INDEX = 0     # Which item index to start with

# Other settings
MAX_CONSECUTIVE_EMPTY = 10  # Number of empty results before moving to next letter
MAX_ATTEMPTS_PER_LETTER = 200  # Maximum number of attempts for a single letter

# =============================================================================
# INITIALIZATION
# =============================================================================

def setup_directories():
    """Create all necessary directories for the pipeline."""
    directories = [RAW_IMAGES_DIR, TRANSPARENT_IMAGES_DIR, BASE_DIRECTORY]
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"Created/verified directory: {directory}")

def load_progress():
    """Load previously processed items or create new progress file."""
    processed_items = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            try:
                processed_items = json.load(f)
                print(f"Loaded progress file with {len(processed_items)} processed items.")
            except json.JSONDecodeError:
                print("Error loading progress file. Starting with empty progress.")
                processed_items = {}
    else:
        with open(PROGRESS_FILE, 'w') as f:
            json.dump({}, f)
        print("Created new progress file.")
    return processed_items

# =============================================================================
# IMAGE GENERATION FUNCTIONS
# =============================================================================

def load_command(current_letter):
    """Load the /give command with the current letter and prepare for tab completion."""
    command = f'/give {PLAYER_NAME} minecraft:{current_letter}'
    pyautogui.write(command)
    time.sleep(COMMAND_DELAY)
    keyboard.press_and_release('tab')
    time.sleep(TAB_DELAY)
    
def copy_command():
    """Copy the current command to clipboard for item name extraction."""
    keyboard.press_and_release('ctrl+a')
    time.sleep(COMMAND_DELAY)
    keyboard.press_and_release('ctrl+c')
    time.sleep(COMMAND_DELAY)
  
def capture_screen(file_path):
    """Take a screenshot of the hotbar slot and save it."""
    try:
        time.sleep(SCREENSHOT_DELAY)
        screenshot = pyautogui.screenshot(region=SCREENSHOT_REGION)
        screenshot.save(file_path)
        
        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            print(f"Screenshot saved successfully: {file_path}")
            return True
        else:
            print(f"Screenshot may not have been saved properly: {file_path}")
            return False
    except Exception as e:
        print(f"Screenshot error: {e}")
        return False
    
def clear_inventory():
    """Clear the player's inventory and reset the command interface."""
    try:
        keyboard.press_and_release('escape')
        time.sleep(COMMAND_DELAY)
        keyboard.press_and_release('/')
        time.sleep(COMMAND_DELAY)
        keyboard.press_and_release('backspace')
        time.sleep(COMMAND_DELAY)
        pyautogui.write(f'/clear {PLAYER_NAME}')
        time.sleep(COMMAND_DELAY)
        keyboard.press_and_release('enter')
        time.sleep(COMMAND_DELAY)
        keyboard.press_and_release('/')
        time.sleep(COMMAND_DELAY)
        keyboard.press_and_release('backspace')
        time.sleep(COMMAND_DELAY)
        return True
    except Exception as e:
        print(f"Inventory clear error: {e}")
        return False

def save_progress(processed_items):
    """Save the current progress to the progress file."""
    try:
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(processed_items, f)
        print(f"Progress saved: {len(processed_items)} items")
    except Exception as e:
        print(f"Error saving progress: {e}")

def start_minecraft_command_mode():
    """Open the Minecraft command interface."""
    keyboard.press_and_release('/')
    time.sleep(COMMAND_DELAY)

# =============================================================================
# LIST AND MANIFEST GENERATION
# =============================================================================

def create_item_list():
    """Create a list of all items from the raw images directory."""
    print("Creating item list...")
    items = []
    
    for filename in os.listdir(RAW_IMAGES_DIR):
        if filename.endswith('.png'):
            items.append(filename[:-4])  # Remove .png extension
    
    return items

def create_manifest(items):
    """Create a manifest file from the list of items."""
    print("Creating manifest file...")
    manifest = {
        "images": [f"{item}.png" for item in items],
        "totalCount": len(items),
        "createdAt": datetime.now().isoformat()
    }
    
    with open(MANIFEST_FILE, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"Manifest file created: {MANIFEST_FILE}")
    print(f"Total items: {len(items)}")

# =============================================================================
# TRANSPARENCY PROCESSING
# =============================================================================

def process_transparency():
    """Process all images to create transparent versions."""
    print("Processing images for transparency...")
    
    for filename in os.listdir(RAW_IMAGES_DIR):
        if not filename.endswith('.png'):
            continue
            
        print(f"Processing: {filename}")
        
        with Image.open(os.path.join(RAW_IMAGES_DIR, filename)) as im:
            # Convert to RGBA
            rgba = im.convert('RGBA')
            datas = rgba.getdata()
            
            # Change all grey pixels (139,139,139) to transparent
            new_data = []
            for item in datas:
                if item[0] == 139 and item[1] == 139 and item[2] == 139:
                    new_data.append((255, 255, 255, 0))  # Transparent
                else:
                    new_data.append(item)
            
            # Save new transparent image
            rgba.putdata(new_data)
            rgba.save(os.path.join(TRANSPARENT_IMAGES_DIR, filename), 'PNG')
    
    print("Transparency processing complete!")

# =============================================================================
# MAIN SCRIPT
# =============================================================================

def main():
    # Setup
    setup_directories()
    
    # Prompt for starting letter
    while True:
        start_letter_input = input("\nEnter starting letter (a-z) or press Enter to start from 'a': ").lower().strip()
        if not start_letter_input:  # If user just presses Enter
            START_LETTER = "a"
            break
        if start_letter_input in "abcdefghijklmnopqrstuvwxyz":
            START_LETTER = start_letter_input
            break
        print("Invalid input. Please enter a single letter from a to z.")
    
    # Prompt for clearing progress
    while True:
        clear_progress = input("\nDo you want to clear previous progress? (y/n): ").lower().strip()
        if clear_progress in ['y', 'n']:
            break
        print("Invalid input. Please enter 'y' or 'n'.")
    
    if clear_progress == 'y':
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
            print("Progress file cleared.")
        processed_items = {}
    else:
        processed_items = load_progress()
    
    # Initialize alphabet and starting position
    alphabet = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", 
                "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]
    
    try:
        letter_index = alphabet.index(START_LETTER.lower())
    except ValueError:
        print(f"Warning: '{START_LETTER}' is not a valid letter. Starting with 'a'.")
        letter_index = 0
    
    # Initialize variables
    letter = alphabet[letter_index]
    letter2 = "a"
    item_index = START_ITEM_INDEX
    consecutive_empty = 0
    last_valid_item = ""
    letter_attempt_count = 0
    current_letter_items = set()
    
    # Print startup instructions
    print("=" * 80)
    print("MINECRAFT ITEM PIPELINE")
    print("=" * 80)
    print(f"Script will start in {STARTING_DELAY} seconds.")
    print("1. Switch to your Minecraft window")
    print("2. Make sure you're in-game (not in a menu)")
    print("3. Position should be in creative mode with inventory visible")
    print("4. The script will automatically open the command interface")
    print("5. Hold CAPS LOCK at any time to stop the script")
    print("-" * 80)
    print(f"Starting Letter: {START_LETTER}")
    print(f"Starting Item Index: {START_ITEM_INDEX}")
    print(f"Raw images will be saved to: {RAW_IMAGES_DIR}")
    print(f"Transparent images will be saved to: {TRANSPARENT_IMAGES_DIR}")
    print("-" * 80)
    
    # Countdown
    for i in range(STARTING_DELAY, 0, -1):
        print(f"{i}...")
        time.sleep(1)
    print("Starting automation!")
    print("=" * 80)
    
    try:
        # Start Minecraft command interface
        start_minecraft_command_mode()
        
        # Main image generation loop
        while letter_index < len(alphabet):
            start_time = time.time()
            print(f"Processing letter {letter}, item #{item_index}")
            
            # Check maximum attempts
            letter_attempt_count += 1
            if letter_attempt_count > MAX_ATTEMPTS_PER_LETTER:
                print(f"Reached maximum attempts for letter {letter}, moving to next letter")
                letter_index += 1
                if letter_index >= len(alphabet):
                    break
                letter = alphabet[letter_index]
                letter2 = "a"
                item_index = 0
                consecutive_empty = 0
                letter_attempt_count = 0
                current_letter_items.clear()
                continue
            
            # Load command and process item
            load_command(letter)
            
            # Navigate to item
            for i in range(item_index):
                keyboard.press_and_release('down')
                time.sleep(NAVIGATION_DELAY)
                keyboard.press_and_release('tab')
                time.sleep(NAVIGATION_DELAY)
            
            # Get item name
            copy_command()
            clipboard_content = pyperclip.paste()
            
            if len(clipboard_content) > 28:
                item_name = clipboard_content[28:]
                current_letter = clipboard_content[28:29]
                current_letter2 = clipboard_content[29:30] if len(clipboard_content) > 29 else ""
                
                print(f"Found item: {item_name}")
                
                # Check for loops
                if item_name in current_letter_items:
                    print(f"Loop detected: Item {item_name} already seen")
                    letter_index += 1
                    if letter_index >= len(alphabet):
                        break
                    letter = alphabet[letter_index]
                    item_index = 0
                    consecutive_empty = 0
                    letter_attempt_count = 0
                    current_letter_items.clear()
                    continue
                else:
                    current_letter_items.add(item_name)
                
                # Process valid item
                if item_name not in processed_items:
                    file_path = os.path.join(RAW_IMAGES_DIR, f"{item_name}.png")
                    
                    # Get item and take screenshot
                    keyboard.press_and_release('enter')
                    time.sleep(COMMAND_DELAY)
                    keyboard.press_and_release('e')
                    time.sleep(INVENTORY_DELAY)
                    
                    if capture_screen(file_path):
                        processed_items[item_name] = True
                        last_valid_item = item_name
                        consecutive_empty = 0
                        save_progress(processed_items)
                    
                    clear_inventory()
                else:
                    print(f"Item {item_name} already processed, skipping")
                    consecutive_empty = 0
            else:
                consecutive_empty += 1
                print(f"No valid item at index {item_index}, consecutive empty: {consecutive_empty}")
                
                if consecutive_empty >= MAX_CONSECUTIVE_EMPTY:
                    print(f"Hit {MAX_CONSECUTIVE_EMPTY} consecutive empty items, moving to next letter")
                    letter_index += 1
                    if letter_index >= len(alphabet):
                        break
                    letter = alphabet[letter_index]
                    item_index = 0
                    consecutive_empty = 0
                    letter_attempt_count = 0
                    current_letter_items.clear()
                    continue
            
            # Check for user interrupt
            if keyboard.is_pressed('caps lock'):
                print("CAPSLOCK key held down, stopping program.")
                break
            
            # Move to next item
            item_index += 1
            
            # Display timing
            end_time = time.time()
            elapsed_time = end_time - start_time
            print(f"Time Elapsed for item #{item_index}: {elapsed_time:.2f} seconds")
            
            time.sleep(COMMAND_DELAY)
        
        # After image generation, create list and manifest
        print("\nGenerating item list and manifest...")
        items = create_item_list()
        create_manifest(items)
        
        # Process transparency
        print("\nProcessing images for transparency...")
        process_transparency()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Save final progress
        save_progress(processed_items)
        print("=" * 80)
        print(f"Pipeline completed. Last processed item: {last_valid_item}")
        print(f"Progress saved to {PROGRESS_FILE}")
        print(f"Total items processed: {len(processed_items)}")
        print("=" * 80)
        print("!IMPORTANT! - Make sure to check the images to make sure they generated correctly. Also make sure images in the transparent_images folder are not messed up. POLISHED_DIORITE is a usual suspect.")

if __name__ == "__main__":
    main() 
