#!/bin/bash

# Script to merge Dependabot PRs
cd /Users/alflewerken/Desktop/web-appliance-dashboard

echo "Fetching latest changes..."
git fetch origin

# First, rebase PR #19 (it's outdated)
echo "Rebasing PR #19..."
git fetch origin pull/19/head:pr-19
git checkout pr-19
git rebase main
git push --force-with-lease origin pr-19:dependabot/npm_and_yarn/frontend/copy-webpack-plugin-13.0.0

# Merge PR #19
echo "Merging PR #19..."
git checkout main
git pull origin main
gh pr merge 19 --squash --auto

# Merge PR #20
echo "Merging PR #20..."
git pull origin main
gh pr merge 20 --squash --auto

# Merge PR #21
echo "Merging PR #21..."
git pull origin main
gh pr merge 21 --squash --auto

echo "All PRs merged successfully!"
git pull origin main
