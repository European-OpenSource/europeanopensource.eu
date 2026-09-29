import type { OgEntry, OgTemplate, SatoriElement } from "../render";
import type { OgTheme } from "../theme";

const MAX_TITLE_LENGTH = 90;

/** Exported for its own unit coverage: a long title must never overflow the 1200x630 canvas. */
export function truncateTitle(title: string, max: number = MAX_TITLE_LENGTH): string {
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1).trimEnd()}…`;
}

const defaultTemplate: OgTemplate = (entry: OgEntry, theme: OgTheme): SatoriElement => {
  const title = truncateTitle(entry.title);

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        backgroundColor: theme.background,
        fontFamily: theme.fonts[0]?.name ?? "Inter",
      },
      children: [
        {
          type: "div",
          props: {
            style: { fontSize: 56, fontWeight: 700, color: theme.foreground, lineHeight: 1.2 },
            children: title,
          },
        },
        entry.subtitle
          ? {
              type: "div",
              props: {
                style: { fontSize: 28, color: theme.foreground, opacity: 0.7, marginTop: 24 },
                children: entry.subtitle,
              },
            }
          : null,
        {
          type: "div",
          props: {
            style: { fontSize: 24, color: theme.primary, fontWeight: 600 },
            children: theme.siteTitle,
          },
        },
      ],
    },
  };
};

export default defaultTemplate;
