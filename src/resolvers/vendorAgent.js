const VendorAgentModel = require("../models/vendorAgent");
const {
  verifyUserId,
  verifyVehicleId,
  verifyVendorAgentId,
} = require("../helpers/verifyValidity");

const createVendorAgent = async (req, res) => {
  const { organisationId, userId, remark } = req.body;
  console.log("reqqq",req.body);
  try {
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    const validUserId = await verifyUserId(userId, organisationId);
    if (!validUserId) {
      return res
        .status(400)
        .send({ error: "userId is invalid for this organisation" });
    }
    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }

    const params = {
      ...req.body,
      remarks,
    };

    const createContact = new VendorAgentModel({ ...params });
    const newContact = await createContact.save();
    if (newContact) {
      return res
        .status(200)
        .send({ message: "vendor created", data: newContact });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getVendorAgent = async (req, res) => {
  try {
    const { vendorAgentId, organisationId } = req.query;
    if (!vendorAgentId)
      return res.status(400).send({ error: "vendorAgentId is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });

    const vendorAgent = await VendorAgentModel.findOne({
      _id: vendorAgentId,
      organisationId,
    });
    if (!vendorAgent) {
      return res.status(400).send({ error: "vendorAgent not found" });
    }
    return res.status(200).send({ data: vendorAgent });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getAllVendorAgents = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });

    const vendorAgents = await VendorAgentModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    });

    return res.status(200).send({ data: vendorAgents, message: "Vendors fetched" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const editVendorAgent = async (req, res) => {
  try {
    let vendorAgent;
    const { vendorAgentId, organisationId, userId, remark } = req.body;
    if (!vendorAgentId)
      return res.status(400).send({ error: "vendorAgentId is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    const validUserId = await verifyUserId(userId, organisationId);
    if (!validUserId) {
      return res
        .status(400)
        .send({ error: "userId is invalid for this organisation" });
    }
    if (remark) {
      const remarkObj = {
        remark,
        userId,
        date: new Date(),
      };
      vendorAgent = await VendorAgentModel.findOneAndUpdate(
        { _id: vendorAgentId, organisationId },
        { ...req.body, $push: { remarks: remarkObj } },
        { new: true }
      );
      if (!vendorAgent)
        return res.status(400).send({ error: "error updating vendorAgent" });
      return res
        .status(200)
        .send({ message: "vendor updated", data: vendorAgent });
    }
    vendorAgent = await VendorAgentModel.findByIdAndUpdate(
      vendorAgentId,
      { ...req.body },
      { new: true }
    );
    if (!vendorAgent)
      return res.status(400).send({ error: "error updating vendorAgent" });
    return res
      .status(200)
      .send({ message: "vendorAgent updated", data: vendorAgent });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getVendorAgentRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "vendor _id is required" });
    const contact = await VendorAgentModel.aggregate([
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

const deleteVendorAgentRemark = async (req, res) => {
  try {
    const { vendorAgentId, remarkId, userId } = req.body;
    if (!vendorAgentId)
      return res.status(400).send({ error: "vendorAgentId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const contact = await VendorAgentModel.findById({
      _id: vendorAgentId,
    });
    if (!contact) return res.status(400).send({ error: "vendor not found" });
    const param = { vendorAgentId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationVendorAgentRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const updateRemark = await CustomerModel.findByIdAndUpdate(
      {
        _id: vendorAgentId,
      },
      {
        $pull: {
          remarks: { _id: remarkId },
        },
      },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editVendorAgentRemark = async (req, res) => {
  try {
    const { vendorAgentId, remarkId, userId, remark } = req.body;
    if (!vendorAgentId)
      return res.status(400).send({ error: "vendorAgentId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const contact = await VendorAgentModel.findById({
      _id: vendorAgentId,
    });
    if (!contact) return res.status(400).send({ error: "vendor not found" });
    const param = { vendorAgentId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationVendorAgentRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await VendorAgentModel.updateOne(
      {
        _id: vendorAgentId,
        remarks: { $elemMatch: { _id: remarkId } },
      },

      {
        $set: {
          "remarks.$.remark": remark,
        },
      },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const addVendorAgentRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "vendor id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const contact = await CustomerModel.findById({ _id });
    if (!contact) return res.status(400).send({ error: "customer not found" });
    remarkObj.date = new Date();
    const updateRemark = await VendorAgentModel.findByIdAndUpdate(
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

    return res
      .status(200)
      .send({ message: "remark added successfully", data: updateRemark });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const validateVendorAgent = async (ids) => {
  const invalidTrip = await ids.reduce(async (acc, _id) => {
    let invalid = await acc;

    const found = await VendorAgentModel.findById(_id).lean();

    if (!found) {
      invalid.push(_id);
    }

    return invalid;
  }, []);

  return invalidTrip;
};

const deleteRestoreVendorAgent = async (trips, userId, disabledValue) => {
  return trips.reduce(async (acc, _id) => {
    const result = await acc;
    const disabled = await VendorAgentModel.findByIdAndUpdate(
      _id,
      { disabled: disabledValue },
      { new: true }
    );
    if (disabled) {
      result.push(_id);
    }

    return result;
  }, []);
};

const deleteVendorAgent = async (req, res) => {
  try {
    const { ids, organisationId } = req.body;
    if (!ids) return res.status(400).send({ error: "ids is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const invalidVendorAgent = await validateVendorAgent(ids);
    if (invalidVendorAgent.length > 0) {
      return res.status(400).send({
        error: `request failed as the following trips(s)  ${
          invalidVendorAgent.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidTrips}]`,
      });
    }
    const disabledValue = true;
    const disabledVendorAgent = await deleteRestoreVendorAgent(
      ids,
      userId,
      disabledValue
    );
    if (disabledVendorAgent.length > 0) {
      return res.status(200).send({
        message: "trip deleted successfully",
        data: disabledVendorAgent,
      });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const restoreVendorAgent = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    const invalidVendorAgent = await validateVendorAgent(ids);
    if (invalidVendorAgent.length > 0) {
      return res.status(400).send({
        error: `request failed as the following trips(s)  ${
          invalidVendorAgent.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidTrips}]`,
      });
    }
    const disabledValue = false;
    const restoredVendorAgent = await deleteRestoreVendorAgent(
      ids,
      userId,
      disabledValue
    );
    if (restoredTrips.length > 0) {
      return res.status(200).send({
        message: "trip deleted successfully",
        data: restoredVendorAgent,
      });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
    createVendorAgent,
    getVendorAgent,
    editVendorAgent,
    deleteVendorAgent,
    restoreVendorAgent,
    addVendorAgentRemark,
    editVendorAgentRemark,
    deleteVendorAgentRemark,
    getAllVendorAgents,
    getVendorAgentRemarks
}