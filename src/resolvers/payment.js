const PaymentModel = require("../models/payment");
const VendorAgentModel = require("../models/vendorAgent");
const TruckModel = require("../models/truck");
const TripModel = require("../models/trip");
const InvoiceModel = require("../models/invoice");
const mongoose = require("mongoose");
const moment = require("moment");
const {
  canDeleteOrEditOrganisationPaymentRemark,
  canEditOrganisationPayment,
  canCreateOrganisationPayment,
} = require("../helpers/actionPermission");
const { numberWithCommas, getPaidAndAmountDue } = require("../helpers/utils");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await PaymentModel.findOne(
      {
        organisationId,
        paymentId: code,
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

const updateTripLogs = async (requestId, log) => {
  const upDateTrip = await TripModel.findOneAndUpdate(
    { requestId: requestId },
    { $push: { logs: log } },
    { new: true }
  );
  return upDateTrip?._id ? true : false;
};

const validateAmount = async (request) => {
  const { amount, requestId } = request;
  const trip = await TripModel.findOne({ requestId: requestId });
  const originalAmount = trip?.amount;
  const { paid, amountDue } = await Promise.resolve(getPaidAndAmountDue(trip));
  console.log("amountDue", amountDue, "amount", amount, "paid", paid);
  if (amountDue === 0) return false;
  if (amountDue < amount) return false;
  if (paid + amount > originalAmount) return false;
  return true;
};

const createPayment = async (req, res) => {
  const {
    organisationId,
    amount,
    date,
    userId,
    remark,
    requestIds,
    invoiceId,
  } = req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }

    if (!amount)
      return res.status(400).json({ error: "Please provide amount" });

    if (!date) return res.status(400).json({ error: "Please provide date" });

    const invalidRequestIds =
      requestIds?.length > 0 &&
      requestIds?.find((r) => !r.requestId) &&
      requestIds
        ? true
        : false;

    if (invalidRequestIds)
      return res
        .status(400)
        .json({ error: "Please provide  valid requestIds" });
    console.log("invalidRequestIds", invalidRequestIds);

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const param = { organisationId, userId };
    const canPerformAction = await canCreateOrganisationPayment(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });
    let vendorId;
    if (requestIds?.length > 0 && !invalidRequestIds) {
      vendorId = await TripModel.findOne(
        { requestId: requestIds[0].requestId },
        { vendorId: 1 }
      ).lean().vendorId;
    }
    if (requestIds?.length > 0 && !invalidRequestIds) {
      let invalids = 0;

      const validate = await Promise.all(
        requestIds?.map(async (request) => {
          const valid = await validateAmount(request);
          if (!valid) {
            invalids++;
          }
        })
      );
      if (invalids > 0) {
        return res.status(400).send({
          error:
            "Failed to validate amount: either invalid trip or amount is in conflict with trip amount due",
        });
      }
    }

    const paymentId = await generateUniqueCode(organisationId);
    if (!paymentId)
      return res
        .status(400)
        .send({ error: "Internal error in generating paymentId" });

    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `Payment -  created`,
      reason: `added new payment`,
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
    let invoice;
    if (invoiceId) {
      invoice = await InvoiceModel.findOne({ invoiceId }).lean();
    }

    params = {
      ...req.body,
      paymentId,
      vendorId,
      isTrip: requestIds?.length > 0 && !invalidRequestIds,
      logs: [log],
      remarks,
    };
    if (req.body?.date) {
      params.date = moment(req.body.date).toISOString();
    }

    const newPayment = new PaymentModel({
      ...params,
    });
    const savePayment = await newPayment.save();
    if (!savePayment)
      return res.status(401).json({ error: "Internal in saving payment" });

    if (requestIds?.length > 0 && !invalidRequestIds) {
      await Promise.all(
        requestIds.map(async (request) => {
          const { amount, requestId } = request;
          const log = {
            date: new Date(),
            userId: userId,
            action: "paid",
            details: `${numberWithCommas(
              amount
            )} paid from paymentId - ${paymentId}`,
            reason: `Payment added to trip`,
          };
          const updateTrip = await updateTripLogs(requestId, log);
          if (!updateTrip)
            return res.status(401).json({
              error: "Payment recorded but failed to update trip log",
            });
        })
      );
    }
    const invoiceLog = {
      date: new Date(),
      userId: userId,
      action: "stamp",
      details: `Invoice - marked as sent`,
      reason: `Invoice sent to recipient`,
    };
    if (invoiceId && invoice && !invoice?.sentToCustomer) {
      await InvoiceModel.findOneAndUpdate(
        { invoiceId },
        { sentToCustomer: true, $push: { logs: invoiceLog } }
      );
    }

    return res
      .status(200)
      .send({ message: "Payment created successfully", data: savePayment });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const attachProperties = async (payments) => {
  const vendorIds = payments.map((payment) => {
    if (payment.vendorId && payment.vendorId !== "") {
      return payment.vendorId;
    } else {
      return null;
    }
  });
  const vendors = await VendorAgentModel.find(
    { _id: { $in: vendorIds } },
    { companyName: 1, firstName: 1, lastName: 1 }
  ).lean();

  const tripobjs = payments.map((payment) => payment.requestIds)?.flat();
  const tripIds = tripobjs.map((trip) => trip.requestId);

  const trips = await TripModel.find(
    { requestId: { $in: tripIds } },
    { status: 1, requestId: 1, waybillNumber: 1 }
  ).lean();

  const paymentWithVehicleAndTrip = payments.map((payment) => {
    const vendor = vendors.find((vendor) => vendor._id == payment.vendorId);
    const vendorName = getName(vendor);
    const { requestIds } = payment;
    let tripCollection = [];
    if (requestIds && requestIds.length > 0) {
      requestIds.map((request) => {
        const trip = trips.find((trip) => trip.requestId == request.requestId);
        if (trip) {
          tripCollection.push({
            ...trip,
            amountPaid: request.amount,
          });
        }
      });
    }

    return {
      ...payment,
      vendorName,
      trips: tripCollection,
    };
  });
  return paymentWithVehicleAndTrip;
};

const getInvoicesRecordedPayment = async (req, res) => {
  const { organisationId, invoiceIds, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!invoiceIds || invoiceIds.length === 0) {
      return res.status(400).json({
        error: "Please provide valid invoice ids",
      });
    }
    let invoiceIdsMap = invoiceIds;
    if (typeof invoiceIds === "string") {
      invoiceIdsMap = invoiceIds.split(",");
    }

    const payment = await PaymentModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
      invoiceId: { $in: invoiceIdsMap },
    }).lean();

    return res.status(200).send({
      message: "Payment fetched successfully",
      data: payment,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getPayments = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const payment = await PaymentModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!payment)
      return res
        .status(401)
        .json({ error: "Internal error in getting payment" });

    const propertiesAttached = await attachProperties(payment, organisationId);

    return res.status(200).send({
      message: "Payment fetched successfully",
      data: propertiesAttached.sort(function (a, b) {
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
const getPaymentsByInvoiceId = async (req, res) => {
  const { organisationId, disabled, invoiceId } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!invoiceId)
      return res.status(400).json({ error: "Please provide invoice id" });
    const payment = await PaymentModel.find({
      organisationId,
      invoiceId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!payment)
      return res
        .status(401)
        .json({ error: "Internal error in getting payment" });

    const propertiesAttached = await attachProperties(payment, organisationId);

    return res.status(200).send({
      message: "Payments for specified invoiceId fetched successfully",
      data: propertiesAttached.sort(function (a, b) {
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

const getPayment = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "payment _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const payment = await PaymentModel.findOne({
      _id,
      organisationId,
      disabled: false,
    }).lean();
    if (!payment) return res.status(400).send({ error: "payment not found" });
    const propertiesAttached = await attachProperties(
      [payment],
      organisationId
    );

    return res.status(200).send({ data: propertiesAttached[0] });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updatePayment = async (req, res) => {
  const { _id, userId, organisationId, requestIds } = req.body;
  console.log("requestIds", requestIds);
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const param = { paymentId: _id, userId };
    const canPerformAction = await canEditOrganisationPayment(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });
    const oldData = await PaymentModel.findById(_id).lean();
    console.log("oldData", oldData);
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
        key !== "vehicleId" &&
        key !== "requestIds"
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

    const oldRequestIds = oldData?.requestIds;
    const oldRequestIdsMap = oldRequestIds?.map(
      (request) => request?.requestId
    );

    const requestIdsMap = requestIds?.map((request) => request?.requestId);
    if (requestIds && requestIds.length > 0) {
      //check if equal content
      const isEqual = requestIdsMap.every((requestId) =>
        oldRequestIdsMap.includes(requestId)
      );

      if (!isEqual) {
        difference.push({
          field: "trips",
          old: oldRequestIdsMap || "not provided",
          new: requestIdsMap || "not provided",
        });
      }
    }
    const log = {
      date: new Date(),
      userId: userId,
      action: "update",
      details: `Payment - updated`,
      reason: `updated payment`,
      difference,
    };
    const params = {
      ...req.body,
    };
    if (req.body?.date) {
      params.date = moment(req.body.date).toISOString();
    }

    const updatePayment = await PaymentModel.findByIdAndUpdate(
      _id,
      {
        ...params,
        logs: [...oldData.logs, log],
      },
      { new: true }
    );

    if (!updatePayment)
      return res
        .status(401)
        .json({ error: "Internal error in updating payment" });

    await Promise.all(
      updatePayment.requestIds.map(async (request) => {
        const requestLog = {
          date: new Date(),
          userId: userId,
          action: "edit payment",
          details: `Payment - updated`,
          reason: `updated payment`,
          difference,
        };
        const updateTrip = await updateTripLogs(request.requestId, requestLog);
      })
    );

    return res
      .status(200)
      .send({ message: "Payment updated successfully", data: updatePayment });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const validatePayments = async (ids) => {
  const Payment = await PaymentModel.find({
    _id: { $in: ids },
    disabled: false,
  });
  if (Payment.length !== ids.length) {
    return false;
  }
  return true;
};
const disablePayments = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Payment -  deleted`,
    reason: `deleted payment`,
  };
  const updateExp = await PaymentModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};

const deletePayments = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No payment id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validatePayments(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid payment id is provided" });
    const isDisabled = await disablePayments(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in deleting Payments" });
    return res
      .status(200)
      .send({ message: "Payment deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getPaymentLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "Payment _id is required" });
    const payment = await PaymentModel.aggregate([
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

    const logs = payment[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addPaymentRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "payment_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const payment = await PaymentModel.findById({ _id });
    if (!payment) return res.status(400).send({ error: "payment not found" });
    remarkObj.date = new Date();
    const updateRemark = await PaymentModel.findByIdAndUpdate(
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
      details: `added remark on payment `,
    };
    const updatePayment = await PaymentModel.findByIdAndUpdate(
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

const deletePaymentRemark = async (req, res) => {
  try {
    const { paymentId, remarkId, userId } = req.body;
    if (!paymentId)
      return res.status(400).send({ error: "paymentId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const payment = await PaymentModel.findById({
      _id: paymentId,
    });
    if (!payment) return res.status(400).send({ error: "Payment not found" });
    const param = { paymentId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationpaymentRemark(
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
      details: `deleted remark on payment`,
    };

    const updateRemark = await PaymentModel.findByIdAndUpdate(
      {
        _id: paymentId,
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
const editPaymentRemark = async (req, res) => {
  try {
    const { paymentId, remarkId, userId, remark } = req.body;
    if (!paymentId)
      return res.status(400).send({ error: "paymentId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const payment = await PaymentModel.findById({
      _id: paymentId,
    });
    if (!payment) return res.status(400).send({ error: "payment not found" });
    const param = { paymentId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationPaymentRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await PaymentModel.updateOne(
      {
        _id: paymentId,
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
      details: `edited remark on payment`,
    };
    const updatePayment = await PaymentModel.findByIdAndUpdate(
      { _id: paymentId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getPaymentRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "payment _id is required" });
    const payments = await PaymentModel.aggregate([
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

    const remarks = payments[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  addPaymentRemark,
  deletePaymentRemark,
  editPaymentRemark,
  getPaymentRemarks,
  createPayment,
  getPayments,
  getPayment,
  getPaymentsByInvoiceId,
  updatePayment,
  deletePayments,
  getPaymentLogs,
  getInvoicesRecordedPayment,
};
