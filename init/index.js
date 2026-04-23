const mongoose = require("mongoose");
const User = require("../models/user.js");
const Farmer = require("../models/farmer.js");
const Vaccine = require("../models/vaccine.js");
const Vaccination = require("../models/vaccination.js");
const Animal = require("../models/animal.js");
const Paravet = require("../models/paravet.js");
const Payment = require("../models/payment.js");


const MONGO_URL = "mongodb://127.0.0.1:27017/zoopito";

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  try {
    // 🔥 DROP OLD UNIQUE INDEX
    await Animal.findAndDeleteMany({});
    await Farmer.findAndDeleteMany({});
    await Vaccine.findAndDeleteMany({});
    await Vaccination.findAndDeleteMany({});
    await Paravet.findAndDeleteMany({});
    await Payment.findAndDeleteMany({});
  } catch (err) {
    console.log(err);
  }
  };

  console.log(user);
};

initDB();
