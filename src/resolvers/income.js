const IncomeModel = require("../models/income");
const VendorAgentModel = require("../models/vendorAgent");
const TruckModel = require("../models/truck");
const TripModel = require("../models/trip");
const mongoose = require("mongoose");
const {
  canDeleteOrEditOrganisationIncomeRemark,
  canEditOrganisationIncome,
  canCreateOrganisationIncome,
} = require("../helpers/actionPermission");
const { numberWithCommas, getPaidAndAmountDue } = require("../helpers/utils");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await IncomeModel.findOne(
      {
        organisationId,
        incomeId: code,
      },
      { lean: true }
    );

    if (exist || exist !== null) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return code.toString();
};
const getName = (contact) => {
  if (!contact) return null;
  if (contact?.companyName) return contact?.companyName;

  return `${contact?.firstName} ${contact?.lastName}`;
};

const updateTripLogs = async (requestId, log) => {
  const upDateTrip = await TripModel.findOneAndUpdate(
    { requestId: requestId },
    { $push: { logs: log } },
    { new: true }
  );
  return upDateTrip?._id ? true : false;
};

const validateAmount = async (request) => {
  const { amount, requestId } = request;
  const trip = await TripModel.findOne({ requestId: requestId });
  const originalAmount = trip?.amount;
  const { paid, amountDue } = await Promise.resolve(getPaidAndAmountDue(trip));
  if (amountDue === 0) return false;
  if (amountDue < amount) return false;
  if (paid + amount > originalAmount) return false;
  return true;
};

const createIncome = async (req, res) => {
  const { organisationId, amount, date, userId, remark, requestIds, vendorId } =
    req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }

    if (!amount)
      return res.status(400).json({ error: "Please provide amount" });
    if (!vendorId)
      return res.status(400).json({ error: "Please provide vendor id" });

    if (!date) return res.status(400).json({ error: "Please provide date" });
    if (!requestIds || requestIds.length === 0)
      return res.status(400).json({ error: "Please provide requestIds" });

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const param = { organisationId, userId };
    const canPerformAction = await canCreateOrganisationIncome(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });
    let invalids = 0;
    const validate = await Promise.all(
      requestIds.map(async (request) => {
        const valid = await validateAmount(request);
        if (!valid) {
          invalids++;
        }
      })
    );
    if (invalids > 0) {
      return res.status(400).send({
        error:
          "Failed to validate amount: either invalid trip or amount is in conflict with trip amount due",
      });
    }

    const incomeId = await generateUniqueCode(organisationId);
    if (!incomeId)
      return res
        .status(400)
        .send({ error: "Internal error in generating incomeId" });

    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `Income -  created`,
      reason: `added new income`,
    };
    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    let params;

    params = {
      ...req.body,
      incomeId,

      logs: [log],
      remarks,
    };

    const newIncome = new IncomeModel({
      ...params,
    });
    const saveIncome = await newIncome.save();
    if (!saveIncome)
      return res.status(401).json({ error: "Internal in saving income" });

    await Promise.all(
      requestIds.map(async (request) => {
        const { amount, requestId } = request;
        const log = {
          date: new Date(),
          userId: userId,
          action: "paid",
          details: `${numberWithCommas(
            amount
          )} paid from incomeId - ${incomeId}`,
          reason: `Income added to trip`,
        };
        const updateTrip = await updateTripLogs(requestId, log);
        if (!updateTrip)
          return res
            .status(401)
            .json({ error: "Income recorded but failed to update trip log" });
      })
    );

    return res
      .status(200)
      .send({ message: "Income created successfully", data: saveIncome });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const attachProperties = async (incomes) => {
  const vendorIds = incomes.map((income) => {
    if (income.vendorId && income.vendorId !== "") {
      return income.vendorId;
    } else {
      return null;
    }
  });
  const vendors = await VendorAgentModel.find(
    { _id: { $in: vendorIds } },
    { companyName: 1, firstName: 1, lastName: 1 }
  ).lean();

  const tripobjs = incomes.map((income) => income.requestIds)?.flat();
  const tripIds = tripobjs.map((trip) => trip.requestId);

  const trips = await TripModel.find(
    { requestId: { $in: tripIds } },
    { status: 1, requestId: 1, waybillNumber: 1 }
  ).lean();

  const incomeWithVehicleAndTrip = incomes.map((income) => {
    const vendor = vendors.find((vendor) => vendor._id == income.vendorId);
    const vendorName = getName(vendor);
    const { requestIds } = income;
    let tripCollection = [];
    if (requestIds && requestIds.length > 0) {
      requestIds.map((request) => {
        const trip = trips.find((trip) => trip.requestId == request.requestId);
        if (trip) {
          tripCollection.push({
            ...trip,
            amountPaid: request.amount,
          });
        }
      });
    }

    return {
      ...income,
      vendorName,
      trips: tripCollection,
    };
  });
  return incomeWithVehicleAndTrip;
};

const getIncomes = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const income = await IncomeModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!income)
      return res
        .status(401)
        .json({ error: "Internal error in getting income" });

    const propertiesAttached = await attachProperties(income, organisationId);

    return res.status(200).send({
      message: "Income fetched successfully",
      data: propertiesAttached.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getIncome = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "income _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const income = await IncomeModel.findOne({ _id, organisationId }).lean();
    if (!income) return res.status(400).send({ error: "income not found" });
    const propertiesAttached = await attachProperties([income], organisationId);

    return res.status(200).send({ data: propertiesAttached[0] });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updateIncome = async (req, res) => {
  const { _id, userId, organisationId, requestIds } = req.body;
  console.log("requestIds", requestIds);
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const param = { incomeId: _id, userId };
    const canPerformAction = await canEditOrganisationIncome(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });
    const oldData = await IncomeModel.findById(_id).lean();
    console.log("oldData", oldData);
    const newData = req.body;
    const difference = [];

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
        key !== "remarks" &&
        key !== "userId" &&
        key !== "vendorId" &&
        key !== "vehicleId" &&
        key !== "requestIds"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }
    if (req.body?.vendorId && req.body?.vendorId !== oldData?.vendorId) {
      const oldVendor = await VendorAgentModel.findOne({
        _id: oldData?.vendorId,
        organisationId,
      });
      const newVendor = await VendorAgentModel.findOne({
        _id: req.body?.vendorId,
        organisationId,
      });
      difference.push({
        field: "vendor",
        old: getName(oldVendor) || "not provided",
        new: getName(newVendor),
      });
    }

    const oldRequestIds = oldData?.requestIds;
    const oldRequestIdsMap = oldRequestIds?.map(
      (request) => request?.requestId
    );

    const requestIdsMap = requestIds?.map((request) => request?.requestId);
    if (requestIds && requestIds.length > 0) {
      //check if equal content
      const isEqual = requestIdsMap.every((requestId) =>
        oldRequestIdsMap.includes(requestId)
      );

      if (!isEqual) {
        difference.push({
          field: "trips",
          old: oldRequestIdsMap || "not provided",
          new: requestIdsMap || "not provided",
        });
      }
    }
    const log = {
      date: new Date(),
      userId: userId,
      action: "update",
      details: `Income - updated`,
      reason: `updated income`,
      difference,
    };

    const updateIncome = await IncomeModel.findByIdAndUpdate(
      _id,
      {
        ...req.body,
        logs: [...oldData.logs, log],
      },
      { new: true }
    );

    if (!updateIncome)
      return res
        .status(401)
        .json({ error: "Internal error in updating income" });

    await Promise.all(
      updateIncome.requestIds.map(async (request) => {
        const requestLog = {
          date: new Date(),
          userId: userId,
          action: "edit payment",
          details: `Income - updated`,
          reason: `updated income`,
          difference,
        };
        const updateTrip = await updateTripLogs(request.requestId, requestLog);
      })
    );

    return res
      .status(200)
      .send({ message: "Income updated successfully", data: updateIncome });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const validateIncomes = async (ids) => {
  const Income = await IncomeModel.find({ _id: { $in: ids } });
  if (Income.length !== ids.length) {
    return false;
  }
  return true;
};
const disableIncomes = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Income -  deleted`,
    reason: `deleted income`,
  };
  const updateExp = await IncomeModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};

const deleteIncomes = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No income id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateIncomes(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid income id is provided" });
    const isDisabled = await disableIncomes(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in deleting Incomes" });
    return res
      .status(200)
      .send({ message: "Income deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getIncomeLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "Income _id is required" });
    const income = await IncomeModel.aggregate([
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

    const logs = income[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addIncomeRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "income_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const income = await IncomeModel.findById({ _id });
    if (!income) return res.status(400).send({ error: "income not found" });
    remarkObj.date = new Date();
    const updateRemark = await IncomeModel.findByIdAndUpdate(
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
      details: `added remark on income `,
    };
    const updateIncome = await IncomeModel.findByIdAndUpdate(
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

const deleteIncomeRemark = async (req, res) => {
  try {
    const { incomeId, remarkId, userId } = req.body;
    if (!incomeId)
      return res.status(400).send({ error: "incomeId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const income = await IncomeModel.findById({
      _id: incomeId,
    });
    if (!income) return res.status(400).send({ error: "Income not found" });
    const param = { incomeId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationincomeRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const log = {
      date: new Date(),
      userId,
      action: "delete",
      reason: "deleted remark",
      details: `deleted remark on income`,
    };

    const updateRemark = await IncomeModel.findByIdAndUpdate(
      {
        _id: incomeId,
      },
      {
        $pull: {
          remarks: { _id: remarkId },
        },
        $push: { logs: log },
      },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editIncomeRemark = async (req, res) => {
  try {
    const { incomeId, remarkId, userId, remark } = req.body;
    if (!incomeId)
      return res.status(400).send({ error: "incomeId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const income = await IncomeModel.findById({
      _id: incomeId,
    });
    if (!income) return res.status(400).send({ error: "income not found" });
    const param = { incomeId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationIncomeRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await IncomeModel.updateOne(
      {
        _id: incomeId,
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
      details: `edited remark on income`,
    };
    const updateIncome = await IncomeModel.findByIdAndUpdate(
      { _id: incomeId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getIncomeRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "income _id is required" });
    const incomes = await IncomeModel.aggregate([
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

    const remarks = incomes[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  addIncomeRemark,
  deleteIncomeRemark,
  editIncomeRemark,
  getIncomeRemarks,
  createIncome,
  getIncomes,
  getIncome,
  updateIncome,
  deleteIncomes,
  getIncomeLogs,
};
