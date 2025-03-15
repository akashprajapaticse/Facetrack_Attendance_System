import face_recognition
import cv2
import numpy as np
import csv
from datetime import datetime

video_capture = cv2.VideoCapture(0)

# Load known faces
person1_image = face_recognition.load_image_file("faces/person1.jpg")
person1_encoding = face_recognition.face_encodings(person1_image)[0]

person2_image = face_recognition.load_image_file("faces/person2.jpg")
person2_encoding = face_recognition.face_encodings(person2_image)[0]

known_face_encodings = [person1_encoding, person2_encoding]
known_face_names = ["person1_name", "person2_name"] # you can add n nnumber of names and data

# List of expected students
students = known_face_names.copy()

face_locations = []
face_encodings = []

# Get the current date and time
now = datetime.now()
current_date = now.strftime("%Y-%m-%d")

f = open(f"{current_date}.csv", "w+", newline="")
lnwriter = csv.writer(f)

while True:
    _, frame = video_capture.read()
    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
    rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

    # Recognize faces
    face_locations = face_recognition.face_locations(rgb_small_frame)
    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

    for face_encoding in face_encodings:
        matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
        face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
        best_match_index = np.argmin(face_distances)

        if matches[best_match_index]:
            name = known_face_names[best_match_index]

        # Add the text if a person is present
        if name in known_face_names:
            font =cv2.FONT_HERSHEY_SIMPLEX
            bottomLeftCornerofText =(10,100)
            fontScale=1.5
            fontColor=(255,0,0)
            thickness=3
            linetype=2
            cv2.putText(frame,name+" Present ",bottomLeftCornerofText,font,fontScale,fontColor,thickness,linetype)
        if name in students:
            students.remove(name)
            curent_time=now.strftime("%H-%M%S")
            lnwriter.writerow([name,curent_time])
    cv2.imshow("Attendance", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# Release the video capture object and close the CSV file
video_capture.release()
f.close()
cv2.destroyAllWindows()
