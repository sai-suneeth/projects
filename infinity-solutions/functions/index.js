const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const cors = require("cors");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const crypto = require("crypto");
const moment = require("moment-timezone");
const slotTimeouts = {};

// Initialize Firebase Admin SDK
admin.initializeApp();

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
app.post("/create-order", async (req, res) => {
  const {amount, receipt, notes} = req.body;

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // amount in paisa
      currency: "INR",
      receipt: receipt,
      payment_capture: 1, // auto capture
      notes: notes,
    });

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    });
    console.log("Incoming /create-order request body:", req.body);
  } catch (error) {
    res.status(500).send(error);
  }
});


// Razorpay Webhook function to handle payment events
exports.razorpayWebhook1 = functions.https.onRequest(async (req, res) => {
  console.log("Received a request at Razorpay Webhook");

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const receivedSignature = req.headers["x-razorpay-signature"];
  const payload = JSON.stringify(req.body);

  // Verify the Razorpay webhook signature
  const verifyWebhookSignature = (payload, signature, secret) => {
    const expectedSignature = crypto.createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
    return expectedSignature === signature;
  };

  if (!verifyWebhookSignature(payload, receivedSignature, secret)) {
    console.error("Invalid signature detected");
    return res.status(400).send("Invalid signature.");
  }

  const {event, payload: eventData} = req.body;
  const paymentId = eventData.payment.entity.id;
  const userId = eventData.payment.entity.notes.userId;
  let slotIds = eventData.payment.entity.notes.slotIds;
  if (typeof slotIds === "string") {
    slotIds = slotIds.split(",");
  } else if (!Array.isArray(slotIds)) {
    slotIds = [];
  }
  const controllers = eventData.payment.entity.notes.controllers;
  const bookingPrice = eventData.payment.entity.amount / 100;
  const userName = eventData.payment.entity.notes.username;
  const startTime = eventData.payment.entity.notes.startTime;
  const endTime = eventData.payment.entity.notes.endTime;

  try {
    const db = admin.firestore();
    if (event === "payment.captured") {
      console.log("Processing payment.captured event");

      const processedRef = db.collection("processedPayments").doc(paymentId);
      const processedDoc = await processedRef.get();
      if (processedDoc.exists) {
        console.log("Payment already processed, skipping:", paymentId);
        return res.status(200).send("Already handled");
      }


      await db.collection("webhookQueue").add({
        data: eventData,
      });

      console.log("userId:", userId);
      console.log("slotIds:", slotIds);
      console.log("controllers:", controllers);
      console.log("bookingPrice:", bookingPrice);
      console.log("userName:", userName);
      console.log("startTime:", startTime);
      console.log("endTime:", endTime);

      await exports.handleCallbackBooking.run({
        userId,
        slotIds,
        controllers,
        bookingPrice,
        userName,
        startTime,
        endTime,
      });

      await processedRef.set({
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("handleCallbackBooking triggered successfully.");
    } else if (event === "payment.failed") {
      console.log("Processing payment.failed event");

      // Call the releaseLockedSlots function to release booked slots
      await exports.releaseLockedSlots.run({
        selectedSlots: slotIds}, {});
      console.log("releaseLockedSlots function called successfully.");
    }

    res.status(200).send("Webhook handled successfully.");
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Error handling webhook.");
  }
});


exports.handleCallbackBooking =functions.https.onCall(async (data, context) => {
  try {
    // Extract relevant information from the incoming data
    const {
      userId,
      slotIds,
      controllers,
      bookingPrice,
      userName,
      startTime,
      endTime,
    } = data;

    if (!slotIds || !Array.isArray(slotIds)) {
      throw new Error("slotIds is undefined or not an array");
    }
    const format = "YYYYMMDD_HHmm";
    const startTimeParsed = moment
        .tz(startTime, format, "Asia/Kolkata").toDate();
    const endTimeParsed = moment
        .tz(endTime, format, "Asia/Kolkata").toDate();
    const successTime = new Date();

    // Firebase references
    const db = admin.database();
    const firestore = admin.firestore();

    // Update slots in Realtime Database
    const updates = {};
    slotIds.forEach((slotId, index) => {
      const slotNumber = index === slotIds.length - 1 ? 0 : index + 1;
      updates[`public/slots/${slotId}`] = {
        userId,
        controllers,
        userName,
        slotnumber: slotNumber,
      };
    });

    await db.ref().update(updates);
    console.log("Slots successfully updated");

    // Release the locked slots
    await exports.releaseLockedSlots.run({selectedSlots: slotIds});
    console.log("Locks released after successful booking");

    // Save booking details to Firestore
    const bookingDetails = {
      start_time: startTimeParsed,
      end_time: endTimeParsed,
      controllers: controllers,
      price: `₹${bookingPrice}`,
      success_booking_time: successTime,
    };

    // Store booking details under user's transactions
    const userTransactionsRef = firestore
        .collection("transactions").doc(userId);
    const dashboardDetailsRef = userTransactionsRef
        .collection("dashboardDetails");

    // Get the next document ID for Firestore
    const querySnapshot = await dashboardDetailsRef.get();
    let newId = 1;
    querySnapshot.forEach((doc) => {
      const docId = parseInt(doc.id);
      if (docId >= newId) newId = docId + 1;
    });
    const paddedId = newId.toString().padStart(2, "0");

    await dashboardDetailsRef.doc(paddedId).set(bookingDetails);
    console.log("Dashboard details successfully written with ID:", paddedId);

    return {success: true, message: "Booking successfully completed."};
  } catch (error) {
    console.error("Error processing booking:", error);
    return {success: false, message: "Error processing booking."};
  }
});


// Cloud Function to check if phone number exists
exports.checkPhoneExists = functions.https.onCall(async (data, context) => {
  const phoneNumber = data.phoneNumber;

  try {
    await admin.auth().getUserByPhoneNumber(phoneNumber);
    return {exists: true};
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return {exists: false};
    }
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});


exports.AccountDeletion = functions.https.onCall(async (data, context) => {
  const {uid} = data;

  const timerDuration = 4 * 60 * 1000;

  const deleteTaskRef = admin.firestore().collection("deleteTasks").doc(uid);
  await deleteTaskRef.set({
    uid: uid,
    timerSetAt: admin.firestore.FieldValue.serverTimestamp(),
    deleteTime: admin.firestore.Timestamp.fromMillis(Date.now()+timerDuration),
    timerCancelled: false,
  });


  setTimeout(async () => {
    const taskSnapshot = await deleteTaskRef.get();
    if (taskSnapshot.exists && !taskSnapshot.data().timerCancelled) {
      try {
        await admin.auth().deleteUser(uid);
        await deleteTaskRef.delete();
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  }, timerDuration);

  return {success: true};
});

exports.cancelAccountDelete = functions.https.onCall(async (data, context) => {
  const {uid} = data;

  const deleteTaskRef = admin.firestore().collection("deleteTasks").doc(uid);
  const taskSnapshot = await deleteTaskRef.get();

  if (taskSnapshot.exists) {
    await deleteTaskRef.update({timerCancelled: true});
  }

  return {success: true};
});

exports.lockSlotsTemporarily = functions.https.onCall(async (data, context) => {
  const {selectedSlots, userId} = data;

  try {
    const updates = {};
    const timestamp = Date.now();

    selectedSlots.forEach((slotId) => {
      updates[`public/locks/${slotId}`] = {
        userId,
        timestamp: timestamp + 3 * 60 * 1000,
      };
    });

    await admin.database().ref().update(updates);

    selectedSlots.forEach((slotId) => {
      slotTimeouts[slotId] = setTimeout(async () => {
        await admin.database().ref().update({[`public/locks/${slotId}`]: null});
        console.log(`Slot ${slotId} released after 3-minute timeout`);
      }, 3 * 60 * 1000);
    });

    return {success: true, message: "Slots locked successfully"};
  } catch (error) {
    console.error("Error locking slots:", error);
    return {success: false, error: "Failed to lock slots"};
  }
});

exports.releaseLockedSlots = functions.https.onCall(async (data, context) => {
  const {selectedSlots} = data;

  try {
    const updates = {};
    selectedSlots.forEach((slotId) => {
      if (slotTimeouts[slotId]) {
        clearTimeout(slotTimeouts[slotId]);
        delete slotTimeouts[slotId];
      }
      updates[`public/locks/${slotId}`] = null;
    });

    await admin.database().ref().update(updates);
    console.log("Successfully released locked slots:", selectedSlots);

    return {success: true, message: "Slots released successfully"};
  } catch (error) {
    console.error("Error releasing slots:", error);
    return {success: false, error: "Failed to release slots"};
  }
});

exports.app = functions.https.onRequest(app);
