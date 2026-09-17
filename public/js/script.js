// Counter Animation
const counters = document.querySelectorAll(".counter");
counters.forEach((counter) => {
  const updateCount = () => {
    const target = +counter.getAttribute("data-target");
    const count = +counter.innerText;
    const speed = 50;

    if (count < target) {
      counter.innerText = Math.ceil(count + target / speed);
      setTimeout(updateCount, 30);
    } else {
      counter.innerText = target;
    }
  };
  updateCount();
});

// Feature Card Hover Effect
const cards = document.querySelectorAll(".feature-card");

cards.forEach((card) => {
  card.addEventListener("mouseover", () => {
    card.classList.add("bg-green-600", "text-white", "scale-105");
  });

  card.addEventListener("mouseout", () => {
    card.classList.remove("bg-green-600", "text-white", "scale-105");
  });
});

// Theme state and event handlers are owned by the shared navbar.
// Keeping one implementation avoids conflicting storage keys and listeners.

// ------------------------------
// MOBILE MENU
// ------------------------------
const mobileMenuBtn = document.getElementById("mobile-menu-button");
const mobileMenu = document.getElementById("mobile-menu");
const mobileMenuClose = document.getElementById("mobile-menu-close");

// Open mobile menu
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    mobileMenu.classList.remove("translate-x-full");
  });
}

// Close mobile menu
if (mobileMenuClose) {
  mobileMenuClose.addEventListener("click", () => {
    mobileMenu.classList.add("translate-x-full");
  });
}

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  if (
    mobileMenu &&
    mobileMenuBtn &&
    !mobileMenu.contains(e.target) &&
    !mobileMenuBtn.contains(e.target)
  ) {
    mobileMenu.classList.add("translate-x-full");
  }
});
