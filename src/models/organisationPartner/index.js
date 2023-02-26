"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const SocialSchema = new mongoose.Schema({
  twitter: String,
  facebook: String,
  instagram: String,
  website: String,
});

const OrganisationPartnerSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  type: { type: String, required: true },
  salutation: { type: String, required: false },
  disabled: { type: Boolean, default: false },
  portalStatus: { type: Boolean, default: false },
  firstName: { type: String, required: false },
  lastName: { type: String, required: false },
  gender: { type: String, required: false },
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
  enablePartnerPortal: { type: Boolean, default: false },
  social: SocialSchema,
  imageUrl: {
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

OrganisationPartnerSchema.plugin(timestamp);

const OrganisationPartnerModel = mongoose.model(
  "organisationPartner",
  OrganisationPartnerSchema,
  "organisationPartner"
);

module.exports = OrganisationPartnerModel;
