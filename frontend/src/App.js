import React, { useRef, useEffect, useState, useCallback } from 'react';

// Main App component
const App = () => {
  // Refs for DOM elements
  const webcamVideoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const tempCanvasRef = useRef(null); // Temporary canvas for sending frames

  // State variables
  const [stream, setStream] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Click "Start Webcam" to begin.');
  const [isLoading, setIsLoading] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [messageBox, setMessageBox] = useState({ visible: false, message: '' });

  // Configuration for backend communication and frame processing
  const BACKEND_URL = 'http://127.0.0.1:5000/process_frame';
  const FRAME_INTERVAL_MS = 200; // Process a frame every 200ms (5 FPS)
  let animationFrameId = null; // To store requestAnimationFrame ID
  let lastFrameTime = 0; // To control frame sending interval

  // Function to show custom message box
  const showMessageBox = useCallback((message) => {
    setMessageBox({ visible: true, message });
  }, []);

  // Function to hide custom message box
  const hideMessageBox = useCallback(() => {
    setMessageBox({ visible: false, message: '' });
  }, []);

  // Function to start the webcam
  const startWebcam = useCallback(async () => {
    try {
      // Request access to the user's camera with a specific resolution
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setStream(mediaStream);
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = mediaStream;
        await webcamVideoRef.current.play(); // Ensure video is playing
      }
      setIsWebcamActive(true);
      setStatusMessage('Webcam started. Connecting to backend...');
    } catch (err) {
      console.error('Error accessing webcam:', err);
      if (err.name === 'NotAllowedError') {
        showMessageBox('Webcam access denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        showMessageBox('No webcam found. Please ensure a webcam is connected and enabled.');
      } else {
        showMessageBox('Could not start webcam: ' + err.message);
      }
      setStatusMessage('Failed to start webcam.');
    }
  }, [showMessageBox]);

  // Function to stop the webcam
  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop()); // Stop all tracks in the stream
      setStream(null);
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId); // Stop the drawing loop
      animationFrameId = null;
    }
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height); // Clear canvas
    }
    setIsWebcamActive(false);
    setIsLoading(false);
    setStatusMessage('Webcam stopped.');
    lastFrameTime = 0; // Reset timer for next start
  }, [stream]);

  // Function to send frame to backend and draw results
  const processFrameAndDraw = useCallback(async () => {
    if (!webcamVideoRef.current || webcamVideoRef.current.paused || webcamVideoRef.current.ended) {
      return; // Do not process if video is not active
    }

    const video = webcamVideoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;

    if (!overlayCanvas || !tempCanvas) return;

    const ctx = overlayCanvas.getContext('2d');
    const tempCtx = tempCanvas.getContext('2d');

    // Set temporary canvas dimensions to match video
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    // Draw video frame onto the temporary canvas (mirroring it)
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.save();
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.restore();

    // Convert canvas content to base64 image
    const imageData = tempCanvas.toDataURL('image/jpeg', 0.8); // JPEG format, 80% quality

    setIsLoading(true); // Show loading spinner

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      
      // Clear overlay canvas for new drawing
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Process and draw results from the backend
      if (!data.is_live) {
        setStatusMessage('SPOOF DETECTED! Please present a live face.');
        ctx.strokeStyle = '#ef4444'; // Red for spoof
        ctx.lineWidth = 4;
        // Draw a large red X or outline to indicate spoof
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(overlayCanvas.width, overlayCanvas.height);
        ctx.moveTo(overlayCanvas.width, 0);
        ctx.lineTo(0, overlayCanvas.height);
        ctx.stroke();
        ctx.font = 'bold 36px Inter';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("SPOOF DETECTED!", overlayCanvas.width / 2, overlayCanvas.height / 2);

      } else if (data.faces && data.faces.length > 0) {
        let recognizedCount = 0;
        data.faces.forEach(face => {
          const [top, right, bottom, left] = face.box;
          const name = face.name;

          // Draw bounding box
          ctx.strokeStyle = '#22c55e'; // Green for live/recognized
          ctx.lineWidth = 4;
          // Adjust coordinates for mirrored canvas
          const mirroredLeft = overlayCanvas.width - right;
          const mirroredRight = overlayCanvas.width - left;
          ctx.strokeRect(mirroredLeft, top, mirroredRight - mirroredLeft, bottom - top);

          // Draw name label
          ctx.fillStyle = '#22c55e'; // Green background for name
          ctx.fillRect(mirroredLeft, bottom, mirroredRight - mirroredLeft, 30);
          ctx.font = 'bold 20px Inter';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(name, mirroredLeft + 5, bottom + 5);

          if (name !== "Unknown") {
            recognizedCount++;
          }
        });

        if (recognizedCount > 0) {
          setStatusMessage(`Recognized ${recognizedCount} face(s). Attendance may be marked.`);
        } else {
          setStatusMessage('Face(s) detected. Looking for a match...');
        }
      } else {
        setStatusMessage('No face detected. Please align your face in the camera.');
      }

    } catch (error) {
      console.error('Error processing frame:', error);
      setStatusMessage('Error: Could not connect to backend or process frame.');
      // Optionally show a message box for critical errors
      // showMessageBox('Backend connection error. Please ensure the Python backend is running.');
    } finally {
      setIsLoading(false); // Hide loading spinner
    }
  }, []); // Dependencies for useCallback

  // Effect to handle video metadata loading and start animation loop
  useEffect(() => {
    const video = webcamVideoRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    const handleLoadedMetadata = () => {
      if (video && overlayCanvas) {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
        // Start the animation loop after video metadata is loaded
        const animate = (currentTime) => {
          if (currentTime - lastFrameTime >= FRAME_INTERVAL_MS) {
            processFrameAndDraw();
            lastFrameTime = currentTime;
          }
          animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (video && stream) {
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    // Cleanup function
    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [stream, processFrameAndDraw]); // Re-run effect if stream or processFrameAndDraw changes

  // Initial check for camera availability on component mount
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showMessageBox('Your browser does not support webcam access.');
      // Disable start button if webcam not supported
      if (webcamVideoRef.current) {
        webcamVideoRef.current.disabled = true;
      }
    }
  }, [showMessageBox]);

  return (
    <div className="flex justify-center items-center min-h-screen p-4 box-border bg-gray-100 font-inter">
      <div className="container bg-white rounded-3xl shadow-lg p-8 w-full max-w-xl flex flex-col gap-6">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-4">Facetrack Attendance</h1>

        <div className="video-container relative w-full pt-[75%] bg-gray-200 rounded-xl overflow-hidden">
          <video ref={webcamVideoRef} autoPlay playsInline className="absolute top-0 left-0 w-full h-full object-cover rounded-xl transform scale-x-[-1]"></video>
          <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full rounded-xl transform scale-x-[-1] z-10"></canvas>
          {/* Hidden canvas for capturing frames to send to backend */}
          <canvas ref={tempCanvasRef} style={{ display: 'none' }}></canvas>
        </div>

        <div id="statusMessage" className="status-message min-h-10 flex items-center justify-center font-semibold text-gray-700">
          {statusMessage}
        </div>

        <div className="flex justify-center gap-4">
          {!isWebcamActive ? (
            <button
              onClick={startWebcam}
              className="button button-primary px-6 py-3 text-lg"
            >
              Start Webcam
            </button>
          ) : (
            <button
              onClick={stopWebcam}
              className="button button-secondary px-6 py-3 text-lg"
            >
              Stop Webcam
            </button>
          )}
          {isLoading && <span className="spinner ml-2"></span>}
        </div>
      </div>

      {/* Custom Message Box */}
      {messageBox.visible && (
        <div className="message-box fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-8 rounded-xl shadow-2xl z-[1000] text-center max-w-90 w-96 block">
          <p className="message-box-content text-xl text-gray-700 mb-6">{messageBox.message}</p>
          <button onClick={hideMessageBox} className="message-box-button bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold cursor-pointer transition-colors duration-200 hover:bg-blue-600">
            OK
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
