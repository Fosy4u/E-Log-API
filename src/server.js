
const cors = require("cors");
require('dotenv').config()
const {ENV} = require('./config')
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const dbConfig = require("../src/config/db");
const { ServerApiVersion } = require("mongodb");





const url = dbConfig.url;

const app = express();

// app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));

// app.use(bodyParser.urlencoded({ extended: true }));
const initRoutes = require("./routes");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
var corsOptions = {
  // origin: "http://localhost:4200",
};
app.use(cors(corsOptions));


const start = async () => {
  try {
    console.log("start");
    await mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    });
    console.log("connected", ENV);
    initRoutes(app);
    app.listen(process.env.PORT || 8080, () => {
      console.log("Server is running...");
    } );
  } catch (error) {
    console.error(new Date(), "Error Starting Server::", error);
  }
};

start();
