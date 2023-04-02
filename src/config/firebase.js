


const firebaseAdmin = require('firebase-admin');
 const config = require('../config/firebaseServiceAcc')


console.log("config", config)
const firebase = firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(config),
});
const storageRef = firebase.storage().bucket(`${process.env.FIRBASE_STORAGE_BUCKET}`);
module.exports={storageRef, firebase}

