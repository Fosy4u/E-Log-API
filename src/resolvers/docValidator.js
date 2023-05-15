const InvoiceModel = require("../models/invoice");
const VendorAgentModel = require("../models/vendorAgent");
const CustomerModel = require("../models/customer");
const TripModel = require("../models/trip");
const mongoose = require("mongoose");
const PaymentModel = require("../models/payment");
const OrganisationProfileModel = require("../models/organisationProfile");


const attachProperties = async (payments) => {
  const vendorIds = payments.map((payment) => {
    if (payment.vendorId && payment.vendorId !== "") {
      return payment.vendorId;
    } else {
      return null;
    }
  });
  const customerIds = payments.map((payment) => {
    if (payment.customerId && payment.customerId !== "") {
      return payment.customerId;
    } else {
      return null;
    }
  });
  const vendors = await VendorAgentModel.find({
    _id: { $in: vendorIds },
  }).lean();
  const customers = await CustomerModel.find({
    _id: { $in: customerIds },
  }).lean();
  const tripobjs = payments.map((payment) => payment.requestIds)?.flat();
  const tripIds = tripobjs.map((trip) => trip.requestId);

  const trips = await TripModel.find(
    { requestId: { $in: tripIds } },
    { status: 1, requestId: 1, waybillNumber: 1, amount: 1 }
  ).lean();
  const paymentWithVehicleAndTrip = payments.map((payment) => {
    const vendor = vendors.find(
      (vendor) => vendor._id.toString() == payment.vendorId
    );
    const vendorName = getName(vendor);
    const customer = customers.find(
      (customer) => customer._id.toString() == payment.customerId
    );
    const customerName = getName(customer);
    const { requestIds } = payment;
    let tripCollection = [];
    if (requestIds && requestIds.length > 0) {
      requestIds.map((request) => {
        const trip = trips.find((trip) => trip.requestId == request.requestId);
        if (trip) {
          tripCollection.push({
            ...trip,
            amountPaid: request.amount,
            invoiceId: payment.invoiceId,
          });
        }
      });
    }

    return {
      ...payment,
      vendorName,
      customerName,
      receievedFrom: vendor || customer,
      trips: tripCollection,
    };
  });
  return paymentWithVehicleAndTrip;
};

const getName = (contact) => {
  if (!contact) return null;
  if (contact?.companyName) return contact?.companyName;

  return `${contact?.firstName} ${contact?.lastName}`;
};

const getInvoicePaidAndAmountDue = async (request, invoiceId) => {
  const requestId = request?.requestId;
  let paid = 0;
  let amountDue = request?.amount;
  const paidInvoices = await PaymentModel.find({
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
  const customerData = await CustomerModel.find({
    customerId: { $in: customerIds },
  }).lean();
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
    let status = "Draft";
    if (invoice?.sentToCustomer) {
      status = "Sent";
    }
    if (paid > 0 && amountDue === 0) {
      status = "Paid";
    }
    if (paid > 0 && amountDue > 0) {
      status = "Partially Paid";
    }

    const invObj = {
      vendor: {
        ...vendorDetail,
      },

      customer: {
        customerId: customerDetail?._id,
        name: getName(customerDetail),
        ...customerDetail,
      },
      status,
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
  const isVendorRequested = collection[0]?.vendor?._id ? true : false;
  return {
    ...invoice,
    amountDue: totalAmountDue,
    paid: totalPaid,
    vendor: collection[0]?.vendor,
    tripsDetails: collection,
    isVendorRequested,
    status: collection[0]?.status,
    sentTo: collection[0]?.vendor?._id
      ? collection[0]?.vendor
      : collection[0]?.customer,

    requester: collection[0]?.vendor?._id
      ? getName(collection[0]?.vendor)
      : getName(collection[0]?.customer),
  };
  // return {
  //   ...invoice,
  //   tripsDetails: format,
  //   vendor: format[0]?.vendor,
  // };
};

const getDoc = async (req, res) => {
  try {
    const { code, docId } = req.query;
    console.log("code is", code);
    console.log("docId is", docId);
    if (!code) return res.status(400).send({ error: "code is required" });
    if (!docId) {
      return res.status(400).send({
        error:
          "Invalid Doc. Please ensure url is correct. If you are still having issues, please contact your issuer.",
      });
    }
    let type;
    let data;
    let organisationId;
    let invoice;
    let payment;

    invoice = await InvoiceModel.findOne({
      "shareCode.code": code,
    }).lean();
    if (invoice) {
      if (invoice?.invoiceId !== docId)
        return res.status(400).send({
          error:
            "Invalid Doc. Please ensure url is correct. If you are still having issues, please contact your issuer.",
        });
      if (invoice?.sentToCustomer === false) {
        return res.status(400).send({
          error:
            "Oops! This invoice is still in draft mode and has not been sent to you yet. Please contact your issuer.",
        });
      }
      if (invoice?.disabled) {
        return res.status(400).send({
          error:
            "Oops! This invoice has been disabled. Please contact your issuer.",
        });
      }
      if (invoice?.shareCode?.expiresAt < new Date()) {
        return res.status(400).send({
          error: "Oops! This invoice has expired. Please contact your issuer.",
        });
      }

      const formattedInvoice = await formatInvoice(invoice);
      type = "invoice";
      data = formattedInvoice;
      organisationId = invoice?.organisationId;
    }
    if (!invoice) {
      payment = await PaymentModel.findOne({
        "shareCode.code": code,
      }).lean();
      if (payment) {
        if (payment?.paymentId !== docId) {
          return res.status(400).send({
            error:
              "Invalid Doc. Please ensure url is correct. If you are still having issues, please contact your issuer.",
          });
        }
        if (payment?.shareCode?.expiresAt < new Date()) {
          return res.status(400).send({
            error:
              "Oops! This receipt has expired. Please contact your issuer.",
          });
        }
        if (payment?.disabled) {
          return res.status(400).send({
            error:
              "Oops! This receipt has been disabled. Please contact your issuer.",
          });
        }
        organisationId = payment?.organisationId;
        type = "receipt";
        const propertiesAttached = await attachProperties(
          [payment],
          organisationId
        );
        data = propertiesAttached[0];
      }
    }
    if (!invoice && !payment) {
      console.log("no invoice or payment");
      return res.status(400).send({
        error:
          "The code you entered is invalid. Please try again or request a code from your issuer.",
      });
    }
    const organisationProfile = await OrganisationProfileModel.findById(
      organisationId
    ).lean();

    return res
      .status(200)
      .send({ data, type, organisation: organisationProfile });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  getDoc,
};
