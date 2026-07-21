/**
 * TableOfContentsManager
 *
 * Manages the interactive table of contents functionality for blog posts.
 * Handles navigation, active section tracking, mobile interactions, and accessibility.
 *
 * @class TableOfContentsManager
 * @version 2.0.0
 */

export interface TocItem {
  id: string;
  text: string;
  element: HTMLElement;
}

export interface TableOfContentsOptions {
  /** CSS selector for headings to include. Default: "h2, h3" */
  headingSelector?: string;
  /** List of CSS selectors; any heading matching one will be excluded */
  excludeSelectors?: string[];
  /** Attribute name used to skip a single heading. Default: data-toc-skip */
  skipAttribute?: string;
  /** Class name used to skip a single heading. Default: toc-skip */
  skipClass?: string;
  /** Container attribute; any heading inside an ancestor with this attribute is skipped. Default: data-toc-skip-container */
  skipContainerAttribute?: string;
  /** Optional text patterns; if heading text matches any pattern it will be excluded */
  excludeTextPatterns?: RegExp[];
}

export class TableOfContentsManager {
  private tocItems: TocItem[] = [];
  private currentActiveIndex = -1;
  private articleContent: HTMLElement | null = null;
  private tocNav: HTMLElement | null = null;
  private tocContainer: HTMLElement | null = null;
  private isScrolling = false;
  private isMobile = false;
  private lastScrollTimestamp = 0;
  private options: TableOfContentsOptions;

  constructor(options: TableOfContentsOptions = {}) {
    this.articleContent = document.getElementById("article-content");
    this.tocNav = document.getElementById("toc-nav");
    this.tocContainer = document.getElementById("toc");
    this.options = {
      headingSelector: "h2, h3",
      skipAttribute: "data-toc-skip",
      skipClass: "toc-skip",
      skipContainerAttribute: "data-toc-skip-container",
      excludeSelectors: [],
      excludeTextPatterns: [],
      ...options,
    };
    this.updateDeviceType();
  }

  /**
   * Initialize the table of contents
   */
  public init(): void {
    this.generateTOC();
    this.initNavigationHandlers();
    this.updateActiveTOC();
    this.bindEvents();
  }

  /**
   * Update device type (mobile vs desktop)
   */
  private updateDeviceType(): void {
    this.isMobile = window.innerWidth <= 1024;
  }

  /**
   * Generate TOC from article headings
   */
  private generateTOC(): void {
    if (!this.articleContent || !this.tocNav || !this.tocContainer) return;
    const headings = this.articleContent.querySelectorAll(this.options.headingSelector || "h2, h3");

    if (headings.length === 0) {
      this.tocContainer.style.display = "none";
      return;
    }

    this.tocNav.classList.add("loading");
    this.tocItems = [];

    const fragment = document.createDocumentFragment();

    headings.forEach((heading, index) => {
      const headingElement = heading as HTMLElement;
      if (this.shouldExcludeHeading(headingElement)) return; // skip excluded headings without incrementing index positions in TOC
      let id = headingElement.id;

      if (!id) {
        id = this.generateHeadingId(headingElement, index);
        headingElement.id = id;
      }

      const tocItem: TocItem = {
        id,
        text: headingElement.textContent || "",
        element: headingElement,
      };

      this.tocItems.push(tocItem);
      fragment.appendChild(
        this.createTocLink(tocItem, this.tocItems.length - 1, headingElement.tagName)
      );
    });

    this.tocNav.appendChild(fragment);
    this.tocNav.classList.remove("loading");
    this.setupMobileInteraction();
  }

  /** Decide if a heading should be excluded from TOC based on options */
  private shouldExcludeHeading(el: HTMLElement): boolean {
    const {
      skipAttribute,
      skipClass,
      skipContainerAttribute,
      excludeSelectors = [],
      excludeTextPatterns = [],
    } = this.options;

    // Direct attribute/class skip
    if (skipAttribute && el.hasAttribute(skipAttribute)) return true;
    if (skipClass && el.classList.contains(skipClass)) return true;

    // Ancestor container skip
    if (skipContainerAttribute && el.closest(`[${skipContainerAttribute}]`)) return true;

    // Selector-based exclusion
    if (excludeSelectors.some((sel) => el.matches(sel))) return true;

    // Text pattern exclusion
    const text = (el.textContent || "").trim();
    if (excludeTextPatterns.some((re) => re.test(text))) return true;

    return false;
  }

  /**
   * Generate unique ID for heading
   */
  private generateHeadingId(element: HTMLElement, index: number): string {
    const text = element.textContent || "";
    const level = element.tagName.toLowerCase();
    return `${level}-${index}-${text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50)}`;
  }

  /**
   * Create TOC link element
   */
  private createTocLink(tocItem: TocItem, index: number, tagName: string): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = `#${tocItem.id}`;
    link.textContent = tocItem.text;
    link.setAttribute("data-toc-index", index.toString());
    link.setAttribute("data-level", tagName === "H2" ? "2" : "3");
    link.setAttribute("aria-label", `Navigate to: ${tocItem.text}`);
    link.setAttribute("role", "link");

    // Add indentation for h3
    if (tagName === "H3") {
      link.style.paddingLeft = "2.5rem";
      link.style.fontSize = "0.85rem";
    }

    return link;
  }

  /**
   * Setup mobile interaction (collapsible header)
   */
  private setupMobileInteraction(): void {
    if (!this.tocContainer) return;

    const tocHeader = this.tocContainer.querySelector("h3");
    if (!tocHeader) return;

    // Clean slate: remove existing listeners by replacing element
    const newHeader = tocHeader.cloneNode(true) as HTMLElement;
    tocHeader.parentNode?.replaceChild(newHeader, tocHeader);

    if (this.isMobile) {
      // Setup toggle functionality
      this.setupHeaderToggle(newHeader);

      // Auto-collapse on initial load for better mobile UX
      if (this.tocItems.length > 6 || window.innerWidth <= 768) {
        this.tocContainer.classList.add("collapsed");
      }
    }
  }

  /**
   * Setup header toggle for mobile
   */
  private setupHeaderToggle(header: HTMLElement): void {
    let touchStartY = 0;
    let touchStartX = 0;
    let isTap = true;

    const toggleCollapse = () => {
      if (!this.tocContainer) return;

      const isCollapsed = this.tocContainer.classList.contains("collapsed");
      this.tocContainer.classList.toggle("collapsed");

      // Update ARIA attribute
      header.setAttribute("aria-expanded", isCollapsed.toString());

      // Haptic feedback (if supported)
      if ("vibrate" in navigator) {
        navigator.vibrate(30);
      }

      // Announce to screen readers
      const announcement = isCollapsed
        ? "Table of contents expanded"
        : "Table of contents collapsed";
      this.announceToScreenReader(announcement);
    };

    // Track touch movement to differentiate tap from scroll
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      isTap = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX);

      // If user moved more than 10px, it's not a tap
      if (deltaY > 10 || deltaX > 10) {
        isTap = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTap) {
        e.preventDefault();
        toggleCollapse();
      }
    };

    // Touch events for mobile
    header.addEventListener("touchstart", handleTouchStart, { passive: true });
    header.addEventListener("touchmove", handleTouchMove, { passive: true });
    header.addEventListener("touchend", handleTouchEnd, { passive: false });

    // Click event for desktop (if user resizes window)
    header.addEventListener("click", (e) => {
      if (!this.isMobile) return;
      e.preventDefault();
      toggleCollapse();
    });

    // Accessibility setup
    header.style.cursor = "pointer";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "true");
    header.setAttribute("aria-controls", "toc-nav");
    header.setAttribute("aria-label", "Toggle table of contents");

    // Keyboard support
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapse();
      }
    });

    // Monitor collapse state changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const isCollapsed = this.tocContainer?.classList.contains("collapsed");
          header.setAttribute("aria-expanded", (!isCollapsed).toString());
        }
      });
    });

    if (this.tocContainer) {
      observer.observe(this.tocContainer, { attributes: true });
    }
  }

  /**
   * Initialize navigation handlers
   */
  private initNavigationHandlers(): void {
    if (!this.tocNav) return;

    // Use event delegation for better performance
    this.tocNav.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement;

        // Check if clicked element is a TOC link
        if (target.tagName === "A" && target.getAttribute("href")?.startsWith("#")) {
          e.preventDefault();
          e.stopPropagation();

          const targetId = target.getAttribute("href")?.substring(1);
          const targetElement = document.getElementById(targetId || "");

          if (targetElement) {
            // Add visual feedback
            target.classList.add("navigating");

            if (this.isMobile && this.tocContainer) {
              this.tocContainer.classList.add("collapsed");

              // Wait a tiny bit for menu animation, then scroll
              setTimeout(() => {
                this.scrollToElement(targetElement, target);
              }, 150);
            } else {
              // Desktop: just scroll
              this.scrollToElement(targetElement, target);
            }
          }
        }
      },
      { passive: false }
    );
  }

  /**
   * Scroll to element with proper timing
   */
  private scrollToElement(element: HTMLElement, link: HTMLElement): void {
    // Reset stuck scrolling flag if too much time has passed (3 seconds)
    const now = Date.now();
    if (this.isScrolling && now - this.lastScrollTimestamp > 3000) this.isScrolling = false;
    if (this.isScrolling) return;

    this.isScrolling = true;
    this.lastScrollTimestamp = now;

    // Safety timeout: reset isScrolling after max 3 seconds
    setTimeout(() => {
      if (this.isScrolling) this.isScrolling = false;
    }, 3000);
    const offset = this.getDynamicOffset();

    // Mobile: prefer native anchor behavior + offset correction
    if (this.isMobile) {
      // Use scrollIntoView first for better compatibility (Safari/iOS)
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      // After initial positioning, adjust for sticky header offset
      setTimeout(() => {
        window.scrollBy(0, -offset);
        this.onScrollComplete(link);
      }, 320);
      return;
    }

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const elementTop = rect.top + scrollTop;
    const targetPosition = elementTop - offset;

    // Visual feedback during scroll
    link.classList.add("navigating");

    // Perform scroll
    if ("scrollBehavior" in document.documentElement.style) {
      window.scrollTo({ top: targetPosition, behavior: "smooth" });

      // Desktop fallback: verify movement and force complete if needed
      setTimeout(() => {
        const currentPos = window.scrollY;
        if (Math.abs(currentPos - targetPosition) < 4) {
          // If not moved significantly, jump instantly
          window.scrollTo({ top: targetPosition, behavior: "auto" });
          this.onScrollComplete(link);
        }
      }, 240);

      // Use scrollend event if available (modern browsers)
      if ("onscrollend" in window) {
        const handleScrollEnd = () => {
          window.removeEventListener("scrollend", handleScrollEnd);
          this.onScrollComplete(link);
        };
        window.addEventListener("scrollend", handleScrollEnd, { once: true });
      } else {
        this.waitForScrollEnd(() => {
          this.onScrollComplete(link);
        });
      }
    } else {
      // Legacy browsers without smooth scroll: jump directly
      window.scrollTo(0, targetPosition);
      this.onScrollComplete(link);
    }
  }

  /**
   * Wait for scroll to end (fallback for browsers without scrollend event)
   */
  private waitForScrollEnd(callback: () => void): void {
    let lastScrollTop = window.pageYOffset;
    let scrollCheckCount = 0;
    const maxChecks = 50; // Max 2.5 seconds (50 * 50ms)

    const checkScroll = () => {
      const currentScrollTop = window.pageYOffset;
      scrollCheckCount++;

      // Check if scroll has stopped (same position for 2 checks)
      if (Math.abs(currentScrollTop - lastScrollTop) < 1) {
        callback();
      } else if (scrollCheckCount < maxChecks) {
        lastScrollTop = currentScrollTop;
        setTimeout(checkScroll, 50);
      } else {
        // Timeout: call callback anyway
        callback();
      }
    };

    setTimeout(checkScroll, 50);
  }

  /**
   * Handle scroll completion
   */
  private onScrollComplete(link: HTMLElement): void {
    this.isScrolling = false;
    link.classList.remove("navigating");
    if (this.isMobile) this.announceToScreenReader("Navigated to section");
    // Force active state for the clicked target (helps when threshold logic hasn't run yet)
    const targetId = link.getAttribute("href")?.substring(1);
    if (targetId) {
      const idx = this.tocItems.findIndex((i) => i.id === targetId);
      if (idx !== -1 && idx !== this.currentActiveIndex) {
        this.updateActiveLinks(idx);
        this.currentActiveIndex = idx;
      }
    }
  }

  /**
   * Smooth scroll polyfill for older browsers
   */
  // Removed legacy smooth scroll polyfill and scroll container detection for simplicity.

  /**
   * Dynamic offset based on heading scroll-margin-top or fallback values.
   */
  private getDynamicOffset(): number {
    if (!this.isMobile) return 120;
    const first = this.tocItems[0]?.element;
    if (first) {
      const sm = parseInt(getComputedStyle(first).scrollMarginTop || "0", 10);
      if (!isNaN(sm) && sm > 0) return sm;
    }
    return 100; // mobile fallback
  }

  /**
   * Update active TOC item based on scroll position
   */
  private updateActiveTOC(): void {
    if (this.tocItems.length === 0 || this.isScrolling) return;

    const scrollTop = window.pageYOffset;
    const offset = this.getDynamicOffset();
    let activeIndex = -1;

    // Find the current active section
    for (let i = 0; i < this.tocItems.length; i++) {
      const element = this.tocItems[i].element;
      const elementTop = element.getBoundingClientRect().top + scrollTop;

      if (elementTop <= scrollTop + offset) {
        activeIndex = i;
      }
    }

    // Update active state if changed
    if (activeIndex !== this.currentActiveIndex) {
      this.updateActiveLinks(activeIndex);
      this.currentActiveIndex = activeIndex;
    }
  }

  /**
   * Update active link styling
   */
  private updateActiveLinks(activeIndex: number): void {
    const tocLinks = this.tocNav?.querySelectorAll("a");
    if (!tocLinks) return;

    tocLinks.forEach((link, index) => {
      const isActive = index === activeIndex;
      link.classList.toggle("active", isActive);
      link.setAttribute("aria-current", isActive ? "location" : "false");
    });

    // Scroll active link into view within TOC
    if (activeIndex >= 0 && tocLinks[activeIndex] && this.tocNav) {
      const activeLink = tocLinks[activeIndex] as HTMLElement;
      const navRect = this.tocNav.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();

      // Check if link is outside visible area
      if (linkRect.top < navRect.top || linkRect.bottom > navRect.bottom) {
        activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  /**
   * Update reading progress indicators
   */
  // Removed internal TOC progress bar logic; external reading progress component handles it.

  /**
   * Throttle function execution
   */
  private throttle(func: Function, limit: number): Function {
    let inThrottle: boolean;
    return function (this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Debounce function execution
   */
  private debounce(func: Function, wait: number): Function {
    let timeout: number | null = null;
    return function (this: any, ...args: any[]) {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = window.setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Announce message to screen readers
   */
  private announceToScreenReader(message: string): void {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Bind all event listeners
   */
  private bindEvents(): void {
    const throttledScroll = this.throttle(() => {
      this.updateActiveTOC();
    }, 16) as EventListener;

    const debouncedResize = this.debounce(() => {
      this.updateDeviceType();
      this.setupMobileInteraction();
    }, 250) as EventListener;

    // Scroll events with passive listener for performance
    window.addEventListener("scroll", throttledScroll, { passive: true });

    // Resize events
    window.addEventListener("resize", debouncedResize, { passive: true });

    // Orientation change for mobile devices
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        this.updateDeviceType();
        this.setupMobileInteraction();
      }, 100);
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (event) => {
      // ESC key to collapse TOC on mobile
      if (event.key === "Escape" && this.isMobile && this.tocContainer) {
        this.tocContainer.classList.add("collapsed");
        this.announceToScreenReader("Table of contents collapsed");
      }
    });

    // Prevent accidental zoom on mobile
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          const target = event.target as HTMLElement;
          if (target.closest(".toc-nav a")) {
            event.preventDefault();
          }
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }
}

// Add screen reader only CSS class to document if not exists
const style = document.createElement("style");
style.textContent = `
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
`;
document.head.appendChild(style);
