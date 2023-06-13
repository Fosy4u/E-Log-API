"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const SocialSchema = new mongoose.Schema({
  twitter: String,
  facebook: String,
  instagram: String,
  website: String,
});

const OrganisationUserSchema = new mongoose.Schema({
  root: { type: Boolean, required: false, default: false },
  userId: { type: String, required: true, unique: true },
  organisationId: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
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
  hasUserAccess: { type: Boolean, required: true, default: false },
  emailVerified: { type: Boolean, required: true, default: false },
  employeeNo: { type: String, required: false },
  disabled: { type: Boolean, required: true, default: false },
});

OrganisationUserSchema.plugin(timestamp);

const OrganisationUserModel = mongoose.model(
  "organisationUsers",
  OrganisationUserSchema,
  "organisationUsers"
);

module.exports = OrganisationUserModel;
