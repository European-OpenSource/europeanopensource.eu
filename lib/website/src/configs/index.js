import AppConfig from "./app.json";
import FooterConfig from "./footer.json";
import NavbarConfig from "./navbar.json";

/**
 * Configuration data for the website.
 * Don't change the name and don't use directly but use `import config from "@walle/config";` instead.
 * This allows to use the `config` in the components without importing the file directly.
 */
export default {
  // Default configuration. Don't change or remove this.
  app: AppConfig,
  footer: FooterConfig,
  navbar: NavbarConfig,
  teamMembers: [
    {
      name: "Fabrizio Cafolla",
      position: "Community Manager",
      bio: "",
      image: "/img/collettivo/fabrizio-cafolla.jpg",
      social: {
        github: "https://github.com/FabrizioCafolla",
        linkedin: "https://www.linkedin.com/in/fabrizio-cafolla/",
      },
    },
    {
      name: "Greta Tesini",
      position: "Community Manager",
      bio: "",
      image: "/img/collettivo/greta-tesini.jpg",
      social: {
        github: null,
        linkedin: "https://linkedin.com/in/greta-tesini",
      },
    },
    {
      name: "Daniele Dapuzzo",
      position: "Community Manager",
      bio: "",
      image: "/img/collettivo/daniele-dapuzzo.jpg",
      social: {
        github: "https://github.com/dandpz",
        linkedin: "https://linkedin.com/in/daniele.dapuzzo",
      },
    },
  ],
  // Custom configuration
};
