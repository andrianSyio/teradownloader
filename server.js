// server.js
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware untuk melayani file statis (index.html, css, dll.) dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Fungsi untuk mencari dan mengekstrak tautan unduhan langsung.
 * CATATAN: Logika ini bersifat SANGAT spesifik dan mungkin perlu disesuaikan
 * atau di-reverse-engineer untuk bekerja pada situs tertentu seperti Terabox.
 * Ini hanyalah ilustrasi konsep.
 */
async function extractDirectLink(shareUrl) {
    let browser;
    try {
        // 1. Luncurkan Headless Browser
        // headless: 'new' adalah mode terbaru dan efisien
        browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Atur timeout yang lebih panjang karena scraping bisa lambat
        page.setDefaultNavigationTimeout(60000); 

        // Array untuk menyimpan potensi URL unduhan
        const potentialLinks = [];

        // 2. Intersepsi Permintaan Jaringan
        // Ini adalah kunci untuk menangkap tautan langsung
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            // Kita akan mencari permintaan yang memuat file besar atau memiliki tipe file tertentu
            const url = request.url();
            const resourceType = request.resourceType();
            const method = request.method();
            
            // Logika Sederhana: Mencari URL yang kemungkinan besar adalah file (misalnya, yang tidak berekstensi HTML/JS/CSS)
            if (method === 'GET' && resourceType === 'other' && !url.endsWith('.html') && !url.endsWith('.js') && !url.endsWith('.css')) {
                 // Di sini, Anda bisa menambahkan filter yang lebih spesifik berdasarkan URL Terabox 
                 potentialLinks.push(url);
            }
            request.continue();
        });

        // 3. Navigasi dan Simulasikan Interaksi
        await page.goto(shareUrl, { waitUntil: 'domcontentloaded' });

        // --- Simulasi Pengguna ---
        // CATATAN: Selector harus sesuai dengan ID/Class/Selector CSS yang ada di halaman Terabox.
        // Ini HANYA CONTOH.
        
        console.log('Halaman dimuat. Mencari tombol unduh...');
        
        // Tunggu tombol unduh muncul dan klik
        const downloadButtonSelector = '#download-button'; // Ganti dengan selector Terabox yang benar
        
        // Tambahkan blok try/catch untuk menangani jika elemen tidak ditemukan
        try {
            await page.waitForSelector(downloadButtonSelector, { timeout: 15000 });
            await page.click(downloadButtonSelector);
            console.log('Tombol unduh diklik.');
            
            // Tunggu sebentar agar permintaan unduhan (direct link) dikirim
            await page.waitForTimeout(5000); 
            
        } catch (error) {
            console.warn('Tombol unduh tidak ditemukan atau error. Melanjutkan...');
        }
        
        // 4. Proses Hasil
        // Ambil tautan terakhir yang tertangkap (ini biasanya tautan langsungnya)
        const finalLink = potentialLinks[potentialLinks.length - 1];

        return finalLink;

    } catch (error) {
        console.error('Error saat scraping:', error);
        return null;
    } finally {
        // SANGAT PENTING: Selalu tutup browser untuk menghemat RAM server
        if (browser) {
            await browser.close();
        }
    }
}

// ------------------------------------
// Endpoint API
// ------------------------------------
app.get('/api/download', async (req, res) => {
    const shareLink = req.query.link;

    if (!shareLink) {
        return res.status(400).json({ error: 'Parameter link dibutuhkan.' });
    }

    // Melindungi dari link yang tidak valid atau masalah keamanan
    if (!shareLink.includes('terabox')) { 
        return res.status(400).json({ error: 'Hanya tautan Terabox yang didukung.' });
    }

    console.log(`Memproses link: ${shareLink}`);
    
    // Panggil fungsi scraping
    const directLink = await extractDirectLink(shareLink);

    if (directLink) {
        // 5. Kembalikan Tautan Langsung ke Pengguna
        res.json({ success: true, directLink: directLink });
    } else {
        res.status(500).json({ success: false, error: 'Gagal mendapatkan tautan unduhan.' });
    }
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
