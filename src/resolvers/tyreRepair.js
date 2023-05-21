const TyreModel = require("../models/tyre");
const TyreRepairModel = require("../models/tyreRepair");
const OrganisationUserModel = require("../models/organisationUsers");
const ExpensesModel = require("../models/expenses");
const TruckModel = require("../models/truck");
const mongoose = require("mongoose");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await TyreRepairModel.findOne(
      {
        organisationId,
        repairId: code,
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

const createTyreRepair = async (req, res) => {
  const {
    serialNo,
    date,
    expensesId,
    description,
    repairType,
    userId,
    remark,
    organisationId,
  } = req.body;
  try {
    if (!serialNo)
      return res.status(400).send({ error: " - serialNo not provided" });
    if (!date) return res.status(400).send({ error: " - date not provided" });
    if (!repairType)
      return res.status(400).send({ error: " - repairType not provided" });
    if (!userId)
      return res.status(400).send({ error: " - userId not provided" });
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    const repairId = await generateUniqueCode(organisationId);

    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }

    const tyreRepair = await TyreRepairModel.create({
      repairId,
      serialNo,
      date,
      expensesId,
      description,
      repairType,
      userId,
      remarks,
    });
    if (!tyreRepair)
      return res.status(400).send({ error: " - tyreRepair not created" });
    const log = {
      date: new Date(),
      userId: userId,
      action: "repair",
      details: `recorded tyre repair - ${tyreRepair.repairId}`,
      reason: `${repairType}`,
    };
    const update = await TyreModel.findOneAndUpdate(
      { serialNo },
      { $push: { logs: log } },
      { new: true }
    );

    return res
      .status(200)
      .send({ message: "Tyres created successfully", data: tyreRepair });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getTyreRepair = async (req, res) => {
  try {
    const { organisationId, repairId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!repairId)
      return res.status(400).send({ error: " - repairId not provided" });
    const tyreRepair = await TyreRepairModel.findOne({
      organisationId,
      repairId,
    }).lean();
    if (!tyreRepair)
      return res.status(400).send({ error: " - no tyreRepair found" });
    const user = await OrganisationUserModel.findOne({
      userId: tyreRepair.userId,
    });
    tyreRepair.user = user ? user : {};
    if (tyreRepair?.expensesId) {
      const expense = await ExpensesModel.findOne({
        expensesId: tyreRepair.expensesId,
        organisationId,
      });
      tyreRepair.expense = expense ? expense : {};
    }
    return res.status(200).send({ data: tyreRepair });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getTyreRepairs = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    const tyreRepairs = await TyreRepairModel.find({
      organisationId,
    }).lean();
    if (!tyreRepairs)
      return res.status(400).send({ error: " - no tyreRepairs found" });
    const data = [];
    await Promise.all(
      tyreRepairs.map(async (tyreRepair) => {
        const newTyreRepair = { ...tyreRepair };
        const user = await OrganisationUserModel.findOne({
          _id: tyreRepair.userId,
        }).lean();

        newTyreRepair.user = user;
        if (tyreRepair?.expensesId) {
          const expense = await ExpensesModel.findOne({
            expensesId: tyreRepair.expensesId,
            organisationId,
          }).lean();
          newTyreRepair.expense = expense;
        }
        data.push(newTyreRepair);
      })
    );
    return res.status(200).send({
      data: data.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      }),
      message: "tyre repairs fetched",
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const getTyreRepairsByTyre = async (req, res) => {
  try {
    const { organisationId, serialNo } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!serialNo)
      return res.status(400).send({ error: " - serialNo not provided" });
    const tyreRepairs = await TyreRepairModel.find({
      organisationId,
      serialNo,
    }).lean();

    if (!tyreRepairs)
      return res.status(400).send({ error: " - no tyreRepairs found" });

    const data = [];
    await Promise.all(
      tyreRepairs.map(async (tyreRepair) => {
        const newTyreRepair = { ...tyreRepair };
        const user = await OrganisationUserModel.findOne({
          _id: tyreRepair.userId,
        }).lean();

        newTyreRepair.user = user;
        if (tyreRepair?.expensesId) {
          const expense = await ExpensesModel.findOne({
            expensesId: tyreRepair.expensesId,
            organisationId,
          }).lean();
          newTyreRepair.expense = expense;
        }
        data.push(newTyreRepair);
      })
    );

    return res.status(200).send({
      data: data.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      }),
      message: "tyre repairs fetched successfully",
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const getTyreRepairsByVehicleID = async (req, res) => {
  try {
    const { organisationId, vehicleId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!vehicleId)
      return res.status(400).send({ error: " - vehicleId not provided" });
    const tyreRepairs = await TyreRepairModel.find({
      organisationId,
    });
    if (!tyreRepairs)
      return res.status(400).send({ error: " - no tyreRepairs found" });
    const serialNos = tyreRepairs.map((tyreRepair) => tyreRepair.serialNo);
    const tyres = await TyreModel.find({
      organisationId,
      vehicleId,
      serialNo: { $in: serialNos },
    }).lean();
    const vehicleTyreRepairs = [];

    tyres.map((tyre) => {
      const tyreRepair = tyreRepairs.find(
        (tyreRepair) => tyreRepair.serialNo === tyre.serialNo
      );
      if (tyreRepair) {
        vehicleTyreRepairs.push({ ...tyreRepair });
      }
    });

    const data = [];

    await Promise.all(
      tyreRepairs.map(async (tyreRepair) => {
        const newTyreRepair = { ...tyreRepair };
        const user = await OrganisationUserModel.findOne({
          _id: tyreRepair.userId,
        }).lean();

        newTyreRepair.user = user;
        if (tyreRepair?.expensesId) {
          const expense = await ExpensesModel.findOne({
            expensesId: tyreRepair.expensesId,
            organisationId,
          }).lean();
          newTyreRepair.expense = expense;
        }
        data.push(newTyreRepair);
      })
    );
    return res.status(200).send({
      data: data.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      }),
      message: "tyre repairs fetched",
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const updateTyreRepair = async (req, res) => {
  try {
    const { _id, remark, userId } = req.body;

    if (!_id) return res.status(400).send({ error: "_id is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    let remarks = [];
    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    const update = await TyreRepairModel.findByIdAndUpdate(
      _id,
      {
        ...req.body,
        ...(remark && { remarks }),
      },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: "TyreRepair not found" });
    return res
      .status(200)
      .send({ data: update, message: "TyreRepair updated" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const deleteTyreRepair = async (req, res) => {
  try {
    const { _id, reason, userId, serialNo } = req.body;
    if (!_id) return res.status(400).send({ error: "_id is required" });
    if (!reason) return res.status(400).send({ error: "reason is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!serialNo)
      return res.status(400).send({ error: "serialNo is required" });
    const tyreRepair = await TyreRepairModel.findByIdAndDelete(_id);
    if (!tyreRepair)
      return res.status(400).send({ error: "TyreRepair not found" });
    const log = {
      date: new Date(),
      userId: userId,
      action: "delete",
      details: `deleted tyre repair - ${tyreRepair.repairId}`,
      reason: reason,
    };
    const update = await TyreModel.findOneAndUpdate(
      { serialNo },
      { $push: { logs: log } },
      { new: true }
    );

    return res
      .status(200)
      .send({ data: tyreRepair, message: "TyreRepair deleted" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  createTyreRepair,
  getTyreRepair,
  getTyreRepairs,
  updateTyreRepair,
  deleteTyreRepair,
  getTyreRepairsByTyre,
  getTyreRepairsByVehicleID,
};
