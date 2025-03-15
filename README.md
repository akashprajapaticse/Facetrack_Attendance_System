### **Updated README.md** for FaceTrack Attendance System

```markdown
# 🎯 FaceTrack Attendance System

This project is a **Face Recognition-based Attendance System** built using **Python** and **OpenCV**. It uses the **face_recognition** library to detect and recognize faces from live webcam input and automatically logs attendance in a CSV file.

---

## 📌 **Features**
✅ Real-time face detection and recognition  
✅ Automatic attendance logging in a CSV file  
✅ Multiple face recognition support  
✅ Fast and efficient face matching  

---

## 🛠️ **Tech Stack**
- **Python** – Programming language  
- **OpenCV** – For real-time video processing  
- **face_recognition** – For face detection and recognition  
- **NumPy** – For numerical computations  
- **CSV** – For attendance logging  

---

## 📂 **Folder Structure**
```
├── facerecognition.py     # Main script for face recognition and attendance
├── faces/                 # Folder containing known face images
├── requirements.txt       # Project dependencies
├── README.md              # Project documentation
```

---

## 🚀 **Setup and Usage**
### ✅ **1. Clone the repository**:
```bash
git clone https://github.com/akashprajapaticse/FaceTrack-Attendance-System.git
```

### ✅ **2. Create a virtual environment**:
```bash
python -m venv venv
source venv/bin/activate   # For Linux/macOS
venv\Scripts\activate      # For Windows
```

### ✅ **3. Install dependencies**:
```bash
pip install -r requirements.txt
```

### ✅ **4. Add Known Faces**:
- Create a folder named `faces` in the project directory.
- Save known face images as `.jpg` files in the `faces` folder.
- Example:
```
faces/
├── person1.jpg
├── person2.jpg
```

### ✅ **5. Run the program**:
```bash
python facerecognition.py
```

---

## 🎯 **How to Use**
1. **Face Detection** – The webcam will detect faces in real-time.  
2. **Face Recognition** – If a face matches a known person, their name will be displayed on the screen.  
3. **Attendance Logging** – Attendance is logged automatically in a CSV file named after the current date.  
4. **Exit** – Press **'q'** to stop the program.  

---

## 🚨 **Dependencies**
Install dependencies using:
```bash
pip install face-recognition opencv-python-headless numpy
```

---

## 📝 **Contributing**
Feel free to contribute by opening a pull request or reporting issues!  

---

## ⭐ **Give this project a star if you found it helpful!** 🌟
