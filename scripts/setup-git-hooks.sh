#!/bin/bash

# Setup Git hooks and commit template for GLAPI

echo "🔧 Setting up Git hooks and commit template..."

# Set up pre-commit hook
if [ -f .git/hooks/pre-commit ]; then
    echo "⚠️  Pre-commit hook already exists. Backing up to .git/hooks/pre-commit.backup"
    mv .git/hooks/pre-commit .git/hooks/pre-commit.backup
fi

echo "📎 Linking pre-commit hook..."
ln -sf ../../scripts/precommit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Set up commit message template
echo "📝 Setting up commit message template..."
git config --local commit.template .gitmessage

# Set up other useful git configs
echo "⚙️  Setting up additional git configurations..."

# Use VS Code as default editor (change if you prefer something else)
git config --local core.editor "code --wait"

# Enable colored output
git config --local color.ui true

# Set up helpful aliases
git config --local alias.st "status -sb"
git config --local alias.ll "log --oneline -10"
git config --local alias.last "log -1 HEAD --stat"
git config --local alias.cm "commit -m"
git config --local alias.rv "remote -v"
git config --local alias.d "diff"
git config --local alias.dc "diff --cached"
git config --local alias.br "branch"
git config --local alias.co "checkout"

echo ""
echo "✅ Git hooks and configurations set up successfully!"
echo ""
echo "📋 What was configured:"
echo "  - Pre-commit hook: Runs linting, type checking, and security checks"
echo "  - Commit template: Helps write consistent commit messages"
echo "  - Git aliases: st, ll, last, cm, rv, d, dc, br, co"
echo ""
echo "💡 Usage tips:"
echo "  - Run 'pnpm precommit' to manually check your code"
echo "  - The pre-commit hook will run automatically on 'git commit'"
echo "  - Use 'git commit --no-verify' to skip hooks (not recommended)"
echo "  - Your commit editor will open with a template"
echo ""
echo "🚀 Happy committing!"