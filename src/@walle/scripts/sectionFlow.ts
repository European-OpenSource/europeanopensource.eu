function initSectionFlow() {
  const steps = document.querySelectorAll(".flow-step");
  if (!steps.length) return;

  const reveal = () => {
    steps.forEach((step, i) => {
      const rect = step.getBoundingClientRect();
      if (rect.top < window.innerHeight - 80) {
        setTimeout(() => step.classList.add("visible"), i * 120);
      }
    });
  };

  reveal();
  window.addEventListener("scroll", reveal, { passive: true });
}

document.addEventListener("DOMContentLoaded", initSectionFlow);
document.addEventListener("astro:page-load", initSectionFlow);
