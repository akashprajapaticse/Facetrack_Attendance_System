import face_recognition
import cv2
import numpy as np
import csv
import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import re
import time

app = Flask(__name__)
CORS(app) # Enable CORS for all routes, allowing frontend to access

# --- Configuration ---
FACES_DIR = "faces"
ATTENDANCE_CSV_DIR = "attendance_logs" # New directory for CSV files
LIVENESS_SIMULATION_INTERVAL = 30 # Simulate liveness check every X frames
LIVENESS_SPOOF_CHANCE = 0.1 # 10% chance to simulate a spoof
RECOGNITION_THRESHOLD = 0.6 # Lower value means stricter match (0.6 is common for face_recognition)

# --- Global Variables for Face Data and Attendance ---
known_face_encodings = []
known_face_names = []
students_to_mark = [] # List of students whose attendance is yet to be marked in the current session

# Store attendance data in memory for the current session to avoid re-reading CSV constantly
# Format: { 'name': 'timestamp' }
session_attendance_records = {}

# --- Liveness Simulation Variables ---
frame_count = 0
current_liveness_status = True # Assume live initially
liveness_status_change_time = 0 # Timestamp of last liveness status change

# --- Helper Functions ---

def load_known_faces():
    """Loads face encodings and names from the FACES_DIR."""
    global known_face_encodings, known_face_names
    known_face_encodings = []
    known_face_names = []

    if not os.path.exists(FACES_DIR):
        print(f"Error: The '{FACES_DIR}' directory does not exist.")
        print("Please create a folder named 'faces' in the same directory as this script.")
        print("Place images of known individuals inside this 'faces' folder (e.g., 'john_doe.jpg').")
        return False

    for filename in os.listdir(FACES_DIR):
        if filename.lower().endswith((".jpg", ".jpeg", ".png")): # Process only image files
            image_path = os.path.join(FACES_DIR, filename)
            person_name = os.path.splitext(filename)[0].replace("_", " ").title() # Clean name for display

            try:
                image = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(image)
                if encodings:
                    known_face_encodings.append(encodings[0])
                    known_face_names.append(person_name)
                    print(f"Loaded face for: {person_name}")
                else:
                    print(f"Warning: No face found in {filename}. Skipping.")
            except Exception as e:
                print(f"Error loading {filename}: {e}")
    
    if not known_face_encodings:
        print("No known faces loaded. Please ensure there are valid face images in the 'faces' folder.")
        return False
    
    # Initialize students_to_mark for the session
    global students_to_mark
    students_to_mark = known_face_names.copy()
    print(f"Known faces loaded: {len(known_face_names)}")
    return True

def get_attendance_csv_path():
    """Returns the path for today's attendance CSV file."""
    if not os.path.exists(ATTENDANCE_CSV_DIR):
        os.makedirs(ATTENDANCE_CSV_DIR)
    current_date = datetime.now().strftime("%Y-%m-%d")
    return os.path.join(ATTENDANCE_CSV_DIR, f"{current_date}_attendance.csv")

def mark_attendance(name):
    """Marks attendance for a given name in the CSV file."""
    global session_attendance_records
    csv_path = get_attendance_csv_path()
    
    current_time = datetime.now().strftime("%H:%M:%S")

    # Check if attendance is already marked for this person in this session
    if name in session_attendance_records:
        # Optionally, you could update the timestamp if they reappear, or just ignore
        print(f"Attendance already recorded for {name} at {session_attendance_records[name]}.")
        return False

    try:
        # Open CSV in append mode, create if not exists
        with open(csv_path, "a", newline="") as f:
            lnwriter = csv.writer(f)
            # Write header if file is empty
            if os.stat(csv_path).st_size == 0:
                lnwriter.writerow(["Name", "Time"])
                print(f"Created new CSV file: {csv_path}")
            lnwriter.writerow([name, current_time])
        
        session_attendance_records[name] = current_time
        if name in students_to_mark:
            students_to_mark.remove(name)
        print(f"ATTENDANCE MARKED for: {name} at {current_time}")
        return True
    except IOError as e:
        print(f"Error writing to CSV file {csv_path}: {e}")
        return False

def simulate_liveness_detection():
    """Simulates liveness detection logic."""
    global frame_count, current_liveness_status, liveness_status_change_time
    
    frame_count += 1
    
    # Change liveness status periodically or randomly
    if frame_count % LIVENESS_SIMULATION_INTERVAL == 0:
        if time.time() - liveness_status_change_time > 5: # Don't change too rapidly
            if np.random.rand() < LIVENESS_SPOOF_CHANCE: # 10% chance to become spoof
                current_liveness_status = False
                print("Liveness simulation: SPOOF detected!")
            else:
                current_liveness_status = True
                print("Liveness simulation: LIVE detected.")
            liveness_status_change_time = time.time()
    
    # If spoof, keep it spoof for a few seconds
    if not current_liveness_status and (time.time() - liveness_status_change_time > 3):
        current_liveness_status = True # Revert to live after 3 seconds of spoof
        print("Liveness simulation: Spoof reverted to LIVE.")

    return current_liveness_status

# --- Flask Routes ---

@app.route('/process_frame', methods=['POST'])
def process_frame():
    """
    Receives a base64 encoded image frame, processes it for face recognition
    and simulated liveness, and returns results.
    """
    if not known_face_encodings:
        return jsonify({"error": "Known faces not loaded. Please restart the backend."}), 500

    data = request.json
    if 'image' not in data:
        return jsonify({"error": "No image data provided"}), 400

    # Extract base64 string and decode
    image_data = data['image']
    # Remove data:image/jpeg;base64, prefix if present
    base64_decoded = re.sub(r'^data:image\/\w+;base64,', '', image_data)
    nparr = np.frombuffer(base64.b64decode(base64_decoded), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        return jsonify({"error": "Could not decode image"}), 400

    # Resize frame for faster processing (1/4 size)
    # Note: Frontend sends 640x480, so 1/4 is 160x120. Adjust as needed.
    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
    rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

    # --- Simulated Liveness Detection ---
    is_live = simulate_liveness_detection()

    detected_faces_info = []
    if is_live:
        # Find all the faces and face encodings in the current frame of video
        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            # Scale back up face locations since the frame was resized
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4

            name = "Unknown"
            # Compare current face with known faces
            matches = face_recognition.compare_faces(known_face_encodings, face_encoding, tolerance=RECOGNITION_THRESHOLD)
            face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
            
            if len(face_distances) > 0: # Ensure there are distances to compare
                best_match_index = np.argmin(face_distances)

                if matches[best_match_index]:
                    name = known_face_names[best_match_index]
                    
                    # Mark attendance if recognized and not already marked in this session
                    if name in students_to_mark:
                        mark_attendance(name) # This will also remove from students_to_mark if successful

            detected_faces_info.append({
                "name": name,
                "box": [top, right, bottom, left] # Return bounding box coordinates
            })
    
    response_data = {
        "is_live": is_live,
        "faces": detected_faces_info
    }
    return jsonify(response_data)

# --- Initial Setup ---
if __name__ == '__main__':
    print("Loading known faces...")
    if load_known_faces():
        print("Backend starting...")
        # Run Flask app on all available interfaces (0.0.0.0) and port 5000
        # This makes it accessible from your frontend even if running on a different port
        app.run(host='0.0.0.0', port=5000)
    else:
        print("Failed to load known faces. Exiting backend.")

