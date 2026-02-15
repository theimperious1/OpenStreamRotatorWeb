#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# setup-https.sh — Install nginx + certbot and configure HTTPS
# for OpenStreamRotator Web.
#
# Usage:
#   sudo bash setup-https.sh <domain>
#
# Example:
#   sudo bash setup-https.sh supreme-one.net
# ──────────────────────────────────────────────────────────────

set -euo pipefail

DOMAIN="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$DOMAIN" ]; then
    echo "Usage: sudo bash setup-https.sh <domain>"
    echo "Example: sudo bash setup-https.sh supreme-one.net"
    exit 1
fi

if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)."
    exit 1
fi

echo "================================================"
echo "  OpenStreamRotator Web — HTTPS Setup"
echo "  Domain: $DOMAIN"
echo "================================================"
echo

# ── 1. Install nginx and certbot ──
echo "[1/5] Installing nginx and certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx > /dev/null 2>&1
echo "  ✓ nginx and certbot installed"

# ── 2. Create certbot webroot ──
echo "[2/5] Creating certbot webroot..."
mkdir -p /var/www/certbot
echo "  ✓ /var/www/certbot created"

# ── 3. Copy nginx config (replace domain) ──
echo "[3/5] Configuring nginx..."
NGINX_CONF="/etc/nginx/sites-available/osr-web"
sed "s/supreme-one.net/$DOMAIN/g" "$SCRIPT_DIR/nginx.conf" > "$NGINX_CONF"

# Create symlink
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/osr-web

# Remove default site if it exists (it would conflict on port 80)
rm -f /etc/nginx/sites-enabled/default

echo "  ✓ Nginx configured for $DOMAIN"

# ── 4. Get SSL certificate ──
echo "[4/5] Obtaining Let's Encrypt certificate..."
echo "  This will briefly start nginx on port 80 for the ACME challenge."
echo

# Temporarily comment out the SSL server block so nginx can start without certs
# We'll use certbot's nginx plugin which handles this automatically
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --redirect --email "admin@$DOMAIN" \
    --cert-name "$DOMAIN" || {
    echo
    echo "  ⚠ Certbot failed. Common issues:"
    echo "    - Port 80 must be open and reachable from the internet"
    echo "    - DNS for $DOMAIN must point to this server's public IP"
    echo "    - If running behind a firewall/NAT, forward ports 80 and 443"
    echo
    echo "  You can retry manually with:"
    echo "    sudo certbot --nginx -d $DOMAIN"
    exit 1
}
echo "  ✓ SSL certificate obtained for $DOMAIN"

# ── 5. Reload nginx ──
echo "[5/5] Reloading nginx..."
nginx -t
systemctl reload nginx
systemctl enable nginx
echo "  ✓ Nginx is running with HTTPS"

echo
echo "================================================"
echo "  ✓ HTTPS setup complete!"
echo "================================================"
echo
echo "Your site is now available at: https://$DOMAIN"
echo
echo "Next steps:"
echo "  1. Update your backend .env:"
echo "       DISCORD_REDIRECT_URI=https://$DOMAIN/api/auth/discord/callback"
echo "       FRONTEND_URL=https://$DOMAIN"
echo "       ALLOWED_ORIGINS=https://$DOMAIN"
echo
echo "  2. Update your frontend .env.local:"
echo "       NEXT_PUBLIC_SITE_URL=https://$DOMAIN"
echo "       NEXT_PUBLIC_API_URL=https://$DOMAIN/api"
echo
echo "  3. Update Discord Developer Portal:"
echo "       OAuth2 Redirect URI → https://$DOMAIN/api/auth/discord/callback"
echo
echo "  4. Restart your frontend and backend services."
echo
echo "Certificate auto-renewal is handled by certbot's systemd timer."
echo "Check with: sudo certbot renew --dry-run"
echo
