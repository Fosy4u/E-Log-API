"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const CarDocs = new mongoose.Schema({
  proofOfOwnership: {
    title: { type: String, value: "proofOfOwnership" },
    imageUrl: {
      link: { type: String, required: false },
      name: { type: String, required: false },
      expiryDate: { type: String, required: true },
    },
  },
  proofOfInsurance: {
    title: { type: String, value: "proofOfInsurance" },
    imageUrl: {
      link: { type: String, required: false },
      name: { type: String, required: false },
      insuranceNo: { type: String, required: true },
      expiryDate: { type: String, required: true },
    },
  },
  vehicleLicense: {
    title: { type: String, value: "vehicleLicense" },
    imageUrl: {
      link: { type: String, required: false },
      name: { type: String, required: false },
      expiryDate: { type: String, required: true },
    },
  },
  roadWorthyNess: {
    title: { type: String, value: "roadWorthyNess" },
    imageUrl: {
      link: { type: String, required: false },
      name: { type: String, required: false },
      expiryDate: { type: String, required: true },
    },
  },
});
const TruckSchema = new mongoose.Schema({
  regNo: { type: String, required: true, unique: true },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  status: { type: String, default: "Inactive" },
  chasisNo: { type: String, required: true, unique: true },
  manufacturer: { type: String, required: true },
  ownership: { type: String, required: true },
  manufactureYear: { type: String, required: false },
  assignedDriverId: { type: String, required: false },
  assignedPartnerId: { type: String, required: false },
  model: { type: String },
  tyreCount: { type: Number, required: true },
  colorTag: { type: String, required: true },
  carDocs: CarDocs,
  maxLoad: { type: String, required: true },
  truckType: { type: String, required: true },
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
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
  imageUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
});

TruckSchema.plugin(timestamp);

const TruckModel = mongoose.model("truck", TruckSchema, "truck");

module.exports = TruckModel;
