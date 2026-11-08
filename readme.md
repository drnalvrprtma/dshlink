# AVMX — Pemendek Tautan Cepat Tanpa Akun

**[AVMX (avmx.web.id)](https://avmx.web.id)** adalah layanan pemendek tautan (*URL shortener*) berbasis web yang dirancang agar pengguna dapat memperpendek URL panjang dalam hitungan detik, lengkap dengan pembuatan kode QR berbingkai dan pemantauan statistik klik—tanpa perlu mendaftar akun atau menggunakan kata sandi.

---

## Ringkasan Proyek

| Atribut | Detail |
| :--- | :--- |
| **Nama Layanan** | [AVMX](https://avmx.web.id) |
| **Domain Resmi** | [https://avmx.web.id](https://avmx.web.id) |
| **Kategori** | Pemendek URL (*URL Shortener*) & Generator QR Code |
| **Pengembang** | Fitrah Akbar Maulana ([AVMX](https://avmx.web.id)) |
| **Kebutuhan Akun** | Tanpa registrasi dan tanpa login (*No-Account Required*) |

---

## Fitur Utama

Berdasarkan layanan yang berjalan di [avmx.web.id](https://avmx.web.id), platform ini menyediakan fitur-fitur berikut:

* **Tanpa Akun, Selamanya**: Pengguna dapat langsung memperpendek tautan tanpa wajib mendaftar atau masuk (*login*). Riwayat tautan yang dibuat disimpan di penyimpanan lokal peramban (*browser*) agar mudah dikelola kembali.
* **Slug Kustom dengan Pengecekan Langsung**: Pengguna bebas menggunakan akhiran tautan (*slug*) acak otomatis atau menulis akhiran sendiri (misalnya `avmx.web.id/halo`). Ketersediaan *slug* diperiksa secara langsung (*real-time*) saat pengguna mengetik.
* **Masa Berlaku Fleksibel**: Tautan dapat diatur agar aktif selama 1 jam, 1 minggu, hingga tanggal dan waktu pilihan tertentu, atau aktif selamanya.
* **QR Code Berbingkai Bermerek**: Setiap tautan pendek yang dibuat otomatis dilengkapi dengan kode QR berbingkai bermerek [AVMX](https://avmx.web.id) yang dapat langsung diunduh dalam format gambar `.png`.
* **Statistik Klik Nyata**: Pantau performa tautan melalui data jumlah klik, jenis perangkat, peramban (*browser*), dan perkiraan lokasi/negara pengunjung secara transparan berdasarkan data kunjungan yang tersedia.
* **Redirect di Sisi Server**: Seluruh tautan disimpan dan dialihkan langsung dari server [avmx.web.id](https://avmx.web.id), sehingga tautan dapat dibuka dari perangkat, peramban, atau jaringan mana pun. Jika data peramban lokal terhapus, daftar riwayat di perangkat akan hilang tetapi tautan pendek tetap aktif hingga masa berlakunya berakhir.
* **Koreksi Protokol Otomatis**: Apabila pengguna menempelkan URL tanpa awalan protokol, sistem otomatis menambahkan `https://` sebelum memproses tautan.
* **Penghapusan Tautan Permanen**: Pengguna dapat menghapus tautan kapan saja dari daftar riwayat mereka; tautan yang dihapus tidak lagi mengarah ke URL tujuan dan akan menampilkan halaman tidak ditemukan.

---

## Cara Penggunaan

Penggunaan layanan di [avmx.web.id](https://avmx.web.id) hanya membutuhkan tiga langkah sederhana:

1. **Tempel Tautan**: Masukkan URL panjang pada kolom input di halaman utama [avmx.web.id](https://avmx.web.id) (awalan `https://` akan ditambahkan otomatis jika terlewat).
2. **Atur Sesuai Kebutuhan**: Biarkan sistem membuat *slug* acak atau ketik *slug* kustom pilihan Anda, lalu pilih masa berlaku tautan (1 jam, 1 minggu, tanggal tertentu, atau selamanya).
3. **Bagikan dan Pantau**: Klik tombol **Perpendek**, salin tautan pendek yang dihasilkan, unduh gambar QR code PNG, dan pantau statistik klik, perangkat, serta lokasi perkiraan langsung dari bagian **Link kamu**.

---

## Struktur Proyek (Template Repositori)

Jika Anda mengelola kode sumber [avmx.web.id](https://avmx.web.id) di dalam repositori Git, Anda dapat menyesuaikan bagian struktur direktori dan panduan instalasi lokal di bawah ini sesuai *tech stack* yang digunakan:

```text
avmx.web.id/
├── public/                 # Aset statis (favicon, logo, template bingkai QR)
├── src/                    # Kode sumber aplikasi (UI, komponen, utilitas QR & analitik)
├── server/                 # Logika backend / API endpoint untuk redirect & penyimpanan tautan
├── .env.example            # Contoh konfigurasi variabel lingkungan
├── package.json            # Daftar dependensi dan skrip proyek
└── README.md               # Dokumentasi proyek
```

### Menjalankan Secara Lokal (Opsional)

1. Kloning repositori ini ke komputer lokal Anda:
   ```bash
   git clone https://github.com/username/avmx.web.id.git
   cd avmx.web.id
   ```
2. Pasang seluruh dependensi proyek:
   ```bash
   npm install
   ```
3. Salin berkas konfigurasi lingkungan dan sesuaikan pengaturannya:
   ```bash
   cp .env.example .env
   ```
4. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```

---

## Catatan Privasi & Keamanan

* **Sifat Tautan Publik**: Setiap tautan pendek yang dibuat melalui [avmx.web.id](https://avmx.web.id) bersifat publik dan dapat diakses oleh siapa saja yang memiliki tautan tersebut. Hindari memperpendek URL yang memuat informasi rahasia, token akses pribadi, atau data sensitif.
* **Penyimpanan Daftar Riwayat**: Daftar pada bagian **Link kamu** disimpan secara lokal di peramban perangkat pengguna untuk menjaga privasi tanpa perlu autentikasi akun.

---

## Kredit & Lisensi

* **Pengembang**: Dikembangkan oleh **Fitrah Akbar Maulana**
* **Situs Web**: [https://avmx.web.id](https://avmx.web.id)
