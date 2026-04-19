import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

async function fetchFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  ).then((r) => r.text());
  const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!match) throw new Error(`Font not found: ${family} ${weight}`);
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

const truncate = (str: string, max: number) =>
  str.length > max ? str.slice(0, max).trimEnd() + "…" : str;

const fontRegular = await fetchFont("Inter", 400);
const fontBold = await fetchFont("Inter", 700);

export const getStaticPaths: GetStaticPaths = async () => {
  const projects = await getCollection("project");
  return projects.map((project) => ({
    params: { slug: project.id },
    props: project,
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { data } = props;

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          backgroundImage: "linear-gradient(145deg, #00216e 0%, #0046ad 60%, #0153ce 100%)",
          fontFamily: "Inter",
          overflow: "hidden",
        },
        children: [
          // Content
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                flex: 1,
                padding: "60px 56px 56px 64px",
              },
              children: [
                // Brand
                {
                  type: "div",
                  props: {
                    style: { display: "flex", alignItems: "center", gap: "10px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: "#ffcc00",
                            flexShrink: 0,
                          },
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            color: "rgba(255,255,255,0.55)",
                            fontSize: "18px",
                            letterSpacing: "0.12em",
                          },
                          children: "EUROPEAN OPEN SOURCE",
                        },
                      },
                    ],
                  },
                },
                // Title + description
                {
                  type: "div",
                  props: {
                    style: { display: "flex", flexDirection: "column", gap: "20px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "72px",
                            fontWeight: 700,
                            color: "#ffffff",
                            lineHeight: 1.05,
                            letterSpacing: "-0.02em",
                          },
                          children: truncate(data.name, 36),
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "24px",
                            color: "rgba(255,255,255,0.6)",
                            lineHeight: 1.5,
                          },
                          children: truncate(data.description, 110),
                        },
                      },
                    ],
                  },
                },
                // Badges
                {
                  type: "div",
                  props: {
                    style: { display: "flex", gap: "12px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            padding: "10px 24px",
                            backgroundColor: "rgba(255,255,255,0.12)",
                            borderRadius: "9999px",
                            color: "rgba(255,255,255,0.9)",
                            fontSize: "20px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                          },
                          children: data.category.toUpperCase(),
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            padding: "10px 24px",
                            backgroundColor: "#bd1178",
                            borderRadius: "9999px",
                            color: "#ffffff",
                            fontSize: "20px",
                            fontWeight: 700,
                          },
                          children: data.country,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // Decorative circles
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                width: "360px",
                flexShrink: 0,
                overflow: "hidden",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      width: "500px",
                      height: "500px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginRight: "-100px",
                    },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            width: "340px",
                            height: "340px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                style: {
                                  width: "180px",
                                  height: "180px",
                                  borderRadius: "50%",
                                  backgroundColor: "rgba(255,255,255,0.08)",
                                  flexShrink: 0,
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
        { name: "Inter", data: fontBold, weight: 700, style: "normal" },
      ],
    }
  );

  const png = new Uint8Array(new Resvg(svg).render().asPng());
  return new Response(png, { headers: { "Content-Type": "image/png" } });
};
