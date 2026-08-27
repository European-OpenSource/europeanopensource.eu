import configs from "../configs";

export interface AstroConfig {
  baseUrl: string;
  basePath: string;
  trailingSlash: string;
  analyticsScriptContent?: string;
  [key: string]: any;
}

export interface WebsiteConfig {
  title: string;
  description: string;
  favicon: string;
  image: string;
  robots: string;
  language: string;
  [key: string]: any;
}

export interface NavigationLink {
  name?: string;
  url: string;
  icon?: string;
  target?: "_blank" | "_self";
  dropdown?: Omit<NavigationLink, "dropdown">[];
}

export interface NavbarLogo {
  src?: string;
  title?: string;
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  cssClasses?: string;
  license?: string;
}

export interface NavbarConfig {
  logo: NavbarLogo;
  items: NavigationLink[];
}

export interface FooterConfig {
  logo: NavbarLogo;
  items: NavigationLink[];
}

export interface PwaIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

/**
 * Progressive web app. Opt-in: absent, or `enabled: false`, and a site ships no manifest,
 * no service worker and no registration script at all. Every other key is optional and
 * falls back to what the site already declares (website title/description/language, theme
 * palette), so turning it on is one line.
 */
export interface PwaConfig {
  enabled?: boolean;
  name?: string;
  shortName?: string;
  description?: string;
  lang?: string;
  themeColor?: string;
  backgroundColor?: string;
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  startUrl?: string;
  scope?: string;
  icons?: PwaIcon[];
  appleTouchIcon?: string;
}

export interface AppConfig {
  astro: AstroConfig;
  website: WebsiteConfig;
  components?: Record<string, string>;
  pwa?: PwaConfig;
}

export interface DefaultConfig {
  app: AppConfig;
  navbar: NavbarConfig;
  footer: FooterConfig;
  [key: string]: any;
}

export const config: DefaultConfig = {
  ...configs,
  env: {
    ...import.meta.env,
    IS_PRODUCTION: import.meta.env.NODE_ENV === "production",
  },
};

export default config;

// Build-time Astro config resolver (used by astro.config.mjs). Lives in a sibling
// module so importing the runtime `config` above doesn't drag in astro/config.
export { defineWalleConfig } from "./define-config";
