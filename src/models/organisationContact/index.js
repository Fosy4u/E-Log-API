"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const SocialSchema = new mongoose.Schema({
  twitter: String,
  facebook: String,
  instagram: String,
  website: String,
});

const OrganisationContactSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  contactType: { type: String, required: true },
  salutation: { type: String, required: false },
  status: { type: String, default: "active" },
  firstName: { type: String, required: false },
  lastName: { type: String, required: false },
  gender: { type: String, required: false },
  companyName: { type: String, required: false },
  email: { type: String, required: false },
  phoneNo: { type: String, required: false },
  address: { type: String, required: false },
  city: { type: String, required: false },
  country: { type: String, required: false },
  region: { type: String, required: false },
  postCode: { type: String, required: false },
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
  localGovernmentArea: { type: String, required: false },
  createdBy: { type: String, required: true },
  type: { type: String, required: false },
  customerGroups: { type: [String], required: false },
  enableCustomerPortal: { type: Boolean, default: false },
  social: SocialSchema,
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
      customerPortal: { type: Boolean, default: false },
    },
  ],
});

OrganisationContactSchema.plugin(timestamp);

const OrganisationContactModel = mongoose.model(
  "organisationContact",
  OrganisationContactSchema,
  "organisationContact"
);

module.exports = OrganisationContactModel;
