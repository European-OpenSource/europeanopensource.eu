if (!document.querySelector("#header-keyframes")) {
  const style = document.createElement("style");
  style.id = "header-keyframes";
  style.textContent = `
    @keyframes textReveal {
      0% { opacity: 0; transform: translateY(20px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function initHeaderStandard(header: HTMLElement) {
  const imageContainer = header.querySelector<HTMLElement>(".image-container");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (imageContainer && !prefersReducedMotion) {
    imageContainer.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = imageContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 5;
      const rotateX = ((rect.height / 2 - y) / (rect.height / 2)) * 5;
      imageContainer.style.transform = `perspective(1000px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateZ(0) translateY(-5px)`;

      const spotlight = imageContainer.querySelector<HTMLElement>(".spotlight");
      if (spotlight) {
        spotlight.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0), rgba(255,255,255,0.35))`;
      }
    });

    imageContainer.addEventListener("mouseleave", () => {
      imageContainer.style.transform =
        "perspective(1000px) rotateY(0deg) rotateX(0deg) translateZ(0)";
    });
  }

  const title = header.querySelector<HTMLElement>(".header-title");
  if (title && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            title.style.animation = "textReveal 1s cubic-bezier(0.22, 1, 0.36, 1) forwards";
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(title);
  }
}

function init() {
  document.querySelectorAll<HTMLElement>("[data-walle-header]").forEach(initHeaderStandard);
}

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
