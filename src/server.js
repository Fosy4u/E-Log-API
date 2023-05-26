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


// app.use(
//   express.urlencoded({
//     extended: true,
//     limit: "500mb",
//     parameterLimit: 1000000,
//   })
// );
// app.use(express.json());
//  app.use(bodyParser.text({ limit: "500mb", extended: true , parameterLimit: 1000000}));

const initRoutes = require("./routes");
app.use(
  bodyParser.json({
    extended: true,
    limit: "500mb",
    parameterLimit: 1000000,
  })
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "500mb",
    parameterLimit: 1000000,
  })
);

var corsOptions = {
  // origin: "http://localhost:4200",

  origin: ENV === "dev" ? "*" : "*",
  // [
  //     "https://app.francongtech.com/:3001",
  //     "https://elog.francongtech.com/:*",
  //     "https://francongtech.com/:*",
  //     "https://elog.francongtech.com/:*",
  //     "https://app.francongtech.com/:*",
  //     "https://dev-elog-nemfra.netlify.app/:*",
  //     "https://www.francongtech.com/:*",
  //     "https://www.francongtech.com/:3000",
  //     "https://elog.francongtech.com/:3000",
  //     "https://francongtech.com/:3000",
  //     "https://elog.francongtech.com/:3000",
  //     "https://app.francongtech.com/:3000",
  //     "https://dev-elog-nemfra.netlify.app/:3000",
  //     "https://elog.francongtech.com",
  //     "http://localhost:3000",
  //   ],

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
