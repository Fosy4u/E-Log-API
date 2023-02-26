"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const OrganisationUserSchema = new mongoose.Schema({
  root: { type: Boolean, required: false, default: false },
  userId: { type: String, required: true, unique: true },
  organisationId: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  permissionGroups: { type: [String], required: true },
  hierarchyLevel: { type: String, required: false },
  isAdmin: { type: Boolean, required: true, default: false },
  email: { type: String, required: false },
  imageUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
});

OrganisationUserSchema.plugin(timestamp);

const OrganisationUserModel = mongoose.model(
  "organisationUsers",
  OrganisationUserSchema,
  "organisationUsers"
);

module.exports = OrganisationUserModel;
