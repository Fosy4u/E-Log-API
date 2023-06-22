"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const SocialSchema = new mongoose.Schema({
  twitter: String,
  facebook: String,
  instagram: String,
  website: String,
  linkedin: String,
});

const OrganisationUserSchema = new mongoose.Schema({
  root: { type: Boolean, required: false, default: false },
  userId: { type: String, required: false, sparse: true },
  idNumber: { type: String, required: true, unique: true },
  organisationId: { type: String, required: true },
  lastSignIn: {
    date: { type: String, required: false },
    browser: { type: String, required: false },
    os: { type: String, required: false },
    device: { type: String, required: false },
    isDesktop: { type: Boolean, required: false },
    isMobile: { type: Boolean, required: false },
  },
  signInCount: { type: Number, required: false, default: 0 },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  companyName: { type: String, required: false },
  phone: { type: String, required: false },
  salutation: { type: String, required: false },
  disabled: { type: Boolean, default: false },
  address: { type: String, required: false },
  group: { type: String, required: false },
  isAdmin: { type: Boolean, required: true, default: false },
  email: { type: String, required: false },
  imageUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
  social: SocialSchema,
  isEmployee: { type: Boolean, required: true, default: false },
  isTechnician: { type: Boolean, required: true, default: false },
  isTripManager: { type: Boolean, required: true, default: false },
  jobTitle: { type: String, required: false },
  hasUserAccess: { type: Boolean, required: true, default: false },
  emailVerified: { type: Boolean, required: true, default: false },
  employeeNo: { type: String, required: false },
  startDate: { type: String, required: false },
  endDate: { type: String, required: false },
  country: { type: String, required: false },
  region: { type: String, required: false },
  postCode: { type: String, required: false },
});

OrganisationUserSchema.plugin(timestamp);

const OrganisationUserModel = mongoose.model(
  "organisationUsers",
  OrganisationUserSchema,
  "organisationUsers"
);

module.exports = OrganisationUserModel;
