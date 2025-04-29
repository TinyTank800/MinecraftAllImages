import os
import random
from PIL import Image, ImageOps
import glob

IMAGE_SOURCE_DIR = 'C:/GitHub/MinecraftAllImages/images'
OUTPUT_WIDTH = 1200
OUTPUT_HEIGHT = 628
NUM_IMAGES_TO_PLACE = 1350 # How many random images to attempt to place
OUTPUT_FILENAME = 'output_collage.png'
# --- End Configuration ---

def find_image_files(directory):
    """Recursively finds all .png files in the given directory."""
    png_files = glob.glob(os.path.join(directory, '**', '*.png'), recursive=True)
    print(f"Found {len(png_files)} PNG files in '{directory}'.")
    return png_files

def create_collage(image_paths, width, height, num_images, output_filename):
    """Creates a collage by randomly placing, rotating, and scaling images."""
    if not image_paths:
        print("Error: No image files found.")
        return

    # Create a blank canvas with transparency
    collage = Image.new('RGBA', (width, height), (0, 0, 0, 0))

    # Select random images
    selected_paths = random.sample(image_paths, min(num_images, len(image_paths)))
    print(f"Selected {len(selected_paths)} images for the collage.")

    images_processed = 0
    for img_path in selected_paths:
        try:
            # Open image
            img = Image.open(img_path).convert('RGBA')

            # Random scale factor (e.g., 0.5x to 1.5x)
            scale_factor = random.uniform(0.5, 1.0)
            new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
            # Ensure size is at least 1x1 pixel after scaling
            new_size = (max(1, new_size[0]), max(1, new_size[1]))

            if new_size[0] > 0 and new_size[1] > 0: # Ensure valid size
                img_resized = img.resize(new_size, Image.Resampling.LANCZOS)

                # Random rotation (0-360 degrees)
                rotation_angle = random.uniform(0, 360)
                # Use expand=True to prevent cropping during rotation
                img_rotated = img_resized.rotate(rotation_angle, Image.Resampling.BICUBIC, expand=True)

                # Random position
                # Allow images to be placed partially off-canvas
                max_x = width - 1
                max_y = height - 1
                # Adjust placement range to allow partial off-screen placement
                paste_x = random.randint(-img_rotated.width // 2, max_x - img_rotated.width // 2)
                paste_y = random.randint(-img_rotated.height // 2, max_y - img_rotated.height // 2)

                # Paste the image using its alpha channel as a mask
                collage.paste(img_rotated, (paste_x, paste_y), img_rotated)
                images_processed += 1
            else:
                 print(f"Skipping {img_path} due to invalid size after scaling.")


        except Exception as e:
            print(f"Warning: Could not process image {img_path}. Error: {e}")

    if images_processed > 0:
        # Save the final collage
        collage.save(output_filename)
        print(f"\nCollage saved as '{output_filename}'")
    else:
        print("\nNo images were successfully processed. Collage not saved.")


if __name__ == "__main__":
    all_images = find_image_files(IMAGE_SOURCE_DIR)
    if all_images:
        create_collage(all_images, OUTPUT_WIDTH, OUTPUT_HEIGHT, NUM_IMAGES_TO_PLACE, OUTPUT_FILENAME)
    else:
        print(f"No PNG images found in '{IMAGE_SOURCE_DIR}' or its subdirectories.") 
