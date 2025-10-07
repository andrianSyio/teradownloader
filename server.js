// server.js
const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Variabel Global untuk menyimpan log terbaru (max 50 baris)
let logHistory = [];
const MAX_LOGS = 50;

/**
 * Fungsi pembantu untuk mencatat log ke konsol dan ke history log.
 */
function logToHistory(message) {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    const fullMessage = `[${timestamp}] ${message}`;
    
    // Tampilkan di konsol server
    console.log(fullMessage); 
    
    // Simpan di history
    logHistory.push(fullMessage);
    
    // Batasi jumlah log
    if (logHistory.length > MAX_LOGS) {
        logHistory.shift(); // Hapus log terlama
    }
}


// Middleware untuk melayani file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Fungsi utama untuk scraping.
 */
async function extractDirectLink(shareUrl) {
    let browser;
    logToHistory(`Memulai ekstraksi untuk: ${shareUrl}`);
    
    try {
        // --- Vercel/Serverless Fix ---
        logToHistory('Meluncurkan Chromium...');
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
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
            
            if (method === 'GET' && url.includes('download')) { 
                 potentialLinks.push(url);
                 logToHistory(`[INTERCEPTED] Potensi link ditemukan: ${url.substring(0, 80)}...`);
            }
            request.continue();
        });

        // 3. Navigasi dan Simulasikan Interaksi
        logToHistory('Menavigasi ke halaman sharing...');
        await page.goto(shareUrl, { waitUntil: 'domcontentloaded' });

        const downloadButtonSelector = '.x-btn-main.g-btn'; // Contoh selector
        
        try {
            logToHistory(`Menunggu selector tombol: ${downloadButtonSelector}`);
            await page.waitForSelector(downloadButtonSelector, { timeout: 15000 });
            await page.click(downloadButtonSelector);
            logToHistory('Tombol unduh berhasil diklik.');
            
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
        logToHistory(`FATAL ERROR saat scraping: ${error.message}`);
        throw new Error("Gagal mengekstrak tautan.");
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
            res.status(500).json({ success: false, error: 'Gagal mendapatkan tautan unduhan. Cek log.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ------------------------------------
// Endpoint API untuk Log
// ------------------------------------
app.get('/api/logs', (req, res) => {
    // Mengembalikan log history, log terbaru ada di bagian bawah
    res.json({ logs: logHistory });
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
