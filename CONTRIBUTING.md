# Contributing to European OpenSource

**Thanks for taking the time to contribute! ❤️**

Before you start please read our [CODE OF CONDUCT](https://github.com/european-opensource/europeanopensource.eu/blob/main/CODE_OF_CONDUCT.md) so that you can understand what actions will and will not be tolerated.

All types of contributions are encouraged and valued, no matter if it's a bug report, a feature request, or a Pull Request.

## How to Contribute

- **🚀 I want to submit a project**: [Fill out the form](https://europeanopensource.eu/form)
- **❓ I have a question:** Ask in [[Open an Issue](https://github.com/European-OpenSource/europeanopensource.eu/issues/new?template=QUESTION.yml)]
- **🐛 I found a bug:** [[Open an Issue](https://github.com/European-OpenSource/europeanopensource.eu/issues/new?template=BUG_REPORT.yml)]
- **💡 I have an idea:** [[Open an Issue](https://github.com/European-OpenSource/europeanopensource.eu/issues/new?template=FEATURE_REQUEST.yml)]
- **💻 I want to code (or improve documentation):** See [Contributing code](#contributing-code) section

## Contributing Code

> ⚠️ **Important:** If you're looking to add a new feature, please check if a feature issue exists or create one before starting development.

When you've identified an issue and you want to work on it here's how you can get started:

1. Fork the repo
2. Setup project
   - If you using VS Code: Open the project in devcontainer mode
   - Or, setup your local env with `just setup`
3. Add your changes
4. Test your changes using `just yarn test` and `just yarn dev` to make sure everything still works
5. Commit & push your changes (we suggest use a feature or fix branch)
6. Open a PR to get your changes merged.

### With Dev Container (Recommended)

1. Requirements: `Docker >=24`
2. Open the project in Visual Studio Code
3. Install the Dev Containers extension
4. Reopen in container when prompted
5. Website automatically starts at [http://localhost:4321](http://localhost:4321)

### Without Dev Container

1. **Requirements**

   | pkg    | version |
   | ------ | ------- |
   | Docker | `>=24`  |
   | Node   | `>=22`  |
   | Yarn   | `^1.22` |

2. **Setup the project:**

   ```bash
   just setup
   ```

3. **Start development server:**

   ```bash
   just dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:4321](http://localhost:4321)

### Tech Stack

- **Framework**: [Astro](https://astro.build/) - Static site generator
- **Styling**: CSS with custom properties
- **Icons**: Astro Icon with Font Awesome
- **Content**: Markdown-based project data
- **Deployment**: Static hosting
- **Development**: Dev Container with Node.js 22+

### Project Structure

```
├── lib/
│   ├── infrastructure/           # Infrastructure tooling/placeholders
│   ├── scripts/                  # Automation scripts
│   │   └── @walle/               # Project CLI helpers
│   └── website/                  # Main Astro website
│       ├── src/
│       │   ├── @walle/           # Shared UI, layouts, styles, utils
│       │   ├── components/       # Reusable UI components
│       │   ├── configs/          # App/navbar/footer configs
│       │   ├── content/          # Markdown content (projects, etc.)
│       │   ├── layouts/          # Page layouts
│       │   ├── pages/            # Website pages (routes)
│       │   ├── styles/           # Global styles
│       │   └── utils/            # Helpers and interfaces
│       ├── public/               # Static assets (fonts, images)
│       ├── .astro/               # Astro content collections metadata
│       ├── .husky/               # Git hooks
│       ├── astro.config.mjs      # Astro configuration
│       ├── eslint.config.js      # ESLint configuration
│       ├── package.json          # Website dependencies/scripts
│       ├── tsconfig.json         # TypeScript configuration
│       ├── Makefile              # Make targets for the website
│       └── README.md             # Website-specific readme
├── justfile                       # Project-level tasks
├── walle.justfile                 # Walle tasks
├── README.md                      # Repository readme
├── LICENSE                        # License
├── CODE_OF_CONDUCT.md             # Code of conduct
└── CONTRIBUTING.md                # Contribution guidelines
```

### PR Guidelines

- Keep PRs focused on a single feature/fix
- Include tests for new functionality
- Update documentation if needed
- Ensure all CI checks pass

### Code Style Guidelines

- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Follow the project's ESLint configuration

## Join our Community

[![LinkedIn](https://img.shields.io/badge/Linkedin-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/european-open-source)

#### [CODE OF CONDUCT](CODE_OF_CONDUCT.md)
