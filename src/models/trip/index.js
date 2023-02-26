"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const TripSchema = new mongoose.Schema({
  disabled: { type: Boolean, default: false },
  requestId: { type: String, required: true, unique: true },
  vehicleId: { type: String, required: true },
  organisationId: { type: String, required: true },
  customerId: { type: String },
  vendorId: { type: String },
  truckType: { type: String },
  maxLoad: { type: String },
  estimatedDropOffDate: { type: String },
  estimatedFuelLitters : { type: String },
  actualFuelLitters : { type: String },
  status: { type: String, required: true, default: "pending" },
  pickupAddress: { type: String, required: true },
  dropOffAddress: { type: String, required: true },
  pickupDate: { type: String, required: true },
  expectedDropOffDate: { type: String },
  dropOffDate : { type: String },
  createdBy: { type: String, required: true },
  price: { type: String },
  cargoName: { type: String, required: true },
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
  logs: [
    {
      date: Date,
      user: String,
      userId: String,
      action: String,
      details: String,
      status: String,
      comment: String,
      difference: [{ _id: false, field: String, old: String, new: String }],
      reason: String,
    },
  ],
});

TripSchema.plugin(timestamp);

const TripModel = mongoose.model(
  "trip",
  TripSchema,
  "trip"
);

module.exports = TripModel;
