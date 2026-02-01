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
    // 🔥 DROP OLD UNIQUE INDEX
    await User.collection.dropIndex("mobile_1");
    console.log("mobile_1 index dropped successfully");

    const users = await User.find();
    console.log("Admin user check complete", users.length);
  } catch (err) {
    console.log("Error in checking admin user or dropping index:", err.message);
  } finally {
    mongoose.connection.close();
  }
};

initDB();
