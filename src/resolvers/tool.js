const ToolModel = require("../models/tool");
const ToolRepairModel = require("../models/toolRepair");
const TruckModel = require("../models/truck");
const ExpensesModel = require("../models/expenses");
const ToolInspectionModel = require("../models/tyreInspection");
const OrganisationUserModel = require("../models/organisationUsers");
const DriverModel = require("../models/driver");
const mongoose = require("mongoose");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const {
  canDeleteOrEditOrganisationToolRemark,
  canEditOrganisationTool,
  canCreateOrganisationTool,
} = require("../helpers/actionPermission");
const { deleteLocalFile } = require("../helpers/utils");


//saving image to firebase storage
const addImage = async (destination, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1024, 1024)
      .jpeg({ quality: 100 })
      .toFile(path.resolve(destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(destination, "resized", filename),
      {
        public: true,
        destination: `/tools/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };

    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/expenses/" + name)
      .delete()
      .then(() => {
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

const getName = (contact) => {
  if (!contact) return null;
  if (contact?.companyName) return contact?.companyName;

  return `${contact?.firstName} ${contact?.lastName}`;
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
    const exist = await ToolInspectionModel.findOne(
      {
        organisationId,
        inspectionId: code,
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
const handleImageUpload = async (files) => {
  const newDocuments = [];
  const newPictures = [];
  if (files) {
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];

      const filename = file.filename;
      const fieldname = file.fieldname;
      const destination = file.destination;

      const url = await addImage(destination, filename);

      if (fieldname === "documents") {
        newDocuments.push(url);
      }
      if (fieldname === "pictures") {
        newPictures.push(url);
      }
    }
  }

  return { newDocuments, newPictures };
};

const createTool = async (req, res) => {
  const {
    organisationId,
    userId,
    remark,
    vehicleId,
    status,
    name,
    assignedUserId,
  } = req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!name)
      return res.status(400).json({ error: "Please provide tool name" });

    if (!status)
      return res.status(400).json({ error: "Please provide status" });

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (vehicleId) {
      const assignedVehicle = await TruckModel.findOne({
        _id: vehicleId,
        organisationId,
      });
      if (!assignedVehicle)
        return res
          .status(400)
          .json({ error: "Vehicle to be assigned not found" });
    }
    const param = { organisationId, userId };
    const canPerformAction = await canCreateOrganisationTool(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });

    const log = {
      date: new Date(),
      userId: userId,
      action: "added",
      details: `Tool -  created`,
      reason: `added new tool`,
    };
    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    let documents = [];
    let pictures = [];
    const uploadedPictures = req.files?.pictures || [];
    const uploadedDocuments = req.files?.documents || [];
    if (req.files) {
      const upload = await handleImageUpload([
        ...uploadedPictures,
        ...uploadedDocuments,
      ]);

      const docs = await Promise.all([upload]);

      const { newDocuments, newPictures } = docs[0];

      documents = newDocuments || [];
      pictures = newPictures || [];
    }

    let params;
    const statusList = [
      {
        status: "Added",
        date: new Date(),
        userId,
      },
      {
        status,
        date: new Date(),
        userId,
      },
    ];
    let assignedUserList = [];
    let assignedVehicleList = [];
    if (assignedUserId) {
      assignedUserList = [
        {
          assignedUserId,
          date: new Date(),
          userId,
          action: "assigned",
        },
      ];
    }
    if (vehicleId) {
      assignedVehicleList = [
        {
          vehicleId,
          date: new Date(),
          userId,
          action: "assigned",
        },
      ];
    }
    params = {
      ...req.body,
      logs: [log],
      remarks,
      statusList,
      assignedUserList,
      assignedVehicleList,
      ...(documents.length > 0 && { documents }),
      ...(pictures.length > 0 && { pictures }),
    };
    if (pictures.length === 0) {
      return res.status(400).json({ error: "Please provide pictures" });
    }

    const newTools = new ToolModel({
      ...params,
    });
    const saveTools = await newTools.save();
    if (!saveTools)
      return res.status(401).json({ error: "Internal in saving tools" });

    return res
      .status(200)
      .send({ message: "Tools created successfully", data: saveTools });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const attachVehicle = async (tools, organisationId) => {
  const vehicleIds = tools.map((tool) => {
    if (tool.vehicleId && tool.vehicleId !== "") {
      return tool.vehicleId;
    } else {
      return null;
    }
  });

  const vehicles = await TruckModel.find({
    _id: { $in: vehicleIds },
  }).lean();

  const toolsWithVehicle = tools.map((tool) => {
    const vehicle = vehicles.find((vehicle) => vehicle._id == tool.vehicleId);

    return {
      ...tool,
      vehicle: vehicle,
    };
  });
  return toolsWithVehicle;
};

const getTools = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const tools = await ToolModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();

    const toolsWithVehicle = await attachVehicle(tools, organisationId);

    return res.status(200).send({
      message: "Tools fetched successfully",
      data: toolsWithVehicle.sort(function (a, b) {
        return new Date(b?.toolId) - new Date(a?.toolId);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getToolsByParams = async (req, res) => {
  const { organisationId, disabled } = req.query;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }

    const tools = await ToolModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
      ...req.query,
    }).lean();
    if (!tools) return res.status(200).json({ data: [] });

    const toolsWithVehicle = await attachVehicle(tools, organisationId);

    return res.status(200).send({
      message: "Tool fetched successfully",
      data: toolsWithVehicle.sort(function (a, b) {
        return new Date(b?.toolId) - new Date(a?.toolId);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getToolInspections = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const tyreInspections = await ToolInspectionModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!tyreInspections)
      return res
        .status(401)
        .json({ error: "Internal error in getting tool Inspections" });

    const tyreInspectionsWithVehicle = await attachVehicle(
      tyreInspections,
      organisationId
    );

    return res.status(200).send({
      message: "Tool Inspections fetched successfully",
      data: tyreInspectionsWithVehicle.sort(function (a, b) {
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
const getToolsByVehicleId = async (req, res) => {
  const { organisationId, disabled, vehicleId } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!vehicleId)
      return res.status(400).json({ error: "Please provide vehicle id" });

    const tools = await ToolModel.find({
      organisationId,
      vehicleId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!tools)
      return res.status(401).json({ error: "Internal error in getting tools" });

    return res.status(200).send({
      message: "Tools fetched successfully",
      data: tools.sort(function (a, b) {
        return new Date(b?.toolId) - new Date(a?.toolId);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getToolInspectionByVehicleId = async (req, res) => {
  const { organisationId, disabled, vehicleId } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!vehicleId)
      return res.status(400).json({ error: "Please provide vehicle id" });
    const inspections = await ToolInspectionModel.find({
      organisationId,
      vehicleId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!inspections) {
      return res
        .status(401)
        .json({ error: "Internal error in getting inspections" });
    }

    return res.status(200).send({
      message: "Reports fetched successfully",
      data: inspections.sort(function (a, b) {
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

const getTool = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "tool _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const tool = await ToolModel.findOne({ _id, organisationId }).lean();
    if (!tool) return res.status(400).send({ error: "tool not found" });
    const currentTool = { ...tool };
    const statusList = currentTool?.statusList || [];
    const statusListWithUser = [];
    if (statusList.length > 0) {
      await Promise.all(
        statusList.map(async (status) => {
          const { userId } = status;
          const user = await OrganisationUserModel.findOne(
            {
              _id: userId,
            },
            {
              firstName: 1,
              lastName: 1,
              imageUrl: 1,
            }
          ).lean();
          if (user) {
            statusListWithUser.push({
              ...status,
              user,
            });
          }
        })
      );
    }
    currentTool.statusList = statusListWithUser.sort(function (a, b) {
      // sort by date and action
      if (a?.date === b?.date) {
        return a?.action - b?.action;
      }
      return new Date(b?.date) - new Date(a?.date);
    });
    const assignedVehicleList = currentTool?.assignedVehicleList || [];
    const allAssignedVehicleList = [];
    await Promise.all(
      assignedVehicleList.map(async (vehicle) => {
        const { vehicleId, userId } = vehicle;
        const vehicleData = await TruckModel.findOne(
          {
            _id: vehicleId,
            organisationId,
          },
          {
            regNo: 1,
            imageUrl: 1,
            model: 1,
            brand: 1,
          }
        ).lean();

        const actionedByUser = await OrganisationUserModel.findOne(
          {
            _id: userId,
          },
          {
            firstName: 1,
            lastName: 1,
            imageUrl: 1,
          }
        ).lean();
        if (vehicleData) {
          allAssignedVehicleList.push({
            vehicle: { ...vehicleData },
            title: vehicleData.regNo,
            actionedByUser,
            ...vehicle,
          });
        }
      })
    );
    currentTool.assignedVehicleList = allAssignedVehicleList.sort(function (
      a,
      b
    ) {
      
    });

    const assignedUserList = currentTool?.assignedUserList || [];
    const allAssignedUserList = [];
    await Promise.all(
      assignedUserList.map(async (user) => {
        const { userId, assignedUserId } = user;

        const actionedByUser = await OrganisationUserModel.findOne(
          {
            _id: userId,
          },
          {
            firstName: 1,
            lastName: 1,
            imageUrl: 1,
          }
        ).lean();

        let currentUser = {};
        currentUser = await OrganisationUserModel.findOne(
          {
            _id: assignedUserId,
          },
          {
            firstName: 1,
            lastName: 1,
            imageUrl: 1,
          }
        ).lean();
        if (!currentUser) {
          currentUser = await DriverModel.findOne(
            {
              _id: assignedUserId,
            },
            {
              firstName: 1,
              lastName: 1,
              imageUrl: 1,
            }
          ).lean();
        }

        if (currentUser) {
          allAssignedUserList.push({
            ...user,
            assignedUser: { ...currentUser },
            actionedByUser,
            title: `${currentUser?.firstName && currentUser.firstName} ${
              currentUser?.lastName && currentUser.lastName
            }`,
          });
        }
      })
    );
    currentTool.assignedUserList = allAssignedUserList.sort(function (a, b) {
      return new Date(b?.date) - new Date(a?.date);
    });
    if (currentTool?.assignedUserId) {
      let assignedUser = {};
      assignedUser = await OrganisationUserModel.findOne(
        {
          _id: currentTool?.assignedUserId,
        },
        {
          firstName: 1,
          lastName: 1,
          imageUrl: 1,
          isEmployee: 1,
          isTechnician: 1,
          isTripManager: 1,
        }
      ).lean();
      if (!assignedUser) {
        const driver = await DriverModel.findOne(
          {
            _id: currentTool?.assignedUserId,
          },
          {
            firstName: 1,
            lastName: 1,
            imageUrl: 1,
          }
        ).lean();
        if (driver) {
          assignedUser = { ...driver, isDriver: true };
        }
      }

      currentTool.assignedUser = assignedUser;
    }

    const tyreWithVehicle = await attachVehicle([currentTool], organisationId);

    // const inspections = await ToolInspectionModel.find({
    //   organisationId,
    //   "details.serialNo": tool.serialNo,
    // })
    //   .lean()
    //   .sort({ date: -1 });

    // const toolInspections = [];

    // if (inspections.length > 0) {
    //   await Promise.all(
    //     inspections.map(async (inspection) => {
    //       const { userId, details } = inspection;
    //       const detail = details.find(
    //         (detail) => detail.serialNo === tool.serialNo
    //       );

    //       const user = await OrganisationUserModel.findOne(
    //         {
    //           _id: userId,
    //         },
    //         {
    //           firstName: 1,
    //           lastName: 1,
    //           imageUrl: 1,
    //         }
    //       ).lean();
    //       if (detail) {
    //         tyreInspections.push({
    //           date: inspection.date,
    //           inspectionId: inspection.inspectionId,
    //           ...detail,
    //           inspector: user,
    //         });
    //       }
    //     })
    //   );
    // }
    const formattedTool = {
      ...tyreWithVehicle[0],
      // inspections: tyreInspections,
    };

    return res.status(200).send({ data: formattedTool });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getToolExpenses = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "tool _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const tool = await ToolModel.findOne({ _id, organisationId }).lean();

    if (!tool) return res.status(400).send({ error: "tool not found" });

    const toolId = tool.toolId;
    let purchasedExpenses = {};
    if (tool?.puchaseExpensesId) {
      purchasedExpenses = await ExpensesModel.findOne({
        expensesId: tool.puchaseExpensesId,
        organisationId,
      }).lean();
    }
    const repair = await ToolRepairModel.find({
      toolId,
      organisationId,
      expensesId: { $exists: true },
    }).lean();
    const repairExpenses = await ExpensesModel.find({
      expensesId: { $in: repair.map((r) => r.expensesId) },
      organisationId,
    }).lean();

    const allExpenses = [];
    if (purchasedExpenses) {
      allExpenses.push({
        ...purchasedExpenses,
        type: "purchased",
        debit: purchasedExpenses.amount,
        from: "purchased",
      });
    }
    if (repairExpenses.length > 0) {
      repairExpenses.forEach((expense) => {
        const found = allExpenses.find(
          (e) => e.expensesId === expense.expensesId
        );
        if (!found) {
          allExpenses.push({
            ...expense,
            type: repair.find((r) => r.expensesId === expense.expensesId)
              ?.repairType,
            debit: expense.amount,
            from: "repair",

            repairId: repair.find((r) => r.expensesId === expense.expensesId)
              .repairId,
          });
        }
      });
    }
    const linkedOtherExpensesId = tool?.linkedOtherExpensesId || [];

    if (linkedOtherExpensesId.length > 0) {
      const otherExpenses = await ExpensesModel.find({
        _id: { $in: linkedOtherExpensesId },
        organisationId,
      }).lean();
      if (otherExpenses.length > 0) {
        otherExpenses.forEach((expense) => {
          const found = allExpenses.find(
            (e) => e.expensesId === expense.expensesId
          );
          if (!found) {
            allExpenses.push({
              ...expense,
              type: otherExpenses.find(
                (e) => e.expensesId === expense.expensesId
              )?.type,
              debit: expense.amount,
              from: "linked other expenses",
            });
          }
        });
      }
    }
    const allExpensesWithUser = [];
    await Promise.all(
      allExpenses.map(async (expense) => {
        const { userId } = expense;
        const user = await OrganisationUserModel.findOne(
          {
            _id: userId,
          },
          {
            firstName: 1,
            lastName: 1,
            imageUrl: 1,
          }
        ).lean();
        if (user) {
          allExpensesWithUser.push({
            ...expense,
            user,
          });
        }
      })
    );
    const sortedExpenses = allExpensesWithUser.sort(function (a, b) {
      return new Date(b?.date) - new Date(a?.date);
    });
    return res.status(200).send({ data: sortedExpenses });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getToolInspection = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id)
      return res.status(400).send({ error: "inspection _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const inspection = await ToolInspectionModel.findOne({
      _id: _id,
      organisationId,
    }).lean();
    if (!inspection)
      return res.status(400).send({ error: "inspection not found" });
    return res.status(200).send({ data: inspection });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updateTool = async (req, res) => {
  const {
    _id,
    userId,
    organisationId,
    status,
    reason,
    vehicleId,
    assignedUserId,
    unAssignUser,
    unAssignVehicle,
  } = req.body;
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (!organisationId)
      return res.status(400).json({ error: "Please provide organisationId" });
    if (unAssignUser && assignedUserId)
      return res.status(400).json({
        error: "Please provide either unAssignUser or assignedUserId",
      });
    if (unAssignVehicle && vehicleId)
      return res
        .status(400)
        .json({ error: "Please provide either unAssignVehicle or vehicleId" });
    if (vehicleId) {
      const assignedVehicle = await TruckModel.findOne({
        _id: vehicleId,
        organisationId,
      });
      if (!assignedVehicle)
        return res
          .status(400)
          .json({ error: "Vehicle to be assigned not found" });
    }
    const oldData = await ToolModel.findById(_id).lean();

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
        key !== "vehicleId"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }

    if (req.body?.vehicleId && req.body?.vehicleId !== oldData?.vehicleId) {
      let oldVehicle = {};
      if (oldData?.vehicleId) {
        oldVehicle = await TruckModel.findOne({
          _id: mongoose.Types.ObjectId(oldData?.vehicleId || ""),
          organisationId,
        });
      }

      const newVehicle = await TruckModel.findOne({
        _id: mongoose.Types.ObjectId(req.body?.vehicleId || ""),
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
      action: "edit",
      details: `Tools - updated`,
      reason: reason || "not provided",
      difference,
    };
    let statuListObj = {};
    if (status && status !== oldData?.status) {
      statuListObj = {
        status,
        date: new Date(),
        userId,
      };
    }
    let previousAssignedUserObj = {};
    let assignedUserObj = {};
    let previousAssignedVehicleObj = {};
    let assignedVehicleObj = {};
    if (assignedUserId && assignedUserId !== null && assignedUserId !== "") {
      assignedUserObj = {
        userId,
        date: new Date(),
        action: "assigned",
        assignedUserId,
      };
    }
    if (assignedUserId && assignedUserId !== oldData?.assignedUserId) {
      if (
        oldData?.assignedUserId &&
        oldData?.assignedUserId !== null &&
        oldData?.assignedUserId !== ""
      ) {
        previousAssignedUserObj = {
          userId,
          date: new Date(),
          action: "unassigned",
          assignedUserId: oldData?.assignedUserId,
        };
      }
    }

    if (vehicleId && vehicleId !== oldData?.vehicleId) {
      if (vehicleId) {
        assignedVehicleObj = {
          userId,
          date: new Date(),
          action: "assigned",
          vehicleId,
        };
      }
      if (oldData?.vehicleId) {
        previousAssignedVehicleObj = {
          userId,
          date: new Date(),
          action: "unassigned",
          vehicleId: oldData?.vehicleId,
        };
      }
    }
    if (unAssignUser) {
      previousAssignedUserObj = {
        userId,
        date: new Date(),
        action: "unassigned",
        assignedUserId: oldData?.assignedUserId,
      };
    }
    if (unAssignVehicle) {
      previousAssignedVehicleObj = {
        userId,
        date: new Date(),
        action: "unassigned",
        vehicleId: oldData?.vehicleId,
      };
    }

    const assignedUserList = [...(oldData?.assignedUserList || [])];
    if (previousAssignedUserObj?.assignedUserId) {
      assignedUserList.push(previousAssignedUserObj);
    }
    if (assignedUserObj?.assignedUserId) {
      assignedUserList.push(assignedUserObj);
    }

    const assignedVehicleList = [...(oldData?.assignedVehicleList || [])];
    if (previousAssignedVehicleObj?.vehicleId) {
      assignedVehicleList.push(previousAssignedVehicleObj);
    }
    if (assignedVehicleObj?.vehicleId) {
      assignedVehicleList.push(assignedVehicleObj);
    }

    const params = {
      ...req.body,
      assignedUserId: unAssignUser ? null : assignedUserId,
      vehicleId: unAssignVehicle ? null : vehicleId,

      statusList: [...oldData?.statusList, statuListObj],
      assignedUserList,
      assignedVehicleList,
    };

    const updateTools = await ToolModel.findByIdAndUpdate(
      _id,
      {
        ...params,
        $push: { logs: log },
      },
      { new: true }
    );

    if (!updateTools)
      return res
        .status(401)
        .json({ error: "Internal error in updating tools" });

    return res
      .status(200)
      .send({ message: "Tools updated successfully", data: updateTools });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const updateToolInspection = async (req, res) => {
  const { _id, userId, organisationId } = req.body;
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const oldData = ToolInspectionModel.findById(_id, { lean: true });
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
        key !== "vehicleId" &&
        key !== "details"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }

    if (req.body?.vehicleId && req.body?.vehicleId !== oldData?.vehicleId) {
      const oldVehicle = await TruckModel.findOne({
        _id: mongoose.Types.ObjectId(oldData?.vehicleId),
        organisationId,
      });
      const newVehicle = await TruckModel.findOne({
        _id: mongoose.Types.ObjectId(req.body?.vehicleId),
        organisationId,
      });
      difference.push({
        field: "vehicle",
        old: oldVehicle?.regNo || "not provided",
        new: newVehicle?.regNo,
      });
    }

    if (req.body?.details) {
      const oldDetails = oldData?.details || [];
      const newDetails = req.body?.details || [];
      //check if contents are same
      const changedKeys = [];
      const isSame = oldDetails.every((item, index) => {
        if (item !== newDetails[index]) {
          changedKeys.push(index);
        }
        return item === newDetails[index];
      });
      if (!isSame) {
        changedKeys.forEach((key) => {
          difference.push({
            field: `details - ${key}`,
            old: oldDetails[key] || "not provided",
            new: newDetails[key],
          });
        });
      }
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "edit",
      details: `Tools Inspection - updated`,
      reason: `updated tools inspection`,
      difference,
    };

    const params = {
      ...req.body,
    };

    const updateToolsInspection = await ToolInspectionModel.findByIdAndUpdate(
      _id,
      {
        ...params,
        $push: { logs: log },
      },
      { new: true }
    );

    if (!updateToolsInspection)
      return res
        .status(401)
        .json({ error: "Internal error in updating tools" });

    return res.status(200).send({
      message: "Tools updated successfully",
      data: updateToolsInspection,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const validateTools = async (ids) => {
  const tools = await ToolModel.find({ _id: { $in: ids } });
  if (tools.length !== ids.length) {
    return false;
  }
  return true;
};
const disableTools = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Tool -  deleted`,
    reason: `deleted tool`,
  };
  const updateExp = await ToolModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};
const enableTools = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "restore",
    details: `Tool -  restored`,
    reason: `deleted tool`,
  };
  const updateExp = await ToolModel.updateMany(
    { _id: { $in: ids } },
    { disabled: false, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};
const validateToolInspections = async (ids) => {
  const tyreInspections = await ToolInspectionModel.find({ _id: { $in: ids } });
  if (tyreInspections.length !== ids.length) {
    return false;
  }
  return true;
};
const disableToolInspections = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Tool -  deleted`,
    reason: `deleted tool`,
  };
  const updateExp = await ToolInspectionModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};
const enableToolInspections = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "restore",
    details: `Tool -  restored`,
    reason: `deleted tool`,
  };
  const updateExp = await ToolInspectionModel.updateMany(
    { _id: { $in: ids } },
    { disabled: false, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};

const deleteTools = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No tool id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateTools(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid tool id is provided" });
    const isDisabled = await disableTools(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in deleting tools" });
    return res
      .status(200)
      .send({ message: "Tools deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const deleteToolInspections = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res
        .status(400)
        .send({ error: "No tool inspection id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateToolInspections(ids);
    if (!isValid)
      return res
        .status(400)
        .send({ error: "Invalid tool inspection id is provided" });
    const isDisabled = await disableToolInspections(ids, userId);
    if (!isDisabled)
      return res
        .status(400)
        .send({ error: "Error in deleting tool inspections" });
    return res
      .status(200)
      .send({ message: "Tool Inspections deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const restoreTools = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No tool id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateTools(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid tool id is provided" });
    const isDisabled = await enableTools(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in restoring tools" });
    return res
      .status(200)
      .send({ message: "Tools restored successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const restoreToolInspections = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res
        .status(400)
        .send({ error: "No tool inspection id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateToolInspections(ids);
    if (!isValid)
      return res
        .status(400)
        .send({ error: "Invalid tool inspection id is provided" });
    const isDisabled = await enableToolInspections(ids, userId);
    if (!isDisabled)
      return res
        .status(400)
        .send({ error: "Error in restoring tool inspection" });
    return res
      .status(200)
      .send({ message: "Tool Inspections restored successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getToolLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "Tools _id is required" });
    const tools = await ToolModel.aggregate([
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

    const logs = tools[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addToolRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "tools_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const tools = await ToolModel.findById({ _id });
    if (!tools) return res.status(400).send({ error: "tools not found" });
    remarkObj.date = new Date();
    const updateRemark = await ToolModel.findByIdAndUpdate(
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
      details: `added remark on tools`,
    };
    const updateTools = await ToolModel.findByIdAndUpdate(
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

const deleteToolRemark = async (req, res) => {
  try {
    const { toolId, remarkId, userId } = req.body;
    if (!toolId) return res.status(400).send({ error: "toolId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const tools = await ToolModel.findById({
      _id: toolId,
    });
    if (!tools) return res.status(400).send({ error: "tools not found" });
    const param = { toolId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationToolRemark(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const log = {
      date: new Date(),
      userId,
      action: "delete",
      reason: "deleted remark",
      details: `deleted remark on tools`,
    };

    const updateRemark = await ToolModel.findByIdAndUpdate(
      {
        _id: toolId,
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
const editToolRemark = async (req, res) => {
  try {
    const { toolId, remarkId, userId, remark } = req.body;
    if (!toolId) return res.status(400).send({ error: "toolId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const tools = await ToolModel.findById({
      _id: toolId,
    });
    if (!tools) return res.status(400).send({ error: "tools not found" });
    const param = { toolId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationToolRemark(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await ToolModel.updateOne(
      {
        _id: toolId,
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
      details: `edited remark on tools`,
    };
    const updateTool = await ToolModel.findByIdAndUpdate(
      { _id: toolId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getToolRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "tools _id is required" });
    const tools = await ToolModel.aggregate([
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

    const remarks = tools[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const uploadToolImages = async (req, res) => {
  try {
    const { toolId, userId } = req.body;
    if (!toolId) return res.status(400).send({ error: "toolId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });

    if (!req.files) return res.status(400).send({ error: "image is required" });

    const tool = await ToolModel.findById({ _id: toolId });
    if (!tool) return res.status(400).send({ error: "tool not found" });
    const param = { toolId, userId };
    const canPerformAction = await canEditOrganisationTool(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });
    const pictures = req.files?.pictures || [];
    const documents = req.files?.documents || [];
    const upload = await handleImageUpload([...documents, ...pictures]);

    const docs = await Promise.all([upload]);
    const { newDocuments, newPictures } = docs[0];
    const log = {
      date: new Date(),
      userId,
      action: "edit",
      reason: "added images",
      details: `added images on tool`,
    };
    const updateTool = await ToolModel.findByIdAndUpdate(
      { _id: toolId },
      {
        $push: {
          documents: newDocuments || {},
          pictures: newPictures || {},
          logs: log,
        },
      },
      { new: true }
    );
    if (!updateTool) return res.status(400).send({ error: "tool not found" });
    return res.status(200).send({ data: updateTool });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const deleteToolImage = async (req, res) => {
  try {
    const { toolId, imageId, userId, imageType } = req.body;
    if (!toolId) return res.status(400).send({ error: "toolId is required" });
    if (!imageId) return res.status(400).send({ error: "imageId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (imageType !== "documents" && imageType !== "pictures")
      return res.status(400).send({ error: "imageType is required" });
    const tool = await ToolModel.findById({ _id: toolId });
    if (!tool) return res.status(400).send({ error: "tool not found" });
    const param = { toolId, userId };
    const canPerformAction = await canEditOrganisationTool(param);
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
        details: `deleted document on tool`,
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
        details: `deleted tool picture`,
      };
      updateParam = {
        $pull: {
          pictures: { _id: imageId },
          logs: log,
        },
      };
    }
    const updateTool = await ToolModel.findByIdAndUpdate(
      { _id: toolId },
      updateParam,
      { new: true }
    );
    if (!updateTool) return res.status(400).send({ error: "tool not found" });

    if (imageType === "documents") {
      const image = tool.documents.find((doc) => doc._id == imageId);
      const oldImageName = image?.name;
      if (oldImageName) {
        await deleteImageFromFirebase(oldImageName);
      }
    }
    if (imageType === "pictures") {
      const image = tool.pictures.find((doc) => doc._id == imageId);
      const oldImageName = image?.name;
      if (oldImageName) {
        await deleteImageFromFirebase(oldImageName);
      }
    }

    return res.status(200).send({ data: updateTool });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const linkToolToExpenses = async (req, res) => {
  try {
    const { _id, expenseId, userId, organisationId } = req.body;
    if (!_id) return res.status(400).send({ error: "_id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!expenseId)
      return res.status(400).send({ error: "expenseId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    const expenses = await ExpensesModel.findById({ _id: expenseId });
    if (!expenses) return res.status(400).send({ error: "expense not found" });
    const tool = await ToolModel.findById({ _id: _id });
    if (!tool) return res.status(400).send({ error: "tool not found" });
    const toolId = tool.toolId;
    let purchasedExpenses = {};
    if (tool?.puchaseExpensesId) {
      purchasedExpenses = await ExpensesModel.findOne({
        expensesId: tool.puchaseExpensesId,
        organisationId,
      }).lean();
    }
    const repair = await ToolRepairModel.find({
      toolId,
      organisationId,
      expensesId: { $exists: true },
    }).lean();
    const repairExpenses = await ExpensesModel.find({
      expensesId: { $in: repair.map((r) => r.expensesId) },
      organisationId,
    }).lean();

    const allExpenses = [];
    if (purchasedExpenses) {
      allExpenses.push({
        ...purchasedExpenses,
      });
    }

    if (repairExpenses.length > 0) {
      repairExpenses.forEach((expense) => {
        const found = allExpenses.find(
          (e) => e.expensesId === expense.expensesId
        );
        if (!found) {
          allExpenses.push({
            ...expense,
          });
        }
      });
    }
    const linkedOtherExpensesId = tool?.linkedOtherExpensesId || [];

    if (linkedOtherExpensesId.length > 0) {
      const otherExpenses = await ExpensesModel.find({
        _id: { $in: linkedOtherExpensesId },
        organisationId,
      }).lean();
      if (otherExpenses.length > 0) {
        otherExpenses.forEach((expense) => {
          const found = allExpenses.find(
            (e) => e.expensesId === expense.expensesId
          );
          if (!found) {
            allExpenses.push({
              ...expense,
            });
          }
        });
      }
    }

    const exist = allExpenses.find((e) => e.expensesId === expenses.expensesId);
    if (exist)
      return res
        .status(400)
        .send({ error: "this expense is already linked to this tool" });

    const log = {
      date: new Date(),
      userId,
      action: "edit",
      reason: "linked expense",
      details: `linked expense to tool`,
    };
    const updateTool = await ToolModel.findByIdAndUpdate(
      { _id: _id },
      {
        $push: {
          linkedOtherExpensesId: expenseId,
          logs: log,
        },
      },
      { new: true }
    );
    if (!updateTool) return res.status(400).send({ error: "tool not found" });
    return res.status(200).send({ data: updateTool });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const unlinkToolToExpenses = async (req, res) => {
  try {
    const { _id, expenseId, userId } = req.body;
    if (!_id) return res.status(400).send({ error: "_id is required" });
    if (!expenseId)
      return res.status(400).send({ error: "expenseId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    const log = {
      date: new Date(),
      userId,
      action: "edit",
      reason: "unlinked expense",
      details: `unlinked expense to tool`,
    };
    const updateTool = await ToolModel.findByIdAndUpdate(
      { _id: _id },
      {
        $pull: {
          linkedOtherExpensesId: expenseId,
        },
        $push: {
          logs: log,
        },
      },
      { new: true }
    );
    if (!updateTool) return res.status(400).send({ error: "tool not found" });
    return res.status(200).send({ data: updateTool });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  addToolRemark,
  deleteToolRemark,
  editToolRemark,
  getToolRemarks,
  createTool,
  getToolInspection,
  getToolInspections,
  getTools,
  getToolsByParams,
  getToolsByVehicleId,
  getTool,
  getToolExpenses,
  updateTool,
  deleteTools,
  getToolLogs,
  restoreTools,
  getToolInspectionByVehicleId,
  updateToolInspection,
  deleteToolInspections,
  restoreToolInspections,
  uploadToolImages,
  deleteToolImage,
  linkToolToExpenses,
  unlinkToolToExpenses,
};
