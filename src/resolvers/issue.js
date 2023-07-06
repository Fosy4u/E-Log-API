const IssueModel = require("../models/issue");
const VendorAgentModel = require("../models/vendorAgent");
const TruckModel = require("../models/truck");
const ToolModel = require("../models/tool");
const DriverModel = require("../models/driver");
const mongoose = require("mongoose");
const moment = require("moment");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const {
  canDeleteOrEditOrganisationIssuesRemark,
  canEditOrganisationIssues,
  canCreateOrganisationIssues,
} = require("../helpers/actionPermission");
const { deleteLocalFile } = require("../helpers/utils");
const OrganisationUserModel = require("../models/organisationUsers");

//saving image to firebase storage
const addImage = async (destination, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1024, 1024)
      .jpeg({ quality: 90 })
      .toFile(path.resolve(destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(destination, "resized", filename),
      {
        public: true,
        destination: `/issues/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };
    console.log("source is", source);
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
      .file("/issues/" + name)
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

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await IssueModel.findOne(
      {
        organisationId,
        issueId: `ISSUE-${code}`,
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
const getAssetTitle = (asset) => {
  if (asset?.regNo) return asset?.regNo;
  if (asset?.toolId) return `${asset?.toolId} ${asset?.name}`;
  return null;
};

const createIssue = async (req, res) => {
  const {
    organisationId,
    category,
    reportedBy,
    reportedDate,
    assetId,
    userId,
    remark,
    subject,
    assignedPersonnelsId,
    verifiedBy,
  } = req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!subject) {
      return res.status(400).json({
        error: "Please provide subject",
      });
    }
    if (!category) {
      return res.status(400).json({
        error: "Please provide category",
      });
    }
    if (!reportedBy) {
      return res.status(400).json({
        error: "Please provide reportedBy",
      });
    }
    if (!reportedDate) {
      return res.status(400).json({
        error: "Please provide reportedDate",
      });
    }

    if (!assetId) {
      return res.status(400).json({
        error: "Please provide assetId",
      });
    }

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const param = { organisationId, userId };

    const canPerformAction = await canCreateOrganisationIssues(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });
    let verifiedReportedBy;

    verifiedReportedBy = await OrganisationUserModel.findById(reportedBy);
    if (!verifiedReportedBy) {
      verifiedReportedBy = await DriverModel.findById(reportedBy);
    }
    if (!verifiedReportedBy) {
      return res.status(400).send({
        error: "Reported by not found",
      });
    }

    let confirmVerifiedBy;
    if (verifiedBy) {
      confirmVerifiedBy = await OrganisationUserModel.findById(verifiedBy);
      if (!confirmVerifiedBy) {
        confirmVerifiedBy = await DriverModel.findById(verifiedBy);
      }
      if (!confirmVerifiedBy) {
        return res.status(400).send({
          error: "Verified by not found",
        });
      }
    }

    let asset;
    asset = await TruckModel.findById(assetId);
    if (!asset) {
      asset = await ToolModel.findById(assetId);
    }
    if (!asset) {
      return res.status(400).send({
        error: "Asset not found",
      });
    }
    const assignedPersonnelsList = [];
    if (assignedPersonnelsId?.length > 0) {
      await Promise.all(
        assignedPersonnelsId?.map(async (personnelId) => {
          const validPersonnerlId = await OrganisationUserModel.findById(
            personnelId
          );
          if (!validPersonnerlId) {
            return res
              .status(400)
              .send({ error: "one or more assignedPersonnelsId is invalid" });
          }
          assignedPersonnelsList.push({
            assignedUserId: personnelId,
            date: new Date(),
            userId,
            action: "assigned",
          });
        })
      );
    }
    const identity = await generateUniqueCode(organisationId);
    const issueId = `ISSUE-${identity}`;
    const statusList = [
      {
        status: "Pending",
        date: new Date(),
        userId,
      },
    ];
    let status = "Pending";
    if (verifiedBy) {
      status = "Open";
      statusList.push({
        status: "Open",
        date: new Date(),
        userId,
      });
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "added",
      details: `Issues -  created`,
      reason: `added new issues`,
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
      const uploadedPictures = req.files?.pictures || [];
      const uploadedDocuments = req.files?.documents || [];
      const upload = await handleImageUpload([
        ...uploadedPictures,
        ...uploadedDocuments,
      ]);

      const docs = await Promise.all([upload]);
      const { newDocuments, newPictures } = docs[0];

      documents = newDocuments || [];
      pictures = newPictures || [];

      params = {
        ...req.body,
        status,
        issueId,
        statusList,
        documents,
        pictures,
        logs: [log],
        remarks,
        assignedPersonnelsList,
      };
    } else {
      params = {
        ...req.body,
        status,
        issueId,
        statusList,
        logs: [log],
        remarks,
        assignedPersonnelsList,
      };
    }

    params.date = moment(req.body.date).toISOString();

    const newIssues = new IssueModel({
      ...params,
    });
    const saveIssues = await newIssues.save();
    if (!saveIssues)
      return res.status(401).json({ error: "Internal in saving issues" });

    return res
      .status(200)
      .send({ message: "Issues created successfully", data: saveIssues });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const attachAsset = async (issues) => {
  const assetIds = issues.map((issue) => issue.assetId);
  let assets = [];
  const issuesWithAsset = [];
  assets = await TruckModel.find(
    {
      _id: { $in: assetIds },
    },
    {
      imageUrl: 1,
      regNo: 1,
      status: 1,
      organisationId: 1,
      model: 1,
      manufacturer: 1,
    }
  ).lean();

  if (assets.length === 0) {
    assets = await ToolModel.find(
      {
        _id: { $in: assetIds },
      },
      { imageUrl: 1, name: 1, status: 1, organisationId: 1, model: 1, brand: 1 }
    ).lean();
  }

  issues.map((issue) => {
    const found = assets.find(
      (asset) => asset._id.toString() === issue.assetId
    );
    if (found) {
      issuesWithAsset.push({
        ...issue,
        asset: found,
        assetType: found?.regNo ? "Vehicle" : "Tool",
      });
    }
  });

  return issuesWithAsset;
};

const attachStatus = (issue) => {
  let status = issue?.status;
  if (issue?.disabled) {
    status = "Deleted";
  }
  issue.status = status;
  return issue;
};

const getIssues = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }

    const issues = await IssueModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!issues)
      return res
        .status(401)
        .json({ error: "Internal error in getting issues" });
    const attachedStatusToIssue = [];
    issues.map((issue) => {
      const issueWithStatus = attachStatus(issue);
      attachedStatusToIssue.push(issueWithStatus);
    });

    const issuesWithAsset = await Promise.resolve(
      attachAsset(attachedStatusToIssue, organisationId)
    );

    return res.status(200).send({
      message: "Issues fetched successfully",
      data: issuesWithAsset.sort(function (a, b) {
        return new Date(b?.reportedDate) - new Date(a?.reportedDate);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getIssue = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "issue _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const issue = await IssueModel.findOne({ _id, organisationId }).lean();
    if (!issue) return res.status(400).send({ error: "issue not found" });
    const issueWithStatus = attachStatus(issue);
    const issueWithAsset = await attachAsset([issueWithStatus], organisationId);
    const data = issueWithAsset[0];
    if (!data) return res.status(400).send({ error: "issue not found" });

    if (data?.reportedBy) {
      let reportedBy = await OrganisationUserModel.findOne({
        _id: data?.reportedBy,
      }).lean();
      if (reportedBy) {
        reportedBy.isDriver = false;
        reportedBy.name = `${reportedBy.firstName} ${reportedBy.lastName}`;
      }

      if (!reportedBy) {
        reportedBy = await DriverModel.findOne({
          _id: data?.reportedBy,
        }).lean();
        if (reportedBy) {
          reportedBy.isDriver = true;
          reportedBy.name = `${reportedBy.firstName} ${reportedBy.lastName}`;
        }
      }
      data.reportedBy = reportedBy;
    }
    if (data?.verifiedBy) {
      let verifiedBy = await OrganisationUserModel.findOne({
        _id: data?.verifiedBy,
      }).lean();
      if (verifiedBy) {
        verifiedBy.isDriver = false;
        verifiedBy.name = `${verifiedBy.firstName} ${verifiedBy.lastName}`;
      }
      if (!verifiedBy) {
        verifiedBy = await DriverModel.findOne({
          _id: data?.verifiedBy,
        }).lean();
        if (verifiedBy) {
          verifiedBy.isDriver = true;
          verifiedBy.name = `${verifiedBy.firstName} ${verifiedBy.lastName}`;
        }
      }
      data.verifiedBy = verifiedBy;
    }
    const assignedPersonnelsList = [];

    if (data?.assignedPersonnelsList?.length > 0) {
      await Promise.all(
        data?.assignedPersonnelsList?.map(async (personnel) => {
          const { assignedUserId } = personnel;
          if (!assignedUserId) return;
          const user = await OrganisationUserModel.findOne({
            _id: assignedUserId,
          }).lean();
          if (user) {
            assignedPersonnelsList.push({
              ...personnel,
              user,
            });
          }
        })
      );
    }
    data.assignedPersonnelsList = assignedPersonnelsList;

    return res.status(200).send({ data: issueWithAsset[0] });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updateIssue = async (req, res) => {
  const {
    _id,
    userId,
    organisationId,
    category,
    reportedBy,
    reportedDate,
    verifiedBy,
    assetId,
    subject,
    assignedPersonnelsId,
  } = req.body;
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });
    if (
      subject &&
      (subject === " " || subject === null || subject === undefined)
    ) {
      return res.status(400).json({ error: "Please provide subject" });
    }
    if (!organisationId)
      return res.status(400).json({ error: "Please provide organisationId" });
    if (
      category &&
      (category === " " || category === null || category === undefined)
    ) {
      return res.status(400).json({ error: "Please provide category" });
    }
    if (
      reportedBy &&
      (reportedBy === " " || reportedBy === null || reportedBy === undefined)
    ) {
      return res.status(400).json({ error: "Please provide reportedBy" });
    }
    if (
      verifiedBy &&
      (verifiedBy === " " || verifiedBy === null || verifiedBy === undefined)
    ) {
      return res.status(400).json({ error: "Please provide verifiedBy" });
    }

    if (
      reportedDate &&
      (reportedDate === " " ||
        reportedDate === null ||
        reportedDate === undefined)
    ) {
      return res.status(400).json({ error: "Please provide reportedDate" });
    }

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });

    const param = { issueId: _id, userId };

    const canPerformAction = await canEditOrganisationIssues(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this image" });
    let asset;
    if (
      assetId &&
      assetId !== "" &&
      assetId !== null &&
      assetId !== undefined
    ) {
      asset = await TruckModel.findById(assetId);
      if (!asset) {
        asset = await ToolModel.findById(assetId);
      }
      if (!asset) {
        return res.status(400).send({
          error: "Asset not found",
        });
      }
    }
    let verifiedReportedBy;
    if (
      reportedBy &&
      reportedBy !== "" &&
      reportedBy !== null &&
      reportedBy !== undefined
    ) {
      verifiedReportedBy = await OrganisationUserModel.findById(reportedBy);
      if (!verifiedReportedBy) {
        verifiedReportedBy = await DriverModel.findById(reportedBy);
      }
      if (!verifiedReportedBy) {
        return res.status(400).send({
          error: "Reported by not found",
        });
      }
    }

    let confirmVerifiedBy;
    if (verifiedBy) {
      confirmVerifiedBy = await OrganisationUserModel.findById(verifiedBy);
      if (!confirmVerifiedBy) {
        confirmVerifiedBy = await DriverModel.findById(verifiedBy);
      }
      if (!confirmVerifiedBy) {
        return res.status(400).send({
          error: "Verified by not found",
        });
      }
    }

    const oldData = await IssueModel.findById(_id).lean();
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
        key !== "reportedBy" &&
        key !== "assetId" &&
        key !== "assignedPersonnelsId"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }
    if (req.body?.assetId && req.body?.assetId !== oldData?.assetId && asset) {
      let oldAsset;
      oldAsset = await TruckModel.findById(oldData?.assetId);

      difference.push({
        field: "asset",
        old: getAssetTitle(oldData) || "not provided",
        new: getAssetTitle(asset),
      });
    }

    if (
      req.body?.reportedBy &&
      req.body?.reportedBy !== oldData?.reportedBy &&
      verifiedReportedBy
    ) {
      let oldReportedBy;
      oldReportedBy = await OrganisationUserModel.findById(oldData?.reportedBy);

      difference.push({
        field: "reportedBy",
        old: getName(oldData) || "not provided",
        new: getName(verifiedReportedBy),
      });
    }
    let assignedPersonnelsList = [];
    if (assignedPersonnelsId?.length > 0) {
      await Promise.all(
        assignedPersonnelsId?.map(async (personnelId) => {
          const validPersonnerlId = await OrganisationUserModel.findById(
            personnelId
          );
          if (!validPersonnerlId) {
            return res
              .status(400)
              .send({ error: "one or more assignedPersonnelsId is invalid" });
          }
          assignedPersonnelsList.push({
            assignedUserId: personnelId,
            date: new Date(),
            userId,
            action: "assigned",
          });
          const found = oldData?.assignedPersonnelsId?.find(
            (assigned) => assigned?.assignedUserId === personnelId
          );
          if (!found) {
            difference.push({
              field: "assignedPersonnels",
              old: "-",
              new: `${validPersonnerlId?.firstName} ${validPersonnerlId?.lastName}  assigned`,
            });
          }
        })
      );

      oldData?.assignedPersonnelsId?.map(async (assigned) => {
        const validPersonnerlId = await OrganisationUserModel.findById(
          assigned?.assignedUserId
        );
        const exist = assignedPersonnelsId?.find(
          (personnelId) => personnelId === assigned?.assignedUserId
        );
        if (!exist) {
          difference.push({
            field: "assignedPersonnels",
            old: `${validPersonnerlId?.firstName} ${validPersonnerlId?.lastName} removed from assignedPersonnels`,
            new: "-",
          });
        }
      });
    }
   
    let status = oldData?.status;

    let newStatusObj;
    if (confirmVerifiedBy && status === "Pending") {
      status = "Open";
      newStatusObj = {
        status: "Open",
        date: new Date(),
        userId,
      };
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "edit",
      details: `Issues - updated`,
      reason: `updated issues`,
      difference,
    };

    const params = {
      ...req.body,
      status,
      ...(assignedPersonnelsId?.length > 0 && {
        assignedPersonnelsList: assignedPersonnelsList,
      }),
    };
    if (req.body?.date) {
      params.date = moment(req.body.date).toISOString();
    }

    const updateIssues = await IssueModel.findByIdAndUpdate(
      _id,
      {
        ...params,
        $push: {
          logs: log,
          ...(newStatusObj && { statusList: newStatusObj }),
        },
      },
      { new: true }
    );

    if (!updateIssues)
      return res
        .status(401)
        .json({ error: "Internal error in updating issues" });

    return res
      .status(200)
      .send({ message: "Issues updated successfully", data: updateIssues });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const validateIssues = async (ids) => {
  const issues = await IssueModel.find({ _id: { $in: ids } });
  if (issues.length !== ids.length) {
    return false;
  }
  return true;
};
const disableIssues = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Issues -  deleted`,
    reason: `deleted issues`,
  };
  const updateExp = await IssueModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};
const enableIssues = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "restore",
    details: `Issue -  restored`,
    reason: `restored issue`,
  };
  const updateIssue = await IssueModel.updateMany(
    { _id: { $in: ids } },
    { disabled: false, $push: { logs: log } }
  );
  if (!updateIssue) return false;
  return true;
};
// const getIssuesDocumentsAndPictureNames = async (ids) => {
//   const issues = await IssueModel.find({ _id: { $in: ids } });
//   const documentNames = issues.map((issue) => issue?.documents?.map((doc) => doc?.name));
//   const pictureNames = issues.map((issue) => issue?.pictures?.map((pic) => pic?.name));
//   return { documentNames, pictureNames };
// }
const deleteIssues = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No issue id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateIssues(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid issue id is provided" });
    const isDisabled = await disableIssues(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in deleting issues" });
    return res
      .status(200)
      .send({ message: "Issues deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const restoreIssues = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No issue id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateIssues(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid issue id is provided" });
    const enabled = await enableIssues(ids, userId);
    if (!enabled)
      return res.status(400).send({ error: "Error in deleting issues" });
    return res
      .status(200)
      .send({ message: "Issues deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getIssueLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "Issues _id is required" });
    const issues = await IssueModel.aggregate([
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

    const logs = issues[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addIssueRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "issues_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const issues = await IssueModel.findById({ _id });
    if (!issues) return res.status(400).send({ error: "issues not found" });
    remarkObj.date = new Date();
    const updateRemark = await IssueModel.findByIdAndUpdate(
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
      details: `added remark on issues`,
    };
    const updateIssues = await IssueModel.findByIdAndUpdate(
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

const deleteIssueRemark = async (req, res) => {
  try {
    const { issueId, remarkId, userId } = req.body;
    if (!issueId) return res.status(400).send({ error: "issueId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const issues = await IssueModel.findById({
      _id: issueId,
    });
    if (!issues) return res.status(400).send({ error: "issues not found" });
    const param = { issueId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationIssuesRemark(
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
      details: `deleted remark on issues`,
    };

    const updateRemark = await IssueModel.findByIdAndUpdate(
      {
        _id: issueId,
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
const editIssueRemark = async (req, res) => {
  try {
    const { issueId, remarkId, userId, remark } = req.body;
    if (!issueId) return res.status(400).send({ error: "issueId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const issues = await IssueModel.findById({
      _id: issueId,
    });
    if (!issues) return res.status(400).send({ error: "issues not found" });
    const param = { issueId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationIssuesRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await IssueModel.updateOne(
      {
        _id: issueId,
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
      details: `edited remark on issues`,
    };
    const updateIssues = await IssueModel.findByIdAndUpdate(
      { _id: issueId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getIssueRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "issues _id is required" });
    const issues = await IssueModel.aggregate([
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

    const remarks = issues[0]?.remarks;

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
    const { issueId, userId } = req.body;
    if (!issueId) return res.status(400).send({ error: "issueId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });

    if (!req.files) return res.status(400).send({ error: "image is required" });

    const issues = await IssueModel.findById({ _id: issueId });
    if (!issues) return res.status(400).send({ error: "issues not found" });
    const param = { issueId, userId };
    const canPerformAction = await canEditOrganisationIssues(param);
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
      details: `added images on issues`,
    };
    const updateIssues = await IssueModel.findByIdAndUpdate(
      { _id: issueId },
      {
        $push: {
          documents: newDocuments || {},
          pictures: newPictures || {},
          logs: log,
        },
      },
      { new: true }
    );
    if (!updateIssues)
      return res.status(400).send({ error: "issues not found" });
    return res.status(200).send({ data: updateIssues });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const deleteIssueImage = async (req, res) => {
  try {
    const { issueId, imageId, userId, imageType } = req.body;
    if (!issueId) return res.status(400).send({ error: "issueId is required" });
    if (!imageId) return res.status(400).send({ error: "imageId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (imageType !== "documents" && imageType !== "pictures")
      return res.status(400).send({ error: "imageType is required" });
    const issues = await IssueModel.findById({ _id: issueId });
    if (!issues) return res.status(400).send({ error: "issues not found" });
    const param = { issueId, userId };
    const canPerformAction = await canEditOrganisationIssues(param);
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
        details: `deleted document on issues`,
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
        details: `deleted picture on issues`,
      };
      updateParam = {
        $pull: {
          pictures: { _id: imageId },
          logs: log,
        },
      };
    }
    const updateIssues = await IssueModel.findByIdAndUpdate(
      { _id: issueId },
      updateParam,
      { new: true }
    );
    if (!updateIssues)
      return res.status(400).send({ error: "issues not found" });

    if (imageType === "documents") {
      const image = issues.documents.find((doc) => doc._id == imageId);
      const oldImageName = image?.name;
      if (oldImageName) {
        await deleteImageFromFirebase(oldImageName);
      }
    }
    if (imageType === "pictures") {
      const image = issues.pictures.find((doc) => doc._id == imageId);
      const oldImageName = image?.name;
      if (oldImageName) {
        await deleteImageFromFirebase(oldImageName);
      }
    }

    return res.status(200).send({ data: updateIssues });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
module.exports = {
  addIssueRemark,
  deleteIssueRemark,
  editIssueRemark,
  getIssueRemarks,
  createIssue,
  getIssues,
  getIssue,
  updateIssue,
  deleteIssues,
  restoreIssues,
  uploadImages,
  deleteIssueImage,
  getIssueLogs,
};
