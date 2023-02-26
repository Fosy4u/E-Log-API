"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const Driver = new mongoose.Schema({
  organisationId: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNo: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  licenseExpiryDate: { type: String, required: true },
  licenseNo: { type: String, required: true },
  assignedTruckId: { type: String, required: false },
  status: { type: String, default: "inactive" },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  imageUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
  driversLicense: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
  logs: [
    {
      date: Date,
      user: String,
      userId: String,
      action: String,
      details: String,
      comment: String,
      difference: [{ _id: false, field: String, old: String, new: String }],
      reason: String,
    },
  ],
});

Driver.plugin(timestamp);

const DriverModel = mongoose.model("diver", Driver, "driver");

module.exports = DriverModel;
