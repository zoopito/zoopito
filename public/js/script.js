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

// ------------------------------
// THEME TOGGLE (FINAL CLEAN VERSION)
// ------------------------------

const toggleTheme = () => {
  const html = document.documentElement;
  const isDark = html.classList.toggle("dark");
  localStorage.theme = isDark ? "dark" : "light";
  updateIcons();
};

const updateIcons = () => {
  const icon = document.getElementById("themeIcon");
  const mobileIcon = document.getElementById("mobileThemeIcon");

  if (document.documentElement.classList.contains("dark")) {
    icon?.classList.replace("fa-moon", "fa-sun");
    mobileIcon?.classList.replace("fa-moon", "fa-sun");
  } else {
    icon?.classList.replace("fa-sun", "fa-moon");
    mobileIcon?.classList.replace("fa-sun", "fa-moon");
  }
};

document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
document
  .getElementById("mobileThemeToggle")
  ?.addEventListener("click", toggleTheme);

// Mobile menu
const menu = document.getElementById("mobileMenu");
document.getElementById("mobileMenuBtn").onclick = () =>
  menu.classList.remove("translate-x-full");
document.getElementById("mobileMenuClose").onclick = () =>
  menu.classList.add("translate-x-full");

updateIcons();

// Function: Apply theme + save to localStorage + update UI
function setTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
  applyThemeUI(isDark);
}

// ------------------------------
// INITIAL LOAD THEME CHECK
// ------------------------------
const savedTheme = localStorage.getItem("theme");
const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)",
).matches;

// Saved theme → apply it
if (savedTheme === "dark") {
  setTheme(true);
} else if (savedTheme === "light") {
  setTheme(false);
} else {
  // No saved theme → follow system
  setTheme(systemPrefersDark);
}

// ------------------------------
// DESKTOP TOGGLE
// ------------------------------
themeToggle?.addEventListener("click", () => {
  const isDark = !document.documentElement.classList.contains("dark");
  setTheme(isDark);
});

// ------------------------------
// MOBILE TOGGLE
// ------------------------------
mobileThemeToggle?.addEventListener("click", () => {
  const isDark = !document.documentElement.classList.contains("dark");
  setTheme(isDark);
});

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
    !mobileMenu.contains(e.target) &&
    !mobileMenuBtn.contains(e.target)
  ) {
    mobileMenu.classList.add("translate-x-full");
  }
});

// Generate particles
function createParticles() {
  const particlesContainer = document.getElementById("particles");
  const particleCount = window.innerWidth < 768 ? 15 : 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";

    // Random properties
    const size = Math.random() * 4 + 4;
    const x = Math.random() * 100;
    const delay = Math.random() * 15;
    const duration = Math.random() * 10 + 15;

    particle.style.cssText = `
                    width: ${size}px;
                    height: ${size}px;
                    left: ${x}vw;
                    --x-offset: ${(Math.random() - 0.5) * 0.2};
                    animation-delay: ${delay}s;
                    animation-duration: ${duration}s;
                    opacity: ${Math.random() * 0.5 + 0.3};
                `;

    particlesContainer.appendChild(particle);
  }
}

// Simulate loading completion
function simulateLoading() {
  return new Promise((resolve) => {
    // Check if document is already loaded
    if (document.readyState === "complete") {
      resolve();
      return;
    }

    // Or wait for load event
    window.addEventListener("load", resolve);

    // Fallback timeout
    setTimeout(resolve, 2000);
  });
}

// Initialize splash screen
document.addEventListener("DOMContentLoaded", () => {
  createParticles();

  simulateLoading().then(() => {
    // Add a small delay for smooth transition
    setTimeout(() => {
      // Show main app content
      document.getElementById("app").style.display = "block";

      // Optional: Add class for exit animation
      document.getElementById("splash").classList.add("exiting");
    }, 500);
  });
});

// Service Worker registration for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.log("ServiceWorker registration failed: ", err));
  });
}
