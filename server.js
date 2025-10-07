// server.js
const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; 

// --- Log Management ---
let logHistory = [];
const MAX_LOGS = 50;

function logToHistory(message) {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    const fullMessage = `[${timestamp}] ${message}`;
    
    console.log(fullMessage); 
    logHistory.push(fullMessage);
    
    if (logHistory.length > MAX_LOGS) {
        logHistory.shift(); 
    }
}
// -----------------------

// Melayani file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Fungsi utama untuk scraping.
 */
async function extractDirectLink(shareUrl) {
    let browser;
    logToHistory(`Memulai ekstraksi untuk: ${shareUrl}`);
    
    try {
        // --- Solusi Serverless/Chromium Fix ---
        logToHistory('Meluncurkan Chromium dengan konfigurasi Vercel...');
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'], 
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(), // Menggunakan jalur Chromium yang sudah terinstal
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(60000); 

        const potentialLinks = [];

        // 2. Intersepsi Permintaan Jaringan
        logToHistory('Mengaktifkan intersepsi jaringan.');
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const url = request.url();
            const method = request.method();
            
            // Logika: mencari URL GET yang mengandung 'download'
            if (method === 'GET' && url.includes('download') && !url.includes('.css') && !url.includes('.js')) { 
                 potentialLinks.push(url);
                 logToHistory(`[INTERCEPTED] Potensi link ditemukan: ${url.substring(0, 80)}...`);
            }
            request.continue();
        });

        // 3. Navigasi dan Simulasikan Interaksi
        logToHistory('Menavigasi ke halaman sharing...');
        await page.goto(shareUrl, { waitUntil: 'domcontentloaded' });

        // Contoh Selector Terabox (GANTI INI JIKA ADA PERUBAHAN)
        const downloadButtonSelector = '.x-btn-main.g-btn'; 
        
        try {
            logToHistory(`Menunggu tombol unduh: ${downloadButtonSelector}`);
            await page.waitForSelector(downloadButtonSelector, { timeout: 15000 });
            await page.click(downloadButtonSelector);
            logToHistory('Tombol unduh berhasil diklik. Menunggu tautan muncul...');
            
            await page.waitForTimeout(5000); 
            
        } catch (error) {
            logToHistory('Peringatan: Tombol unduh tidak ditemukan atau error klik.');
        }
        
        // 4. Proses Hasil
        const finalLink = potentialLinks[potentialLinks.length - 1];
        
        if (finalLink) {
             logToHistory(`SUCCESS: Tautan langsung terakhir: ${finalLink.substring(0, 80)}...`);
        } else {
             logToHistory('FAILURE: Tidak ada tautan langsung yang tertangkap.');
        }

        return finalLink;

    } catch (error) {
        logToHistory(`FATAL ERROR saat scraping: ${error.message.substring(0, 150)}...`);
        throw new Error(`Gagal mengekstrak tautan: ${error.message.substring(0, 50)}... Cek log server.`);
    } finally {
        if (browser) {
            await browser.close();
            logToHistory('Browser ditutup.');
        }
    }
}

// ------------------------------------
// Endpoint API untuk Download
// ------------------------------------
app.get('/api/download', async (req, res) => {
    const shareLink = req.query.link;
    
    if (!shareLink || !shareLink.includes('terabox')) {
        return res.status(400).json({ error: 'Harap berikan tautan Terabox yang valid.' });
    }

    try {
        const directLink = await extractDirectLink(shareLink);
        if (directLink) {
            res.json({ success: true, directLink: directLink });
        } else {
            res.status(500).json({ success: false, error: 'Gagal mendapatkan tautan unduhan. Cek log server.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ------------------------------------
// Endpoint API untuk Log
// ------------------------------------
app.get('/api/logs', (req, res) => {
    res.json({ logs: logHistory });
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
