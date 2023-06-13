const ToolModel = require("../models/tyre");
const ToolRepairModel = require("../models/toolRepair");
const OrganisationUserModel = require("../models/organisationUsers");
const ExpensesModel = require("../models/expenses");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await ToolRepairModel.findOne(
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

const createToolRepair = async (req, res) => {
  const {
    toolId,
    date,
    expensesId,
    description,
    repairType,
    userId,
    remark,
    organisationId,
  } = req.body;
  try {
    if (!toolId)
      return res.status(400).send({ error: " - toolId not provided" });
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

    const toolRepair = await ToolRepairModel.create({
      repairId,
      toolId,
      date,
      expensesId,
      description,
      repairType,
      userId,
      remarks,
    });
    if (!toolRepair)
      return res.status(400).send({ error: " - toolRepair not created" });
    const log = {
      date: new Date(),
      userId: userId,
      action: "repair",
      details: `recorded tyre repair - ${toolRepair.repairId}`,
      reason: `${repairType}`,
    };
    const update = await ToolModel.findOneAndUpdate(
      { toolId },
      { $push: { logs: log } },
      { new: true }
    );

    return res
      .status(200)
      .send({ message: "Tools created successfully", data: toolRepair });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getToolRepair = async (req, res) => {
  try {
    const { organisationId, repairId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!repairId)
      return res.status(400).send({ error: " - repairId not provided" });
    const toolRepair = await ToolRepairModel.findOne({
      organisationId,
      repairId,
    }).lean();
    if (!toolRepair)
      return res.status(400).send({ error: " - no toolRepair found" });
    const user = await OrganisationUserModel.findOne({
      userId: toolRepair.userId,
    });
    toolRepair.user = user ? user : {};
    if (toolRepair?.expensesId) {
      const expense = await ExpensesModel.findOne({
        expensesId: toolRepair.expensesId,
        organisationId,
      });
      toolRepair.expense = expense ? expense : {};
    }
    return res.status(200).send({ data: toolRepair });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getToolRepairs = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    const toolRepairs = await ToolRepairModel.find({
      organisationId,
    }).lean();
    if (!toolRepairs)
      return res.status(400).send({ error: " - no toolRepairs found" });
    const data = [];
    await Promise.all(
      toolRepairs.map(async (toolRepair) => {
        const newToolRepair = { ...toolRepair };
        const user = await OrganisationUserModel.findOne({
          _id: toolRepair.userId,
        }).lean();

        newToolRepair.user = user;
        if (toolRepair?.expensesId) {
          const expense = await ExpensesModel.findOne({
            expensesId: toolRepair.expensesId,
            organisationId,
          }).lean();
          newToolRepair.expense = expense;
        }
        data.push(newToolRepair);
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
const getToolRepairsByTool = async (req, res) => {
  try {
    const { organisationId, toolId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!toolId)
      return res.status(400).send({ error: " - toolId not provided" });
    const toolRepairs = await ToolRepairModel.find({
      organisationId,
      toolId,
    }).lean();

    if (!toolRepairs)
      return res.status(400).send({ error: " - no toolRepairs found" });

    const data = [];
    await Promise.all(
      toolRepairs.map(async (toolRepair) => {
        const newToolRepair = { ...toolRepair };
        const user = await OrganisationUserModel.findOne({
          _id: toolRepair.userId,
        }).lean();

        newToolRepair.user = user;
        if (toolRepair?.expensesId) {
          const expense = await ExpensesModel.findOne({
            expensesId: toolRepair.expensesId,
            organisationId,
          }).lean();
          newToolRepair.expense = expense;
        }
        data.push(newToolRepair);
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
const getToolRepairsByVehicleID = async (req, res) => {
  try {
    const { organisationId, vehicleId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!vehicleId)
      return res.status(400).send({ error: " - vehicleId not provided" });
    const toolRepairs = await ToolRepairModel.find({
      organisationId,
    });
    if (!toolRepairs)
      return res.status(400).send({ error: " - no toolRepairs found" });
    const toolIds = toolRepairs.map((toolRepair) => toolRepair.toolId);
    const tyres = await ToolModel.find({
      organisationId,
      vehicleId,
      toolId: { $in: toolIds },
    }).lean();
    const vehicleToolRepairs = [];

    tyres.map((tyre) => {
      const toolRepair = toolRepairs.find(
        (toolRepair) => toolRepair.toolId === tyre.toolId
      );
      if (toolRepair) {
        vehicleToolRepairs.push({ ...toolRepair });
      }
    });

    const data = [];

    await Promise.all(
      toolRepairs.map(async (toolRepair) => {
        const newToolRepair = { ...toolRepair };
        const user = await OrganisationUserModel.findOne({
          _id: toolRepair.userId,
        }).lean();

        newToolRepair.user = user;
        if (toolRepair?.expensesId) {
          const expense = await ExpensesModel.findOne({
            expensesId: toolRepair.expensesId,
            organisationId,
          }).lean();
          newToolRepair.expense = expense;
        }
        data.push(newToolRepair);
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

const updateToolRepair = async (req, res) => {
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
    const update = await ToolRepairModel.findByIdAndUpdate(
      _id,
      {
        ...req.body,
        ...(remark && { remarks }),
      },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: "ToolRepair not found" });
    return res
      .status(200)
      .send({ data: update, message: "ToolRepair updated" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const deleteToolRepair = async (req, res) => {
  try {
    const { _id, reason, userId, toolId } = req.body;
    if (!_id) return res.status(400).send({ error: "_id is required" });
    if (!reason) return res.status(400).send({ error: "reason is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!toolId) return res.status(400).send({ error: "toolId is required" });
    const toolRepair = await ToolRepairModel.findByIdAndDelete(_id);
    if (!toolRepair)
      return res.status(400).send({ error: "ToolRepair not found" });
    const log = {
      date: new Date(),
      userId: userId,
      action: "delete",
      details: `deleted tyre repair - ${toolRepair.repairId}`,
      reason: reason,
    };
    const update = await ToolModel.findOneAndUpdate(
      { toolId },
      { $push: { logs: log } },
      { new: true }
    );

    return res
      .status(200)
      .send({ data: toolRepair, message: "ToolRepair deleted" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  createToolRepair,
  getToolRepair,
  getToolRepairs,
  updateToolRepair,
  deleteToolRepair,
  getToolRepairsByTool,
  getToolRepairsByVehicleID,
};
