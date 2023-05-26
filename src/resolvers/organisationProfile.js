const OrganisationProfileModel = require("../models/organisationProfile");
const OrganisationUserModel = require("../models/organisationUsers");
const TemplateModel = require("../models/template");
const validator = require("email-validator");

const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { deleteLocalFile } = require("../helpers/utils");

//saving image to firebase storage
const addImage = async (req, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    console.log("receiving file");
    await sharp(source)
      // .resize(1024, 1024)
      .jpeg({ quality: 90 })
      .toFile(path.resolve(req.file.destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(req.file.destination, "resized", filename),
      {
        public: true,
        destination: `/uploads/e-stocker/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };
    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(req.file.destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const getOrganisationProfile = async (req, res) => {
  try {
    const params = { ...req.query };

    const organisation = await OrganisationProfileModel.findOne(params);

    if (!organisation) return res.status(200).send({ data: {} });

    return res.status(200).send({ data: organisation });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const createOrganisationProfile = async (req, res) => {
  const { contactEmail, firstName, lastName, password, userId } = req.body;
  if (!contactEmail || !firstName || !lastName)
    return res.status(400).send({ message: " - incomplete required fields" });
  try {
    const organisation = new OrganisationProfileModel({ ...req.body });
    const newOrganisation = await organisation.save();
    if (!newOrganisation)
      return res.status(400).send({
        message:
          "problem with creating organisation. Contact Admin if this continues",
      });
    if (contactEmail) {
      if (!validator.validate(contactEmail))
        return res.status(400).send({ error: "Invalid email address" });
    }
    const params = {
      firstName,
      lastName,
      password,
      userId,
      email: contactEmail,
      root: true,
      organisationId: newOrganisation._id,
      isAdmin: true,
    };
    const createUser = new OrganisationUserModel({ ...params });
    const newUser = await createUser.save();
    if (!newUser) {
      return res.status(400).send({
        message:
          "problem with creating organisation user. Contact Nemfra Tech if this continues",
      });
    }

    console.log("new user successful", newUser);
    const template = new TemplateModel({
      organisationId: newOrganisation._id,
    });
    const newTemplate = await template.save();
    // update organisation with emailSenders
    const emailSender = {
      name: `${firstName} ${lastName}`,
      email: contactEmail,
      default: true,
    };
    const updateOrganisation = await OrganisationProfileModel.findByIdAndUpdate(
      newOrganisation._id,
      { emailSenders: [emailSender] },
      { new: true }
    );

    return res.status(200).send({ data: [newOrganisation, newUser] });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const deleteOrganisationProfileDeletionReason = async (req, res) => {
  try {
    const { _id, element } = req.body;
    if (!_id)
      return res.status(400).send({ error: " - no organisation to update" });
    if (!element)
      return res.status(400).send({ error: " - incomplete required fields" });

    const deleteReason = await OrganisationProfileModel.findByIdAndUpdate(
      _id,
      {
        $pull: {
          deletionReasons: element,
        },
      },
      { new: true }
    );
    if (!deleteReason)
      return res.status(400).send({ message: "organisation not updated" });

    return res
      .status(200)
      .send({ message: "organisation updated", data: deleteReason });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const editOrganisationProfile = async (req, res) => {
  try {
    const { email } = req.body;
    if (email) {
      if (!validator.validate(email))
        return res.status(400).send({ error: "Invalid email address" });
    }

    if (!req.body.logoUrl && req.file) {
      const filename = req.file.filename;
      const logoUrl = await addImage(req, filename);
      const {
        _id,
        companyRegNo,
        industry,
        tradingName,
        websiteUrl,
        deletionReason,
      } = req.body;
      if (!_id)
        return res.status(400).send({ error: "No organisation to update" });
      const social = req.body.social ? JSON.parse(req.body.social) : [];
      const regionalSettings = req.body.regionalSettings
        ? JSON.parse(req.body.regionalSettings)
        : [];
      const update = await OrganisationProfileModel.findByIdAndUpdate(
        _id,

        {
          companyRegNo,
          industry,
          tradingName,
          websiteUrl,
          social,
          regionalSettings,
          logoUrl,
          $push: { deletionReasons: deletionReason },
        },
        { new: true }
      );
      if (!update)
        return res.status(400).send({ error: "organisation not updated" });
      console.log("update", update);
      return res
        .status(200)
        .send({ message: "organisation updated", data: update });
    } else {
      const {
        _id,
        companyRegNo,
        industry,
        tradingName,
        websiteUrl,
        deletionReason,
        bankDetails,
      } = req.body;
      if (!_id)
        return res.status(400).send({ error: " - no organisation to update" });
      const social = req.body.social ? JSON.parse(req.body.social) : [];
      const regionalSettings = req.body.regionalSettings
        ? JSON.parse(req.body.regionalSettings)
        : [];
      const update = await OrganisationProfileModel.findByIdAndUpdate(
        _id,
        {
          companyRegNo,
          industry,
          tradingName,
          websiteUrl,
          social,
          regionalSettings,

          $push: { deletionReasons: deletionReason },
        },
        { new: true }
      );
      if (!update) return res.status(400).send("organisation not updated");
      console.log("update", update);
      return res
        .status(200)
        .send({ message: "organisation updated", data: update });
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const getBankDetails = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ error: " - no organisation to update" });
    const bankDetails = await OrganisationProfileModel.findById(_id).select(
      "bankDetails"
    );
    // if (!bankDetails)
    //   return res.status(400).send({ message: "no bank " });
    console.log("update", bankDetails);
    return res.status(200).send({ data: bankDetails });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const deleteBankDetails = async (req, res) => {
  try {
    const { _id, bankId } = req.body;
    if (!_id) return res.status(400).send(" - no organisation to update");
    if (!bankId)
      return res
        .status(400)
        .send(" - incomplete required fields - no bankDetails Id");

    const deleteBankDetails = await OrganisationProfileModel.findByIdAndUpdate(
      _id,
      {
        $pull: {
          bankDetails: { _id: bankId },
        },
      },
      { new: true }
    );
    if (!deleteBankDetails)
      return res.status(400).send("couldnt delete bank detail");

    return res.status(200).send({ data: deleteBankDetails });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const updateBank = async (organisationId, bankDetails) => {
  return await bankDetails.reduce(async (acc, curr) => {
    console.log("acc", acc);
    let result = await acc;
    const { bankName, accountName, accountNumber, _id } = curr;
    if (_id) {
      console.log("first");
      const newBankDetails = await OrganisationProfileModel.findByIdAndUpdate(
        { _id, bankDetails: { $elemMatch: { _id } } },
        {
          $set: {
            "bankDetails.$.bankName": bankName,
            "bankDetails.$.accountNumber": accountNumber,
            "bankDetails.$.accountName": accountName,
          },
        },
        { new: true }
      );
      if (newBankDetails) {
        result.push(newBankDetails);
      }
    } else {
      console.log("second");
      const addBankDetails = await OrganisationProfileModel.findByIdAndUpdate(
        organisationId,
        { $push: { bankDetails: curr } },

        { new: true }
      );
      if (addBankDetails) {
        result.push(addBankDetails);
      }
    }

    return result;
  }, []);
};

const updateBankDetails = async (req, res) => {
  try {
    const { organisationId, bankDetails } = req.body;
    if (!organisationId)
      return res.status(400).send("organisationId is required");
    if (!bankDetails) return res.status(400).send("bankDetails is required");
    if (!Array.isArray(bankDetails))
      return res.status(400).send("bankDetails must be an array");
    let valid = true;
    bankDetails.map((bank) => {
      const { bankName, accountNumber, accountName } = bank;
      if (bankName === " ") valid = false;
      if (!accountNumber) valid = false;
      if (!accountName) valid = false;
      return valid;
    });
    if (!valid)
      return res
        .status(400)
        .send("one or more of the account details is empty");
    console.log("reched here");
    const result = await updateBank(organisationId, bankDetails, res);

    return res.status(200).send({ data: result });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const addOrganisationEmailSenders = async (req, res) => {
  try {
    const { organisationId, email, name } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: "No organisation to update" });
    if (!email) return res.status(400).send({ error: "No email to add" });
    if (!name) return res.status(400).send({ error: "No name to add" });
    const found = await OrganisationProfileModel.findOne({
      _id: organisationId,
      emailSenders: { $elemMatch: { email } },
    });
    if (found)
      return res
        .status(400)
        .send({ error: "Email already exist in emailSenders" });

    if (!validator.validate(email))
      return res.status(400).send({ error: "Invalid email address" });
    const emailSender = { email, name };
    const update = await OrganisationProfileModel.findByIdAndUpdate(
      organisationId,
      { $push: { emailSenders: emailSender } },
      { new: true }
    );
    if (!update)
      return res.status(400).send({ error: " - organisation not updated" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const deleteOrganisationEmailSenders = async (req, res) => {
  try {
    const { organisationId, email } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!email) return res.status(400).send({ error: "email is required" });
    const update = await OrganisationProfileModel.findByIdAndUpdate(
      organisationId,
      { $pull: { emailSenders: { email } } },
      { new: true }
    );
    if (!update)
      return res.status(400).send({ error: "organisation not updated" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const makeDefaultOrganisationEmailSenders = async (req, res) => {
  try {
    const { organisationId, email } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!email) return res.status(400).send({ error: "email is required" });
    const org = await OrganisationProfileModel.findOne({
      _id: organisationId,
    }).lean();

    const emailSenders = org.emailSenders;
    console.log("em", emailSenders);
    if (!emailSenders || emailSenders.length === 0)
      return res.status(400).send({ error: "emailSenders is empty" });

    const found = emailSenders.find((sender) => sender.email === email);
    if (!found)
      return res
        .status(400)
        .send({ error: "email does not exist in emailSenders" });
    const modifiedEmailSenders = emailSenders.map((sender) => {
      if (sender.email === email) {
        return { ...sender, default: true };
      }
      return { ...sender, default: false };
    });
    const update = await OrganisationProfileModel.findByIdAndUpdate(
      organisationId,
      { emailSenders: modifiedEmailSenders },
      { new: true }
    );
    if (!update)
      return res.status(400).send({ error: "organisation not updated" });

    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  createOrganisationProfile,
  getOrganisationProfile,
  editOrganisationProfile,
  deleteOrganisationProfileDeletionReason,
  getBankDetails,
  deleteBankDetails,
  updateBankDetails,
  addOrganisationEmailSenders,
  deleteOrganisationEmailSenders,
  makeDefaultOrganisationEmailSenders,
};
