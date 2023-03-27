const InvoiceModel = require("../models/invoice");
const VendorAgentModel = require("../models/vendorAgent");

const CustomerModel = require("../models/customer");
const TripModel = require("../models/trip");
const mongoose = require("mongoose");
const {
  canDeleteOrEditOrganisationInvoiceRemark,
  canEditOrganisationInvoice,
  canCreateOrganisationInvoice,
} = require("../helpers/actionPermission");
const { getPaidAndAmountDue } = require("../helpers/utils");
const IncomeModel = require("../models/income");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await InvoiceModel.findOne(
      {
        organisationId,
        invoiceId: code,
        disabled: false,
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
const verifyTrips = async (requestIds) => {
  const requestIdsMap = requestIds.map((request) => request.requestId);
  const trips = await TripModel.find({
    requestId: { $in: requestIdsMap },
  }).lean();

  if (requestIdsMap?.length !== trips.length) return false;
  const sameVendor = trips.every(
    (trip) => trip?.vendorId === trips[0]?.vendorId
  );
  if (!sameVendor) return false;
  return true;
};
const hasTripsInvoiced = async (requestIds) => {
  const requestIdsMap = requestIds.map((request) => request.requestId);
  const invoices = await InvoiceModel.find(
    {
      disabled: false,
      "requestIds.requestId": { $in: requestIdsMap },
    },
    { lean: true }
  );
  if (invoices.length > 0) return true;
  return false;
};

const createInvoice = async (req, res) => {
  const { organisationId, requestIds, amount, date, userId, remark, vendorId } =
    req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }

    if (!amount)
      return res.status(400).json({ error: "Please provide amount" });
    const requestIdsMap = requestIds.map((request) => request.requestId);
    const selectedTrips = await TripModel.find({
      requestId: { $in: requestIdsMap },
    }).lean();
    if (!vendorId)
      return res.status(400).json({ error: "Please provide vendor id" });

    const amountDueTotal = await Promise.resolve(
      selectedTrips.reduce(async (acc, trip) => {
        let collector = await acc;
        const { amountDue } = await getPaidAndAmountDue(trip);

        return collector + amountDue;
      }, 0)
    );
    await Promise.resolve(amountDueTotal);
    if (amountDueTotal != Number(amount))
      return res.status(400).json({ error: "Please provide valid amount" });
    if (!date) return res.status(400).json({ error: "Please provide date" });

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (!requestIds || requestIds.length === 0)
      return res.status(400).json({ error: "Please provide requestIds" });
    const verify = await Promise.resolve(verifyTrips(requestIds));
    if (!verify)
      return res.status(400).json({ error: "Please provide valid trips" });

    const alreadyInvoiced = await Promise.resolve(hasTripsInvoiced(requestIds));

    if (alreadyInvoiced)
      return res
        .status(400)
        .json({ error: "One or more of the trips have been invoiced before" });
    const param = { organisationId, userId };

    const canPerformAction = await canCreateOrganisationInvoice(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });

    const invoiceId = await generateUniqueCode(organisationId);

    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `Invoice -  created`,
      reason: `added new invoice`,
    };
    let formattedRemark;

    if (remark) {
      formattedRemark = {
        remark,
        userId,
        date: new Date(),
      };
    }

    let params;

    params = {
      ...req.body,
      invoiceId,
      logs: [log],
      remark: formattedRemark,
      requestIds,
    };

    const newInvoice = new InvoiceModel({
      ...params,
    });
    const saveInvoice = await newInvoice.save();
    if (!saveInvoice)
      return res.status(401).json({ error: "Internal in saving invoice" });

    const formattedInvoice = await Promise.resolve(formatInvoice(saveInvoice));

    return res.status(200).send({
      message: "Invoice created successfully",
      data: formattedInvoice,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getInvoicePaidAndAmountDue = async (request, invoiceId) => {
  const requestId = request?.requestId;
  let paid = 0;
  let amountDue = request?.amount;
  const paidInvoices = await IncomeModel.find({
    invoiceId,
    disabled: false,
    "requestIds.requestId": requestId,
  }).lean();
  const flatPaidInvoicesReuestIds = paidInvoices.flatMap((invoice) => {
    return invoice?.requestIds;
  });
  if (flatPaidInvoicesReuestIds.length > 0) {
    const paidInvoicesRequestIds = flatPaidInvoicesReuestIds.filter(
      (request) => request?.requestId === requestId
    );
    paid = paidInvoicesRequestIds.reduce((acc, request) => {
      return acc + request?.amount;
    }, 0);
    amountDue = amountDue - paid;
  }

  return { paid, amountDue };
};

const formatInvoice = async (invoice) => {
  const { requestIds } = invoice;
  const requestIdsMap = requestIds.map((request) => request.requestId);
  const tripData = await TripModel.find(
    {
      requestId: { $in: requestIdsMap },
    },
    {
      vendorId: 1,
      customerId: 1,
      requestId: 1,
      waybillNumber: 1,
      price: 1,
      quantity: 1,
      maxLoad: 1,
      pickupAddress: 1,
      dropOffAddress: 1,
      amount: 1,
    }
  ).lean();

  const vendorIds = tripData.map((trip) => trip?.vendorId);

  const vendorData = await Promise.resolve(
    VendorAgentModel.find({
      vendorId: { $in: vendorIds },
    }).lean()
  );

  const customerIds = tripData.map((trip) => trip?.customerId);
  const customerData = await CustomerModel.find(
    {
      customerId: { $in: customerIds },
    },
    { companyName: 1, firstName: 1, lastName: 1, customerId: 1 }
  ).lean();
  const collection = [];

  const format = requestIds.map(async (request) => {
    const tripDetail = tripData.find(
      (t) => t?.requestId === request?.requestId
    );

    const vendorDetail = vendorData.find(
      (vendor) => vendor?._id?.toString() === tripDetail?.vendorId
    );

    const customerDetail = customerData.find(
      (customer) => customer?._id?.toString() === tripDetail?.customerId
    );

    const calc = await Promise.resolve(
      getInvoicePaidAndAmountDue(request, invoice?.invoiceId)
    );
    const { amountDue, paid } = calc;

    const invObj = {
      vendor: {
        ...vendorDetail,
      },

      customer: {
        customerId: customerDetail?._id,
        name: getName(customerDetail),
      },
      trip: {
        ...tripDetail,
        amountDue,
        paid,
        requester: getName(vendorDetail || customerDetail),
      },
    };

    await Promise.resolve(invObj);

    collection.push(invObj);
  });

  await Promise.all(format);

  const totalAmountDue = collection.reduce((acc, trip) => {
    return acc + trip.trip.amountDue;
  }, 0);
  const totalPaid = collection.reduce((acc, trip) => {
    return acc + trip.trip.paid;
  }, 0);

  return {
    ...invoice,
    amountDue: totalAmountDue,
    paid: totalPaid,
    vendor: collection[0]?.vendor,
    tripsDetails: collection,
    requester: getName(collection[0]?.vendor || collection[0]?.customer),
  };
  // return {
  //   ...invoice,
  //   tripsDetails: format,
  //   vendor: format[0]?.vendor,
  // };
};

const getInvoices = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const invoice = await InvoiceModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!invoice)
      return res
        .status(401)
        .json({ error: "Internal error in getting invoice" });

    const formattedInvoices = await Promise.all(
      invoice.map(async (inv) => {
        const format = await formatInvoice(inv);
        return format;
      })
    );

    return res.status(200).send({
      message: "Invoice fetched successfully",
      data: formattedInvoices.sort(function (a, b) {
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
const getUnpaidInvoices = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const invoice = await InvoiceModel.aggregate([
      { $match: { organisationId, disabled: false } },
      {
        $lookup: {
          from: "income",
          let: {
            parent_group: "$invoiceId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$invoiceId", "$$parent_group"],
                },
              },
            },
          ],
          as: "parent_docs",
        },
      },
    ]);

    if (!invoice)
      return res
        .status(401)
        .json({ error: "Internal error in getting invoice" });

    const formattedInvoices = await Promise.all(
      invoice.map(async (inv) => {
        const format = await formatInvoice(inv);
        return format;
      })
    );
    const filterUnpaid = formattedInvoices.filter((inv) => inv.amountDue > 0);

    return res.status(200).send({
      message: "Invoice fetched successfully",
      data: filterUnpaid.sort(function (a, b) {
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

const getInvoice = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "invoice _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });

    const invoice = await InvoiceModel.findOne({
      _id,
      organisationId,
      disabled: false,
    }).lean();
    if (!invoice) return res.status(400).send({ error: "invoice not found" });
    const formattedInvoice = await formatInvoice(invoice);
    return res.status(200).send({ data: formattedInvoice });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getInvoiceByInvoiceId = async (req, res) => {
  try {
    const { invoiceId, organisationId } = req.query;
    if (!invoiceId)
      return res.status(400).send({ error: "invoiceId is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });

    const invoice = await InvoiceModel.findOne({
      invoiceId,
      organisationId,
      disabled: false,
    }).lean();
    if (!invoice) return res.status(400).send({ error: "invoice not found" });
    const formattedInvoice = await formatInvoice(invoice);
    return res.status(200).send({ data: formattedInvoice });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updateInvoice = async (req, res) => {
  const { _id, userId, remark, requestIds } = req.body;
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (!requestIds || requestIds?.length === 0)
      return res.status(400).json({ error: "Please provide requestIds" });
    const param = { invoiceId: _id, userId };
    const canPerformAction = await canEditOrganisationInvoice(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });
    const oldData = await InvoiceModel.findById(_id).lean();
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
        key !== "remark" &&
        key !== "userId" &&
        key !== "requestIds"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }

    const oldRequestIds = oldData?.requestIds;
    const newRequestIds = newData?.requestIds;
    let newAmount;
    if (newRequestIds?.length > 0) {
      const verify = await Promise.resolve(verifyTrips(newRequestIds));
      if (!verify)
        return res.status(400).json({ error: "Please provide valid trips" });

      const oldRequestIdsMap = oldRequestIds.map(
        (request) => request?.requestId
      );
      const notInOldDataTrips = newRequestIds.filter(
        (request) => !oldRequestIdsMap.includes(request?.requestId)
      );
      if (notInOldDataTrips.length > 0) {
        const alreadyInvoiced = await Promise.resolve(
          hasTripsInvoiced(notInOldDataTrips)
        );
        if (alreadyInvoiced)
          return res.status(400).json({
            error: "One or more of the trips have been invoiced before",
          });
      }

      const totalAmount = newRequestIds.reduce((acc, curr) => {
        return acc + curr?.amount;
      }, 0);

      const oldAmount = oldData?.amount;
      if (totalAmount !== oldAmount) {
        newAmount = totalAmount;
      }

      //compare trips

      if (notInOldDataTrips.length > 0) {
        difference.push({
          field: "trips",
          old: oldRequestIdsMap?.toString() || "not provided",
          new: newRequestIds?.map((request) => request?.requestId)?.toString(),
        });
      }
      //compare amount
      if (newAmount !== oldAmount) {
        difference.push({
          field: "amount",
          old: oldAmount || "not provided",
          new: newAmount,
        });
      }
    }

    let formattedRemark;

    if (remark || remark === "") {
      formattedRemark = {
        remark: remark || "",
        userId,
        date: new Date(),
      };
      if (oldData?.remark?.remark !== remark) {
        difference.push({
          field: "remark",
          old: oldData?.remark?.remark || "not provided",
          new: remark,
        });
      }
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "update",
      details: `Invoice - updated`,
      reason: `updated invoice`,
      difference,
    };

    const updateInvoice = await InvoiceModel.findByIdAndUpdate(
      _id,
      {
        ...req.body,
        amount: newAmount || oldData?.amount,
        remark: remark || remark === "" ? formattedRemark : oldData?.remark,
        $push: { logs: log },
      },
      { new: true }
    );

    if (!updateInvoice)
      return res
        .status(401)
        .json({ error: "Internal error in updating invoice" });

    return res
      .status(200)
      .send({ message: "Invoice updated successfully", data: updateInvoice });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const validateInvoices = async (ids) => {
  const Invoice = await InvoiceModel.find({
    _id: { $in: ids },
    disabled: false,
  });
  if (Invoice.length !== ids.length) {
    return false;
  }
  return true;
};
const disableInvoices = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Invoice -  deleted`,
    reason: `deleted invoice`,
  };
  const updateExp = await InvoiceModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};

const deleteInvoices = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No invoice id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateInvoices(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid invoice id is provided" });
    const isDisabled = await disableInvoices(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in deleting Invoices" });
    return res
      .status(200)
      .send({ message: "Invoice deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getInvoiceLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "Invoice _id is required" });
    const invoice = await InvoiceModel.aggregate([
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

    const logs = invoice[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addInvoiceRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "invoice_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const invoice = await InvoiceModel.findById({ _id });
    if (!invoice) return res.status(400).send({ error: "invoice not found" });
    remarkObj.date = new Date();
    const updateRemark = await InvoiceModel.findByIdAndUpdate(
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
      details: `added remark on invoice - ${invoice.requestId}`,
    };
    const updateInvoice = await InvoiceModel.findByIdAndUpdate(
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

const deleteInvoiceRemark = async (req, res) => {
  try {
    const { invoiceId, remarkId, userId } = req.body;
    if (!invoiceId)
      return res.status(400).send({ error: "invoiceId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const invoice = await InvoiceModel.findById({
      _id: invoiceId,
    });
    if (!invoice) return res.status(400).send({ error: "Invoice not found" });
    const param = { invoiceId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationInvoiceRemark(
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
      details: `deleted remark on invoice`,
    };

    const updateRemark = await InvoiceModel.findByIdAndUpdate(
      {
        _id: invoiceId,
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
const editInvoiceRemark = async (req, res) => {
  try {
    const { invoiceId, remarkId, userId, remark } = req.body;
    if (!invoiceId)
      return res.status(400).send({ error: "invoiceId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const invoice = await InvoiceModel.findById({
      _id: invoiceId,
    });
    if (!invoice) return res.status(400).send({ error: "invoice not found" });
    const param = { invoiceId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationInvoiceRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await InvoiceModel.updateOne(
      {
        _id: invoiceId,
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
      details: `edited remark on invoice`,
    };
    const updateInvoice = await InvoiceModel.findByIdAndUpdate(
      { _id: invoiceId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getInvoiceRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "invoice _id is required" });
    const invoices = await InvoiceModel.aggregate([
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

    const remarks = invoices[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  addInvoiceRemark,
  deleteInvoiceRemark,
  editInvoiceRemark,
  getInvoiceRemarks,
  createInvoice,
  getInvoices,
  getInvoice,
  getInvoiceByInvoiceId,
  updateInvoice,
  deleteInvoices,
  getInvoiceLogs,
  getUnpaidInvoices,
};
