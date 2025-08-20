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
  children?: NavigationLink[];
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

export interface AppConfig {
  astro: AstroConfig;
  website: WebsiteConfig;
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
