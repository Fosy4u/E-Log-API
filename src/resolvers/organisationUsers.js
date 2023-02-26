const OrganisationProfileModel = require("../models/organisationProfile");
const OrganisationUserModel = require("../models/organisationUsers");

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
      return res.status(200).send({data : newUser});
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const getOrganisationUser = async (req, res) => {
  try {
   
    const { userId } = req.query;
    const user = await OrganisationUserModel.findOne({ userId });
    return res.status(200).send({data : user});
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  createOrganisationUsers,
  getOrganisationUser,
};
