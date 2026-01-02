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
 *   GITHUB_TOKEN=your_token node scripts/migrate-wiki.js
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

/**
 * Get GitHub token from environment
 */
function getGitHubToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('✗ GITHUB_TOKEN environment variable is required');
    console.error('   Get a token from: https://github.com/settings/tokens');
    console.error('   Required scopes: repo (for private repos) or public_repo (for public repos)');
    process.exit(1);
  }
  return token;
}

/**
 * Find all markdown files in a directory recursively
 */
function findMarkdownFiles(dir, baseDir = rootDir) {
  const files = [];
  
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
    console.warn(`⚠ Skipping ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return files;
}

/**
 * Convert file path to wiki page name (URL-friendly)
 * GitHub wikis use the filename as the page name
 */
function pathToWikiName(filePath) {
  const relativePath = relative(rootDir, filePath);
  const withoutExt = relativePath.replace(/\.md$/, '');
  
  // Convert to wiki page name
  // GitHub wikis use the filename, so we'll preserve directory structure as part of the name
  return withoutExt
    .replace(/[/\\]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Fix relative links in markdown content for wiki context
 */
function fixWikiLinks(content, currentPath) {
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
function cloneWikiRepo(wikiDir, token) {
  // CRITICAL: GitHub requires x-access-token:TOKEN format, not just TOKEN@
  // This is the ONLY format that works for GitHub Actions GITHUB_TOKEN
  const authUrl = WIKI_REPO_URL.replace('https://', `https://x-access-token:${token}@`);
  
  // Set environment variables to prevent any interactive prompts
  const env = { 
    ...process.env, 
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: 'echo',
    GIT_SSH_COMMAND: 'ssh -o BatchMode=yes'
  };
  
  if (existsSync(wikiDir)) {
    console.log('ℹ Updating existing wiki repository...');
    try {
      // Update remote URL with token before pulling
      execSync(`git remote set-url origin ${authUrl}`, { cwd: wikiDir });
      // Configure git to prevent credential prompts
      execSync('git config --local credential.helper ""', { cwd: wikiDir });
      execSync('git config --local core.askPass ""', { cwd: wikiDir });
      execSync('git pull', { cwd: wikiDir, stdio: 'inherit', env });
    } catch (error) {
      console.warn('⚠ Could not pull, will clone fresh...');
      rmSync(wikiDir, { recursive: true, force: true });
      execSync(`git clone ${authUrl} "${wikiDir}"`, { stdio: 'inherit', env });
    }
  } else {
    console.log('ℹ Cloning wiki repository...');
    mkdirSync(dirname(wikiDir), { recursive: true });
    execSync(`git clone ${authUrl} "${wikiDir}"`, { stdio: 'inherit', env });
  }
}

/**
 * Copy documentation files to wiki directory
 */
function copyDocsToWiki(sourceFiles, wikiDir) {
  let copied = 0;
  
  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const wikiName = pathToWikiName(file);
      const fixedContent = fixWikiLinks(content, file);
      const wikiFilePath = join(wikiDir, `${wikiName}.md`);
      
      // Ensure directory exists
      mkdirSync(dirname(wikiFilePath), { recursive: true });
      
      // Write file
      writeFileSync(wikiFilePath, fixedContent, 'utf-8');
      console.log(`✓ Copied: ${wikiName}.md`);
      copied++;
    } catch (error) {
      console.error(`✗ Error copying ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return copied;
}

/**
 * Create Home page from main README
 */
function createHomePage(wikiDir) {
  try {
    const readmePath = join(rootDir, 'README.md');
    const readmeContent = readFileSync(readmePath, 'utf-8');
    
    const homeContent = `# Welcome to Strixun Stream Suite Documentation

${readmeContent}

---

## ★ Documentation Index

All documentation has been automatically migrated from the codebase to this wiki. Browse the pages on the right sidebar to explore:

- **Getting Started** - Setup and quick start guides
- **Architecture** - System design and technical architecture
- **API Documentation** - Complete API reference
- **Services** - Individual service documentation
- **Development** - Development guides and best practices
- **Deployment** - Deployment and operations
- **Security** - Security documentation
- **Guides** - How-to guides and tutorials
- **Reference** - Technical reference and specifications
- **Product Documentation** - Product overview and business docs

---

*This wiki is the single source of truth for documentation. All documentation files have been migrated from the codebase.*
`;

    const homePath = join(wikiDir, 'Home.md');
    writeFileSync(homePath, homeContent, 'utf-8');
    console.log('✓ Created: Home.md');
  } catch (error) {
    console.error(`✗ Error creating home page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Commit and push changes to wiki
 */
function commitAndPush(wikiDir, token) {
  try {
    // Configure git
    execSync('git config user.name "GitHub Actions Bot"', { cwd: wikiDir });
    execSync('git config user.email "actions@github.com"', { cwd: wikiDir });
    
    // Configure git to handle line endings properly
    execSync('git config core.autocrlf false', { cwd: wikiDir });
    
    // CRITICAL: Disable all credential prompting and helpers
    // This prevents Git from trying to prompt for password interactively
    execSync('git config --local credential.helper ""', { cwd: wikiDir });
    execSync('git config --local credential.helper store', { cwd: wikiDir });
    execSync('git config --local core.askPass ""', { cwd: wikiDir });
    
    // Add all files first (including untracked)
    execSync('git add -A', { cwd: wikiDir, stdio: 'inherit' });
    
    // Check if there are actually changes to commit (after adding)
    try {
      execSync('git diff --cached --quiet', { cwd: wikiDir });
      console.log('ℹ No changes to commit (files may already be in wiki)');
      return true;
    } catch {
      // There are changes staged, proceed with commit
    }
    
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
    // CRITICAL: GitHub requires x-access-token:TOKEN format, not just TOKEN@
    // This is the ONLY format that works for GitHub Actions GITHUB_TOKEN
    const authUrl = WIKI_REPO_URL.replace('https://', `https://x-access-token:${token}@`);
    
    // Update remote URL with token before pushing
    execSync(`git remote set-url origin ${authUrl}`, { cwd: wikiDir });
    
    // Set environment variables to prevent any interactive prompts
    const env = { 
      ...process.env, 
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo',
      GIT_SSH_COMMAND: 'ssh -o BatchMode=yes'
    };
    
    // Try to determine the default branch (could be master or main)
    let defaultBranch = 'master';
    try {
      const branchOutput = execSync('git branch -r', { cwd: wikiDir, encoding: 'utf-8' });
      if (branchOutput.includes('origin/main')) {
        defaultBranch = 'main';
      }
    } catch {
      // Default to master if we can't determine
    }
    
    // Push to the determined branch
    execSync(`git push origin ${defaultBranch}`, { 
      cwd: wikiDir, 
      stdio: 'inherit',
      env
    });
    
    console.log('✓ Pushed changes to wiki');
    return true;
  } catch (error) {
    console.error(`✗ Error committing/pushing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('ℹ Starting documentation migration to wiki...\n');
  console.log('ℹ This will move ALL documentation files to the wiki.\n');
  
  const token = getGitHubToken();
  const wikiDir = join(rootDir, '.wiki-temp');
  
  try {
    // Find all markdown files
    console.log('ℹ Finding markdown files...');
    const allFiles = [];
    
    for (const dir of DOC_DIRS) {
      const fullPath = join(rootDir, dir);
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        const files = findMarkdownFiles(fullPath);
        allFiles.push(...files);
        console.log(`   Found ${files.length} files in ${dir}`);
      }
    }
    
    console.log(`\nℹ Processing ${allFiles.length} files...\n`);
    
    // Clone wiki repo
    cloneWikiRepo(wikiDir, token);
    console.log('');
    
    // Create home page
    createHomePage(wikiDir);
    console.log('');
    
    // Copy documentation files
    const copied = copyDocsToWiki(allFiles, wikiDir);
    console.log(`\nℹ Copied ${copied} files to wiki\n`);
    
    // Commit and push
    const success = commitAndPush(wikiDir, token);
    
    if (success) {
      console.log(`\n✓ Migration complete!`);
      console.log(`ℹ View your wiki at: https://github.com/${REPO_OWNER}/${REPO_NAME}/wiki`);
      console.log(`\nℹ Next steps:`);
      console.log(`   1. Review the wiki to ensure all files migrated correctly`);
      console.log(`   2. Update any code references to point to wiki pages`);
      console.log(`   3. Consider removing migrated docs from codebase (keep only README.md)`);
      console.log(`   4. Update your workflow to maintain docs in wiki going forward`);
    } else {
      console.error('\n✗ Migration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Fatal error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (existsSync(wikiDir)) {
      console.log('\nℹ Cleaning up temporary files...');
      rmSync(wikiDir, { recursive: true, force: true });
    }
  }
}

// Run if called directly
main().catch(error => {
  console.error('✗ Fatal error:', error);
  process.exit(1);
});

