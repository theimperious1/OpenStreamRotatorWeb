# OpenStreamRotator Web — Nginx + Let's Encrypt HTTPS Setup
#
# This directory contains everything needed to put the dashboard behind
# HTTPS using nginx as a reverse proxy and Let's Encrypt (certbot) for
# free, auto-renewing TLS certificates.
#
# Prerequisites:
#   - A Linux server (Ubuntu/Debian recommended) with ports 80 and 443 open
#   - A domain name (e.g. openstreamrotator.com) pointed at the server's public IP
#   - The frontend running on port 3000
#   - The backend running on port 8000
#
# Quick Start:
#   1. Copy this folder to your server
#   2. Edit nginx.conf and replace openstreamrotator.com with your domain
#   3. Run: sudo bash setup-https.sh openstreamrotator.com
#   4. Update your .env files (see below)
#
# After setup, update your environment variables:
#
#   Backend .env:
#     DISCORD_REDIRECT_URI=https://openstreamrotator.com/api/auth/discord/callback
#     FRONTEND_URL=https://openstreamrotator.com
#     ALLOWED_ORIGINS=https://openstreamrotator.com
#
#   Frontend .env.local:
#     NEXT_PUBLIC_SITE_URL=https://openstreamrotator.com
#     NEXT_PUBLIC_API_URL=https://openstreamrotator.com/api
#
#   Discord Developer Portal:
#     Update your OAuth2 redirect URI to:
#     https://openstreamrotator.com/api/auth/discord/callback
