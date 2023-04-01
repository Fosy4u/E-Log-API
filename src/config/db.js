

// this is for locally installed mongodb
//module.exports = {
//   url: "mongodb://0.0.0.0:27017/",
//   database: "local",
//   imgBucket: "image",
// };
const config = {
  url: process.env.MONGODB_URI_DEV,
  database: "Data1",
  imgBucket: "pictures",
};
module.exports = config