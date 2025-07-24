import face_recognition
import numpy as np
import base64
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
import datetime # Import datetime for timestamps

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- In-memory Storage ---
# These dictionaries will store data only while the server is running.
# All data will be lost when the server restarts.
known_face_encodings = {} # Stores { "name": face_encoding_array }
# Stores { "name": [{"timestamp": "iso_string", "type": "check-in/out"}, ...] }
attendance_records = {}

# --- Helper Functions ---

def decode_image(base64_string):
    """
    Decodes a base64 string into an OpenCV image (numpy array).
    """
    try:
        # Remove the "data:image/png;base64," prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode the base64 string
        nparr = np.frombuffer(base64.b64decode(base64_string), np.uint8)
        # Read the image using OpenCV
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"Error decoding image: {e}")
        return None

def get_face_encoding(image):
    """
    Detects faces in an image and returns the encoding of the first face found.
    Assumes only one prominent face per registration/recognition.
    """
    if image is None:
        return None

    # Convert BGR (OpenCV default) to RGB (face_recognition expects RGB)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Find all face locations in the image
    face_locations = face_recognition.face_locations(rgb_image)
    
    if len(face_locations) > 0:
        # Get face encodings for all detected faces
        encodings = face_recognition.face_encodings(rgb_image, face_locations)
        if encodings:
            return encodings[0] # Return the encoding of the first face found
    return None

# --- API Endpoints ---

@app.route('/register_face', methods=['POST'])
def register_face():
    """
    Registers a new face with a given name in in-memory storage.
    Expects JSON with 'image' (base64 string) and 'name'.
    """
    data = request.get_json()
    image_data = data.get('image')
    name = data.get('name')

    if not image_data or not name:
        return jsonify({'success': False, 'message': 'Image data and name are required.'}), 400

    image = decode_image(image_data)
    if image is None:
        return jsonify({'success': False, 'message': 'Invalid image data.'}), 400

    face_encoding = get_face_encoding(image)

    if face_encoding is None:
        return jsonify({'success': False, 'message': 'No face detected in the image.'}), 400

    try:
        # Store the face encoding in the in-memory dictionary
        known_face_encodings[name] = face_encoding.tolist() # Store as list for consistency
        print(f"Registered face for: {name} in memory.")
        return jsonify({'success': True, 'message': f'Face registered for {name}.'})
    except Exception as e:
        print(f"Error registering face: {e}")
        return jsonify({'success': False, 'message': f'Failed to register face: {e}'}), 500

@app.route('/recognize_face', methods=['POST'])
def recognize_face():
    """
    Recognizes a face from the provided image and records attendance in in-memory storage.
    Determines if it's a check-in or check-out based on the last entry for the day.
    Expects JSON with 'image' (base64 string).
    Returns recognized name, action type, and a sassy message.
    """
    data = request.get_json()
    image_data = data.get('image')

    if not image_data:
        return jsonify({'success': False, 'message': 'Image data is required.'}), 400

    image = decode_image(image_data)
    if image is None:
        return jsonify({'success': False, 'message': 'Invalid image data.'}), 400

    unknown_face_encoding = get_face_encoding(image)

    if unknown_face_encoding is None:
        sassy_message = "Whoops! No face detected. Are you hiding? Try again!"
        return jsonify({'success': True, 'name': None, 'message': sassy_message, 'action_type': None})

    recognized_name = None
    try:
        # Compare the unknown face with all known faces from in-memory dictionary
        for name, known_encoding_list in known_face_encodings.items():
            known_encoding = np.array(known_encoding_list) # Convert list back to numpy array
            # Compare faces using a tolerance (lower is stricter)
            # A common tolerance is 0.6. Adjust as needed.
            matches = face_recognition.compare_faces([known_encoding], unknown_face_encoding, tolerance=0.6)
            if matches[0]:
                recognized_name = name
                break # Found a match, no need to check further

        if recognized_name:
            current_time = datetime.datetime.now()
            current_timestamp_iso = current_time.isoformat()
            today_date = current_time.date()

            # Get attendance for the recognized user
            user_attendance = attendance_records.get(recognized_name, [])

            # Filter today's entries
            today_entries = [
                entry for entry in user_attendance
                if datetime.datetime.fromisoformat(entry['timestamp']).date() == today_date
            ]

            action_type = "check-in"
            sassy_message = ""

            if today_entries:
                last_entry = today_entries[-1]
                if last_entry['type'] == "check-in":
                    action_type = "check-out"
                    sassy_message = f"Alright, {recognized_name}! Time to wrap it up! You're officially checked out. See ya!"
                else: # last_entry['type'] == "check-out"
                    action_type = "check-in"
                    sassy_message = f"Welcome back, {recognized_name}! Let's get this day going! You're checked in!"
            else: # First entry for today
                action_type = "check-in"
                sassy_message = f"Hello, {recognized_name}! Ready to conquer the day? You're officially checked in!"

            # Add the new entry to the user's attendance records
            user_attendance.append({"timestamp": current_timestamp_iso, "type": action_type})
            attendance_records[recognized_name] = user_attendance # Update the main dictionary

            print(f"Recorded {action_type} for: {recognized_name} at {current_timestamp_iso} in memory.")
            return jsonify({
                'success': True,
                'name': recognized_name,
                'message': sassy_message,
                'action_type': action_type # Send action type for frontend to potentially use
            })
        else:
            sassy_message = "Whoops! Face not recognized. Are you registered? Try again!"
            return jsonify({'success': True, 'name': None, 'message': sassy_message, 'action_type': None})
    except Exception as e:
        print(f"Error during recognition or attendance update: {e}")
        sassy_message = f"Recognition failed due to an internal error: {e}"
        return jsonify({'success': False, 'message': sassy_message, 'action_type': None}), 500

@app.route('/delete_user/<name>', methods=['DELETE'])
def delete_user(name):
    """
    Deletes a registered user's face encoding and their attendance records from in-memory storage.
    """
    try:
        if name in known_face_encodings:
            del known_face_encodings[name]
            print(f"Deleted face encoding for: {name} from memory.")
        
        if name in attendance_records:
            del attendance_records[name]
            print(f"Deleted attendance records for: {name} from memory.")

        return jsonify({'success': True, 'message': f'User {name} and their attendance records deleted.'})
    except Exception as e:
        print(f"Error deleting user {name}: {e}")
        return jsonify({'success': False, 'message': f'Failed to delete user {name}: {e}'}), 500

@app.route('/clear_all_attendance', methods=['DELETE'])
def clear_all_attendance():
    """
    Deletes all attendance records from in-memory storage.
    """
    try:
        attendance_records.clear()
        print("All attendance records cleared from memory.")
        return jsonify({'success': True, 'message': 'All attendance records cleared.'})
    except Exception as e:
        print(f"Error clearing all attendance: {e}")
        return jsonify({'success': False, 'message': f'Failed to clear all attendance: {e}'}), 500

@app.route('/get_known_faces', methods=['GET'])
def get_known_faces():
    """
    Returns a list of names of all registered faces from in-memory storage.
    """
    try:
        return jsonify({'success': True, 'known_faces': list(known_face_encodings.keys())})
    except Exception as e:
        print(f"Error fetching known faces: {e}")
        return jsonify({'success': False, 'message': f'Failed to fetch known faces: {e}'}), 500

@app.route('/get_attendance', methods=['GET'])
def get_attendance():
    """
    Returns the current attendance records with timestamps and types from in-memory storage.
    The structure will be { "name": [{"timestamp": "iso_string", "type": "check-in/out"}, ...] }.
    """
    try:
        # Return a copy to prevent external modification of the original dictionary
        return jsonify({'success': True, 'attendance': attendance_records.copy()})
    except Exception as e:
        print(f"Error fetching attendance: {e}")
        return jsonify({'success': False, 'message': f'Failed to fetch attendance: {e}'}), 500

# Run the Flask app
if __name__ == '__main__':
    # Run on all available interfaces and port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
