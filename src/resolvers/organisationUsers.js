const OrganisationProfileModel = require("../models/organisationProfile");
const OrganisationUserModel = require("../models/organisationUsers");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
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
  console.log("starting image del", name);

  if (name) {
    storageRef
      .file("/user/" + name)
      .delete()
      .then(() => {
        console.log("del is", name);
        return true;
      })
      .catch((err) => {
        console.log("err is", err);
        return false;
      });
  }
};

const createOrganisationUsers = async (req, res) => {
  const { email, firstName, lastName, password, organisationId } = req.body;
  try {
    const user = OrganisationUserModel.find({ email });
    if (user) {
      return res
        .status(400)
        .send("An account with same email address is already existing.");
    }

    const params = {
      firstName,
      lastName,
      password,
      organisationId,
      isAdmin: false,
    };
    const createUser = new OrganisationUserModel({ ...params });
    const newUser = createUser.save();
    if (newUser) {
      console.log("new user successful", newUser);
      return res.status(200).send({ data: newUser });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getOrganisationUser = async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await OrganisationUserModel.findOne({ userId });
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

      disabled: disabled ? disabled : false,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const updateOrganisationUser = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const update = await OrganisationUserModel.findByIdAndUpdate(
      _id,
      {
        ...req.body,
      },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: "User not found" });

    return res.status(200).send({ data: update });
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

module.exports = {
  createOrganisationUsers,
  getOrganisationUser,
  getOrganisationUsers,
  updateOrganisationUser,
  uploadProfilePic,
};
