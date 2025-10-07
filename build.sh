#!/bin/bash
# install dependencies for chromium to run on linux (fixes libnspr4.so error)

echo "--- [BUILD.SH] Starting system dependency installation ---"

# Perintah untuk memperbarui daftar paket
apt-get update

# Menginstal libnss3 dan libgconf-2-4 untuk menjalankan Chromium
apt-get install -y libnss3 libgconf-2-4

echo "--- [BUILD.SH] System dependencies installed ---"

# Lanjutkan dengan instalasi Node.js dependencies
npm install --no-package-lock

echo "--- [BUILD.SH] Node dependencies installed. Build ready ---"
