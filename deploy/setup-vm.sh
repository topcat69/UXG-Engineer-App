#!/usr/bin/env bash
# One-time VM bootstrap for the split-hosting deploy (see DECISIONS.md's deploy addendum).
# Run once, as root, on a fresh Ubuntu/Debian VM. Everything after this is
# handled by .github/workflows/deploy.yml on every push to main.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/topcat69/UXG-Engineer-App.git}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/uxg-engineer-app}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

echo "==> Installing Docker Engine + Compose plugin"
curl -fsSL https://get.docker.com | sh

echo "==> Creating '$DEPLOY_USER' user (no login shell needed beyond SSH+docker)"
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

echo "==> Cloning $REPO_URL into $DEPLOY_PATH"
if [ ! -d "$DEPLOY_PATH/.git" ]; then
  git clone --branch main "$REPO_URL" "$DEPLOY_PATH"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"

if [ ! -f "$DEPLOY_PATH/.env.production" ]; then
  echo "==> Seeding .env.production from .env.example — fill in the real values before continuing"
  cp "$DEPLOY_PATH/.env.example" "$DEPLOY_PATH/.env.production"
  {
    echo ""
    echo "# Not in .env.example — see DECISIONS.md's deploy addendum."
    echo "NEXT_PUBLIC_SENTRY_DSN=\"\""
  } >> "$DEPLOY_PATH/.env.production"
fi

if command -v ufw &>/dev/null; then
  echo "==> Restricting the firewall to SSH/HTTP/HTTPS"
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

cat <<EOF

==> Bootstrap done. Remaining manual steps:
  1. Edit $DEPLOY_PATH/.env.production with real values (Supabase, Resend,
     Monday.com, WEBHOOK_SHARED_SECRET, ICS_FEED_SECRET, ...).
  2. Edit $DEPLOY_PATH/Caddyfile with your real domain.
  3. Point that domain's DNS A record at this VM's IP.
  4. Generate an SSH keypair for CI deploys and authorize the public half
     for '$DEPLOY_USER':
       ssh-keygen -t ed25519 -f deploy_key -N ""
       su - $DEPLOY_USER -c 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys' < deploy_key.pub
     Then add DEPLOY_HOST / DEPLOY_USER / DEPLOY_SSH_KEY (the private half)
     as GitHub Actions secrets on the repo.
  5. First deploy, run as '$DEPLOY_USER' from $DEPLOY_PATH:
       docker compose --env-file .env.production up -d --build
  6. Set up the cron schedule and pg_net webhook URL — see DECISIONS.md's
     deploy addendum, neither of those has a self-hosted equivalent yet.

EOF
