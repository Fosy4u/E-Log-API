const mongoose = require("mongoose");
const TripModel = require("../models/trip");
const ExpensesModel = require("../models/expenses");
const PaymentModel = require("../models/payment");
const VendorAgentModel = require("../models/vendorAgent");
const TruckModel = require("../models/truck");
const CustomerModel = require("../models/customer");
const TyreModel = require("../models/tyre");
const OrganisationUserModel = require("../models/organisationUsers");
const moment = require("moment");

const getLastUpdated = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    const lastUpdatedTrip = await TripModel.findOne({
      organisationId,
      disabled: false,
    }).sort({
      updatedAt: -1,
    });
    const lastUpdatedExpenses = await ExpensesModel.findOne({
      organisationId,
      disabled: false,
    }).sort({
      updatedAt: -1,
    });
    const lastUpdatedPayment = await PaymentModel.findOne({
      organisationId,
      disabled: false,
    }).sort({
      updatedAt: -1,
    });
    const laseUpdatedExpensesForVehicle = await ExpensesModel.findOne({
      vehicleId: { $nin: [null, ""] },
      organisationId,
      disabled: false,
    }).sort({ updatedAt: -1 });
    const laseUpdatedExpensesForTrip = await ExpensesModel.findOne({
      tripId: { $nin: [null, ""] },
      disabled: false,
      organisationId,
    }).sort({ updatedAt: -1 });
    const laseUpdatedExpensesForNonTrip = await ExpensesModel.findOne({
      tripId: { $nin: [null, ""] },
      disabled: false,
      organisationId,
    }).sort({ updatedAt: -1 });
    const laseUpdatedPaymentForNonTrip = await PaymentModel.findOne({
      "requestIds.requestId": { $exists: false },
      disabled: false,
      organisationId,
    }).sort({ updatedAt: -1 });
    const lastInvoicedPayment = await PaymentModel.findOne({
      invoiceId: { $exists: true },
      disabled: false,
      organisationId,
    }).sort({ updatedAt: -1 });
    const LastNonInvoicedPayment = await PaymentModel.findOne({
      invoiceId: { $nin: [null, ""] },
      organisationId,
      disabled: false,
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
    disabled: false,
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
        disabled: false,
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
        disabled: false,
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
        disabled: false,
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
    const sortedValues = allValues.sort(
      (a, b) => new Date(a.pickupDate) - new Date(b.pickupDate)
    );

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
const resolveTripProfitAndLoss = async (trips, expenses) => {
  const tripProfitAndLoss = [];
  for (const trip of trips) {
    const {
      _id,
      waybillNumber,
      amount,
      pickupDate,
      requestId,
      status,
      maxLoad,
      vehicleId,
      createdAt,
    } = trip;
    const tripExpense = expenses.filter(
      (expense) => expense.tripId === requestId
    );
    const totalExpense = tripExpense.reduce((acc, expense) => {
      return acc + expense.amount;
    }, 0);
    const profit = amount - totalExpense;
    let vehicle;
    if (vehicleId) {
      vehicle = await TruckModel.findById(vehicleId);
    }
    tripProfitAndLoss.push({
      _id,
      waybillNumber,
      pickupDate,
      amount,
      totalExpense,
      profit,
      requestId,
      totalRevenue: amount,
      status,
      maxLoad,
      ...(vehicle && { vehicle: vehicle.regNo }),
      ...trip,
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
        disabled: false,
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
        maxLoad: 1,
        status: 1,
      }
    ).lean();

    to.setUTCHours(23, 59, 59, 999);

    const expenses = await ExpensesModel.find(
      {
        organisationId,
        disabled: false,
        tripId: { $nin: [null, ""] },
      },
      { amount: 1, date: 1, expensesId: 1, expenseType: 1, tripId: 1 }
    ).lean();

    const getResolvedProfitAndLoss = await Promise.resolve(
      resolveTripProfitAndLoss(trips, expenses)
    );
    const sortedValues = getResolvedProfitAndLoss.sort(
      (a, b) => new Date(a.pickupDate) - new Date(b.pickupDate)
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

    const totalMaxLoad = sortedValues.reduce((acc, value) => {
      if (value.maxLoad) {
        return acc + Number(value.maxLoad);
      }
      return acc;
    }, 0);
    const totalDelivered = sortedValues.reduce((acc, value) => {
      if (value.status === "Delivered") {
        return acc + 1;
      }
      return acc;
    }, 0);

    const param = {
      totalRevenue,
      totalExpenses,
      totalProfit,
      data: sortedValues,
      totalMaxLoad,

      totalDelivered,
    };
    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getMostRecentProfitAndLossByTrip = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }

    const excludeStatusAdvancePayments = ["Cancelled"];

    const trips = await TripModel.find(
      {
        organisationId,
        status: { $nin: excludeStatusAdvancePayments },
        disabled: false,
      },
      {
        amount: 1,
        requestId: 1,
        waybillNumber: 1,
        vendorId: 1,
        customerId: 1,
        pickupDate: 1,
        createdAt: 1,
        maxLoad: 1,
        status: 1,
        vehicleId: 1,
        logs: 1,
      }
    )
      .lean()
      .sort({ createdAt: -1 })
      .limit(5);

    const expenses = await ExpensesModel.find(
      {
        organisationId,
        disabled: false,
        tripId: { $nin: [null, ""] },
      },
      { amount: 1, date: 1, expensesId: 1, expenseType: 1, tripId: 1 }
    ).lean();

    const getResolvedProfitAndLoss = await Promise.resolve(
      resolveTripProfitAndLoss(trips, expenses)
    );
    const sortedValues = getResolvedProfitAndLoss.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
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

    const totalMaxLoad = sortedValues.reduce((acc, value) => {
      if (value.maxLoad) {
        return acc + Number(value.maxLoad);
      }
      return acc;
    }, 0);
    const totalDelivered = sortedValues.reduce((acc, value) => {
      if (value.status === "Delivered") {
        return acc + 1;
      }
      return acc;
    }, 0);

    const param = {
      totalRevenue,
      totalExpenses,
      totalProfit,
      data: sortedValues,
      totalMaxLoad,

      totalDelivered,
    };
    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const resolveProfitAndLossByVehicle = (vehicles, trips, expenses) => {
  const profitAndLossByVehicle = [];
  for (const vehicle of vehicles) {
    const { _id, regNo, colorTag } = vehicle;
    const vehicleTrips = trips.filter(
      (trip) => trip.vehicleId === _id?.toString()
    );

    const vehicleExpenses = expenses.filter(
      (expense) => expense.vehicleId === _id?.toString()
    );

    const totalVehicleRevenue = vehicleTrips.reduce((acc, trip) => {
      return acc + trip.amount;
    }, 0);
    const totalVehicleExpense = vehicleExpenses.reduce((acc, expense) => {
      return acc + expense.amount;
    }, 0);
    const totalProfit = totalVehicleRevenue - totalVehicleExpense;
    profitAndLossByVehicle.push({
      _id,
      regNo,
      totalVehicleRevenue,
      totalVehicleExpense,
      totalProfit,
      colorTag,
    });
  }
  return profitAndLossByVehicle;
};
const getProfitAndLossByVehicle = async (req, res) => {
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
        disabled: false,
        pickupDate: {
          $gte: from,
          $lte: to,
        },
        vehicleId: { $exists: true },
        disabled: false,
      },
      {
        amount: 1,
        requestId: 1,
        waybillNumber: 1,
        vendorId: 1,
        customerId: 1,
        pickupDate: 1,
        vehicleId: 1,
      }
    ).lean();

    const tripsVehicleIds = trips.map((trip) => trip.vehicleId);
    const vehicles = await TruckModel.find(
      {
        _id: { $in: tripsVehicleIds },
        organisationId,
        disabled: false,
      },
      { regNo: 1, _id: 1, colorTag: 1 }
    ).lean();
    const vehiclesIds = vehicles.map((vehicle) => vehicle._id);
    to.setUTCHours(23, 59, 59, 999);
    const expenses = await ExpensesModel.find(
      {
        organisationId,
        disabled: false,
        vehicleId: { $in: vehiclesIds },
        date: {
          $gte: from,
          $lte: to,
        },
      },
      {
        amount: 1,
        date: 1,
        expensesId: 1,
        expenseType: 1,
        tripId: 1,
        vehicleId: 1,
      }
    ).lean();

    const getResolvedProfitAndLoss = resolveProfitAndLossByVehicle(
      vehicles,
      trips,
      expenses
    );

    const sortedValues = getResolvedProfitAndLoss.sort(
      (a, b) => a.regNo - b.regNo
    );

    const totalRevenue = sortedValues.reduce((acc, value) => {
      if (value.totalVehicleRevenue) {
        return acc + value.totalVehicleRevenue;
      }
      return acc;
    }, 0);
    const totalExpenses = sortedValues.reduce((acc, value) => {
      if (value.totalVehicleExpense) {
        return acc + value.totalVehicleExpense;
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
const analySeFuel = (trips) => {
  const fuel = {};
  let averageEstimatedFuelLitres = 0;
  let averageEstimatedFuelCost = 0;
  let actualFuelLitres = 0;
  let actualFuelCost = 0;

  trips
    .filter((trip) => trip.status === "Delivered")
    .forEach((trip) => {
      if (trip.estimatedFuelLitres) {
        averageEstimatedFuelLitres += trip.estimatedFuelLitres;
      }
      if (trip.estimatedFuelCost) {
        averageEstimatedFuelCost += trip.estimatedFuelCost;
      }
      if (trip.actualFuelLitres) {
        actualFuelLitres += trip.actualFuelLitres;
      }
      if (trip.actualFuelCost) {
        actualFuelCost += trip.actualFuelCost;
      }
    });
  const sumFuelLitres = averageEstimatedFuelLitres + actualFuelLitres;
  const sumFuelCost = averageEstimatedFuelCost + actualFuelCost;
  fuel.averageEstimatedFuelLitres = {
    value: averageEstimatedFuelLitres,
    percentage: (averageEstimatedFuelLitres / sumFuelLitres) * 100,
  };
  fuel.averageEstimatedFuelCost = {
    value: averageEstimatedFuelCost,
    percentage: (averageEstimatedFuelCost / sumFuelCost) * 100,
  };
  fuel.averageActualFuelLitres = {
    value: actualFuelLitres,
    percentage: (actualFuelLitres / sumFuelLitres) * 100,
  };
  fuel.averageActualFuelCost = {
    value: actualFuelCost,
    percentage: (actualFuelCost / sumFuelCost) * 100,
  };
  return fuel;
};
const getAnalyticsByVehicleID = async (req, res) => {
  try {
    const { organisationId, fromDate, toDate, _id } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    if (!fromDate || !toDate) {
      return res.status(400).send({ error: "fromDate and toDate is required" });
    }
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }

    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCHours(23, 59, 59, 999);
    const excludeStatusAdvancePayments = ["Cancelled"];

    const vehicle = await TruckModel.findOne({
      _id,
      organisationId,
      disabled: false,
    }).lean();
    if (!vehicle) {
      return res.status(400).send({ error: "vehicle not found" });
    }
    //get Tyres and group by tyre status and count
    const tyres = await TyreModel.aggregate([
      {
        $match: {
          organisationId,
          vehicleId: _id,
          disabled: false,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const trips = await TripModel.find(
      {
        organisationId,
        status: { $nin: excludeStatusAdvancePayments },
        disabled: false,
        pickupDate: {
          $gte: from,
          $lte: to,
        },
        vehicleId: _id,
        disabled: false,
      },
      {
        amount: 1,
        requestId: 1,
        waybillNumber: 1,
        vendorId: 1,
        customerId: 1,
        pickupDate: 1,
        vehicleId: 1,
        userId: 1,
        status: 1,
        estimatedFuelLitres: 1,
        estimatedFuelCost: 1,
        actualFuelLitres: 1,
        actualFuelCost: 1,
        estimatedDropOffDate: 1,
        dropOffDate: 1,
      }
    ).lean();

    to.setUTCHours(23, 59, 59, 999);
    const expenses = await ExpensesModel.find(
      {
        organisationId,
        disabled: false,
        vehicleId: _id,
        date: {
          $gte: from,
          $lte: to,
        },
      },
      {
        amount: 1,
        date: 1,
        expensesId: 1,
        expenseType: 1,
        tripId: 1,
        vehicleId: 1,
        userId: 1,
      }
    ).lean();

    const vehicles = [vehicle];
    const getResolvedProfitAndLoss = resolveProfitAndLossByVehicle(
      vehicles,
      trips,
      expenses
    );

    const totalRevenue = getResolvedProfitAndLoss.reduce((acc, value) => {
      if (value.totalVehicleRevenue) {
        return acc + value.totalVehicleRevenue;
      }
      return acc;
    }, 0);
    const totalExpenses = getResolvedProfitAndLoss.reduce((acc, value) => {
      if (value.totalVehicleExpense) {
        return acc + value.totalVehicleExpense;
      }
      return acc;
    }, 0);
    const totalProfit = totalRevenue - totalExpenses;
    //rank expenses by expense type in percentage
    const vehicleExpensesByType = [];
    expenses.reduce((acc, value) => {
      if (value.expenseType) {
        const index = acc.findIndex(
          (item) => item.expenseType === value.expenseType
        );
        if (index > -1) {
          acc[index].amount += value.amount;
          acc[index].percentage = (acc[index].amount / totalExpenses) * 100;
        } else {
          acc.push({
            expenseType: value.expenseType,
            amount: value.amount,
            percentage: (value.amount / totalExpenses) * 100,
          });
        }
      }
      return acc;
    }, vehicleExpensesByType);
    const combined = [...trips, ...expenses];
    await Promise.all(
      combined.map(async (item) => {
        if (item.userId) {
          const user = await OrganisationUserModel.findOne(
            {
              _id: item.userId,
            },
            {
              firstName: 1,
              lastName: 1,
              email: 1,
              phone: 1,
              imageUrl: 1,
            }
          ).lean();
          item.user = user;
        }
      })
    );

    const data = combined.reduce((acc, value) => {
      const { pickupDate, date, amount, expensesId, requestId } = value;
      if (requestId) {
        acc.push({
          date: pickupDate,
          credit: amount,
          ...value,
        });
      }
      if (expensesId) {
        acc.push({
          date: date,
          debit: amount,
          ...value,
        });
      }
      return acc;
    }, []);
    const fuel = analySeFuel(trips);

    const param = {
      totalRevenue,
      totalExpenses,
      totalProfit,
      vehicle,
      data: data.sort((a, b) => a.date - b.date),
      tripCount: trips.length,
      vehicleExpensesByType,
      tyres,
      fuel,
    };
    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getAllPayments = async (req, res) => {
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

    const payments = await PaymentModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        disabled: false,
      },
      { amount: 1, date: 1, paymentId: 1, invoiceId: 1 }
    ).lean();

    const sortedValues = payments.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalPayments = sortedValues.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);
    const param = {
      totalPayments,
      data: sortedValues,
    };

    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getPaymentsByTrip = async (req, res) => {
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

    const payments = await PaymentModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        disabled: false,
        "requestIds.requestId": { $exists: true, $ne: null },
      },
      { amount: 1, date: 1, paymentId: 1, invoiceId: 1, requestIds: 1 }
    ).lean();
    const creditsAdded = [];
    const addCredit = payments.forEach((payment) => {
      const credit = payment.amount || 0;
      creditsAdded.push({
        ...payment,
        credit,
      });
    });

    const sortedValues = creditsAdded.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalPayments = sortedValues.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);
    const param = {
      totalPayments,
      data: sortedValues,
    };

    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getTopTripProviders = async (req, res) => {
  try {
    const { organisationId, fromDate, toDate } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "organisationId is required" });
    }
    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCHours(23, 59, 59, 999);
    const fetchParams = {
      organisationId,
      disabled: false,
      ...(fromDate &&
        toDate && {
          pickupDate: {
            $gte: from,
            $lte: to,
          },
        }),
    };
    const trips = await TripModel.find(
      { ...fetchParams },
      { vendorId: 1, amount: 1, customerId: 1 }
    ).lean();
    const tripArr = [];
    const totalAmount = trips.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);
    await Promise.all(
      trips.map(async (trip) => {
        let requester;
        if (trip?.vendorId) {
          const vendor = await VendorAgentModel.findById(trip.vendorId);
          requester = getName(vendor);
        } else if (trip?.customerId) {
          const customer = await CustomerModel.findById(trip.customerId);
          requester = getName(customer);
        }
        trip.requester = requester;
        const found = tripArr.find((item) => item.requester === requester);
        if (found) {
          found.amount += trip.amount;
          found.count += 1;
          found.amountPercentage = (found.amount / totalAmount) * 100;
        } else {
          tripArr.push({
            requester,
            amount: trip.amount,
            count: 1,
            amountPercentage: (trip.amount / totalAmount) * 100,
          });
        }
      })
    );
    const sortedValues = tripArr.sort((a, b) => b.amount - a.amount);
    const param = {
      totalAmount,
      data: sortedValues,
    };
    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const addTripRequestersToPayments = async (payments, organisationId) => {
  const requstIds = payments.reduce((acc, value) => {
    if (value.requestIds) {
      const requestIds = value.requestIds.map((item) => item.requestId);
      return [...acc, ...requestIds];
    }
    return acc;
  }, []);
  const trips = await TripModel.find(
    {
      organisationId,
      requestId: { $in: requstIds },
    },
    { requestId: 1, vendorId: 1, customerId: 1 }
  ).lean();

  const vendorIds = trips.map((trip) => (trip.vendorId ? trip.vendorId : null));
  const customerIds = trips.map((trip) =>
    trip.customerId ? trip.customerId : null
  );
  const vendors = await VendorAgentModel.find(
    {
      _id: { $in: vendorIds },
    },
    {
      firstName: 1,
      lastName: 1,
      companyName: 1,
      colorTag: 1,
    }
  ).lean();
  const customers = await CustomerModel.find(
    {
      _id: { $in: customerIds },
    },

    {
      firstName: 1,
      lastName: 1,
      companyName: 1,
      colorTag: 1,
    }
  ).lean();
  const newTrips = [];
  for (const trip of trips) {
    const { vendorId, customerId } = trip;
    let requester;
    let colorTag;
    if (vendorId) {
      const vendor = vendors.find(
        (vendor) => vendor._id.toString() === vendorId.toString()
      );
      requester = getName(vendor);
      colorTag = vendor.colorTag;
    } else {
      const customer = customers.find(
        (customer) => customer._id.toString() === customerId.toString()
      );
      requester = getName(customer);
      colorTag = customer.colorTag;
    }
    newTrips.push({ ...trip, requester, colorTag });
  }

  const newPayments = [];
  for (const payment of payments) {
    const { requestIds } = payment;
    const newRequestIds = [];
    for (const requestId of requestIds) {
      const trip = newTrips.find(
        (trip) => trip.requestId.toString() === requestId.requestId.toString()
      );
      newRequestIds.push({
        ...requestId,
        requester: trip.requester,
        colorTag: trip.colorTag,
      });
    }
    newPayments.push({ ...payment, requestIds: newRequestIds });
  }
  return newPayments;
};
const getPaymentsByRequesters = async (req, res) => {
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

    const payments = await PaymentModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        disabled: false,
        "requestIds.requestId": { $exists: true, $ne: null },
      },
      { amount: 1, date: 1, paymentId: 1, invoiceId: 1, requestIds: 1 }
    ).lean();

    const sortedValues = payments.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalPayments = sortedValues.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);

    const addRequestersToPayments = await Promise.resolve(
      addTripRequestersToPayments(sortedValues, organisationId)
    );

    const requestIds = addRequestersToPayments.reduce((acc, value) => {
      const { requestIds } = value;

      if (requestIds) {
        return [...acc, ...requestIds];
      }
      return acc;
    }, []);

    const data = [];
    for (const requestId of requestIds) {
      const { amount, requester, colorTag } = requestId;

      const payment = data.find((item) => item.from === requester);
      if (payment) {
        payment.amount += amount;
      } else {
        data.push({
          from: requester,
          amount,
          colorTag,
          shortFrom: requester
            .match(/\b(\w)/g)
            .join("")
            .toUpperCase(),
        });
      }
    }
    const param = {
      totalPayments,
      data,
    };

    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getPaymentsByNonTrip = async (req, res) => {
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

    const payments = await PaymentModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        disabled: false,
        "requestIds.requestId": { $exists: false },
      },
      { amount: 1, date: 1, paymentId: 1, invoiceId: 1, requestIds: 1 }
    ).lean();
    const creditsAdded = [];
    const addCredit = payments.forEach((payment) => {
      const credit = payment.amount || 0;
      creditsAdded.push({
        ...payment,
        credit,
      });
    });

    const sortedValues = creditsAdded.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalPayments = sortedValues.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);
    const param = {
      totalPayments,
      data: sortedValues,
    };

    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getAllExpenses = async (req, res) => {
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

    const expenses = await ExpensesModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        disabled: false,
      },
      { amount: 1, date: 1, expensesId: 1, expenseType: 1 }
    ).lean();

    const sortedValues = expenses.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalExpenses = sortedValues.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);
    const param = {
      totalExpenses,
      data: sortedValues,
    };

    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getNonTripExpenses = async (req, res) => {
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

    const expenses = await ExpensesModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        disabled: false,
        tripId: { $in: [null, ""] },
      },
      { amount: 1, date: 1, expensesId: 1, expenseType: 1 }
    ).lean();

    const sortedValues = expenses.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalExpenses = sortedValues.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);
    const param = {
      totalExpenses,
      data: sortedValues,
    };

    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const resoleTripsAndExpenses = (trips, expenses) => {
  const expensesList = [];
  for (let i = 0; i < trips.length; i++) {
    const { _id, requestId, waybillNumber, pickupDate } = trips[i];
    const tripExpenses = expenses.filter(
      (expense) => expense.tripId === requestId
    );
    const totalTripExpenses = tripExpenses.reduce((acc, value) => {
      if (value.amount) {
        return acc + Number(value.amount);
      }
      return acc;
    }, 0);

    expensesList.push({
      _id,
      requestId,
      waybillNumber,
      date: pickupDate,
      totalTripExpenses,
    });
  }
  return expensesList;
};
const resoleVehiclesAndExpenses = (vehicles, expenses) => {
  const expensesList = [];
  for (let i = 0; i < vehicles.length; i++) {
    const { _id, regNo, colorTag } = vehicles[i];
    const vehicleExpenses = expenses.filter(
      (expense) => expense.vehicleId === _id.toString()
    );
    const totalVehicleExpenses = vehicleExpenses.reduce((acc, value) => {
      if (value.amount) {
        return acc + value.amount;
      }
      return acc;
    }, 0);

    expensesList.push({
      _id,
      regNo,
      colorTag,
      totalVehicleExpenses,
    });
  }
  return expensesList;
};
const getAllExpensesByTrip = async (req, res) => {
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

    const expenses = await ExpensesModel.find(
      {
        organisationId,
        disabled: false,
        tripId: { $nin: [null, ""] },
      },
      { amount: 1, tripId: 1 }
    ).lean();

    const tripIds = expenses.map((expense) => expense.tripId);
    const trips = await TripModel.find(
      {
        requestId: { $in: tripIds },
        organisationId,
        disabled: false,
        pickupDate: {
          $gte: from,
          $lte: to,
        },
      },
      { requestId: 1, waybillNumber: 1, pickupDate: 1 }
    ).lean();

    const mergedTripsAndExpenses = resoleTripsAndExpenses(trips, expenses);

    const sortedValues = mergedTripsAndExpenses.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const totalExpenses = sortedValues.reduce((acc, value) => {
      if (value.totalTripExpenses) {
        return acc + value.totalTripExpenses;
      }
      return acc;
    }, 0);
    const param = {
      totalExpenses,
      data: sortedValues,
    };

    res.status(200).send({ data: param });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getAllExpensesByVehicle = async (req, res) => {
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

    const expenses = await ExpensesModel.find(
      {
        organisationId,
        date: {
          $gte: from,
          $lte: to,
        },
        disabled: false,
        vehicleId: { $nin: [null, ""] },
      },
      { amount: 1, vehicleId: 1 }
    ).lean();

    const vehicleIds = expenses.map((expense) => expense.vehicleId);
    const vehicles = await TruckModel.find(
      { _id: { $in: vehicleIds }, organisationId, disabled: false },
      { regNo: 1, colorTag: 1 }
    ).lean();
    const mergedVehicleAndExpenses = resoleVehiclesAndExpenses(
      vehicles,
      expenses
    );

    const sortedValues = mergedVehicleAndExpenses.sort(
      (a, b) => a.regNo - b.regNo
    );

    const totalExpenses = sortedValues.reduce((acc, value) => {
      if (value.totalVehicleExpenses) {
        return acc + value.totalVehicleExpenses;
      }
      return acc;
    }, 0);
    const param = {
      totalExpenses,
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
  getProfitAndLossByVehicle,
  getAllExpenses,
  getAllExpensesByTrip,
  getAllExpensesByVehicle,
  getNonTripExpenses,
  getAllPayments,
  getPaymentsByTrip,
  getPaymentsByNonTrip,
  getPaymentsByRequesters,
  getMostRecentProfitAndLossByTrip,
  getTopTripProviders,
  getAnalyticsByVehicleID,
};
