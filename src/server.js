const cors = require("cors");
require("dotenv").config();
const { ENV } = require("./config");
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

  origin:
    ENV === "dev"
      ? "*"
      : [
          "https://elog.francongtech.com/",
          "https://francongtech.com/",
          "https://elog.francongtech.com/",
          "https://app.francongtech.com/",
          "https://dev-elog-nemfra.netlify.app/",
          "http://localhost:3000"
        ],

  exposedHeaders: ["f-version"],
};
app.use(cors(corsOptions));

//adding version to response body
app.use(function (req, res, next) {
  // res.set({ "x-version": process.env.npm_package_version });
  res.append("f-version", process.env.FRONTEND_VERSION);

  next();
});

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
      console.log(
        `Server is running... on port ${
          process.env.PORT || 8080
        } and frontend is on version ${process.env.FRONTEND_VERSION}`
      );
    });
  } catch (error) {
    console.error(new Date(), "Error Starting Server::", error);
  }
};

start();
