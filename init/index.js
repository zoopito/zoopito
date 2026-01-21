const mongoose = require("mongoose");
const User = require("../models/user.js");

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
    const user = await User.updateOne({ role: "ADMIN" });
    console.log("Admin user check complete", user);
  } catch {
    console.log("Error in checking admin user");
  }
};

initDB();
