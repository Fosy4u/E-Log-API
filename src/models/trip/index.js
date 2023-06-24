"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const TimeLineActionSchema = new mongoose.Schema({
  action: { type: String, required: true },
  date: { type: String, required: true },
  userId: { type: String, required: true },
  status: { type: String, required: true },
});

const ShortageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: String, required: true },
  unit : { type: String, required: true },
  shortageAmount: { type: Number, required: true , default: 0},
  shortageReason: { type: String, required: false },
  userId: { type: String, required: true },
});
const TripSchema = new mongoose.Schema({
  disabled: { type: Boolean, default: false },
  requestId: { type: String, required: true, unique: true },
  vehicleId: { type: String },
  driverId: { type: String },
  organisationId: { type: String, required: true },
  isVendorRequested: { type: Boolean, required: true },
  customerId: { type: String },
  assignedPersonnelsList: {
    type: [
      {
        date: String,
        userId: String,
        assignedUserId: [String],
        action: String,
      },
    ],
  },
  shortage : ShortageSchema,

  cancelReason: { type: String },
  vendorId: { type: String },
  truckType: { type: String },
  maxLoad: { type: String },
  quantity: { type: String },
  estimatedDropOffDate: { type: Date },
  estimatedFuelLitres: { type: Number },
  estimatedFuelCost: { type: Number },
  actualFuelCost: { type: Number },
  actualFuelLitres: { type: Number },
  status: { type: String, required: true, default: "Pending" },
  isCompleted: { type: Boolean, default: false },
  pickupAddress: { type: String, required: true },
  dropOffAddress: { type: String, required: true },
  pickupDate: { type: Date, required: true },
  userId: { type: String, required: true },
  dropOffDate: { type: Date },
  amount: { type: Number, required: true },
  productName: { type: String, required: true },
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
  waybillNumber: { type: String, required: false },
  requestedWaybilImageUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },

  deliveredWaybilImageUrl: {
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
      status: String,
      comment: String,
      difference: [{ _id: false, field: String, old: String, new: String }],
      reason: String,
    },
  ],
  timeline: [TimeLineActionSchema],
});

TripSchema.plugin(timestamp);

const TripModel = mongoose.model("trip", TripSchema, "trip");

module.exports = TripModel;
