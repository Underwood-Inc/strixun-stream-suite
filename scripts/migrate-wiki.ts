#!/usr/bin/env node
/**
 * Migrate Documentation to GitHub Wiki
 * 
 * This script migrates ALL documentation files from the codebase to the GitHub wiki
 * as a one-time migration. The wiki becomes the single source of truth for documentation.
 * 
 * The wiki is a separate git repository that GitHub creates automatically
 * at: https://github.com/OWNER/REPO.wiki.git
 * 
 * After running this, you can remove documentation files from the codebase
 * and maintain them only in the wiki.
 * 
 * Usage:
 *   GITHUB_TOKEN=your_token pnpm run migrate-wiki
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Repository info
const REPO_OWNER = 'Underwood-Inc';
const REPO_NAME = 'strixun-stream-suite';
const WIKI_REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}.wiki.git`;

// Directories to migrate (finds ALL markdown files recursively)
const DOC_DIRS = [
  'docs',
  'product-docs',
  'serverless',
  'mods-hub',
  'shared-components',
];

// Files to skip (keep only essential files in codebase)
const SKIP_PATTERNS = [
  /^node_modules/,
  /^\.git/,
  /^dist/,
  /^\.changeset/,
  /^\.wiki-temp/,
  /CHANGELOG\.md$/i,
  // Keep root README.md in codebase (it's needed for GitHub repo display)
  /^README\.md$/i,
];

// Category mapping for better organization
// Maps directory patterns to category prefixes
const CATEGORY_MAP: Array<{ pattern: RegExp; prefix: string; priority: number }> = [
  // High priority - well-organized docs structure
  { pattern: /^docs\/getting-started/i, prefix: 'getting-started', priority: 1 },
  { pattern: /^docs\/architecture/i, prefix: 'architecture', priority: 2 },
  { pattern: /^docs\/api/i, prefix: 'api', priority: 3 },
  { pattern: /^docs\/services/i, prefix: 'service', priority: 4 },
  { pattern: /^docs\/development/i, prefix: 'development', priority: 5 },
  { pattern: /^docs\/deployment/i, prefix: 'deployment', priority: 6 },
  { pattern: /^docs\/security/i, prefix: 'security', priority: 7 },
  { pattern: /^docs\/guides/i, prefix: 'guide', priority: 8 },
  { pattern: /^docs\/reference/i, prefix: 'reference', priority: 9 },
  // Product docs
  { pattern: /^product-docs/i, prefix: 'product', priority: 10 },
  // Service-specific docs
  { pattern: /^serverless\/otp-auth-service/i, prefix: 'service-otp-auth', priority: 11 },
  { pattern: /^serverless\/customer-api/i, prefix: 'service-customer-api', priority: 12 },
  { pattern: /^serverless\/url-shortener/i, prefix: 'service-url-shortener', priority: 13 },
  { pattern: /^serverless\/mods-api/i, prefix: 'service-mods-api', priority: 14 },
  { pattern: /^serverless\/chat-signaling/i, prefix: 'service-chat-signaling', priority: 15 },
  { pattern: /^serverless\/game-api/i, prefix: 'service-game-api', priority: 16 },
  { pattern: /^serverless\/twitch-api/i, prefix: 'service-twitch-api', priority: 17 },
  { pattern: /^serverless/i, prefix: 'serverless', priority: 18 },
  // Other directories
  { pattern: /^mods-hub/i, prefix: 'mods-hub', priority: 19 },
  { pattern: /^shared-components/i, prefix: 'shared-components', priority: 20 },
  // Fallback for docs root
  { pattern: /^docs/i, prefix: 'docs', priority: 21 },
];

/**
 * Get category prefix for a file path
 */
function getCategoryPrefix(filePath: string): string {
  const relativePath = relative(rootDir, filePath);
  
  for (const { pattern, prefix } of CATEGORY_MAP) {
    if (pattern.test(relativePath)) {
      return prefix;
    }
  }
  
  return 'docs';
}

/**
 * Get file priority for sorting
 */
function getFilePriority(filePath: string): number {
  const relativePath = relative(rootDir, filePath);
  
  for (const { pattern, priority } of CATEGORY_MAP) {
    if (pattern.test(relativePath)) {
      return priority;
    }
  }
  
  return 999;
}

/**
 * Get GitHub token from environment
 */
function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('[ERROR] GITHUB_TOKEN environment variable is required');
    console.error('   Get a token from: https://github.com/settings/tokens');
    console.error('   Required scopes: repo (for private repos) or public_repo (for public repos)');
    process.exit(1);
  }
  return token;
}

/**
 * Find all markdown files in a directory recursively
 */
function findMarkdownFiles(dir: string, baseDir: string = rootDir): string[] {
  const files: string[] = [];
  
  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      return files;
    }
    
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      
      // Skip patterns
      if (SKIP_PATTERNS.some(pattern => pattern.test(relativePath) || pattern.test(entry.name))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...findMarkdownFiles(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories that don't exist or can't be read
    console.warn(`[WARNING]  Skipping ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return files;
}

/**
 * Convert file path to wiki page name (URL-friendly)
 * GitHub wikis use the filename as the page name
 * Uses category prefixes for better organization
 */
function pathToWikiName(filePath: string): string {
  const relativePath = relative(rootDir, filePath);
  const withoutExt = relativePath.replace(/\.md$/, '');
  
  // Get category prefix
  const categoryPrefix = getCategoryPrefix(filePath);
  
  // Extract meaningful name from path
  let name = withoutExt
    .replace(/[/\\]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
  
  // Remove category prefix if already in path (to avoid duplication)
  // e.g., "docs-api-reference" -> "api-reference" (if category is "api")
  const prefixPattern = new RegExp(`^${categoryPrefix}-`, 'i');
  if (prefixPattern.test(name)) {
    name = name.replace(prefixPattern, '');
  }
  
  // Handle README files - convert to category index
  if (name.endsWith('-readme') || name === 'readme') {
    const dirName = dirname(relativePath).split(/[/\\]/).pop() || '';
    if (dirName && dirName !== '.' && dirName !== 'docs') {
      // e.g., "docs-api-readme" -> "api-index"
      return `${categoryPrefix}-index`;
    }
    // Root README stays as category index
    return `${categoryPrefix}-index`;
  }
  
  // Add category prefix if not already present
  if (!name.startsWith(`${categoryPrefix}-`)) {
    name = `${categoryPrefix}-${name}`;
  }
  
  // Clean up multiple dashes
  name = name.replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  return name;
}

/**
 * Fix relative links in markdown content for wiki context
 */
function fixWikiLinks(content: string, currentPath: string): string {
  const currentDir = dirname(currentPath);
  
  // Fix relative markdown links: [text](./file.md) or [text](../file.md)
  return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, link) => {
    // Skip external links
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#')) {
      return match;
    }
    
    // Skip mailto links
    if (link.startsWith('mailto:')) {
      return match;
    }
    
    // Handle relative links
    if (link.startsWith('./') || link.startsWith('../')) {
      const resolvedPath = join(currentDir, link);
      const relativeFromRoot = relative(rootDir, resolvedPath);
      
      if (relativeFromRoot.endsWith('.md')) {
        // Convert to wiki page name
        const wikiName = pathToWikiName(resolvedPath);
        return `[${text}](${wikiName})`;
      }
    }
    
    // Handle absolute paths from root
    if (link.startsWith('/')) {
      const resolvedPath = join(rootDir, link.slice(1));
      if (resolvedPath.endsWith('.md')) {
        const wikiName = pathToWikiName(resolvedPath);
        return `[${text}](${wikiName})`;
      }
    }
    
    return match;
  });
}

/**
 * Clone or update the wiki repository
 */
function cloneWikiRepo(wikiDir: string, token: string): void {
  const authUrl = WIKI_REPO_URL.replace('https://', `https://${token}@`);
  
  // Disable credential prompting for clone operations too
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  
  if (existsSync(wikiDir)) {
    console.log('[EMOJI] Updating existing wiki repository...');
    try {
      // Update remote URL with token before pulling
      execSync(`git remote set-url origin ${authUrl}`, { cwd: wikiDir });
      execSync('git pull', { cwd: wikiDir, stdio: 'inherit', env });
    } catch (error) {
      console.warn('[WARNING]  Could not pull, will clone fresh...');
      rmSync(wikiDir, { recursive: true, force: true });
      execSync(`git clone ${authUrl} "${wikiDir}"`, { stdio: 'inherit', env });
    }
  } else {
    console.log('[EMOJI] Cloning wiki repository...');
    mkdirSync(dirname(wikiDir), { recursive: true });
    execSync(`git clone ${authUrl} "${wikiDir}"`, { stdio: 'inherit', env });
  }
}

/**
 * Sort files by category and name for better organization
 */
function sortFiles(files: string[]): string[] {
  return files.sort((a, b) => {
    // First sort by category priority
    const priorityA = getFilePriority(a);
    const priorityB = getFilePriority(b);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Then sort alphabetically within category
    const nameA = pathToWikiName(a);
    const nameB = pathToWikiName(b);
    return nameA.localeCompare(nameB);
  });
}

/**
 * Deduplicate files - if multiple files map to same wiki name, keep the most specific one
 */
function deduplicateFiles(files: string[]): string[] {
  const wikiNameMap = new Map<string, string>();
  
  for (const file of files) {
    const wikiName = pathToWikiName(file);
    const existing = wikiNameMap.get(wikiName);
    
    if (!existing) {
      wikiNameMap.set(wikiName, file);
    } else {
      // Keep the more specific path (longer relative path)
      const relativeA = relative(rootDir, file);
      const relativeB = relative(rootDir, existing);
      
      // Prefer files in organized directories (docs/) over root-level
      const inDocsA = relativeA.startsWith('docs/');
      const inDocsB = relativeB.startsWith('docs/');
      
      if (inDocsA && !inDocsB) {
        wikiNameMap.set(wikiName, file);
      } else if (!inDocsA && inDocsB) {
        // Keep existing
      } else if (relativeA.length > relativeB.length) {
        // Keep longer (more specific) path
        wikiNameMap.set(wikiName, file);
      }
      // Otherwise keep existing
    }
  }
  
  return Array.from(wikiNameMap.values());
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  const categoryLabels: Record<string, string> = {
    'getting-started': 'Getting Started',
    'architecture': 'Architecture',
    'api': 'API',
    'service': 'Services',
    'service-otp-auth': 'OTP Auth Service',
    'service-customer-api': 'Customer API',
    'service-url-shortener': 'URL Shortener',
    'service-mods-api': 'Mods API',
    'service-chat-signaling': 'Chat Signaling',
    'service-game-api': 'Game API',
    'service-twitch-api': 'Twitch API',
    'development': 'Development',
    'deployment': 'Deployment',
    'security': 'Security',
    'guide': 'Guides',
    'reference': 'Reference',
    'product': 'Product',
    'serverless': 'Serverless',
    'mods-hub': 'Mods Hub',
    'shared-components': 'Shared Components',
    'docs': 'Documentation',
  };
  
  return categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
}

/**
 * Add navigation breadcrumbs and metadata to page content
 */
function enhancePageContent(content: string, wikiName: string, category: string, filePath: string): string {
  // Extract title from content (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const pageTitle = titleMatch ? titleMatch[1] : wikiName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // Format category name
  const categoryLabel = formatCategoryName(category);
  
  // Build breadcrumbs (don't include current page title if it's too long)
  const breadcrumbs = [
    '[Home](Home)',
    `[${categoryLabel}](${category}-index)`
  ];
  
  // Only add page title if it's reasonably short
  if (pageTitle.length < 50) {
    breadcrumbs.push(pageTitle);
  }
  
  // Add navigation header
  const navHeader = `---
**Navigation:** ${breadcrumbs.join(' › ')}
---

`;
  
  // Add to top of content (after any existing frontmatter)
  if (content.startsWith('---')) {
    // Has frontmatter, add after it
    const frontmatterEnd = content.indexOf('---', 3);
    if (frontmatterEnd !== -1) {
      return content.slice(0, frontmatterEnd + 3) + '\n\n' + navHeader + content.slice(frontmatterEnd + 4);
    }
  }
  
  return navHeader + content;
}

/**
 * Copy documentation files to wiki directory
 */
function copyDocsToWiki(sourceFiles: string[], wikiDir: string): {
  copied: number;
  categoryMap: Map<string, Array<{ name: string; title: string }>>;
} {
  // Sort and deduplicate files
  const sortedFiles = sortFiles(sourceFiles);
  const uniqueFiles = deduplicateFiles(sortedFiles);
  
  // Group by category for reporting and navigation
  const categoryGroups = new Map<string, number>();
  const categoryMap = new Map<string, Array<{ name: string; title: string }>>();
  
  let copied = 0;
  let skipped = 0;
  
  for (const file of uniqueFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const wikiName = pathToWikiName(file);
      const category = getCategoryPrefix(file);
      
      // Extract title from content
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const pageTitle = titleMatch ? titleMatch[1] : wikiName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Track category
      categoryGroups.set(category, (categoryGroups.get(category) || 0) + 1);
      
      // Track pages for category index
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push({ name: wikiName, title: pageTitle });
      
      // Enhance content with navigation
      let enhancedContent = enhancePageContent(content, wikiName, category, file);
      const fixedContent = fixWikiLinks(enhancedContent, file);
      const wikiFilePath = join(wikiDir, `${wikiName}.md`);
      
      // Check if file already exists and is identical (skip if so)
      if (existsSync(wikiFilePath)) {
        try {
          const existingContent = readFileSync(wikiFilePath, 'utf-8');
          if (existingContent === fixedContent) {
            console.log(`[EMOJI][EMOJI]  Skipped (unchanged): ${wikiName}.md`);
            skipped++;
            continue;
          }
        } catch {
          // If we can't read existing, proceed with write
        }
      }
      
      // Ensure directory exists
      mkdirSync(dirname(wikiFilePath), { recursive: true });
      
      // Write file
      writeFileSync(wikiFilePath, fixedContent, 'utf-8');
      console.log(`[SUCCESS] Copied: ${wikiName}.md`);
      copied++;
    } catch (error) {
      console.error(`[ERROR] Error copying ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Print category summary
  console.log(`\n[ANALYTICS] Files by category:`);
  const sortedCategories = Array.from(categoryGroups.entries())
    .sort((a, b) => {
      const priorityA = CATEGORY_MAP.find(c => c.prefix === a[0])?.priority || 999;
      const priorityB = CATEGORY_MAP.find(c => c.prefix === b[0])?.priority || 999;
      return priorityA - priorityB;
    });
  
  for (const [category, count] of sortedCategories) {
    console.log(`   ${category}: ${count} files`);
  }
  
  if (skipped > 0) {
    console.log(`\n[EMOJI][EMOJI]  Skipped ${skipped} unchanged files`);
  }
  
  return { copied, categoryMap };
}

/**
 * Get category label with emoji
 */
function getCategoryLabel(category: string): string {
  const categoryEmojis: Record<string, string> = {
    'getting-started': '[DEPLOY]',
    'architecture': '[EMOJI][EMOJI]',
    'api': '[EMOJI]',
    'service': '[CONFIG]',
    'service-otp-auth': '[AUTH]',
    'service-customer-api': '[USER]',
    'service-url-shortener': '[LINK]',
    'service-mods-api': '[PACKAGE]',
    'service-chat-signaling': '[CHAT]',
    'service-game-api': '[EMOJI]',
    'service-twitch-api': '[EMOJI]',
    'development': '[CODE]',
    'deployment': '[EMOJI]',
    'security': '[SECURITY]',
    'guide': '[EMOJI]',
    'reference': '[DOCS]',
    'product': '[CLIPBOARD]',
    'serverless': '[EMOJI][EMOJI]',
    'mods-hub': '[TARGET]',
    'shared-components': '[EMOJI]',
    'docs': '[FILE]',
  };
  
  const emoji = categoryEmojis[category] || '';
  const name = formatCategoryName(category);
  return emoji ? `${emoji} ${name}` : name;
}

/**
 * Create category index pages
 */
function createCategoryIndexPages(wikiDir: string, categoryMap: Map<string, Array<{ name: string; title: string }>>): void {
  for (const [category, pages] of categoryMap.entries()) {
    const label = getCategoryLabel(category);
    const indexName = `${category}-index`;
    
    // Sort pages alphabetically by title
    const sortedPages = [...pages].sort((a, b) => a.title.localeCompare(b.title));
    
    const indexContent = `# ${label}

> Category index for ${formatCategoryName(category).toLowerCase()} documentation

## Pages in this category

${sortedPages.map(page => `- [${page.title}](${page.name})`).join('\n')}

---

**Navigation:** [Home](Home) › ${formatCategoryName(category)}

*This page is automatically generated. All pages in this category are listed above.*
`;

    const indexPath = join(wikiDir, `${indexName}.md`);
    writeFileSync(indexPath, indexContent, 'utf-8');
    console.log(`[SUCCESS] Created: ${indexName}.md`);
  }
}

/**
 * Create sidebar navigation
 */
function createSidebar(wikiDir: string, categoryMap: Map<string, Array<{ name: string; title: string }>>): void {
  const categoryOrder = [
    'getting-started',
    'architecture',
    'api',
    'service',
    'service-otp-auth',
    'service-customer-api',
    'service-url-shortener',
    'service-mods-api',
    'service-chat-signaling',
    'service-game-api',
    'service-twitch-api',
    'development',
    'deployment',
    'security',
    'guide',
    'reference',
    'product',
    'serverless',
    'mods-hub',
    'shared-components',
  ];
  
  const sidebarLines: string[] = [
    '# Navigation',
    '',
    '## Main',
    '- [Home](Home)',
    '',
    '## Categories',
    '',
  ];
  
  // Add categories in order
  for (const category of categoryOrder) {
    if (categoryMap.has(category)) {
      const label = getCategoryLabel(category);
      const indexName = `${category}-index`;
      sidebarLines.push(`- [${label}](${indexName})`);
    }
  }
  
  sidebarLines.push('');
  sidebarLines.push('---');
  sidebarLines.push('');
  sidebarLines.push('*Auto-generated navigation*');
  sidebarLines.push(`*Last updated: ${new Date().toLocaleDateString()}*`);
  
  const sidebarPath = join(wikiDir, '_Sidebar.md');
  writeFileSync(sidebarPath, sidebarLines.join('\n'), 'utf-8');
  console.log('[SUCCESS] Created: _Sidebar.md');
}

/**
 * Create footer
 */
function createFooter(wikiDir: string): void {
  const footerContent = `---

## Quick Links

- [Home](Home) - Main documentation index
- [Repository](https://github.com/${REPO_OWNER}/${REPO_NAME}) - Source code
- [Issues](https://github.com/${REPO_OWNER}/${REPO_NAME}/issues) - Report bugs or request features

## Documentation

This wiki is automatically synced from the main repository. To update documentation:

1. Edit files in the \`docs/\` directory
2. Run the migration script: \`pnpm run migrate-wiki\`
3. Changes will be pushed to this wiki

---

*Last updated: ${new Date().toLocaleDateString()}*
`;

  const footerPath = join(wikiDir, '_Footer.md');
  writeFileSync(footerPath, footerContent, 'utf-8');
  console.log('[SUCCESS] Created: _Footer.md');
}

/**
 * Create Home page from main README
 */
function createHomePage(wikiDir: string, categoryMap: Map<string, Array<{ name: string; title: string }>>): void {
  try {
    const readmePath = join(rootDir, 'README.md');
    const readmeContent = readFileSync(readmePath, 'utf-8');
    
    // Build category links
    const categoryLinks: string[] = [];
    const categoryOrder = ['getting-started', 'architecture', 'api', 'service', 'development', 'deployment', 'security', 'guide', 'reference', 'product'];
    
    for (const category of categoryOrder) {
      if (categoryMap.has(category)) {
        const count = categoryMap.get(category)!.length;
        const label = getCategoryLabel(category);
        categoryLinks.push(`- **[${label}](${category}-index)** - ${count} page${count !== 1 ? 's' : ''}`);
      }
    }
    
    const homeContent = `# Welcome to Strixun Stream Suite Documentation

${readmeContent}

---

## [DOCS] Documentation Categories

${categoryLinks.join('\n')}

---

## [DEPLOY] Quick Start

1. **New to the project?** Start with [Getting Started](getting-started-index)
2. **Want to understand the system?** Check out [Architecture](architecture-index)
3. **Need API docs?** See [API Documentation](api-index)
4. **Setting up a service?** Browse [Services](service-index)

---

*This wiki is the single source of truth for documentation. All documentation files have been migrated from the codebase.*

*Use the sidebar on the right to navigate, or search using the search bar at the top.*
`;

    const homePath = join(wikiDir, 'Home.md');
    writeFileSync(homePath, homeContent, 'utf-8');
    console.log('[SUCCESS] Created: Home.md');
  } catch (error) {
    console.error(`[ERROR] Error creating home page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Commit and push changes to wiki
 */
function commitAndPush(wikiDir: string, token: string): boolean {
  try {
    // Configure git
    execSync('git config user.name "GitHub Actions Bot"', { cwd: wikiDir });
    execSync('git config user.email "actions@github.com"', { cwd: wikiDir });
    
    // CRITICAL: Disable credential prompting - we're using token in URL
    // This prevents Git from trying to prompt for password interactively
    execSync('git config credential.helper ""', { cwd: wikiDir });
    execSync('git config credential.helper store', { cwd: wikiDir });
    
    // Check if there are changes
    try {
      execSync('git diff --quiet', { cwd: wikiDir });
      console.log('[INFO]  No changes to commit');
      return true;
    } catch {
      // There are changes, proceed with commit
    }
    
    // Add all files
    execSync('git add -A', { cwd: wikiDir, stdio: 'inherit' });
    
    // Commit
    const commitMessage = `docs: migrate all documentation from main repository

One-time migration of all documentation files to the wiki.
Wiki is now the single source of truth for documentation.
Generated by migrate-wiki script at ${new Date().toISOString()}`;
    
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { 
      cwd: wikiDir, 
      stdio: 'inherit' 
    });
    
    // Push using token in URL - GITHUB_TOKEN has automatic wiki permissions
    const authUrl = WIKI_REPO_URL.replace('https://', `https://${token}@`);
    // Update remote URL with token
    execSync(`git remote set-url origin ${authUrl}`, { cwd: wikiDir });
    
    // Use GIT_TERMINAL_PROMPT=0 to prevent any interactive prompts
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    execSync('git push origin master', { 
      cwd: wikiDir, 
      stdio: 'inherit',
      env
    });
    
    console.log('[SUCCESS] Pushed changes to wiki');
    return true;
  } catch (error) {
    console.error(`[ERROR] Error committing/pushing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('[DEPLOY] Starting documentation migration to wiki...\n');
  console.log('[NOTE] This will move ALL documentation files to the wiki.\n');
  
  const token = getGitHubToken();
  const wikiDir = join(rootDir, '.wiki-temp');
  
  try {
    // Find all markdown files
    console.log('[EMOJI] Finding markdown files...');
    const allFiles: string[] = [];
    
    for (const dir of DOC_DIRS) {
      const fullPath = join(rootDir, dir);
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        const files = findMarkdownFiles(fullPath);
        allFiles.push(...files);
        console.log(`   Found ${files.length} files in ${dir}`);
      }
    }
    
    console.log(`\n[NOTE] Processing ${allFiles.length} files...`);
    console.log(`   (Files will be organized by category and deduplicated)\n`);
    
    // Clone wiki repo
    cloneWikiRepo(wikiDir, token);
    console.log('');
    
    // Copy documentation files (with sorting and deduplication)
    // This returns category map for navigation generation
    const { copied, categoryMap } = copyDocsToWiki(allFiles, wikiDir);
    console.log(`\n[CLIPBOARD] Copied ${copied} files to wiki\n`);
    
    // Create navigation files
    console.log('[EMOJI] Creating navigation files...\n');
    createCategoryIndexPages(wikiDir, categoryMap);
    console.log('');
    createSidebar(wikiDir, categoryMap);
    createFooter(wikiDir);
    console.log('');
    createHomePage(wikiDir, categoryMap);
    console.log('');
    
    // Commit and push
    const success = commitAndPush(wikiDir, token);
    
    if (success) {
      console.log(`\n[FEATURE] Migration complete!`);
      console.log(`[EMOJI] View your wiki at: https://github.com/${REPO_OWNER}/${REPO_NAME}/wiki`);
      console.log(`\n[CLIPBOARD] Next steps:`);
      console.log(`   1. Review the wiki to ensure all files migrated correctly`);
      console.log(`   2. Update any code references to point to wiki pages`);
      console.log(`   3. Consider removing migrated docs from codebase (keep only README.md)`);
      console.log(`   4. Update your workflow to maintain docs in wiki going forward`);
    } else {
      console.error('\n[ERROR] Migration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('[ERROR] Fatal error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (existsSync(wikiDir)) {
      console.log('\n[EMOJI] Cleaning up temporary files...');
      rmSync(wikiDir, { recursive: true, force: true });
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('[ERROR] Fatal error:', error);
    process.exit(1);
  });
}

