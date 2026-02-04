const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");

module.exports.homePage = async (req, res, next) => {
  try {
    if (!req.user) {
      const [
        totalUsers,
        totalFarmers,
        totalAnimals,
        totalParavets,
        totalSalesTeam,
      ] = await Promise.all([
        User.countDocuments(),
        Farmer.countDocuments(),
        Animal.countDocuments(),
        Paravet.countDocuments(),
        SalesTeam.countDocuments(),
      ]);

      const totalAnimalImages = await Animal.countDocuments({
        $or: [
          { "photos.front.url": { $exists: true, $ne: "" } },
          { "photos.left.url": { $exists: true, $ne: "" } },
          { "photos.right.url": { $exists: true, $ne: "" } },
          { "photos.back.url": { $exists: true, $ne: "" } },
        ],
      });

      res.render("zoopito/home.ejs", {
        user: null,
        counts: {
          totalUsers,
          totalFarmers,
          totalAnimals,
          totalParavets,
          totalSalesTeam,
          totalAnimalImages,
        },
      });
    } else if (req.user && req.user.role === "ADMIN") {
      res.redirect("/admin");
    } else if (req.user && req.user.role === "SALES") {
      const user = await User.findById(req.user._id);
      const tile = "Sales Dashboard";
      const shortDescription =
        "This is Sales panel, For adding farmers, animals, vaccinations etc.";
      const farmersCount = await Farmer.countDocuments();
      const animalsCount = await Animal.countDocuments();
      // const servicesCount = await Servise.countDocuments();
      res.render("sales/index.ejs", {
        User: user,
        tile,
        shortDescription,
        farmersCount,
        animalsCount,
      });
    } else {
      const [
        totalUsers,
        totalFarmers,
        totalAnimals,
        totalParavets,
        totalSalesTeam,
      ] = await Promise.all([
        User.countDocuments(),
        Farmer.countDocuments(),
        Animal.countDocuments(),
        Paravet.countDocuments(),
        SalesTeam.countDocuments(),
      ]);

      const totalAnimalImages = await Animal.countDocuments({
        $or: [
          { "photos.front.url": { $exists: true, $ne: "" } },
          { "photos.left.url": { $exists: true, $ne: "" } },
          { "photos.right.url": { $exists: true, $ne: "" } },
          { "photos.back.url": { $exists: true, $ne: "" } },
        ],
      });

      res.render("zoopito/home.ejs", {
        user: null,
        counts: {
          totalUsers,
          totalFarmers,
          totalAnimals,
          totalParavets,
          totalSalesTeam,
          totalAnimalImages,
        },
      });
    }
  } catch (error) {
    console.log(error);
    req.flash("error", "Something went wrong!");
    res.redirect("/login");
  }
};

// module.exports.index = async (req, res) => {
//   try {
//     if (req.user && req.user.role === "ADMIN") {
//       const user = await User.findById(req.user._id);
//       const notifications = user.notifications || [];
//       const notificationCount = notifications.length;
//       const tile = "Admin Dashboard";
//       const shortDescription =
//         "This is admin panel admin can control everything from here sales team, farmers, animals, vaccinations etc.";
//       const farmersCount = await Farmer.countDocuments();
//       const animalsCount = await Animal.countDocuments();
//       const paravetsCount = await Paravet.countDocuments();
//       // const servicesCount = await Servise.countDocuments();
//       const salesTeamsCount = await SalesTeam.countDocuments();
//       res.render("admin/index.ejs", {
//         User: user,
//         tile,
//         shortDescription,
//         farmersCount,
//         animalsCount,
//         paravetsCount,
//         salesTeamsCount,
//       });
//     } else if (req.user && req.user.role === "SALES") {
//       const user = await User.findById(req.user._id);
//       const tile = "Sales Dashboard";
//       const shortDescription =
//         "This is Sales panel, For adding farmers, animals, vaccinations etc.";
//       const farmersCount = await Farmer.countDocuments();
//       const animalsCount = await Animal.countDocuments();
//       // const servicesCount = await Servise.countDocuments();
//       res.render("sales/index.ejs", {
//         User: user,
//         tile,
//         shortDescription,
//         farmersCount,
//         animalsCount,
//       });
//     } else {
//       res.render("zoopito/home.ejs");
//     }
//   } catch (error) {
//     console.log(error);
//     req.flash("error", "Something went wrong!");
//     res.redirect("/login");
//   }
// };

module.exports.profile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const links = await Link.find({ user: req.user._id });

    const totalLinks = links.length;
    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);

    res.render("users/profile.ejs", {
      User: user,
      totalLinks,
      totalClicks,
      links,
    });
  } catch (err) {
    req.flash("error", "Unable to load profile");
    res.redirect("/");
  }
};

module.exports.dashBoard = (req, res) => {
  res.render("TinyLink/healthz.ejs");
};

module.exports.about = (req, res) => {
  res.render("others/about.ejs");
};
module.exports.privacy = (req, res) => {
  res.render("others/privacy.ejs");
};
module.exports.terms = (req, res) => {
  res.render("others/terms.ejs");
};
module.exports.contact = (req, res) => {
  res.render("others/contact.ejs");
};

module.exports.services = async (req, res) => {
  res.render("zoopito/services.ejs");
};
