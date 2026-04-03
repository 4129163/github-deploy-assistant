module.exports = {
  'node': `
# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build output
dist/
build/
*.log

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
`,
  'python': `
# Virtual environment
venv/
env/
__pycache__/
*.py[cod]
*$py.class

# Dependencies
pip-wheel-metadata/
dist/
build/
*.egg-info/
requirements.txt.lock
Pipfile.lock

# Environment
.env
.venv

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`,
  'java': `
# Compiled output
target/
build/
*.class
*.jar
*.war

# Dependencies
.gradle/
.m2/
dependency-reduced-pom.xml

# Environment
.env

# IDE
.idea/
.vscode/
*.iml
*.ipr
*.iws

# OS
.DS_Store
Thumbs.db
`,
  'web': `
# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build output
dist/
build/
*.log

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
`,
  'go': `
# Binaries
bin/
*.exe
*.dll
*.so
*.dylib

# Dependencies
vendor/
go.sum

# Test output
coverage.out
*.test

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db
`,
  'default': `
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage
.grunt

# Bower dependency directory
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
node_modules/
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test

# parcel-bundler cache
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
public

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
Thumbs.db
`
};
