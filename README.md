# FaceTrack Attendance System

🚀 **Project Overview**  
FaceTrack Attendance System is a modern, full‑stack application that automates attendance tracking with facial recognition. It streamlines record‑keeping, user management, and analytics—ideal for schools, small businesses, or any organization that needs an efficient, contact‑free attendance solution.

---

## ✨ Features

| Category | Description |
| -------- | ----------- |
| **Facial Recognition Attendance** | Detects and identifies faces from a live camera feed and timestamps attendance automatically. |
| **User Management** | Create, update, and delete user profiles—including their facial embeddings. |
| **Attendance Logging** | Stores user ID, date, and time for every check‑in event. |
| **Attendance History & Filters** | Search or filter logs by user, date range, or status. |
| **Intuitive UI** | Clean, responsive React interface built with Tailwind CSS. |
| **Modular Architecture** | Decoupled React frontend and Flask REST API for easy scaling. |
| **Secure Storage (TODO)** | Encrypt facial data and logs in production deployments. |

---

## 🛠️ Technologies Used

| Layer | Stack |
| ----- | ----- |
| **Backend** | Python 3.8+, Flask, `face_recognition`, OpenCV, SQLite (dev) / PostgreSQL (prod), Gunicorn |
| **Frontend** | React 18, Tailwind CSS, JavaScript (ES6+), Vite / Create‑React‑App |
| **Dev Ops** | Docker (optional), GitHub Actions (CI/CD) |

---

## ⚙️ Setup and Installation

> **Prerequisites**  
> * Git  
> * Python 3.8+ & `pip`  
> * Node.js ≥ 18 & `npm` (or Yarn)

### 1. Clone the Repository

```bash
git clone https://github.com/<your‑username>/facetrack-attendance.git
cd facetrack-attendance
````

### 2. Backend Setup

```bash
cd backend
python -m venv venv
# Activate (Windows)
.\venv\Scripts\activate
# Activate (macOS / Linux)
source venv/bin/activate

pip install -r requirements.txt
```

> **Note:** SQLite is the default dev database—no extra setup needed.
> For PostgreSQL/MySQL, create a DB and update `config.py` or environment variables.

#### Run the Backend (development)

```bash
export FLASK_APP=app.py      # PowerShell: set FLASK_APP=app.py
flask run                    # Defaults to http://127.0.0.1:5000
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install          # or: yarn
npm start            # Opens at http://localhost:3000
```

### 4. Configure API Endpoint

Create `frontend/.env` and add:

```
REACT_APP_API_URL=http://127.0.0.1:5000
```

Restart the React dev server for changes to take effect.

---

## 🚀 Usage

1. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
2. **Add users** and capture their facial data.
3. **Start the camera feed** to record attendance.
4. **Browse Logs** to review or export attendance history.

---

## ☁️ Deployment

| Component      | Recommended Platforms                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| **Frontend**   | GitHub Pages · Netlify · Vercel · Render (Static)                                 |
| **Backend**    | Render Web Service · Fly.io · Railway · AWS Elastic Beanstalk · Heroku (Procfile) |
| **Containers** | Build a Docker image and deploy to Google Cloud Run, AWS ECS, or a K8s cluster    |

> Remember to update `REACT_APP_API_URL` to your production backend URL and enable CORS for the frontend domain.

---

## 🤝 Contributing

1. **Fork** the repo
2. `git checkout -b feature/awesome‑feature`
3. **Commit** your changes
4. `git push origin feature/awesome‑feature`
5. Open a **Pull Request**

All contributions—bug fixes, new features, docs—are welcome!

---

## 📄 License

This project is licensed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

```
