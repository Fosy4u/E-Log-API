"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ImageSchema = new mongoose.Schema(
  {
    name: String,
    desc: String,
    img:
    {
        data: Buffer,
        contentType: String
    },
  },
  { timestamps: true }
);

const ImageModel = mongoose.model("image", ImageSchema, "image");

module.exports = ImageModel;
