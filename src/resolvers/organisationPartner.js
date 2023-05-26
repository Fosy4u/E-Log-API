const mongoose = require("mongoose");
const OrganisationPartnerModel = require("../models/organisationPartner");
const {
  canDeleteOrEditOrganisationPartnerRemark,
} = require("../helpers/actionPermission");
const validator = require("email-validator");
const path = require("path");
const root = require("../../root");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { storageRef } = require("../config/firebase"); // reference to our db
const { deleteLocalFile } = require("../helpers/utils");

//saving image to firebase storage
const addImage = async (req, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1024, 1024)
      .jpeg({ quality: 90 })
      .toFile(path.resolve(req.file.destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(req.file.destination, "resized", filename),
      {
        public: true,
        destination: `/partner/${filename}`,
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

const validateOrganisationPartner = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send({ message: "email is required" });
    const exist = await OrganisationPartnerModel.findOne({ email });
    if (exist)
      return res
        .status(200)
        .send({ message: "email already exist", data: true });
    return res
      .status(200)
      .send({ message: "email does not exist", data: false });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const deleteImageFromFirebase = async (name) => {
  console.log("starting image del", name);

  if (name) {
    storageRef
      .file("/partner/" + name)
      .delete()
      .then(() => {
        console.log("del is", name);
        return true;
      })
      .catch((err) => {
        console.log("err is", err);
        return false;
      })
      .catch((err) => {
        console.log("err is", err);
        return false;
      });
  }
};

const createOrganisationPartner = async (req, res) => {
  const { organisationId, email, userId, remark, type } = req.body;
  try {
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!email) return res.status(400).send({ error: "email is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!type)
      return res.status(400).send({ error: "partner type is required" });
    if (type !== "individual" && type !== "company")
      return res
        .status(400)
        .send({ error: "partner type must be either individual or company" });
    const exist = await OrganisationPartnerModel.findOne({ email });
    if (exist) return res.status(400).send({ error: "email already exist" });
    if (email) {
      if (!validator.validate(email))
        return res.status(400).send({ error: "Invalid email address" });
    }
    let imageUrl = {};
    let remarks = [];
    if (req.file) {
      imageUrl = await addImage(req, req.file.filename);
    }
    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    if (req.body?.social) {
      req.body.social = JSON.parse(req.body.social);
    }
    const params = {
      ...req.body,
      imageUrl,
      remarks,
    };

    const createContact = new OrganisationPartnerModel({ ...params });
    const newContact = await createContact.save();
    if (newContact) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "create",
        details: `Partner - ${newContact.firstName} ${newContact.lastName} created`,
        reason: `added new partner`,
      };

      const updateLog = await OrganisationPartnerModel.findByIdAndUpdate(
        newContact._id,
        { $push: { logs: log } },
        { new: true }
      );
      return res
        .status(200)
        .send({ message: "partner created", data: updateLog });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addOrganisationPartnerRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "contact_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const contact = await OrganisationPartnerModel.findById({ _id });
    if (!contact) return res.status(400).send({ error: "partner not found" });
    remarkObj.date = new Date();
    const updateRemark = await OrganisationPartnerModel.findByIdAndUpdate(
      {
        _id,
      },
      {
        $push: {
          remarks: remarkObj,
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "remark",
      reason: "added remark",
      details: `added remark on partner`,
    };
    const updatePartner = await OrganisationPartnerModel.findByIdAndUpdate(
      { _id },
      { $push: { logs: log } },
      { new: true }
    );
    return res
      .status(200)
      .send({ message: "remark added successfully", data: updateRemark });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const deleteOrganisationPartnerRemark = async (req, res) => {
  try {
    const { partnerId, remarkId, userId } = req.body;
    if (!partnerId)
      return res.status(400).send({ error: "partnerId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const contact = await OrganisationPartnerModel.findById({
      _id: partnerId,
    });
    if (!contact) return res.status(400).send({ error: "contact not found" });
    const param = { partnerId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationPartnerRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const updateRemark = await OrganisationPartnerModel.findByIdAndUpdate(
      {
        _id: partnerId,
      },
      {
        $pull: {
          remarks: { _id: remarkId },
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "delete",
      reason: "deleted remark",
      details: `deleted remark on partner`,
    };
    const updatePartner = await OrganisationPartnerModel.findByIdAndUpdate(
      { _id: partnerId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editOrganisationPartnerRemark = async (req, res) => {
  try {
    const { partnerId, remarkId, userId, remark } = req.body;
    if (!partnerId)
      return res.status(400).send({ error: "partnerId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const contact = await OrganisationPartnerModel.findById({
      _id: partnerId,
    });
    if (!contact) return res.status(400).send({ error: "contact not found" });
    const param = { partnerId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationPartnerRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await OrganisationPartnerModel.updateOne(
      {
        _id: partnerId,
        remarks: { $elemMatch: { _id: remarkId } },
      },

      {
        $set: {
          "remarks.$.remark": remark,
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "edit",
      reason: "edited remark",
      details: `edited remark on partner`,
    };
    const updatePartner = await OrganisationPartnerModel.findByIdAndUpdate(
      { _id: partnerId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getOrganisationPartnerRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "partner _id is required" });
    const contact = await OrganisationPartnerModel.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(_id),
        },
      },

      { $unwind: "$remarks" },
      {
        $sort: { "remarks.date": -1 },
      },
      {
        $lookup: {
          from: "organisationUsers",
          let: {
            searchId: { $toObjectId: "$remarks.userId" },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$searchId"],
                },
              },
            },
          ],
          as: "user",
        },
      },
      {
        $project: {
          remarks: {
            $mergeObjects: [
              "$remarks",
              {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$user",
                        as: "contact",
                        cond: {
                          $eq: [
                            "$$contact._id",
                            { $toObjectId: "$remarks.userId" },
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          remarks: { $push: "$remarks" },
        },
      },
    ]);

    const remarks = contact[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getOrganisationPartnerLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "partner _id is required" });
    const contact = await OrganisationPartnerModel.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(_id),
        },
      },

      { $unwind: "$logs" },
      {
        $sort: { "logs.date": -1 },
      },
      {
        $lookup: {
          from: "organisationUsers",
          let: {
            searchId: { $toObjectId: "$logs.userId" },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$searchId"],
                },
              },
            },
          ],
          as: "user",
        },
      },
      {
        $project: {
          logs: {
            $mergeObjects: [
              "$logs",
              {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$user",
                        as: "contact",
                        cond: {
                          $eq: [
                            "$$contact._id",
                            { $toObjectId: "$logs.userId" },
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          logs: { $push: "$logs" },
        },
      },
    ]);

    const logs = contact[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getOrganisationPartner = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "partner _id is required" });
    const contact = await OrganisationPartnerModel.findById({ _id });
    if (!contact) return res.status(400).send({ error: "partner not found" });
    return res.status(200).send({ data: contact });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getAllOrganisationPartners = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisationId",
      });
    }
    const partners = await OrganisationPartnerModel.find({
      organisationId,
      disabled: disabled || false,
    });
    if (!partners) {
      return res.status(404).json({
        error: "No partners found",
      });
    }
    return res.status(200).json({
      message: "partners fetched successfully",
      data: partners,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// const getCustomerStatement = async (req, res) => {
//   try {
//     const { _id } = req.query;
//     if (!_id) return res.status(400).send("customerId is required");
//     const combine = [];

//     const receipts = await ReceiptModel.find({ customerId: _id }).lean();
//     if (receipts?.length > 0) {
//       combine.push(...receipts);
//     }
//     const addSaleDate = [];
//     const myPromise = combine.map((sale) => {
//       const newSale = { ...sale };
//       newSale.date = newSale.invoiceDate || newSale.receiptDate;
//       if (newSale?.receiptNo && !newSale.isInvoicePayment) {
//         newSale.amountOwed = newSale.totalSellingPrice;
//       }
//       if (newSale?.receiptNo && newSale.isInvoicePayment) {
//         newSale.overPayment = calcOverPaymentAmount(
//           newSale?.linkedInvoiceList,
//           newSale?.amountPaid
//         );
//       }
//       addSaleDate.push(newSale);
//     });
//     await Promise.all(myPromise);
//     const sortTransactions = addSaleDate.sort(function (a, b) {
//       return new Date(a?.date) - new Date(b?.date);
//     });
//     const addBalances = await Promise.all(
//       addOpenCloseBalance(sortTransactions)
//     );

//     res.status(200).send(addBalances);
//   } catch (error) {
//     return res.status(500).send(error.message);
//   }
// };

const editOrganisationPartner = async (req, res) => {
  try {
    const { _id, userId, email } = req.body;
    if (!_id) return res.status(400).send({ error: "partner _id is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (email) {
      if (!validator.validate(email))
        return res.status(400).send({ error: "Invalid email address" });
    }
    const partner = await OrganisationPartnerModel.findById(_id).lean();
    if (!userId) {
      return res.status(400).json({
        error: "Please provide userId",
      });
    }
    if (!partner) {
      return res.status(404).json({
        error: "Partner not found",
      });
    }

    const difference = [];
    const oldData = partner;
    const newData = req.body;
    for (const key in newData) {
      if (
        oldData[key] !== newData[key] &&
        key !== "_id" &&
        key !== "logs" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
        key !== "file" &&
        key !== "__v" &&
        key !== "disabled" &&
        key !== "organisationId" &&
        key !== "social" &&
        key !== "userId"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }
    if (req.body?.social) {
      req.body.social = JSON.parse(req.body.social);
      for (const key in req.body.social) {
        if (oldData.social[key] !== req.body.social[key]) {
          difference.push({
            field: key,
            old: oldData.social[key] || "not provided",
            new: req.body.social[key],
          });
        }
      }
    }
    if (!req.body.imageUrl && req.file) {
      const { _id } = req.body;
      const filename = req.file.filename;
      const imageUrl = await addImage(req, filename);

      const partnerImage = partner?.imageUrl?.name;
      const update = await OrganisationPartnerModel.findByIdAndUpdate(
        _id,
        { ...req.body, imageUrl },
        { new: true }
      );
      if (!update) {
        return res.status(400).send({ error: "error in updating truck" });
      }
      if (partnerImage && update) {
        const deletePrevImageFromFireBase = Promise.resolve(
          deleteImageFromFirebase(partnerImage)
        );
        difference.push({
          field: "image / logo",
          old: partnerImage || "not provided",
          new: filename,
        });
      }

      if (update) {
        const log = {
          date: new Date(),
          userId: userId,
          action: "edit",
          details: `Partner - ${update.firstName} ${update.lastName} edited`,
          reason: `edited partner`,
          difference,
        };

        const updateLog = await OrganisationPartnerModel.findByIdAndUpdate(
          _id,
          { $push: { logs: log } },
          { new: true }
        );

        return res
          .status(200)
          .send({ meesage: "partner updated successfully", data: update });
      }

      return res
        .status(200)
        .send({ meesage: "partner not modified", data: partner });
    } else {
      const update = await OrganisationPartnerModel.findByIdAndUpdate(
        _id,
        { ...req.body },
        { new: true }
      );

      if (update) {
        const log = {
          date: new Date(),
          userId: userId,
          action: "edit",
          details: `Partner - ${update.firstName} ${update.lastName} edited`,
          reason: `edited partner`,
          difference,
        };

        const updateLog = await OrganisationPartnerModel.findByIdAndUpdate(
          _id,
          { $push: { logs: log } },
          { new: true }
        );

        return res
          .status(200)
          .send({ meesage: "partner updated successfully", data: update });
      }
      return res
        .status(200)
        .send({ meesage: "partner not modified", data: partner });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const validatePartners = async (ids) => {
  const invalidPartner = await ids.reduce(async (acc, item) => {
    let invalid = await acc;

    const found = await OrganisationPartnerModel.findById(item);

    if (!found) {
      invalid.push(id);
    }

    return invalid;
  }, []);

  return invalidPartner;
};

const deletePartner = async (contacts, userId) => {
  return contacts.reduce(async (acc, _id) => {
    const result = await acc;
    const disabled = await OrganisationPartnerModel.findByIdAndUpdate(
      _id,
      { disabled: true, portalStatus: false },
      { new: true }
    );
    if (disabled) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "delete",
        details: `Partner - ${disabled.firstName} ${disabled.lastName} deleted`,
        reason: `deleted partner`,
      };
      const updateLog = await OrganisationPartnerModel.findByIdAndUpdate(
        disabled._id,

        { $push: { logs: log } },
        { new: true }
      );
      result.push(_id);
    }

    return result;
  }, []);
};

const deleteOrganisationPartner = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    if (!ids) {
      return res.status(400).send({ error: "please provide partner id" });
    }
    if (!userId) {
      return res.status(400).send({ error: "please provide user id" });
    }
    const invalidPartners = await validatePartners(ids);
    if (invalidPartners.length > 0) {
      return res.status(400).send({
        error: `request failed as the following partners(s)  ${
          invalidPartners.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidPartners}]`,
      });
    }
    const disabledContacts = await deletePartner(ids, userId);
    if (disabledContacts.length > 0) {
      return res.status(200).send({
        message: "partner deleted successfully",
        data: disabledContacts,
      });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const restorePartners = async (contacts, userId) => {
  return contacts.reduce(async (acc, _id) => {
    const result = await acc;
    const restored = await OrganisationPartnerModel.findByIdAndUpdate(
      _id,
      { disabled: false },
      { new: true }
    );
    if (restored) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "restore",
        details: `Partner - ${restored.firstName} ${restored.lastName} deleted`,
        reason: `restored partner`,
      };
      const updateLog = await OrganisationPartnerModel.findByIdAndUpdate(
        restored._id,
        // { name, category, price },

        { $push: { logs: log } },
        { new: true }
      );
      result.push(_id);
    }

    return result;
  }, []);
};

const restoreOrganisationPartner = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    if (!ids) {
      return res.status(400).send({ error: "please provide partner id" });
    }
    if (!userId) {
      return res.status(400).send({ error: "please provide user id" });
    }
    const invalidPartners = await validatePartners(ids);
    if (invalidPartners.length > 0) {
      return res.status(400).send({
        error: `request failed as the following partners(s)  ${
          invalidPartners.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidPartners}]`,
      });
    }

    const restoredContacts = await restorePartners(ids, userId);
    if (restoredContacts.length > 0) {
      return res.status(200).send({
        message: "partner restored successfully",
        data: restoredContacts,
      });
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  createOrganisationPartner,
  getOrganisationPartner,
  getAllOrganisationPartners,
  editOrganisationPartner,
  deleteOrganisationPartner,
  restoreOrganisationPartner,
  validateOrganisationPartner,
  getOrganisationPartnerLogs,
  getOrganisationPartnerRemarks,
  addOrganisationPartnerRemark,
  deleteOrganisationPartnerRemark,
  editOrganisationPartnerRemark,
};
