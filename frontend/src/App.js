import React, { useRef, useState, useEffect } from 'react';

// Main App component for the face attendance system
function App() {
  // useRef to get direct access to the video element
  const videoRef = useRef(null);
  // useState for managing the video stream from the webcam
  const [stream, setStream] = useState(null);
  // useState for messages displayed to the user (e.g., success, error)
  const [message, setMessage] = useState('');
  // useState for the name input when registering a new face
  const [name, setName] = useState('');
  // useState to store known registered faces (for admin view)
  const [knownFaces, setKnownFaces] = useState([]);
  // useState to store all attendance records (for admin view)
  const [allAttendance, setAllAttendance] = useState({});
  // useState to manage loading state during API calls
  const [isLoading, setIsLoading] = useState(false);
  // useState to manage the current user role ('landing', 'guest', 'admin')
  const [currentRole, setCurrentRole] = useState('landing'); // 'landing', 'guest', 'admin'
  // useState to manage the currently displayed view within the admin dashboard
  const [currentAdminView, setCurrentAdminView] = useState('attendance_reports'); // 'register', 'manage_users', 'attendance_reports'
  // useState for confirmation modal visibility
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // useState for the action to be confirmed by the modal
  const [confirmAction, setConfirmAction] = useState(null);
  // useState for data related to the confirmation (e.g., user name for deletion)
  const [confirmData, setConfirmData] = useState(null);

  // States specific to the Guest (User) view - simplified
  const [recognizedUserName, setRecognizedUserName] = useState(null);
  const [recognizedActionType, setRecognizedActionType] = useState(null); // To store 'check-in' or 'check-out'

  // Base URL for the backend API
  const API_BASE_URL = 'http://127.0.0.1:5000'; // Ensure this matches your Flask backend URL

  // Effect hook for webcam access: runs when role changes to guest or admin
  useEffect(() => {
    let mediaStream = null; // Declare locally to manage within this effect's closure

    const startWebcam = async () => {
      try {
        // Only request media if no stream is currently active or assigned to the video element
        if (!videoRef.current.srcObject) {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            // Attempt to play, catch potential errors like "play() interrupted"
            // Using await here ensures play() is attempted before setting stream state
            await videoRef.current.play().catch(e => console.error("Video play error:", e));
          }
          setStream(mediaStream); // Update state only after successful setup and play attempt
          setMessage(''); // Clear any previous error messages
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
        setMessage('Error: Could not access webcam. Please ensure it is connected and permissions are granted.');
      }
    };

    const stopWebcam = () => {
      if (mediaStream) { // Use the local mediaStream reference for stopping tracks
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null; // Clear local reference
      }
      if (stream) { // Also ensure the state-managed stream is stopped
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null; // Explicitly release video element source
      }
      setStream(null); // Always clear stream state
    };

    // Logic to start/stop webcam based on currentRole
    if (currentRole !== 'landing') {
      startWebcam(); // Always attempt to start if not on landing page
    } else {
      stopWebcam(); // Stop if moving to landing page
    }

    // Cleanup function: runs when component unmounts or currentRole changes
    return () => {
      stopWebcam(); // Ensure webcam is stopped on unmount or role change
    };
  }, [currentRole]); // Only currentRole as dependency for this effect

  // Function to fetch all known faces and all attendance records (primarily for admin view)
  const fetchAllAdminData = async () => {
    try {
      // Fetch known faces
      const facesResponse = await fetch(`${API_BASE_URL}/get_known_faces`);
      const facesData = await facesResponse.json();
      if (facesData.success) {
        setKnownFaces(facesData.known_faces);
      } else {
        console.error(`Error fetching known faces: ${facesData.message}`);
      }

      // Fetch all attendance records
      const attendanceResponse = await fetch(`${API_BASE_URL}/get_attendance`);
      const attendanceData = await attendanceResponse.json();
      if (attendanceData.success) {
        setAllAttendance(attendanceData.attendance);
      } else {
        console.error(`Error fetching all attendance: ${attendanceData.message}`);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      // setMessage('Error: Could not connect to backend to fetch admin data.'); // Only show if critical
    }
  };

  // Effect hook for admin data fetching: runs on mount and periodically for attendance reports
  useEffect(() => {
    let intervalId;
    if (currentRole === 'admin') {
      // Fetch data immediately when entering admin view
      fetchAllAdminData();

      // Set up polling for attendance reports if in that specific admin view
      if (currentAdminView === 'attendance_reports') {
        intervalId = setInterval(fetchAllAdminData, 5000); // Poll every 5 seconds
      }
    }

    // Cleanup interval on component unmount or view change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentRole, currentAdminView]); // Dependencies: re-run if role or admin view changes

  // Function to capture a frame from the video stream
  const captureFrame = () => {
    // Ensure videoRef.current exists AND the video is ready to play (readyState >= 2)
    // readyState 0: HAVE_NOTHING, 1: HAVE_METADATA, 2: HAVE_CURRENT_DATA, 3: HAVE_FUTURE_DATA, 4: HAVE_ENOUGH_DATA
    if (!videoRef.current || videoRef.current.readyState < 2) {
      setMessage('Video stream not ready. Please wait or check webcam connection/permissions.');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png');
    return imageData.split(',')[1];
  };

  // Function to register a new face (Admin only)
  const handleRegisterFace = async () => {
    if (!name.trim()) {
      setMessage('Please enter a name to register.');
      return;
    }

    const imageData = captureFrame();
    if (!imageData) {
      setMessage('Failed to capture image for registration. Is webcam active?');
      return;
    }

    setIsLoading(true);
    setMessage('Registering face...');

    try {
      const response = await fetch(`${API_BASE_URL}/register_face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData, name: name.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`Face registered for ${name.trim()}!`);
        setName(''); // Clear the name input
        fetchAllAdminData(); // Refetch admin data to update registered faces list
      } else {
        setMessage(`Registration failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error during registration:', error);
      setMessage('Error: Could not connect to backend for registration.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to recognize a face and record attendance (Guest or Admin)
  const handleRecognizeFace = async () => {
    const imageData = captureFrame();
    if (!imageData) {
      setMessage('Failed to capture image for recognition. Is webcam active?');
      return;
    }

    setIsLoading(true);
    setMessage('Recognizing face...'); // Set a temporary message during processing
    setRecognizedUserName(null); // Clear previous recognition
    setRecognizedActionType(null); // Clear previous action type

    try {
      const response = await fetch(`${API_BASE_URL}/recognize_face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage(data.message); // Use the sassy message from backend
        setRecognizedUserName(data.name); // Set recognized user name
        setRecognizedActionType(data.action_type); // Set action type
        
        // If in admin view, also refresh all admin data
        if (currentRole === 'admin') {
          fetchAllAdminData();
        }
      } else {
        setMessage(`Recognition failed: ${data.message}`);
        setRecognizedUserName(null);
        setRecognizedActionType(null);
      }
    } catch (error) {
      console.error('Error during recognition:', error);
      setMessage('Error: Could not connect to backend for recognition.');
      setRecognizedUserName(null);
      setRecognizedActionType(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle deletion of a specific user (Admin only)
  const handleDeleteUser = async (userName) => {
    setIsLoading(true);
    setMessage(`Deleting user ${userName}...`);
    try {
      const response = await fetch(`${API_BASE_URL}/delete_user/${userName}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchAllAdminData(); // Refetch admin data to update lists
      } else {
        setMessage(`Deletion failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error during user deletion:', error);
      setMessage('Error: Could not connect to backend for user deletion.');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false); // Close modal
      setConfirmAction(null);
      setConfirmData(null);
    }
  };

  // Function to handle clearing all attendance records (Admin only)
  const handleClearAllAttendance = async () => {
    setIsLoading(true);
    setMessage('Clearing all attendance records...');
    try {
      const response = await fetch(`${API_BASE_URL}/clear_all_attendance`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchAllAdminData(); // Refetch admin data to clear attendance display
      } else {
        setMessage(`Clearing failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error during clearing attendance:', error);
      setMessage('Error: Could not connect to backend for clearing attendance.');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false); // Close modal
      setConfirmAction(null);
      setConfirmData(null);
    }
  };

  // Function to show the confirmation modal
  const confirmActionWithModal = (action, data = null) => {
    setConfirmAction(() => action); // Store the function to be called
    setConfirmData(data); // Store any data needed for the action
    setShowConfirmModal(true);
  };

  // Function to execute the confirmed action
  const executeConfirmedAction = () => {
    if (confirmAction) {
      confirmAction(confirmData); // Call the stored function with its data
    }
  };

  // Confirmation Modal Component
  const ConfirmationModal = () => {
    if (!showConfirmModal) return null;

    let modalMessage = "";
    if (confirmAction === handleDeleteUser) {
      modalMessage = `Are you sure you want to delete user "${confirmData}"? This action cannot be undone.`;
    } else if (confirmAction === handleClearAllAttendance) {
      modalMessage = "Are you sure you want to clear ALL attendance records? This action cannot be undone.";
    }

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full text-center border-t-4 border-red-500 transform transition-all duration-300 scale-100 opacity-100">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Confirm Action</h3>
          <p className="text-gray-700 mb-6">{modalMessage}</p>
          <div className="flex justify-around gap-4">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 px-6 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200 font-semibold shadow-md"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={executeConfirmedAction}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper to format timestamps for display (still useful for admin view)
  const formatTimestamp = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(); // Formats to local date and time string
    } catch (e) {
      return isoString; // Return as-is if invalid
    }
  };

  // --- Render based on currentRole ---
  if (currentRole === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col items-center justify-center p-6 font-inter text-white">
        <h1 className="text-5xl font-extrabold mb-12 text-shadow-lg drop-shadow-lg">
          Welcome to Face Attendance System
        </h1>
        <div className="flex flex-col sm:flex-row gap-8 w-full max-w-lg">
          <button
            onClick={() => setCurrentRole('guest')}
            className="flex-1 px-8 py-5 bg-white text-blue-700 text-xl font-bold rounded-xl shadow-2xl hover:bg-blue-50 transition duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50"
          >
            Clock In/Out
          </button>
          <button
            onClick={() => setCurrentRole('admin')}
            className="flex-1 px-8 py-5 bg-white text-purple-700 text-xl font-bold rounded-xl shadow-2xl hover:bg-purple-50 transition duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50"
          >
            Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 font-inter">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">Face Attendance System</h1>

      {/* Back to Home Button */}
      <button
        onClick={() => {
          setCurrentRole('landing');
          setMessage(''); // Clear messages on role change
          setRecognizedUserName(null); // Clear guest-specific data
          setRecognizedActionType(null); // Clear guest-specific action type
        }}
        className="absolute top-6 left-6 px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-200 shadow-md flex items-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span>Back to Home</span>
      </button>

      {/* Main Content Area */}
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col lg:flex-row gap-8 border-t-8 border-indigo-600">
        {/* Webcam Feed Section (always visible when not on landing page) */}
        <div className="flex-1 flex flex-col items-center p-4 bg-gray-50 rounded-xl shadow-inner border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Live Webcam Feed</h2>
          <div className="w-full max-w-md aspect-video bg-gray-200 rounded-xl overflow-hidden shadow-lg border border-gray-300">
            <video ref={videoRef} className="w-full h-full object-cover rounded-xl" autoPlay playsInline muted></video>
          </div>
          {/* Centralized message display */}
          {message && (
            <p className={`mt-4 px-4 py-2 rounded-lg text-center font-medium
              ${message.includes('Error') ? 'bg-red-100 text-red-700' :
                (message.includes('Welcome') || message.includes('Alright')) ? 'bg-green-100 text-green-700' :
                'bg-blue-100 text-blue-700'}`}>
              {message}
            </p>
          )}
        </div>

        {/* Dynamic Content Section based on currentRole and currentAdminView */}
        <div className="flex-1 flex flex-col gap-6 p-4">
          {currentRole === 'guest' && (
            <>
              <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-xl shadow-lg border border-green-200">
                <h3 className="text-2xl font-bold text-green-800 mb-5 text-center">Clock In / Clock Out</h3>
                <button
                  onClick={handleRecognizeFace}
                  className="w-full bg-green-600 text-white py-4 rounded-xl hover:bg-green-700 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-xl"
                  disabled={isLoading || !stream}
                >
                  {isLoading ? 'Processing...' : 'Recognize & Record Attendance'}
                </button>

                {/* Removed the redundant message display here */}
                {recognizedUserName && (
                  <div className="mt-8 text-center bg-white p-6 rounded-xl shadow-md border border-gray-200">
                    <h4 className={`text-2xl font-extrabold mb-3 ${recognizedActionType === 'check-in' ? 'text-green-700' : 'text-blue-700'}`}>
                      {/* The message is now displayed below the webcam feed */}
                      {recognizedActionType === 'check-in' ? 'Check-in successful!' : 'Check-out successful!'}
                    </h4>
                    <p className="text-gray-700 text-lg">
                      Have a great day, <span className="font-semibold text-gray-900">{recognizedUserName}</span>!
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {currentRole === 'admin' && (
            <>
              {/* Admin Navigation Tabs */}
              <div className="flex justify-center flex-wrap gap-2 mb-6 bg-gray-100 p-3 rounded-xl shadow-inner border border-gray-200">
                <button
                  onClick={() => setCurrentAdminView('attendance_reports')}
                  className={`px-5 py-2.5 rounded-lg text-base font-medium transition duration-300 shadow-sm ${
                    currentAdminView === 'attendance_reports' ? 'bg-yellow-600 text-white scale-105' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Attendance Reports
                </button>
                <button
                  onClick={() => setCurrentAdminView('register')}
                  className={`px-5 py-2.5 rounded-lg text-base font-medium transition duration-300 shadow-sm ${
                    currentAdminView === 'register' ? 'bg-blue-600 text-white scale-105' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Register New User
                </button>
                <button
                  onClick={() => setCurrentAdminView('manage_users')}
                  className={`px-5 py-2.5 rounded-lg text-base font-medium transition duration-300 shadow-sm ${
                    currentAdminView === 'manage_users' ? 'bg-purple-600 text-white scale-105' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Manage Users
                </button>
              </div>

              {/* Admin Content based on currentAdminView */}
              {currentAdminView === 'register' && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border border-blue-200">
                  <h3 className="text-2xl font-bold text-blue-800 mb-5 text-center">Register New Face</h3>
                  <input
                    type="text"
                    placeholder="Enter Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-5 text-lg shadow-sm"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleRegisterFace}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-xl"
                    disabled={isLoading || !stream}
                  >
                    {isLoading ? 'Registering...' : 'Register Face'}
                  </button>
                </div>
              )}

              {currentAdminView === 'manage_users' && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl shadow-lg border border-purple-200">
                  <h3 className="text-2xl font-bold text-purple-800 mb-5 text-center">Manage Registered Users ({knownFaces.length})</h3>
                  <div className="max-h-80 overflow-y-auto bg-white p-4 rounded-lg shadow-inner border border-gray-100">
                    {knownFaces.length > 0 ? (
                      <ul className="list-none text-gray-700 space-y-2">
                        {knownFaces.map((face, index) => (
                          <li key={index} className="flex justify-between items-center py-2.5 px-3 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-lg font-medium text-gray-800">{face}</span>
                            <button
                              onClick={() => confirmActionWithModal(handleDeleteUser, face)}
                              className="ml-4 px-4 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md"
                              disabled={isLoading}
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-600 italic text-center">No faces registered yet.</p>
                    )}
                  </div>
                </div>
              )}

              {currentAdminView === 'attendance_reports' && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl shadow-lg border border-yellow-200">
                  <h3 className="text-2xl font-bold text-yellow-800 mb-5 text-center">Attendance Reports</h3>
                  <div className="max-h-80 overflow-y-auto bg-white p-4 rounded-lg shadow-inner border border-gray-100 mb-6">
                    {Object.keys(allAttendance).length > 0 ? (
                      <ul className="list-none text-gray-700 space-y-4">
                        {Object.entries(allAttendance).map(([personName, entries]) => (
                          <li key={personName} className="py-2.5 px-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                            <span className="font-bold text-lg text-yellow-900">{personName}</span> ({entries.length} entries):
                            <ul className="list-disc list-inside ml-6 text-sm mt-2 space-y-1">
                              {entries.length > 0 ? (
                                entries.map((entry, idx) => (
                                  <li key={`${personName}-${idx}`} className="text-gray-800">
                                    {formatTimestamp(entry.timestamp)} - <span className={`font-semibold ${entry.type === 'check-in' ? 'text-green-600' : 'text-blue-600'}`}>{entry.type.toUpperCase()}</span>
                                  </li>
                                ))
                              ) : (
                                <li className="italic text-gray-600">No attendance recorded.</li>
                              )}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-600 italic text-center">No attendance recorded yet.</p>
                    )}
                  </div>
                  <button
                    onClick={() => confirmActionWithModal(handleClearAllAttendance)}
                    className="w-full bg-red-600 text-white py-4 rounded-xl hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-xl"
                    disabled={isLoading || Object.keys(allAttendance).length === 0}
                  >
                    Clear All Attendance
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmationModal />
    </div>
  );
}

export default App;
