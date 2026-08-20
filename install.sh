#!/bin/sh
# Instalador de qvapay: descarga el binario del último Release, verifica su
# SHA256 contra SHA256SUMS y lo coloca en ~/.local/bin (o /usr/local/bin).
#
# Uso:   curl -fsSL https://raw.githubusercontent.com/qvapay/qvapay-cli/master/install.sh | sh
# Lee el script antes de correrlo (curl | sh a ciegas es antipatrón).
set -eu

REPO="qvapay/qvapay-cli"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Linux)  os=linux ;;
  Darwin) os=darwin ;;
  *) echo "SO no soportado: $os (usa npm: npm i -g qvapay)" >&2; exit 1 ;;
esac
case "$arch" in
  x86_64|amd64) arch=x64 ;;
  arm64|aarch64) arch=arm64 ;;
  *) echo "Arquitectura no soportada: $arch" >&2; exit 1 ;;
esac
asset="qvapay-${os}-${arch}"

# Último tag publicado (sin depender de la API con token).
tag="$(curl -fsSL -o /dev/null -w '%{url_effective}' \
  "https://github.com/${REPO}/releases/latest" | sed 's#.*/tag/##')"
[ -n "$tag" ] || { echo "No pude resolver el último Release" >&2; exit 1; }
base="https://github.com/${REPO}/releases/download/${tag}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "Descargando $asset ($tag)…" >&2
curl -fsSL "$base/$asset" -o "$tmp/$asset"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS"

# Verifica el checksum antes de instalar nada.
want="$(grep " $asset\$" "$tmp/SHA256SUMS" | awk '{print $1}')"
[ -n "$want" ] || { echo "No hay checksum para $asset en SHA256SUMS" >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then
  got="$(sha256sum "$tmp/$asset" | awk '{print $1}')"
else
  got="$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')"
fi
[ "$want" = "$got" ] || { echo "Checksum inválido para $asset (esperado $want, obtenido $got)" >&2; exit 1; }

# Destino: ~/.local/bin si es escribible/creable, si no /usr/local/bin.
dest="$HOME/.local/bin"
mkdir -p "$dest" 2>/dev/null || dest="/usr/local/bin"
install -m 755 "$tmp/$asset" "$dest/qvapay"
echo "✓ qvapay instalado en $dest/qvapay" >&2
case ":$PATH:" in
  *":$dest:"*) ;;
  *) echo "Añade $dest a tu PATH para usar 'qvapay'." >&2 ;;
esac
