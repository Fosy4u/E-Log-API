const mongoose = require("mongoose");
const ReceiptModel = require("../models/receipt");
const OrganisationContactModel = require("../models/organisationContact");
//const SaleModel = require("../models/sales");
const OrganisationUserModel = require("../models/organisationUsers");
const CustomerModel = require("../models/customer");
const {
  canDeleteOrEditOrganisationCustomerRemark,
} = require("../helpers/actionPermission");


const createCustomer = async (req, res) => {
  const { organisationId, userId, remark, type } = req.body;
  try {
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!type)
      return res.status(400).send({ error: "customer type is required" });
    if (type !== "individual" && type !== "company")
      return res
        .status(400)
        .send({ error: "customer type must be either individual or company" });
    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `customer created`,
      reason: `added new customer`,
    };
    const params = {
      ...req.body,
      remarks,
      logs: [log],
    };

    const createContact = new CustomerModel({ ...params });
    const newContact = await createContact.save();
    if (newContact) {
      return res
        .status(200)
        .send({ message: "customer created", data: newContact });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addCustomerRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "contact_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const contact = await CustomerModel.findById({ _id });
    if (!contact) return res.status(400).send({ error: "customer not found" });
    remarkObj.date = new Date();
    const updateRemark = await CustomerModel.findByIdAndUpdate(
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
      details: `added remark on customer`,
    };
    const updateCustomer = await CustomerModel.findByIdAndUpdate(
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

const deleteCustomerRemark = async (req, res) => {
  try {
    const { customerId, remarkId, userId } = req.body;
    if (!customerId)
      return res.status(400).send({ error: "customerId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const contact = await CustomerModel.findById({
      _id: customerId,
    });
    if (!contact) return res.status(400).send({ error: "contact not found" });
    const param = { customerId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationCustomerRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const updateRemark = await CustomerModel.findByIdAndUpdate(
      {
        _id: customerId,
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
      details: `deleted remark on customer`,
    };
    const updatecustomer = await CustomerModel.findByIdAndUpdate(
      { _id: customerId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editCustomerRemark = async (req, res) => {
  try {
    const { customerId, remarkId, userId, remark } = req.body;
    if (!customerId)
      return res.status(400).send({ error: "customerId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const contact = await CustomerModel.findById({
      _id: customerId,
    });
    if (!contact) return res.status(400).send({ error: "contact not found" });
    const param = { customerId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationCustomerRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await CustomerModel.updateOne(
      {
        _id: customerId,
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
      details: `edited remark on customer`,
    };
    const updatecustomer = await CustomerModel.findByIdAndUpdate(
      { _id: customerId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getCustomerRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ error: "customer _id is required" });
    const contact = await CustomerModel.aggregate([
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
const getCustomerLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ error: "customer _id is required" });
    const contact = await CustomerModel.aggregate([
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
const getCustomer = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id)
      return res.status(400).send({ error: "customer _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const contact = await CustomerModel.findOne({ _id, organisationId });
    if (!contact) return res.status(400).send({ error: "customer not found" });
    return res.status(200).send({ data: contact });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisationId",
      });
    }
    const customers = await CustomerModel.find({
      organisationId,
      disabled: disabled || false,
    });
    if (!customers) {
      return res.status(404).json({
        error: "No customers found",
      });
    }
    return res.status(200).json({
      message: "customers fetched successfully",
      data: customers,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

const editCustomer = async (req, res) => {
  try {
    const { _id, userId } = req.body;
    if (!_id)
      return res.status(400).send({ error: "customer _id is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    const customer = await CustomerModel.findById(_id).lean();
    if (!userId) {
      return res.status(400).json({
        error: "Please provide userId",
      });
    }
    if (!customer) {
      return res.status(404).json({
        error: "customer not found",
      });
    }

    const difference = [];
    const oldData = customer;
    const newData = req.body;
    for (const key in newData) {
      if (
        oldData[key] !== newData[key] &&
        key !== "_id" &&
        key !== "logs" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
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

    const update = await CustomerModel.findByIdAndUpdate(
      _id,
      { ...req.body },
      { new: true }
    );

    if (update) {
      console.log("update", update);
      const log = {
        date: new Date(),
        userId: userId,
        action: "edit",
        details: `customer - ${update.firstName} ${update.lastName} edited`,
        reason: `edited customer`,
        difference,
      };

      const updateLog = await CustomerModel.findByIdAndUpdate(
        _id,
        { $push: { logs: log } },
        { new: true }
      );

      return res
        .status(200)
        .send({ meesage: "customer updated successfully", data: update });
    }
    console.log("difference", difference);
    return res
      .status(200)
      .send({ message: "customer not updated", data: customer });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const validateCustomers = async (ids) => {
  const invalidcustomer = await ids.reduce(async (acc, _id) => {
    let invalid = await acc;

    const found = await CustomerModel.findById(_id).lean();

    if (!found) {
      invalid.push(_id);
    }

    return invalid;
  }, []);

  return invalidcustomer;
};

const deletecustomer = async (contacts, userId) => {
  return contacts.reduce(async (acc, _id) => {
    const result = await acc;
    const disabled = await CustomerModel.findByIdAndUpdate(
      _id,
      { disabled: true, portalStatus: false },
      { new: true }
    );
    if (disabled) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "delete",
        details: `customer - ${disabled.firstName} ${disabled.lastName} deleted`,
        reason: `deleted customer`,
      };
      const updateLog = await CustomerModel.findByIdAndUpdate(
        disabled._id,

        { $push: { logs: log } },
        { new: true }
      );
      result.push(_id);
    }

    return result;
  }, []);
};

const deleteCustomer = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    const invalidcustomers = await validateCustomers(ids);
    if (invalidcustomers.length > 0) {
      return res.status(400).send({
        error: `request failed as the following customers(s)  ${
          invalidcustomers.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidcustomers}]`,
      });
    }
    const disabledContacts = await deletecustomer(ids, userId);
    if (disabledContacts.length > 0) {
      return res.status(200).send({
        message: "customer deleted successfully",
        data: disabledContacts,
      });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const restoreCustomers = async (contacts, userId) => {
  return contacts.reduce(async (acc, _id) => {
    const result = await acc;
    const restored = await CustomerModel.findByIdAndUpdate(
      _id,
      { disabled: false },
      { new: true }
    );
    if (restored) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "restore",
        details: `customer - ${restored.firstName} ${restored.lastName} deleted`,
        reason: `restored customer`,
      };
      const updateLog = await OrganisationContactModel.findByIdAndUpdate(
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

const restoreCustomer = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    const invalidcustomers = await validateCustomers(ids);
    if (invalidcustomers.length > 0) {
      return res.status(400).send({
        error: `request failed as the following customers(s)  ${
          invalidcustomers.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidcustomers}]`,
      });
    }

    const restoredContacts = await restoreCustomers(ids, userId);
    if (restoredContacts.length > 0) {
      return res.status(200).send({
        message: "customer restored successfully",
        data: restoredContacts,
      });
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomer,
  editCustomer,
  deleteCustomer,
  restoreCustomer,
  deleteCustomerRemark,
  editCustomerRemark,
  addCustomerRemark,
  getCustomerRemarks,
  getCustomerLogs,
};
