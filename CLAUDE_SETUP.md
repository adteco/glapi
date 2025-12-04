# Claude Code Infrastructure - Setup Guide

**Last Updated:** 2025-11-07

This document provides a complete guide to the Claude Code infrastructure configured for the fredpope-blog project.

---

## 📋 Overview

This is a Next.js 15 blog with AI-powered features, built with:
- **Next.js 15.1.4** with App Router + **React RC**
- **TypeScript** with path aliases
- **Tailwind CSS 3.4.3** for styling
- **Contentlayer2** for type-safe MDX content management
- **Pliny** for blog utilities (analytics, comments, newsletter)
- **AI Integration**: Google Generative AI, Langchain, Pinecone

---

## 🎯 Current Claude Code Setup

### Configuration Status

**Minimal Configuration** - Currently only basic settings are configured:
- `.claude/settings.local.json` - Basic Claude Code settings
- No custom skills defined yet
- No custom hooks configured
- No slash commands set up

### Tech Stack Summary

**Frontend:**
- Next.js 15.1.4 (App Router)
- React RC (release candidate)
- TypeScript with strict mode
- Tailwind CSS 3.4.3
- Headless UI components

**Content Management:**
- Contentlayer2 for MDX processing
- Gray Matter for frontmatter parsing
- Rehype/Remark plugins for markdown processing
- KaTeX for math rendering
- Prism+ for code syntax highlighting

**AI Features:**
- Google Generative AI (@google/generative-ai)
- Langchain for AI orchestration
- Pinecone for vector database

**Blog Utilities (Pliny):**
- Posthog analytics
- Giscus comments system
- Buttondown newsletter integration
- Kbar command palette search

**Development:**
- ESLint + Prettier
- Husky for git hooks
- lint-staged for pre-commit linting
- Bundle analyzer for optimization

---

## 📁 Project Structure

```
fredpope-blog/
├── app/                        # Next.js App Router pages
├── components/                 # React components
├── layouts/                    # Blog post layouts (PostLayout, PostSimple, PostBanner)
├── lib/                        # Utility functions
├── data/
│   ├── blog/                   # MDX blog posts organized by category
│   ├── authors/                # Author profiles in MDX
│   └── siteMetadata.js         # Site-wide configuration
├── public/static/              # Static assets (images, favicons)
├── scripts/
│   ├── prepareBlogContent.ts   # Content preparation script
│   └── postbuild.mjs           # Post-build processing
├── .claude/
│   └── settings.local.json     # Claude Code settings
├── CLAUDE.md                   # Instructions for Claude Code
└── CLAUDE_SETUP.md            # This file
```

---

## 🚀 Development Commands

### Development
```bash
yarn dev                    # Start dev server at localhost:3000
yarn lint                   # Run ESLint with auto-fix
yarn build && yarn serve    # Test production build locally
yarn analyze               # Build with bundle size analysis
```

### Content Management
```bash
yarn prepare-blog-content   # TypeScript script for blog content preparation
```

### Build & Deployment
```bash
yarn build                  # Production build (includes postbuild script)
EXPORT=1 UNOPTIMIZED=1 yarn build  # Static export for GitHub Pages/S3
```

---

## 📝 Content Architecture

### Blog Posts
- Location: `/data/blog/`
- Format: MDX with frontmatter
- Required fields: title, date, tags
- Optional: layout (PostLayout, PostSimple, PostBanner), images, draft status

### Authors
- Location: `/data/authors/`
- Format: MDX profiles
- Linked to posts via frontmatter

### Layouts
- `PostLayout` - Default blog post layout
- `PostSimple` - Minimal layout
- `PostBanner` - Hero image layout

### Features
- Automatic tag extraction and tag pages
- Image optimization with next/image
- Math rendering with KaTeX
- Code syntax highlighting with rehype-prism-plus
- Search via Kbar command palette

---

## 🎓 Working with This Codebase

### Adding Blog Posts

1. Create MDX file in `/data/blog/[category]/`
2. Add required frontmatter:
```mdx
---
title: 'Your Post Title'
date: '2025-11-07'
tags: ['nextjs', 'tailwind', 'typescript']
draft: false
summary: 'Brief description'
---

Your content here...
```

### Styling Components

Use Tailwind utility classes:
```tsx
import { cn } from '@/lib/utils'

export function Component({ className }) {
  return (
    <div className={cn('flex items-center gap-4 p-4', className)}>
      {/* content */}
    </div>
  )
}
```

### AI Integration

The blog includes AI chat functionality:
- Google Generative AI for LLM
- Langchain for orchestration
- Pinecone for vector storage
- Located in chat/AI-related components

---

## 🔧 Potential Claude Code Enhancements

While the current setup is minimal, here are recommended skills that could be added:

### 1. blog-content-manager
**Purpose:** Assist with MDX blog post creation and management
- MDX frontmatter templates
- Image optimization guidance
- Tag management
- Content structure validation

### 2. nextjs-app-router-guidelines
**Purpose:** Next.js 15 App Router patterns
- Server/Client Component patterns
- Route handlers
- Metadata API
- Streaming and Suspense

### 3. tailwind-styling-helper
**Purpose:** Tailwind CSS utility patterns
- Responsive design patterns
- Dark mode with next-themes
- Component styling conventions
- Tailwind plugin usage

### 4. contentlayer-helper
**Purpose:** Contentlayer MDX processing
- Schema definitions
- Computed fields
- Content validation
- Remark/Rehype plugin configuration

### 5. ai-integration-helper
**Purpose:** AI features (Langchain, Pinecone, Google AI)
- Vector database operations
- LLM prompt engineering
- Langchain chain patterns
- AI feature implementation

---

## 📚 Key Files to Understand

**Configuration:**
- `data/siteMetadata.js` - Site-wide settings (title, author, social links, analytics)
- `contentlayer.config.ts` - Content processing configuration
- `tailwind.config.js` - Tailwind customization
- `next.config.js` - Next.js configuration

**Content Processing:**
- `scripts/prepareBlogContent.ts` - Content preparation
- `scripts/postbuild.mjs` - Post-build processing (search indexing, RSS generation)

**Important Patterns:**
- All blog posts use MDX with frontmatter
- Layouts specified in frontmatter
- TypeScript path aliases: `@/components`, `@/lib`, etc.
- Content changes require server restart
- ESLint runs on pre-commit via Husky

---

## 🎯 Best Practices

1. **Content Management**
   - Always include required frontmatter fields (title, date, tags)
   - Use draft: true for work-in-progress posts
   - Organize posts by category in subdirectories
   - Optimize images before adding to /public/static/

2. **Code Style**
   - Use TypeScript path aliases
   - Follow ESLint rules (auto-fixed on commit)
   - Use Prettier for formatting (Tailwind class sorting enabled)
   - Prefer Tailwind utilities over custom CSS

3. **Component Development**
   - Mark client components with 'use client' directive
   - Use next/image for all images
   - Implement proper TypeScript types
   - Keep bundle size in mind (~85kB first load target)

4. **AI Features**
   - Use environment variables for API keys
   - Implement proper error handling
   - Consider rate limiting for AI endpoints
   - Cache responses when appropriate

---

## 🔄 Git Workflow

Current branch: **new-layout**
Main branch: **main**

**Pre-commit Hooks (Husky):**
- ESLint with auto-fix on staged files
- Configured via lint-staged

**Branch Status:** Clean working directory

---

## 📊 Metrics

**Current Status:**
- Claude Code Configuration: Minimal (basic settings only)
- Custom Skills: 0 defined (5 recommended above)
- Custom Hooks: 0 configured
- Slash Commands: 0 defined
- Tech Stack: Production-ready Next.js 15 blog

**Bundle Size Target:** ~85kB first load JS

---

## ✅ Quick Reference

### When Working on Frontend
- Check CLAUDE.md for architecture overview
- Use Tailwind utilities for styling
- Follow Next.js 15 App Router patterns
- Ensure TypeScript type safety

### When Working on Content
- MDX files in `/data/blog/`
- Required frontmatter: title, date, tags
- Restart dev server to see content changes
- Run `yarn prepare-blog-content` if needed

### When Working on AI Features
- Google Generative AI for LLM
- Langchain for orchestration
- Pinecone for vector storage
- Check environment variables configuration

---

## 🆘 Troubleshooting

### Content Not Showing?
1. Check frontmatter syntax
2. Ensure required fields present (title, date, tags)
3. Verify file is not marked as draft
4. Restart dev server

### Build Errors?
1. Run `yarn lint` to check for ESLint errors
2. Check TypeScript errors with `tsc --noEmit`
3. Verify all imports use correct path aliases
4. Clear `.next` cache and rebuild

### Bundle Size Issues?
1. Run `yarn analyze` to inspect bundle
2. Check for unnecessary imports
3. Ensure proper code splitting
4. Use dynamic imports for heavy components

---

## 📖 Additional Documentation

**Project Documentation:**
- `CLAUDE.md` - Claude Code instructions (commands, architecture, patterns)
- `README.md` - Project overview and setup
- `/data/siteMetadata.js` - Site configuration

**External Resources:**
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Contentlayer Documentation](https://contentlayer.dev)
- [Pliny Documentation](https://github.com/timlrx/pliny)
- [Tailwind CSS Documentation](https://tailwindcss.com)

---

For questions about this setup or to enhance Claude Code configuration, refer to the recommended skills section above or consult CLAUDE.md for architecture details.
