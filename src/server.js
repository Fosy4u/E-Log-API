
const cors = require("cors");
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
    console.log("connected");
    initRoutes(app);
     let port = 8080;
    app.listen( () => {
      console.log(`Running at localhost:${port}`);
    });
  } catch (error) {
    console.error(new Date(), "Error Starting Server::", error);
  }
};

start();
