const ExpensesModel = require("../models/expenses");
const mongoose = require("mongoose");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const {
  canDeleteOrEditOrganisationExpensesRemark,
  canEditOrganisationExpenses,
} = require("../helpers/actionPermission");

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
        destination: `/drivers/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/trucks/" + name)
      .delete()
      .then(() => {
        console.log("del is", name);
        return true;
      });
  }
};

const handleImageUpload = async (files) => {
  if (files) {
    const newDocuments = [];
    const newPictures = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = file.filename;
      const url = await addImage(req, filename);
      if (filename === "documents") {
        newDocuments.push(url);
      }
      if (filename === "pictures") {
        newPictures.push(url);
      }
    }
  }
  return { newDocuments, newPictures };
};

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await ExpensesModel.findOne(
      {
        organisationId,
        requestId: code,
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
  if (contact?.companyName) return contact?.companyName;

  return `${contact?.firstName} ${contact?.lastName}`;
};

const createExpenses = async (req, res) => {
  const { organisationId, amount, expenseType, date, userId, remark } =
    req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!amount)
      return res.status(400).json({ error: "Please provide amount" });
    if (!expenseType)
      return res.status(400).json({ error: "Please provide expense type" });
    if (!date) return res.status(400).json({ error: "Please provide date" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const expensesId = await generateUniqueCode(organisationId);
    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `Expenses - ${saveExpenses.expensesId} created`,
      reason: `added new expenses`,
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

    if (req.files) {
      let documents = [];
      let pictures = [];
      const upload = await handleImageUpload(req.files);

      const { newDocuments, newPictures } = await Promise.all([upload]);
      if (newDocuments.length > 0 || newPictures.length > 0) {
        documents = newDocuments;
        pictures = newPictures;
      }

      params = {
        ...req.body,
        expensesId,
        documents,
        pictures,
        logs: [log],
        remarks,
      };
    } else {
      params = {
        ...req.body,
        expensesId,
        logs: [log],
        remarks,
      };
    }
    const newExpenses = new ExpensesModel({
      ...params,
    });
    const saveExpenses = await newExpenses.save();
    if (!saveExpenses)
      return res.status(401).json({ error: "Internal in saving expenses" });

    return res
      .status(200)
      .send({ message: "Expenses created successfully", data: saveExpenses });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getExpenses = async (req, res) => {
  const { organisationId, disabled } = req.body;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const expenses = await ExpensesModel.find(
      {
        organisationId,
        disabled: disabled ? disabled : false,
      },
      { lean: true }
    );
    if (!expenses)
      return res
        .status(401)
        .json({ error: "Internal error in getting expenses" });

    return res
      .status(200)
      .send({ message: "Expenses fetched successfully", data: expenses });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getOneExpenses = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "trip _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const trip = await ExpensesModel.findOne({ _id, organisationId }).lean();
    if (!trip) return res.status(400).send({ error: "trip not found" });
    return res.status(200).send({ data: trip });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updateExpenses = async (req, res) => {
  const { _id, amount, expenseType, date, userId } = req.body;
  try {
    if (!amount)
      return res.status(400).json({ error: "Please provide amount" });
    if (!expenseType)
      return res.status(400).json({ error: "Please provide expense type" });
    if (!date) return res.status(400).json({ error: "Please provide date" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const oldData = ExpensesModel.findById(_id, { lean: true });
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
        key !== "vehicleId"
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

    if (req.body?.vehicleId && req.body?.vehicleId !== oldData?.vehicleId) {
      const oldVehicle = await VehicleModel.findOne({
        _id: oldData?.vehicleId,
        organisationId,
      });
      const newVehicle = await VehicleModel.findOne({
        _id: req.body?.vehicleId,
        organisationId,
      });
      difference.push({
        field: "vehicle",
        old: oldVehicle?.regNo || "not provided",
        new: newVehicle?.regNo,
      });
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "update",
      details: `Expenses - ${expensesId} updated`,
      reason: `updated expenses`,
      difference,
    };

    const params = {
      ...req.body,
      logs: [log],
    };

    const updateExpenses = await ExpensesModel.findByIdAndUpdate(
      _id,
      {
        ...params,
      },
      { new: true }
    );

    if (!updateExpenses)
      return res
        .status(401)
        .json({ error: "Internal error in updating expenses" });

    return res
      .status(200)
      .send({ message: "Expenses updated successfully", data: updateExpenses });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteExpenses = async (req, res) => {
  const { expensesId, userId, organisationId } = req.body;
  try {
    if (!expensesId)
      return res.status(400).json({ error: "Please provide expenses id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (!organisationId)
      return res.status(400).json({ error: "Please provide organisation id" });
    const log = {
      date: new Date(),
      userId: userId,
      action: "delete",
      details: `Expenses - ${expensesId} deleted`,
      reason: `deleted expenses`,
    };
    const updateExpenses = await ExpensesModel.findOneAndUpdate(
      { expensesId, organisationId },
      {
        disabled: true,
        logs: [log],
      },
      { new: true }
    );
    if (!updateExpenses)
      return res
        .status(401)
        .json({ error: "Internal error in deleting expenses" });

    return res
      .status(200)
      .send({ message: "Expenses deleted successfully", data: updateExpenses });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const restoreExpenses = async (req, res) => {
  const { expensesId, userId, organisationId } = req.body;
  try {
    if (!expensesId)
      return res.status(400).json({ error: "Please provide expenses id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (!organisationId)
      return res.status(400).json({ error: "Please provide organisation id" });
    const log = {
      date: new Date(),
      userId: userId,
      action: "restore",
      details: `Expenses - ${expensesId} restored`,
      reason: `restored expenses`,
    };
    const updateExpenses = await ExpensesModel.findOneAndUpdate(
      { expensesId, organisationId },
      {
        disabled: false,
        logs: [log],
      },
      { new: true }
    );
    if (!updateExpenses)
      return res
        .status(401)
        .json({ error: "Internal error in restoring expenses" });

    return res.status(200).send({
      message: "Expenses restored successfully",
      data: updateExpenses,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getExpensesLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ error: "Expenses _id is required" });
    const expenses = await ExpensesModel.aggregate([
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

    const logs = expenses[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addExpensesRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "expenses_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const expenses = await ExpensesModel.findById({ _id });
    if (!expenses) return res.status(400).send({ error: "expenses not found" });
    remarkObj.date = new Date();
    const updateRemark = await ExpensesModel.findByIdAndUpdate(
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
      details: `added remark on expenses - ${expenses.requestId}`,
    };
    const updateExpenses = await CustomerModel.findByIdAndUpdate(
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

const deleteExpensesRemark = async (req, res) => {
  try {
    const { expensesId, remarkId, userId } = req.body;
    if (!expensesId)
      return res.status(400).send({ error: "expensesId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const expenses = await ExpensesModel.findById({
      _id: expensesId,
    });
    if (!expenses) return res.status(400).send({ error: "expenses not found" });
    const param = { expensesId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationExpensesRemark(
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
      details: `deleted remark on expenses`,
    };
    console.log("remarkId", remarkId);
    const updateRemark = await ExpensesModel.findByIdAndUpdate(
      {
        _id: expensesId,
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
const editExpensesRemark = async (req, res) => {
  try {
    const { expensesId, remarkId, userId, remark } = req.body;
    if (!expensesId)
      return res.status(400).send({ error: "expensesId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const expenses = await ExpensesModel.findById({
      _id: expensesId,
    });
    if (!expenses) return res.status(400).send({ error: "expenses not found" });
    const param = { expensesId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationExpensesRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await ExpensesModel.updateOne(
      {
        _id: expensesId,
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
      details: `edited remark on expenses`,
    };
    const updateExpenses = await CustomerModel.findByIdAndUpdate(
      { _id: expensesId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getExpensesRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ error: "expenses _id is required" });
    const expenses = await ExpensesModel.aggregate([
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

    const remarks = expenses[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const uploadImages = async (req, res) => {
  try {
    const { expensesId, userId } = req.body;
    if (!expensesId)
      return res.status(400).send({ error: "expensesId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });

    if (!req.files) return res.status(400).send({ error: "image is required" });

    const expenses = await ExpensesModel.findById({ _id: expensesId });
    if (!expenses) return res.status(400).send({ error: "expenses not found" });

    const upload = await handleImageUpload(req.files);

    const { newDocuments, newPictures } = await Promise.all([upload]);
    const log = {
      date: new Date(),
      userId,
      action: "edit",
      reason: "added images",
      details: `added images on expenses`,
    };
    const updateExpenses = await ExpensesModel.findByIdAndUpdate(
      { _id: expensesId },
      {
        $push: {
          documents: newDocuments || {},
          pictures: newPictures || {},
          logs: log,
        },
      },
      { new: true }
    );
    if (!updateExpenses)
      return res.status(400).send({ error: "expenses not found" });
    return res.status(200).send({ data: updateExpenses });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const deleteExpensesImage = async (req, res) => {
  try {
    const { expensesId, imageId, userId, imageType } = req.body;
    if (!expensesId)
      return res.status(400).send({ error: "expensesId is required" });
    if (!imageId) return res.status(400).send({ error: "imageId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (imageType !== "documents" && imageType !== "pictures")
      return res.status(400).send({ error: "imageType is required" });
    const expenses = await ExpensesModel.findById({ _id: expensesId });
    if (!expenses) return res.status(400).send({ error: "expenses not found" });
    const param = { expensesId, userId };
    const canPerformAction = await canEditOrganisationExpenses(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this image" });
    let log = {};
    let updateParam = {};
    if (imageType === "documents") {
      log = {
        date: new Date(),
        userId,
        action: "delete",
        reason: "deleted document",
        details: `deleted document on expenses`,
      };
      updateParam = {
        $pull: {
          documents: { _id: imageId },
          logs: log,
        },
      };
    }
    if (imageType === "pictures") {
      log = {
        date: new Date(),
        userId,
        action: "delete",
        reason: "deleted picture",
        details: `deleted picture on expenses`,
      };
      updateParam = {
        $pull: {
          pictures: { _id: imageId },
          logs: log,
        },
      };
    }
    const updateExpenses = await ExpensesModel.findByIdAndUpdate(
      { _id: expensesId },
      updateParam,
      { new: true }
    );
    if (!updateExpenses)
      return res.status(400).send({ error: "expenses not found" });

    if (imageType === "documents") {
      const image = expenses.documents.find((doc) => doc._id == imageId);
      const oldImageName = image?.name;
      if (oldImageName) {
        await deleteImageFromFirebase(oldImageName);
      }
    }
    if (imageType === "pictures") {
      const image = expenses.pictures.find((doc) => doc._id == imageId);
      const oldImageName = image?.name;
      if (oldImageName) {
        await deleteImageFromFirebase(oldImageName);
      }
    }

    return res.status(200).send({ data: updateExpenses });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
module.exports = {
  addExpensesRemark,
  deleteExpensesRemark,
  editExpensesRemark,
  getExpensesRemarks,
  createExpenses,
  getExpenses,
  getOneExpenses,
  updateExpenses,
  deleteExpenses,
  restoreExpenses,
  uploadImages,
  deleteExpensesImage,
  getExpensesLogs,
};
