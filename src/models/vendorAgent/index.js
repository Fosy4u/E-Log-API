"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const SocialSchema = new mongoose.Schema({
  twitter: String,
  facebook: String,
  instagram: String,
  website: String,
});

const VendorAgentSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  salutation: { type: String, required: false },
  disabled: { type: Boolean, default: false },
  firstName: { type: String, required: false },
  lastName: { type: String, required: false },
  regNo: { type: String, required: false },
  companyName: { type: String, required: false },
  email: { type: String, required: false },
  phoneNo: { type: String, required: false },
  address: { type: String, required: false },
  country: { type: String, required: false },
  region: { type: String, required: false },
  postCode: { type: String, required: false },
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
  localGovernmentArea: { type: String, required: false },
  social: SocialSchema,
  classification: { type: String, required: false },

  
  
});

VendorAgentSchema.plugin(timestamp);

const VendorAgentModel = mongoose.model(
  "vendorAgent",
  VendorAgentSchema,
  "vendorAgent"
);

module.exports = VendorAgentModel;
