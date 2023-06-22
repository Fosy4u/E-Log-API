const OrganisationProfileModel = require("../models/organisationProfile");
const ToolModel = require("../models/tool");
const TruckModel = require("../models/truck");
const OrganisationUserModel = require("../models/organisationUsers");
const DriverModel = require("../models/driver");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { deleteLocalFile } = require("../helpers/utils");
const validator = require("email-validator");
const { firebase } = require("../config/firebase");

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
        destination: `/user/${filename}`,
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

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/user/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {
        console.log("err is", err);
        return false;
      });
  }
};
function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueIdNumber = async (organisationId) => {
  let idNumber;
  let found = true;

  do {
    const randomVal = getRandomInt(10000, 99999);
    idNumber = `${randomVal}`;
    const exist1 = await OrganisationUserModel.findOne(
      {
        organisationId,
        idNumber,
      },
      { lean: true }
    );
    const exist2 = await DriverModel.findOne(
      {
        organisationId,
        idNumber,
      },
      { lean: true }
    );

    if (exist1 || exist1 !== null || exist2 || exist2 !== null) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return idNumber.toString();
};

const createOrganisationUsers = async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    organisationId,
    hasUserAccess,
    remark,
    user,
    root,
  } = req.body;
  try {
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    if (!root && !user) {
      return res.status(400).send({ error: "user is required" });
    }
    if (!email && hasUserAccess) {
      return res
        .status(400)
        .send({ error: "email is required for persons with user access" });
    }

    if (!firstName) {
      return res.status(400).send({ error: "firstName is required" });
    }
    if (!lastName) {
      return res.status(400).send({ error: "lastName is required" });
    }
    if (email && !validator.validate(email)) {
      return res.status(400).send({ error: "email is invalid" });
    }
    if (email) {
      const user = await OrganisationUserModel.findOne({ email }).lean();

      if (user) {
        return res
          .status(400)
          .send("An account with same email address is already existing.");
      }
    }
    let imageUrl = {};
    let remarks = [];
    if (req.file) {
      imageUrl = await addImage(req, req.file.filename);
    }
    if (remark) {
      remarks.push({
        remark,
        userId: user,
        date: new Date(),
      });
    }
    if (req.body?.social) {
      req.body.social = JSON.parse(req.body.social);
    }
    let log;
    if (user) {
      log = {
        date: new Date(),
        userId: user,
        action: "added",
        details: `Personnel - ${firstName} ${lastName} added`,
        reason: `added new personnel`,
      };
    }

    const idNumber = await generateUniqueIdNumber(organisationId);

    const params = {
      firstName,
      lastName,
      organisationId,
      isAdmin: false,
      ...req.body,
      imageUrl,
      remarks,
      idNumber,
      ...(user && { logs: [log] }),
    };
    const createUser = new OrganisationUserModel({ ...params });
    const newUser = createUser.save();
    if (newUser) {
      return res.status(200).send({ data: newUser });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getOrganisationUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).send({ error: "userId is required" });
    }

    const user = await OrganisationUserModel.findOne({ userId });

    return res.status(200).send({ data: user });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getOrganisationUserById = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }

    const user = await OrganisationUserModel.findById(_id).lean();
    const email = user?.email;
    let userAccessRecord = {
      access: false,
    };
    if (email && user?.hasUserAccess) {
      await firebase
        .auth()
        .getUserByEmail(email)
        .then((userRecord) => {
          if (userRecord?.uid) {
            userAccessRecord = {
              access: true,
              email: userRecord?.email,
              emailVerified: userRecord?.emailVerified,
              creationTime: userRecord?.metadata?.creationTime,
              lastSignInTime: userRecord?.metadata?.lastSignInTime,
              accountType: user?.root ? "account owner" : "regular user",
              //N:B please change this to the actual permissions and status
              permissions: "full access",
              status: "active",
            };
          }
        })
        .catch((error) => {
          console.log("Error fetching user data:", error);
        });
    }
    user.userAccessRecord = userAccessRecord;

    return res.status(200).send({ data: user });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getOrganisationUsers = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    const users = await OrganisationUserModel.find({
      organisationId,
      // disabled: disabled ? disabled : false,
    });

    return res.status(200).send({ data: users });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getOrganisationPersonnels = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    const users = await OrganisationUserModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();

    const peronnels = [];
    users.forEach((user) => {
      const person = {
        ...user,
        isDriver: false,
        name: `${user.firstName} ${user.lastName}`,
      };
      peronnels.push(person);
    });

    const drivers = await DriverModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    drivers.forEach((driver) => {
      const person = {
        ...driver,
        isDriver: true,
        name: `${driver.firstName} ${driver.lastName}`,
      };
      peronnels.push(person);
    });
    return res.status(200).send({ data: peronnels });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const updateOrganisationUser = async (req, res) => {
  try {
    const { _id, email, user } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    if (email) {
      if (!validator.validate(email))
        return res.status(400).send({ error: "Invalid email address" });
    }
    const exist = await OrganisationUserModel.findById(_id).lean();
    if (!exist) return res.status(400).send({ error: "User not found" });
    const difference = [];
    const oldData = exist;
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
    let social = { ...oldData.social };
    if (req.body?.social) {
      req.body.social = JSON.parse(req.body.social);

      for (const key in req.body.social) {
        let oldSocial = "";
        if (oldData?.social[key] && oldData?.social[key] !== "undefined") {
          oldSocial = oldData?.social[key];
        }

        if (oldData?.social[key] !== oldSocial) {
          difference.push({
            field: key,
            old: oldSocial || "not provided",
            new: req.body?.social[key],
          });
          social[key] = req.body.social[key];
        }
      }
    }
    if (!req.body.imageUrl && req.file) {
      const { _id } = req.body;
      const filename = req.file.filename;
      const imageUrl = await addImage(req, filename);

      const userImage = user?.imageUrl?.name;
      const update = await OrganisationUserModel.findByIdAndUpdate(
        _id,
        { ...req.body, imageUrl, social },
        { new: true }
      );
      if (!update) {
        return res.status(400).send({ error: "error in updating truck" });
      }
      if (userImage && update) {
        const deletePrevImageFromFireBase = Promise.resolve(
          deleteImageFromFirebase(userImage)
        );
        difference.push({
          field: "image / logo",
          old: userImage || "not provided",
          new: filename,
        });
      }

      if (update && user) {
        const log = {
          date: new Date(),
          userId: user,
          action: "edit",
          details: `Personnel - ${update.firstName} ${update.lastName} edited`,
          reason: `edited user`,
          difference,
        };

        const updateLog = await OrganisationUserModel.findByIdAndUpdate(
          _id,
          { $push: { logs: log } },
          { new: true }
        );

        return res
          .status(200)
          .send({ meesage: "user updated successfully", data: update });
      }
    }
    const update = await OrganisationUserModel.findByIdAndUpdate(
      _id,
      { ...req.body, social },
      { new: true }
    );
    if (!update) {
      return res.status(400).send({ error: "error in updating truck" });
    }
    if (update && user) {
      const log = {
        date: new Date(),
        userId: user,
        action: "edit",
        details: `Personnel - ${update.firstName} ${update.lastName} edited`,
      };
      const updateLog = await OrganisationUserModel.findByIdAndUpdate(
        _id,
        { $push: { logs: log } },
        { new: true }
      );
    }

    return res.status(200).send({ meesage: "user  modified", data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const uploadProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: "no file uploaded" });
    }

    const { _id } = req.body;

    if (!_id) {
      return res.status(400).send({ error: "no truck id provided" });
    }

    const filename = req.file.filename;
    const imageUrl = await addImage(req, filename);

    const user = await OrganisationUserModel.findById(_id);
    if (!user) {
      return res.status(400).send({ error: "user does not exist" });
    }
    const update = await OrganisationUserModel.findByIdAndUpdate(
      _id,
      { imageUrl },
      { new: true }
    );

    if (!update) return res.status(400).send({ error: "User not found" });
    const deletePrevDocFromFireBase = await deleteImageFromFirebase(
      user?.imageUrl?.name
    );
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const validateUsers = async (ids) => {
  const invalidUser = await ids.reduce(async (acc, item) => {
    let invalid = await acc;

    const found = await OrganisationUserModel.findById(item);

    if (!found) {
      invalid.push(id);
    }

    return invalid;
  }, []);

  return invalidUser;
};

const deleteUser = async (contacts, userId) => {
  return contacts.reduce(async (acc, _id) => {
    const result = await acc;
    const disabled = await OrganisationUserModel.findByIdAndUpdate(
      _id,
      { disabled: true, portalStatus: false },
      { new: true }
    );
    if (disabled) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "delete",
        details: `User - ${disabled.firstName} ${disabled.lastName} deleted`,
        reason: `deleted user`,
      };
      const updateLog = await OrganisationUserModel.findByIdAndUpdate(
        disabled._id,

        { $push: { logs: log } },
        { new: true }
      );
      result.push(_id);
    }

    return result;
  }, []);
};

const deleteOrganisationUser = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    if (!ids) {
      return res.status(400).send({ error: "please provide user id" });
    }
    if (!userId) {
      return res.status(400).send({ error: "please provide user id" });
    }
    const invalidUsers = await validateUsers(ids);
    if (invalidUsers.length > 0) {
      return res.status(400).send({
        error: `request failed as the following users(s)  ${
          invalidUsers.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidUsers}]`,
      });
    }
    const disabledContacts = await deleteUser(ids, userId);
    if (disabledContacts.length > 0) {
      return res.status(200).send({
        message: "user deleted successfully",
        data: disabledContacts,
      });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const restoreUsers = async (contacts, userId) => {
  return contacts.reduce(async (acc, _id) => {
    const result = await acc;
    const restored = await OrganisationUserModel.findByIdAndUpdate(
      _id,
      { disabled: false },
      { new: true }
    );
    if (restored) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "restore",
        details: `User - ${restored.firstName} ${restored.lastName} deleted`,
        reason: `restored user`,
      };
      const updateLog = await OrganisationUserModel.findByIdAndUpdate(
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

const restoreOrganisationUser = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    if (!ids) {
      return res.status(400).send({ error: "please provide user id" });
    }
    if (!userId) {
      return res.status(400).send({ error: "please provide user id" });
    }
    const invalidUsers = await validateUsers(ids);
    if (invalidUsers.length > 0) {
      return res.status(400).send({
        error: `request failed as the following users(s)  ${
          invalidUsers.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidUsers}]`,
      });
    }

    const restoredContacts = await restoreUsers(ids, userId);
    if (restoredContacts.length > 0) {
      return res.status(200).send({
        message: "user restored successfully",
        data: restoredContacts,
      });
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const userAssignments = async (req, res) => {
  try {
    const { _id, toolId, vehicleId, userId } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "please provide user id" });
    }
    if (!toolId && !vehicleId) {
      return res
        .status(400)
        .send({ error: "please provide tool or vehicle id" });
    }
    if (!userId) {
      return res.status(400).send({
        error: "please provide user id of the user making this change",
      });
    }

    const user = await OrganisationUserModel.findById(_id);
    if (!user) {
      return res.status(400).send({ error: "user does not exist" });
    }
    let updateTool;
    let updateVehicle;
    const assignedUserObj = {
      assignedUserId: _id,
      date: new Date(),
      userId,
      action: "assigned",
    };
    if (toolId) {
      const tool = await ToolModel.findById(toolId);
      if (!tool) {
        return res.status(400).send({ error: "tool does not exist" });
      }
      const previousAssignedUserObj = {
        userId,
        date: new Date(),
        action: "unassigned",
        assignedUserId: tool?.assignedUserId,
      };
      const assignedUserList = [...(tool?.assignedUserList || [])];
      if (previousAssignedUserObj?.assignedUserId) {
        assignedUserList.push(previousAssignedUserObj);
      }
      if (assignedUserObj?.assignedUserId) {
        assignedUserList.push(assignedUserObj);
      }

      updateTool = await ToolModel.findByIdAndUpdate(
        toolId,
        { assignedUserList, assignedUserId: _id },
        { new: true }
      );
    }
    if (vehicleId) {
      const vehicle = await TruckModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(400).send({ error: "vehicle does not exist" });
      }
      const assignedPersonnelsList = [
        ...vehicle?.assignedPersonnelsList,
        assignedUserObj,
      ];
      const log = {
        date: new Date(),
        userId: userId,
        action: "update",
        details: `${vehicle.regNo} assigned to ${user.firstName} ${user.lastName}`,
        reason: `assigned personnel to vehicle`,
      };
      updateVehicle = await TruckModel.findByIdAndUpdate(
        vehicleId,
        { assignedPersonnelsList, $push: { logs: log } },
        { new: true }
      );
    }
    return res.status(200).send({
      message: "user assigned successfully",
      data: { updateTool, updateVehicle },
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const userUnAssignments = async (req, res) => {
  try {
    const { _id, toolId, vehicleId, userId } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "please provide user id" });
    }
    if (!toolId && !vehicleId) {
      return res
        .status(400)
        .send({ error: "please provide tool or vehicle id" });
    }
    if (!userId) {
      return res.status(400).send({
        error: "please provide user id of the user making this change",
      });
    }
    const user = await OrganisationUserModel.findById(_id);
    if (!user) {
      return res.status(400).send({ error: "user does not exist" });
    }
    let updateTool;
    let updateVehicle;
    if (toolId) {
      const tool = await ToolModel.findById(toolId);
      if (!tool) {
        return res.status(400).send({ error: "tool does not exist" });
      }
      const previousAssignedUserObj = {
        userId,
        date: new Date(),
        action: "unassigned",
        assignedUserId: tool?.assignedUserId,
      };
      const assignedUserList = [...(tool?.assignedUserList || [])];
      if (previousAssignedUserObj?.assignedUserId) {
        assignedUserList.push(previousAssignedUserObj);
      }

      updateTool = await ToolModel.findByIdAndUpdate(
        toolId,
        { assignedUserList, assignedUserId: "" },
        { new: true }
      );
    }
    if (vehicleId) {
      const vehicle = await TruckModel.findById(vehicleId);

      if (!vehicle) {
        return res.status(400).send({ error: "vehicle does not exist" });
      }
      const newAssignedPersonnelsList = vehicle?.assignedPersonnelsList.filter(
        (item) => !item?.assignedUserId?.includes(_id)
      );

      const log = {
        date: new Date(),
        userId: userId,
        action: "update",
        details: `${vehicle.regNo} unassigned from ${user.firstName} ${user.lastName}`,
        reason: `unassigned personnel from vehicle`,
      };
      updateVehicle = await TruckModel.findByIdAndUpdate(
        vehicleId,
        {
          assignedPersonnelsList: newAssignedPersonnelsList,
          $push: { logs: log },
        },
        { new: true }
      );
    }
    return res.status(200).send({
      message: "user unassigned successfully",
      data: { updateTool, updateVehicle },
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const recordUserSignIn = async (req, res) => {
  try {
    const { userId, browser, device, os, isDesktop, isMobile, date } = req.body;
    if (!userId) {
      return res.status(400).send({ error: "please provide userId" });
    }
    if (!date) {
      return res.status(400).send({ error: "please provide date" });
    }
    const currentUser = await OrganisationUserModel.findOne({ userId });
    if (!currentUser) {
      return res.status(400).send({ error: "user does not exist" });
    }
    lastSignInCount = currentUser.signInCount || 0;
    const param = {
      date: new Date(),
      browser,
      device,
      os,
      isDesktop,
      isMobile,
    };
    const user = await OrganisationUserModel.findOneAndUpdate(
      { userId },
      { lastSignIn: { ...param }, signInCount: lastSignInCount + 1 },

      { new: true }
    );
    if (!user) {
      return res.status(400).send({ error: "user does not exist" });
    }
    return res.status(200).send({
      message: "user sign in recorded successfully",
      data: user,
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  createOrganisationUsers,
  getOrganisationUser,
  getOrganisationUsers,
  getOrganisationUserById,
  getOrganisationPersonnels,
  updateOrganisationUser,
  uploadProfilePic,
  deleteOrganisationUser,
  restoreOrganisationUser,
  userAssignments,
  userUnAssignments,
  recordUserSignIn,
};
