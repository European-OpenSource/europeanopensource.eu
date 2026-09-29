// Leaflet's stylesheet, injected when the map initializes. Imported as text rather than as a CSS
// module because Astro links every stylesheet in a page's module graph, dynamic imports included;
// the file wraps leaflet's rules in @layer walle.components so walle and site rules still win.
import css from "./leaflet.css?inline";

if (!document.querySelector("style[data-walle-leaflet]")) {
  const style = document.createElement("style");
  style.dataset.walleLeaflet = "";
  style.textContent = css;
  document.head.append(style);
}
