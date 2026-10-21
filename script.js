// ============================================================
// KONFIGURASI SUPABASE REST API
// ============================================================
const SUPABASE_URL = ""; 
const SUPABASE_KEY = ""; 

const clientSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const imgPemadam = document.getElementById('imgPemadam');
const emojiHappy = document.getElementById('emojiHappy');
const emojiSad = document.getElementById('emojiSad');
const emojiAngry = document.getElementById('emojiAngry');

const txtSuasanaHati = document.getElementById('txtSuasanaHati');
const valKelembapan = document.getElementById('valKelembapan');
const valCahaya = document.getElementById('valCahaya');
const valDebitAir = document.getElementById('valDebitAir');

const listCurhatan = document.getElementById('listCurhatan');
const btnSiramPlay = document.getElementById('btnSiramPlay');
const btnSiramOval = document.getElementById('btnSiramOval');

const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const statusBadge = document.getElementById('statusBadge');

// ============================================================
// FUNGSI 1: LOAD DATA TERBARU (DENGAN ERROR & EMPTY DATA HANDLING)
// ============================================================
async function loadLatestData() {
    try {
        // Ambil 10 data kondisi tanaman terbaru dari Supabase
        const { data, error } = await clientSupabase
            .from('kondisi_tanaman')
            .select('*')
            .order('dibuat_pada', { ascending: false })
            .limit(10);

        if (error) throw error;

        // --- PENANGANAN 1: JIKA KONEKSI SUKSES ---
        hideErrorBanner();
        updateStatusBadge(true);

        // --- PENANGANAN 2: JIKA DATA KOSONG (BELUM ADA SENSOR DI DATABASE) ---
        if (!data || data.length === 0) {
            showEmptyState();
            return;
        }

        // --- PENANGANAN 3: JIKA DATA TERSEDIA ---
        const latest = data[0];

        // 1. Render Nilai Sensor
        valKelembapan.innerText = `${latest.kelembapan}%`;
        valCahaya.innerText = `${latest.cahaya} Lux`;
        valDebitAir.innerText = `${latest.debit_air || 0}%`;

        // 2. Render Teks Suasana Hati
        txtSuasanaHati.innerText = latest.suasana_hati;

        // 3. Highlight Emoji berdasarkan Kelembapan
        emojiHappy.classList.remove('emoji-active');
        emojiSad.classList.remove('emoji-active');
        emojiAngry.classList.remove('emoji-active');

        if (latest.kelembapan > 70) {
            emojiHappy.classList.add('emoji-active');
        } else if (latest.kelembapan >= 30) {
            emojiSad.classList.add('emoji-active');
        } else {
            emojiAngry.classList.add('emoji-active');
        }

        // 4. Render Linimasa Curhatan
        listCurhatan.innerHTML = '';
        data.forEach(item => {
            const timeStr = new Date(item.dibuat_pada).toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit'
            }) + ' WIB';

            const card = document.createElement('div');
            card.className = "p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-sm space-y-1";
            card.innerHTML = `
                <div class="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>🕒 ${timeStr}</span>
                    <span class="${item.kelembapan < 30 ? 'text-red-500' : 'text-[#74a82b]'} font-bold">${item.kelembapan}% H₂O</span>
                </div>
                <p class="text-slate-700 italic font-medium">"${item.curhatan}"</p>
            `;
            listCurhatan.appendChild(card);
        });

    } catch (err) {
        // --- PENANGANAN KONEKSI GAGAL / ERROR API ---
        console.error("Koneksi gagal:", err.message);
        showErrorBanner("Koneksi ke database terputus. Pastikan internet Anda aktif.");
        updateStatusBadge(false);
    }
}

// ============================================================
// FUNGSI PENDUKUNG PENANGANAN ERROR & DATA KOSONG
// ============================================================

// Tampilan jika data di database kosong
function showEmptyState() {
    txtSuasanaHati.innerText = "Belum Ada Data";
    valKelembapan.innerText = "--%";
    valCahaya.innerText = "-- Lux";
    valDebitAir.innerText = "--%";

    emojiHappy.classList.remove('emoji-active');
    emojiSad.classList.remove('emoji-active');
    emojiAngry.classList.remove('emoji-active');

    listCurhatan.innerHTML = `
        <div class="text-center text-slate-400 py-6 text-sm">
            <p class="font-bold text-slate-500 mb-1">📭 Data Kosong</p>
            <p>Belum ada data sensor dari ESP32. Menunggu pengiriman pertama...</p>
        </div>
    `;
}

// Tampilkan Banner Peringatan saat Koneksi Gagal
function showErrorBanner(msg) {
    errorMessage.innerText = msg;
    errorBanner.classList.remove('hidden');
}

// Sembunyikan Banner Peringatan
function hideErrorBanner() {
    errorBanner.classList.add('hidden');
}

// Ubah Indikator Status Badge (Hijau = Terhubung, Merah = Terputus)
function updateStatusBadge(isConnected) {
    if (isConnected) {
        statusBadge.className = "bg-emerald-800/60 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-white/20";
        statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span> Terhubung`;
        btnSiramOval.disabled = false;
    } else {
        statusBadge.className = "bg-red-800/70 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-white/20";
        statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-400"></span> Terputus`;
        btnSiramOval.disabled = true; // Nonaktifkan tombol saat terputus
    }
}

// ============================================================
// FUNGSI 2: KIRIM PERINTAH SIRAM
// ============================================================
async function siramTanaman() {
    btnSiramOval.disabled = true;
    btnSiramOval.innerText = "Menyiram...";
    imgPemadam.src = "assets/pemadam_siram.png";

    try {
        const { error } = await clientSupabase
            .from('perintah')
            .insert([{ aksi: 'SIRAM', status: 'PENDING' }]);

        if (error) throw error;

        setTimeout(() => {
            imgPemadam.src = "assets/pemadam_diam.png";
            btnSiramOval.disabled = false;
            btnSiramOval.innerText = "Siram??";
            loadLatestData();
        }, 3500);

    } catch (err) {
        alert("Gagal menyiram: " + err.message);
        imgPemadam.src = "assets/pemadam_diam.png";
        btnSiramOval.disabled = false;
        btnSiramOval.innerText = "Siram??";
        showErrorBanner("Gagal mengirim perintah siram. Cek koneksi Anda.");
    }
}

// Event Listeners
btnSiramPlay.addEventListener('click', siramTanaman);
btnSiramOval.addEventListener('click', siramTanaman);

// Init & Auto Refresh
loadLatestData();
setInterval(loadLatestData, 5000);