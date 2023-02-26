const OrganisationBranchModel = require("../models/organisationBranch/index");
const OrganisationProfileModel = require("../models/organisationProfile/index");

const getBranch = async (req, res) => {
  try {
    const organisationId = req.query.organisationId;
    if (!organisationId)
      return res.status(400).send({ message: "organisationId is required" });
    const branch = await OrganisationBranchModel.findOne({ organisationId });
    if (!branch) return res.status(400).send({ message: "branch not found" });
    return res.status(200).send(branch);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const createBranch = async (req, res) => {
  try {
    const { organisationId, branches } = req.body;

    if (!organisationId)
      return res.status(400).send({ message: "organisationId is required" });
    if (!branches)
      return res.status(400).send({ message: "branches is empty" });
    branches.map((branch) => {
      if (!branch.name)
        return res
          .status(400)
          .send({ message: "name is missing in one of the branches" });
      if (!branch.address)
        return res
          .status(400)
          .send({ message: "address is missing in one of the branches" });
      if (!branch.region)
        return res
          .status(400)
          .send({ message: "region is missing in one of the branches" });
      if (!branch.country)
        return res
          .status(400)
          .send({ message: "country is missing in one of the branches" });
    });
    const headOffice = branches.find((branch) => branch.headOffice);
    if (!headOffice)
      return res.status(400).send({
        message:
          "headOffice is missing. One of the branches must be headOffice",
      });
    const exist = await OrganisationBranchModel.find({ organisationId });
    if (exist.length > 0) {
      return res.status(400).send({
        message:
          "organisation already has branch bucket created. Consider adding branch to the bucket",
      });
    }
    const newBranch = new OrganisationBranchModel({
      organisationId,
      branches,
    });
    const organisationBranch = await newBranch.save();

    if (!organisationBranch)
      return res.status(400).send({
        message:
          "error while creating branch. if this continues, please contact adinistrator",
      });
    const UpdatedorganisationProfile =
      await OrganisationProfileModel.findByIdAndUpdate(
        organisationId,
        { branchId: organisationBranch._id },
        { new: true }
      );
    if (!UpdatedorganisationProfile) {
      return res.status(400).send({
        message: "branches created but could not update organisation profile",
      });
    }
    return res.status(200).send(organisationBranch);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const addBranch = async (req, res) => {
  try {
    const { _id, name, address, region, country, email, phoneNo } =
      req.body?.branches;
    if (!_id) return res.status(400).send({ message: "_id is required" });
    if (!name) return res.status(400).send({ message: "name is required" });
    if (!address)
      return res.status(400).send({ message: "address is required" });
    if (!region) return res.status(400).send({ message: "region is required" });
    if (!country)
      return res.status(400).send({ message: "country is required" });
    const newBranch = { name, address, region, country, email, phoneNo };

    const update = await OrganisationBranchModel.findByIdAndUpdate(
      _id,
      { $push: { branches: newBranch } },
      { new: true }
    );
    if (!update) return res.status(400).send({ message: "branch not found" });
    return res.status(200).send(update);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { _id, banchId } = req.body;
    if (!_id) return res.status(400).send({ message: "_id is required" });
    if (!banchId)
      return res.status(400).send({ message: "banchId is required" });
    const exist = await OrganisationBranchModel.findById(_id);
    if (!exist)
      return res.status(400).send({ message: "organisationBranch not found" });
    const branchExist = exist.branches.find((branch) => branch._id == banchId);
    if (!branchExist)
      return res.status(400).send({ message: "branch not found" });
    const headOffice = branchExist.headOffice;
    if (headOffice) {
      return res.status(400).send({
        message:
          "request failed as the branch you are trying to delete is the headOffice. You have to first make another branch head office before continuing to delete this branch",
      });
    }
    const disabledBranch = await OrganisationBranchModel.findByIdAndUpdate(
      { "branches._id": banchId },
      { $set: { "branches.status": "disabled" } },
      { new: true }
    );
    if (!disabledBranch)
      return res.status(400).send({ message: "branch not deleted" });
    return res.status(200).send(disabledBranch);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const editBranch = async (req, res) => {
  try {
    const { _id, banchId, name, address, region, country, email, phoneNo } =
      req.body;
    if (!_id) return res.status(400).send({ message: "_id is required" });
    if (!banchId)
      return res.status(400).send({ message: "banchId is required" });
    const exist = await OrganisationBranchModel.findById(_id);
    if (!exist)
      return res.status(400).send({ message: "organisationBranch not found" });
    const branchExist = exist.branches.find((branch) => branch._id == banchId);
    if (!branchExist)
      return res.status(400).send({ message: "branch not found" });
    const updatedBranch = await OrganisationBranchModel.findByIdAndUpdate(
      { "branches._id": banchId },
      {
        $set: {
          "branches.name": name || branchExist.name,
          "branches.address": address || branchExist.address,
          "branches.region": region || branchExist.region,
          "branches.country": country || branchExist.country,
          "branches.email": email || branchExist.email,
          "branches.phoneNo": phoneNo || branchExist.phoneNo,
        },
      },
      { new: true }
    );
    if (!updatedBranch)
      return res.status(400).send({ message: "branch not updated" });
    return res.status(200).send(updatedBranch);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  getBranch,
  createBranch,
  addBranch,
  deleteBranch,
  editBranch,
};
