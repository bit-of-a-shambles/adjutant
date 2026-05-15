#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║     Adjutant Setup Script            ║"
echo "╚══════════════════════════════════════╝"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Check for mise
if ! command -v mise &>/dev/null; then
  echo "ERROR: mise is required. Install from https://mise.jdx.dev"
  echo "  curl https://mise.jdx.dev/install.sh | sh"
  exit 1
fi

# Install tools via mise
echo "Installing Ruby and Node via mise..."
mise install

echo "Ruby version: $(ruby --version)"
echo "Node version: $(node --version)"

# Check for SuperWhisper
if ! ls /Applications/SuperWhisper*.app &>/dev/null 2>&1; then
  echo "WARNING: SuperWhisper not found in /Applications."
  echo "  Voice input requires SuperWhisper: https://superwhisper.com"
  echo "  Install it and ensure it's running in the menu bar."
fi

# Install Ruby dependencies
echo "Installing backend dependencies..."
bundle install

# Install Node.js dependencies
echo "Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"
npm install

echo ""
echo "Setup complete! Run 'rake start' to launch Adjutant."
