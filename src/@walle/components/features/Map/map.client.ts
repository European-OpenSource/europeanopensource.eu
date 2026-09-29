/**
 * Leaflet (and its own runtime DOM) is only ever pulled in once the map's container scrolls
 * near the viewport. The server-rendered `<ol data-map-list>` is the sole source of marker
 * data, read straight off its `<li data-lat data-lng data-variant data-title>` children so
 * there's no duplicate JSON payload to keep in sync.
 */

interface MarkerData {
  lat: number;
  lng: number;
  variant: string;
  title: string;
  description?: string;
  directionsHref?: string;
  directionsLabel?: string;
}

function parseMarkers(list: HTMLOListElement): MarkerData[] {
  return Array.from(list.querySelectorAll<HTMLLIElement>("li")).map((li) => {
    const link = li.querySelector<HTMLAnchorElement>("a");
    return {
      lat: Number(li.dataset.lat),
      lng: Number(li.dataset.lng),
      variant: li.dataset.variant ?? "primary",
      title: li.dataset.title ?? "",
      description: li.querySelector(".map__marker-description")?.textContent ?? undefined,
      directionsHref: link?.getAttribute("href") ?? undefined,
      directionsLabel: link?.textContent ?? undefined,
    };
  });
}

function buildPopup(marker: MarkerData): HTMLElement {
  const el = document.createElement("div");
  el.className = "map__popup";

  const title = document.createElement("p");
  title.className = "map__popup-title";
  title.textContent = marker.title;
  el.appendChild(title);

  if (marker.description) {
    const description = document.createElement("p");
    description.className = "map__popup-description";
    description.textContent = marker.description;
    el.appendChild(description);
  }

  if (marker.directionsHref) {
    const link = document.createElement("a");
    link.className = "map__popup-directions";
    link.href = marker.directionsHref;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = marker.directionsLabel ?? marker.directionsHref;
    el.appendChild(link);
  }

  return el;
}

async function loadMap(container: HTMLElement, list: HTMLOListElement): Promise<void> {
  const [{ default: L }] = await Promise.all([import("leaflet"), import("./leaflet-styles")]);
  const markers = parseMarkers(list);

  const map = L.map(container, {
    scrollWheelZoom: container.dataset.scrollZoom === "true",
  });

  L.tileLayer(container.dataset.tilesUrl ?? "", {
    attribution: container.dataset.tilesAttribution ?? "",
    subdomains: container.dataset.tilesSubdomains,
    maxZoom: container.dataset.tilesMaxZoom ? Number(container.dataset.tilesMaxZoom) : undefined,
  }).addTo(map);

  // The view must exist before markers are added: Leaflet defers a layer's onAdd (and so
  // its DOM element) until the map is "loaded", which only happens once it has a view. Added
  // before that point, getElement() below would return undefined and every setAttribute a
  // silent no-op, on every marker, on every Map story with more than a bare pin.
  if (markers.length > 1) {
    map.fitBounds(
      markers.map((marker) => [marker.lat, marker.lng]),
      { maxZoom: Number(container.dataset.maxZoom) || 15 }
    );
  } else if (markers.length === 1) {
    map.setView([markers[0].lat, markers[0].lng], Number(container.dataset.zoom) || 15);
  }

  for (const marker of markers) {
    const leafletMarker = L.marker([marker.lat, marker.lng], {
      icon: L.divIcon({ className: "map__marker" }),
    }).addTo(map);
    const markerEl = leafletMarker.getElement();
    markerEl?.setAttribute("data-variant", marker.variant);
    // Leaflet's own interactive marker is keyboard-focusable (role="button", tabindex) but
    // ships with no accessible name of its own: without this it fails WCAG 4.1.2 (axe:
    // aria-command-name) on every marker, on every Map story.
    if (marker.title) markerEl?.setAttribute("aria-label", marker.title);
    if (marker.title || marker.description || marker.directionsHref) {
      leafletMarker.bindPopup(buildPopup(marker));
    }
  }

  list.classList.add("sr-only");
}

/** Called once per `<section>` root Map.astro renders on the page. */
export function initMap(root: HTMLElement): void {
  if (root.dataset.mapReady) return;
  const container = root.querySelector<HTMLElement>("[data-map-container]");
  const list = root.querySelector<HTMLOListElement>("[data-map-list]");
  if (!container || !list) return;
  root.dataset.mapReady = "true";

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadMap(container, list);
    },
    { rootMargin: "200px" }
  );
  observer.observe(container);
}
