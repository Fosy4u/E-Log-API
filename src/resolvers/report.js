const mongoose = require("mongoose");
const TripModel = require("../models/trip");
const ExpensesModel = require("../models/expenses");
const PaymentModel = require("../models/payment");
const VendorAgentModel = require("../models/vendorAgent");
const TruckModel = require("../models/truck");
const CustomerModel = require("../models/customer");
const moment = require("moment");

const getLastUpdated = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    const lastUpdatedTrip = await TripModel.findOne({ organisationId }).sort({
      updatedAt: -1,
    });
    const lastUpdatedExpenses = await ExpensesModel.findOne({
      organisationId,
    }).sort({
      updatedAt: -1,
    });
    const lastUpdatedPayment = await PaymentModel.findOne({
      organisationId,
    }).sort({
      updatedAt: -1,
    });
    const laseUpdatedExpensesForVehicle = await ExpensesModel.findOne({
      vehicleId: { $exists: true },
      organisationId,
    }).sort({ updatedAt: -1 });
    const laseUpdatedExpensesForTrip = await ExpensesModel.findOne({
      tripId: { $exists: true },
      organisationId,
    }).sort({ updatedAt: -1 });
    const laseUpdatedExpensesForNonTrip = await ExpensesModel.findOne({
      tripId: { $exists: false },
      organisationId,
    }).sort({ updatedAt: -1 });
    const laseUpdatedPaymentForNonTrip = await PaymentModel.findOne({
      requestIds: { $exists: false },
      organisationId,
    }).sort({ updatedAt: -1 });
    const lastInvoicedPayment = await PaymentModel.findOne({
      invoiceId: { $exists: true },
      organisationId,
    }).sort({ updatedAt: -1 });
    const LastNonInvoicedPayment = await PaymentModel.findOne({
      invoiceId: { $exists: false },
      organisationId,
    }).sort({ updatedAt: -1 });

    const data = {
      lastUpdatedTrip: lastUpdatedTrip?.updatedAt,
      lastUpdatedExpenses: lastUpdatedExpenses?.updatedAt,
      lastUpdatedPayment: lastUpdatedPayment?.updatedAt,
      lastProfitAndLoss:
        lastUpdatedTrip?.updatedAt.getTime() >
        lastUpdatedExpenses?.updatedAt.getTime()
          ? lastUpdatedTrip?.updatedAt
          : lastUpdatedExpenses?.updatedAt,
      lastUpdatedExpensesForVehicle: laseUpdatedExpensesForVehicle?.updatedAt,
      lastUpdatedExpensesForTrip: laseUpdatedExpensesForTrip?.updatedAt,
      lastUpdateProfitAndLossForVehicle:
        laseUpdatedExpensesForVehicle?.updatedAt.getTime() >
        lastUpdatedTrip?.updatedAt.getTime()
          ? laseUpdatedExpensesForVehicle?.updatedAt
          : lastUpdatedTrip?.updatedAt,
      lastUpdateProfitAndLossForTrip:
        laseUpdatedExpensesForTrip?.updatedAt.getTime() >
        lastUpdatedTrip?.updatedAt.getTime()
          ? laseUpdatedExpensesForTrip?.updatedAt
          : lastUpdatedTrip?.updatedAt,
      lastInvoicedPayment: lastInvoicedPayment?.updatedAt,
      LastNonInvoicedPayment: LastNonInvoicedPayment?.updatedAt,
      lastUpdatedExpensesForNonTrip: laseUpdatedExpensesForNonTrip?.updatedAt,
      lastUpdatedPaymentForNonTrip: laseUpdatedPaymentForNonTrip?.updatedAt,
    };
    res.status(200).send({ data });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const resolveTripIncome = async (trip, variable) => {
  const clonedTrip = { ...trip };
  const {
    amount,
    requestId,
    pickupDate,
    dropOffDate,
    requester,
    waybillNumber,
    _id,
  } = clonedTrip;

  return {
    advanceRevenue: variable === "advanceRevenue" ? true : false,
    balanceRevenue: variable === "balanceRevenue" ? true : false,
    credit: amount / 2,
    requestId,
    date:
      variable === "advanceRevenue"
        ? moment(pickupDate).format("YYYY-MM-DD")
        : moment(dropOffDate).format("YYYY-MM-DD"),
    requester,
    waybillNumber,
    _id,
  };
};

const resolveExpense = (expense) => {
  const clonedExpense = { ...expense };
  const { amount, expensesId, expenseType, date, _id } = clonedExpense;
  return {
    debit: amount,
    expensesId,
    expenseType,
    date: moment(date).format("YYYY-MM-DD"),
    _id,
  };
};

const getName = (contact) => {
  if (contact?.companyName) return contact?.companyName;
  if (contact?.firstName && contact?.lastName)
    return `${contact?.firstName} ${contact?.lastName}`;
  return null;
};
const addRequester = async (trips) => {
  const vendorIds = trips.map((trip) => (trip.vendorId ? trip.vendorId : null));
  const customerIds = trips.map((trip) =>
    trip.customerId ? trip.customerId : null
  );
  const vendors = await VendorAgentModel.find({
    _id: { $in: vendorIds },
  }).lean();
  const customers = await CustomerModel.find({
    _id: { $in: customerIds },
  }).lean();
  const newTrips = [];
  for (const trip of trips) {
    const { vendorId, customerId } = trip;
    let requester;
    if (vendorId) {
      const vendor = vendors.find(
        (vendor) => vendor._id.toString() === vendorId.toString()
      );
      requester = getName(vendor);
    } else {
      const customer = customers.find(
        (customer) => customer._id.toString() === customerId.toString()
      );
      requester = getName(customer);
    }
    newTrips.push({ ...trip, requester });
  }
  return newTrips;
};
const addBalanceRevenue = async (sortedValues) => {
  let balance = 0;
  const newSortedValues = [];
  for (const value of sortedValues) {
    if (value.credit) {
      balance += value.credit;
    } else if (value.debit) {
      balance -= value.debit;
    }
    newSortedValues.push({ ...value, balance });
  }
  return newSortedValues;
};
const getNonTripPayments = async (organisationId, fromDate, toDate) => {
  const payments = await PaymentModel.find({
    organisationId,
    isTrip: false,
    date: {
      $gte: fromDate,
      $lte: toDate,
    },
  }).lean();

  const nonTripPayments = payments.map((payment) => {
    const { amount, date, _id } = payment;
    return {
      credit: amount,
      date: moment(date).format("YYYY-MM-DD"),
      _id,
      revenueType: "Non Trip",
    };
  });
  return nonTripPayments;
};
const getAllProfitAndLoss = async (req, res) => {
  try {
    const { organisationId, fromDate, toDate } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    if (!fromDate || !toDate) {
      return res.status(400).send({ error: "fromDate and toDate is required" });
    }

    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCHours(23, 59, 59, 999);
    const excludeStatusAdvancePayments = ["Cancelled"];

    const undeliveredActiveTrips = await TripModel.find(
      {
        organisationId,
        status: { $nin: excludeStatusAdvancePayments },
        pickupDate: {
          $gte: from,
          $lte: to,
        },
      },
      {
        amount: 1,
        requestId: 1,
        waybillNumber: 1,
        vendorId: 1,
        customerId: 1,
        pickupDate: 1,
      }
    ).lean();

    const advanceRevenueTrips = await Promise.all(
      undeliveredActiveTrips.map((trip) =>
        resolveTripIncome(trip, "advanceRevenue")
      )
    );

    const deliveredActiveTrips = await TripModel.find(
      {
        organisationId,
        status: "Delivered",
        dropOffDate: {
          $gte: from,
          $lte: to,
        },
      },
      {
        amount: 1,
        requestId: 1,
        waybillNumber: 1,
        vendorId: 1,
        customerId: 1,
        dropOffDate: 1,
      }
    ).lean();

    const balanceRevenueTrips = await Promise.all(
      deliveredActiveTrips.map((trip) =>
        resolveTripIncome(trip, "balanceRevenue")
      )
    );

    to.setUTCHours(23, 59, 59, 999);
    const expenses = await ExpensesModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
      },
      { amount: 1, date: 1, expensesId: 1, expenseType: 1 }
    ).lean();

    const resolvedExpenses = await Promise.all(
      expenses.map((expense) => resolveExpense(expense))
    );
    const nonTripPayments = await getNonTripPayments(organisationId, from, to);

    const allValues = [
      ...advanceRevenueTrips,
      ...balanceRevenueTrips,
      ...resolvedExpenses,
      ...nonTripPayments,
    ];
    const sortedValues = allValues.sort((a, b) => a.date - b.date);
    const sortedValuesWithBalance = await Promise.resolve(
      addBalanceRevenue(sortedValues)
    );

    const totalRevenue = sortedValuesWithBalance.reduce((acc, value) => {
      if (value.credit) {
        return acc + value.credit;
      }
      return acc;
    }, 0);
    const totalExpenses = sortedValuesWithBalance.reduce((acc, value) => {
      if (value.debit) {
        return acc + value.debit;
      }
      return acc;
    }, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const param = {
      totalRevenue,
      totalExpenses,
      totalProfit,
      data: sortedValuesWithBalance,
    };
    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const resolveTripProfitAndLoss = (trips, expenses) => {
  console.log("expenses", expenses);
  const tripProfitAndLoss = [];
  for (const trip of trips) {
    const { _id, waybillNumber, amount, pickupDate, requestId } = trip;
    const tripExpense = expenses.filter(
      (expense) => expense.tripId === requestId
    );
    const totalExpense = tripExpense.reduce((acc, expense) => {
      return acc + expense.amount;
    }, 0);
    const profit = amount - totalExpense;
    tripProfitAndLoss.push({
      _id,
      waybillNumber,
      pickupDate,
      amount,
      totalExpense,
      profit,
      requestId,
      totalRevenue: amount,
    });
  }
  return tripProfitAndLoss;
};
const getProfitAndLossByTrip = async (req, res) => {
  try {
    const { organisationId, fromDate, toDate } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    if (!fromDate || !toDate) {
      return res.status(400).send({ error: "fromDate and toDate is required" });
    }

    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCHours(23, 59, 59, 999);
    const excludeStatusAdvancePayments = ["Cancelled"];

    const trips = await TripModel.find(
      {
        organisationId,
        status: { $nin: excludeStatusAdvancePayments },
        pickupDate: {
          $gte: from,
          $lte: to,
        },
      },
      {
        amount: 1,
        requestId: 1,
        waybillNumber: 1,
        vendorId: 1,
        customerId: 1,
        pickupDate: 1,
      }
    ).lean();

    to.setUTCHours(23, 59, 59, 999);
    const expenses = await ExpensesModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        tripId: { $exists: true },
      },
      { amount: 1, date: 1, expensesId: 1, expenseType: 1, tripId: 1 }
    ).lean();

    const getResolvedProfitAndLoss = resolveTripProfitAndLoss(trips, expenses);
    const sortedValues = getResolvedProfitAndLoss.sort(
      (a, b) => a.pickupDate - b.pickupDate
    );

    const totalRevenue = sortedValues.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);
    const totalExpenses = sortedValues.reduce((acc, value) => {
      if (value.totalExpense) {
        return acc + value.totalExpense;
      }
      return acc;
    }, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const param = {
      totalRevenue,
      totalExpenses,
      totalProfit,
      data: sortedValues,
    };
    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  getLastUpdated,
  getAllProfitAndLoss,
  getProfitAndLossByTrip,
};
