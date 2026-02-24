if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const crypto = require("crypto");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { welComeEmail } = require("./utils/sendWelcomeEmail");

const homeRouter = require("./routes/home.js");
const userRouter = require("./routes/user.js");
const resetRout = require("./routes/authRoutes.js");
const user = require("./models/user.js");
const adminRouter = require("./routes/admin.js");
const othersRouter = require("./routes/others.js");
const VaccineRouter = require("./routes/vaccine.js");
const vaccinationRouter = require("./routes/Vaccination.js");
// const animalRouter = require("./routes/animal.js");
// const farmerRouter = require("./routes/farmer.js");
// const paravetRouter = require("./routes/paravet.js");
// const serviceRouter = require("./routes/service.js");

const salesteamRouter = require("./routes/salesteam.js");

const dbUrl = process.env.ATLUSDB_URL;

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
  mongoUrl: dbUrl,
  // crypto: {
  //   secret: process.env.SECRET,
  // },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("error in mongo session store", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    expire: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    //httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy({ usernameField: "email" }, User.authenticate()),
);

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.DOMAIN + "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let email = profile.emails[0].value;
        let name = profile.displayName;

        // Check existing user
        let existingUser = await User.findOne({ email });

        if (existingUser) {
          return done(null, existingUser);
        }

        const username = email.split("@")[0];

        // Create new user
        let newUser = new User({
          name,
          email,
          googleId: profile.id,
          isVerified: true,
        });

        await newUser.save();
        await newUser.save();
        await welComeEmail({
          name: newUser.name,
          email: newUser.email,
        });
        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.info = req.flash("info");
  res.locals.warning = req.flash("warning");
  res.locals.primary = req.flash("primary");
  res.locals.currUser = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.showsplash = false;
  next();
});

const VERIFY_TOKEN = "myVerifyToken123qetx3mxk";

app.get("/webhook", (req, res) => {
  console.log("Query:", req.query);

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Mode:", mode);
  console.log("Token:", token);
  console.log("Expected:", VERIFY_TOKEN);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    res.status(200).send(challenge);
  } else {
    console.log("Verification failed");
    res.sendStatus(403);
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    req.flash("success", "Logged in using Google!");
    res.redirect("/");
  },
);

app.use("/", userRouter);
app.use("/", homeRouter);
app.use("/", resetRout);
app.use("/", othersRouter);
app.use("/vaccines", VaccineRouter);
app.use("/admin", adminRouter);
app.use("/vaccination", vaccinationRouter);
// app.use("/animals", animalRouter);
// app.use("/farmers", farmerRouter);
// app.use("/paravets", paravetRouter);
// app.use("/services", serviceRouter);
app.use("/sales", salesteamRouter);

app.all(/.*/, (req, res, next) => {
  next(new ExpressError(404, "Page not found!"));
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err); // agar response already sent ho, dobara send mat karo
  }
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { message, statusCode });
});

app.listen(3000, () => {
  console.log(`Zoopito is working at ${3000}`);
});
