const ImageModel = require("../models/images");
const path = require("path");
const uploadImage = require("../middleware/uploadImage");
const mongoose = require("mongoose");
const Grid = require("gridfs-stream");
const GridFSBucket = require("mongodb").GridFSBucket;
const fs = require("fs");
const { dirname } = require("path");
const root = require("../../root");
// const ImageModel = require("../models/images");
let gfs;

const uploadPicture = async (req, res) => {
  try {
    console.log("received");
    console.log("file", req.file);
    console.log("body", req.body.name);

    if (req.file === undefined) {
      return res.status(400).send({ message: "You must select a file." });
    }
    const obj = {
      name: req.file.filename,
      desc: req.file.fieldname,
      img: {
        data: fs.readFileSync(
          path.join(root + "/uploads/" + req.file.filename)
        ),
        contentType: "image/png",
      },
    };
    const newImage = ImageModel.create(obj, (err, item) => {
      if (err) {
        console.log(err);
      } else {
        return res.status(200).send({
          message: "File has been uploaded.",
          file: newImage,
        });
      }
    });

    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection("pictures");

    const file = await gfs.files.findOne({
      filename: "1652536985539-e-stocker-panadol.jpeg",
    });
    console.log("file", file);

    // const readStream = gfs.createReadStream(file);
    // readStream.pipe(res);

    // catch (error) {
    //   res.send("not found");
    // }

    // return res.status(200).send({
    //   message: "File has been uploaded.",
    //   file: file,
    // });
  } catch (error) {
    console.log(error);

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).send({
        message: "Too many files to upload.",
      });
    }
    return res.status(500).send({
      message: `Error when trying upload file: ${error}`,
    });
  }
};

// const ImageModel = require("../models/images");
// const path = require("path")
// const uploadImage = async (req, res) => {
//     const obj = {
//         name: req.body.name,
//         desc: req.file.filename,
//         img: req.file.buffer
//     }
//     ImageModel.create(obj, (err, item) => {
//         if (err) {
//             console.log(err);
//         }
//         else {
//             // item.save();
//             res.redirect('/');
//         }
//     });
//   };

module.exports = {
  uploadPicture,
};
