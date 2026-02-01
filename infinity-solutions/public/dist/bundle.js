/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./public/src/login.js":
/*!*****************************!*\
  !*** ./public/src/login.js ***!
  \*****************************/
/***/ (() => {

eval("document.addEventListener('DOMContentLoaded', () => {\n  // Your web app's Firebase configuration\n  const firebaseConfig = {\n    apiKey: \"AIzaSyB0fEeHLqSc_xvrHSq7wFEC2CxZevORaFE\",\n    authDomain: \"kaboom-gaming-d326a.firebaseapp.com\",\n    databaseURL: \"https://kaboom-gaming-d326a-default-rtdb.firebaseio.com\",\n    projectId: \"kaboom-gaming-d326a\",\n    storageBucket: \"kaboom-gaming-d326a.appspot.com\",\n    messagingSenderId: \"856036165098\",\n    appId: \"1:856036165098:web:d09ca266a93d3103975e93\",\n    measurementId: \"G-38YKV3BR09\"\n  };\n\n  // Initialize Firebase\n  firebase.initializeApp(firebaseConfig);\n  const auth = firebase.auth();\n  const db = firebase.firestore(); // Ensure Firestore is initialized correctly\n\n  document.getElementById('login-button').addEventListener('click', loginUser);\n  document.getElementById('register-link').addEventListener('click', () => {\n    window.location.href = 'register.html';\n  });\n  document.getElementById('forgot-password-link').addEventListener('click', () => {\n    window.location.href = 'forgot-password.html';\n  });\n  function loginUser() {\n    const email = document.getElementById('login-email-phone').value;\n    const password = document.getElementById('login-password').value;\n    const message = document.getElementById('message');\n    message.textContent = ''; // Clear any previous message\n\n    if (!email || !password) {\n      message.textContent = 'Please enter both email and password';\n      return;\n    }\n\n    // Sign in with email and password\n    auth.signInWithEmailAndPassword(email, password).then(userCredential => {\n      message.textContent = 'Login successful!';\n      redirectToHomePage();\n    }).catch(error => {\n      console.error('Error logging in:', error);\n      message.textContent = 'Invalid email or password';\n    });\n    function redirectToHomePage() {\n      window.location.href = 'booking.html';\n    }\n  }\n});\n\n//# sourceURL=webpack:///./public/src/login.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./public/src/login.js"]();
/******/ 	
/******/ })()
;