// src/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBHi03QtteLcbxVnfSelXuVlDOUdlpcsDo", // I'm using the key you provided, but double-check it's correct
  authDomain: "gpt-threads.firebaseapp.com",
  projectId: "gpt-threads",
  storageBucket: "gpt-threads.firebasestorage.app", // This looks like a typo, it should likely be "gpt-threads.appspot.com"
  messagingSenderId: "24883706877",
  appId: "1:24883706877:web:0b409fdcb8601987acb794"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. You need to get the auth service AND export it
export const auth = getAuth(app);