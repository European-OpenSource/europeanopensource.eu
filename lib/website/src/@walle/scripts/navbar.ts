function initNavbar() {
  const hamburger = document.getElementById("mobile-menu-toggle");
  const navId = hamburger?.getAttribute("aria-controls");
  const navContainer = document.getElementById(navId || "");

  if (!hamburger || !navContainer) return;

  const closeAllMenus = () => {
    hamburger.classList.remove("active");
    hamburger.setAttribute("aria-expanded", "false");
    navContainer.classList.remove("show");
    document.body.classList.remove("menu-open");
    document
      .querySelectorAll(".nav-item.active")
      .forEach((item) => item.classList.remove("active"));
  };

  const openMenu = () => {
    hamburger.classList.add("active");
    hamburger.setAttribute("aria-expanded", "true");
    navContainer.classList.add("show");
    document.body.classList.add("menu-open");
  };

  hamburger.addEventListener("click", () => {
    hamburger.getAttribute("aria-expanded") === "true" ? closeAllMenus() : openMenu();
  });

  document.querySelectorAll(".dropdown-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const navItem = trigger.closest(".nav-item");
      const isActive = navItem?.classList.contains("active");

      navItem?.parentElement?.querySelectorAll(".nav-item.active").forEach((item) => {
        if (item !== navItem) item.classList.remove("active");
      });

      navItem?.classList.toggle("active", !isActive);
    });
  });

  navContainer.querySelectorAll("a:not(.dropdown-trigger)").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) closeAllMenus();
    });
  });

  document.addEventListener("click", (event) => {
    const isMenuOpen = hamburger.classList.contains("active");
    const target = event.target as Node;
    const clickedOutside =
      isMenuOpen && !navContainer.contains(target) && !hamburger.contains(target);
    if (clickedOutside) closeAllMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && hamburger.classList.contains("active")) {
      closeAllMenus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && hamburger.classList.contains("active")) {
      closeAllMenus();
    }
  });

  const header = document.querySelector(".site-header");
  const handleScroll = () => {
    header?.classList.toggle("scrolled", window.scrollY > 20);
  };
  handleScroll();
  window.addEventListener("scroll", handleScroll, { passive: true });
}

document.addEventListener("DOMContentLoaded", initNavbar);
document.addEventListener("astro:page-load", initNavbar);
