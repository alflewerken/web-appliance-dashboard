#!/bin/bash

# Update Local Development Repository
# Dieses Script hält dein lokales Repository auf dem neuesten Stand

set -e

echo "🔄 Updating local repository..."
echo "================================"

# Farben für bessere Lesbarkeit
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ] || [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in project root directory${NC}"
    exit 1
fi

# Aktuelle Branch speichern
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Current branch: ${CURRENT_BRANCH}${NC}"

# Prüfe auf uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    echo "Files with changes:"
    git status --short
    echo ""
    read -p "Do you want to stash these changes? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash push -m "Auto-stash before update $(date +%Y-%m-%d_%H:%M:%S)"
        echo -e "${GREEN}✅ Changes stashed${NC}"
        STASHED=true
    else
        echo -e "${RED}❌ Aborted. Please commit or stash your changes first.${NC}"
        exit 1
    fi
fi

# Fetch latest changes
echo -e "\n${BLUE}📥 Fetching latest changes from origin...${NC}"
git fetch origin --prune

# Update main branch
echo -e "\n${BLUE}🔄 Updating main branch...${NC}"
git checkout main
git pull origin main

# Zeige Dependabot PRs
echo -e "\n${BLUE}🤖 Dependabot Pull Requests:${NC}"
echo "================================"

# Liste alle Dependabot branches
DEPENDABOT_BRANCHES=$(git branch -r | grep "origin/dependabot" | sed 's/origin\///' || true)

if [ -z "$DEPENDABOT_BRANCHES" ]; then
    echo "No Dependabot PRs found"
else
    # Zähle die PRs nach Typ
    DOCKER_COUNT=$(echo "$DEPENDABOT_BRANCHES" | grep -c "docker" || true)
    NPM_COUNT=$(echo "$DEPENDABOT_BRANCHES" | grep -c "npm_and_yarn" || true)
    ACTIONS_COUNT=$(echo "$DEPENDABOT_BRANCHES" | grep -c "github_actions" || true)
    
    echo -e "${GREEN}📦 Docker updates: ${DOCKER_COUNT}${NC}"
    echo -e "${GREEN}📦 NPM updates: ${NPM_COUNT}${NC}"
    echo -e "${GREEN}📦 GitHub Actions updates: ${ACTIONS_COUNT}${NC}"
    
    echo -e "\n${YELLOW}To review and merge Dependabot PRs:${NC}"
    echo "1. Go to: https://github.com/alflewerken/web-appliance-dashboard/pulls"
    echo "2. Review each PR"
    echo "3. Merge if tests pass"
    echo "4. Run this script again to pull merged changes"
fi

# Update npm dependencies für lokale Entwicklung
echo -e "\n${BLUE}📦 Updating npm dependencies...${NC}"
echo "================================"

# Backend dependencies
if [ -d "backend" ]; then
    echo -e "${BLUE}Backend:${NC}"
    cd backend
    npm install
    cd ..
    echo -e "${GREEN}✅ Backend dependencies updated${NC}"
fi

# Frontend dependencies  
if [ -d "frontend" ]; then
    echo -e "${BLUE}Frontend:${NC}"
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}✅ Frontend dependencies updated${NC}"
fi

# Terminal-app dependencies
if [ -d "terminal-app" ]; then
    echo -e "${BLUE}Terminal-app:${NC}"
    cd terminal-app
    npm install
    cd ..
    echo -e "${GREEN}✅ Terminal-app dependencies updated${NC}"
fi

# Docker images update
echo -e "\n${BLUE}🐳 Docker images...${NC}"
echo "================================"
read -p "Do you want to pull latest Docker images? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose pull
    echo -e "${GREEN}✅ Docker images updated${NC}"
fi

# Zurück zur ursprünglichen Branch
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "\n${BLUE}🔄 Switching back to ${CURRENT_BRANCH}...${NC}"
    git checkout "$CURRENT_BRANCH"
    
    # Rebase auf main wenn gewünscht
    read -p "Do you want to rebase ${CURRENT_BRANCH} on main? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git rebase main
        echo -e "${GREEN}✅ Branch rebased on main${NC}"
    fi
fi

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo -e "\n${BLUE}📋 Restoring stashed changes...${NC}"
    git stash pop
    echo -e "${GREEN}✅ Changes restored${NC}"
fi

echo -e "\n${GREEN}✅ Update complete!${NC}"
echo "================================"

# Zeige Status
echo -e "\n${BLUE}Current status:${NC}"
git status --short

# Container neu bauen wenn Änderungen vorhanden
if [ -f "scripts/build.sh" ]; then
    echo -e "\n${YELLOW}💡 Tip: If there were updates, rebuild containers with:${NC}"
    echo "   ./scripts/build.sh --refresh"
fi
