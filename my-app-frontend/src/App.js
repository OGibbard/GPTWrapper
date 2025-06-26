// src/App.js
import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import axios from 'axios';

// Change this value to track your app version
const APP_VERSION = '1.0.0'; // <-- update this string as needed

function App() {
  const [user, setUser] = useState(null);
  const [publicData, setPublicData] = useState('');
  const [secretData, setSecretData] = useState('');

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error during Google login:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const fetchPublicData = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/public-data');
      setPublicData(response.data.message);
    } catch (error) {
      console.error("Error fetching public data:", error);
      setPublicData('Failed to fetch public data.');
    }
  };

  const fetchSecretData = async () => {
    if (!user) {
      alert('You must be logged in to see the secret message!');
      return;
    }

    try {
      // Get the Firebase ID token from the current user.
      const token = await user.getIdToken();

      // Send the token to your backend in the Authorization header.
      const response = await axios.get('http://localhost:5000/api/secret-data', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setSecretData(response.data.message);
    } catch (error) {
      console.error("Error fetching secret data:", error);
      setSecretData(`Failed to fetch secret data. ${error.response?.data || ''}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>React, Node & Firebase</h1>
      <div style={{ color: 'gray', fontSize: '0.9em' }}>
        Version: {APP_VERSION}
      </div>
      {user ? (
        <div>
          <p>Welcome, {user.displayName}!</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <button onClick={handleGoogleLogin}>Login with Google</button>
      )}

      <hr style={{ margin: '20px 0' }} />

      <div>
        <button onClick={fetchPublicData}>Fetch Public Data</button>
        <p><strong>Public API Response:</strong> {publicData}</p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button onClick={fetchSecretData}>Fetch Secret Data</button>
        <p><strong>Secret API Response:</strong> {secretData}</p>
      </div>
    </div>
  );
}

export default App;