const OrganisationContactModel = require("../models/organisationContact");
const OrganisationUserModel = require("../models/organisationUsers");
const VendorAgentModel = require("../models/vendorAgent");
const CustomerModel = require("../models/customer");
const OrganisationPartnerModel = require("../models/organisationPartner");

const createOrganisationContact = async (req, res) => {
  const { organisationId, firstName, lastName, email } = req.body;
  try {
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!firstName)
      return res.status(400).send({ error: "firstName is required" });
    if (!lastName)
      return res.status(400).send({ error: "lastName is required" });
    if (!email) return res.status(400).send({ error: "email is required" });
    const exist = await OrganisationContactModel.findOne({ email });
    if (!exist) {
      return res.status(400).send({ error: "email already exist" });
    }

    const params = {
      ...req.body,
    };
    const createContact = new OrganisationContactModel({ ...params });
    const newContact = await createContact.save();
    if (newContact) {
      return res.status(200).send({ data: newContact });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getOrganisationContact = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ message: "contact_id is required" });
    const contact = await OrganisationContactModel.findById({ _id });
    if (!contact) return res.status(400).send({ message: "contact not found" });
    return res.status(200).send({ data: contact });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getAllOrganisationContacts = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId)
      return res.status(400).send({ message: "organisationId is required" });
    const others = await OrganisationContactModel.find(
      { organisationId },
      { firstName: 1, lastName: 1, email: 1 }
    ).lean();
    const vendors = await VendorAgentModel.find(
      { organisationId },
      { firstName: 1, lastName: 1, email: 1 }
    ).lean();
    const partners = await OrganisationPartnerModel.find(
      { organisationId },
      { firstName: 1, lastName: 1, email: 1 }
    ).lean();
    const customers = await CustomerModel.find(
      { organisationId },
      { firstName: 1, lastName: 1, email: 1 }
    ).lean();
    const allContacts = [];
    vendors.forEach((vendor) => {
      vendor.type = "vendor";
      vendor.name = `${vendor.firstName} ${vendor.lastName}`;
      if (vendor.email) allContacts.push(vendor);
    });
    partners.forEach((partner) => {
      partner.type = "partner";
      partner.name = `${partner.firstName} ${partner.lastName}`;
      if (partner.email) allContacts.push(partner);
    });
    customers.forEach((customer) => {
      customer.type = "customer";
      customer.name = `${customer.firstName} ${customer.lastName}`;
      if (customer.email) allContacts.push(customer);
    });
    others.forEach((other) => {
      other.type = "other";
      other.name = `${other.firstName} ${other.lastName}`;
      allContacts.push(other);
    });
    return res.status(200).send({ data: allContacts });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const editOrganisationContact = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) return res.status(400).send({ error: "contact_id is required" });
    const update = await OrganisationContactModel.findByIdAndUpdate(
      _id,
      { ...req.body },
      { new: true }
    );
    if (!update) {
      return res.status(400).send({ error: "contact not found" });
    }
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const deleteOrganisationContact = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) return res.status(400).send({ error: "contact_id is required" });
    const deleteContact = await OrganisationContactModel.findByIdAndDelete(_id);
    if (!deleteContact) {
      return res.status(400).send({ error: "contact not found" });
    }
    return res.status(200).send({ data: deleteContact });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  createOrganisationContact,
  getAllOrganisationContacts,
  getOrganisationContact,
  editOrganisationContact,
  deleteOrganisationContact,
};
