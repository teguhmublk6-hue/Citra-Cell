# Panduan Lengkap: Membungkus Aplikasi Web Menjadi APK Android

Dokumen ini adalah panduan langkah demi langkah untuk mengubah aplikasi web Next.js ini menjadi sebuah file `.apk` yang dapat diinstal di perangkat Android.

## Prasyarat (Harus Diinstal Terlebih Dahulu)

Pastikan perangkat komputer Anda sudah memiliki:
1.  **Node.js dan npm**: Anda bisa mengunduhnya dari [situs resmi Node.js](https://nodejs.org/).
2.  **Android Studio**: Ini adalah lingkungan pengembangan resmi untuk Android. Unduh dari [situs Android Developer](https://developer.android.com/studio).
    *   Setelah instalasi, buka Android Studio dan pastikan ia selesai mengunduh SDK (Software Development Kit) yang diperlukan.

---

## Proses Langkah-demi-Langkah

Ikuti perintah-perintah ini secara berurutan di dalam terminal Anda (seperti `cmd` atau `PowerShell`), dari dalam folder proyek aplikasi ini.

### Langkah 1: Instal Semua Dependensi Proyek

Perintah ini akan mengunduh semua paket kode yang dibutuhkan oleh aplikasi web Anda.

```bash
npm install
```

### Langkah 2: Bangun Versi Statis Aplikasi Web

Perintah ini akan membuat versi "final" dari aplikasi web Anda dan menyimpannya di dalam sebuah folder baru bernama `out`. Folder inilah yang akan kita bungkus.

```bash
npm run build
```

### Langkah 3: Tambahkan Capacitor ke Proyek

Capacitor adalah alat yang akan membungkus aplikasi web kita. Pertama, kita instal paket-paket yang diperlukan.

```bash
npm install @capacitor/core @capacitor/android @capacitor/cli
```

### Langkah 4: Inisialisasi Proyek Capacitor

Perintah ini akan membuat file konfigurasi untuk Capacitor dan mengintegrasikannya dengan proyek Android.

```bash
npx cap init
```
*   **Apa yang terjadi di sini?** Capacitor akan menanyakan beberapa hal:
    *   **App Name**: Nama aplikasi Anda (misal: "Brimo UI").
    *   **App ID**: ID unik untuk aplikasi Anda, biasanya dalam format `com.domain.app` (misal: `com.brimo.enhancer`).

Setelah itu, tambahkan platform Android ke proyek Capacitor.

```bash
npx cap add android
```
*   **Apa yang terjadi di sini?** Capacitor akan membuat sebuah folder baru bernama `android` di dalam proyek Anda. Folder ini berisi proyek Android Studio yang sesungguhnya.

### Langkah 5: Sinkronkan Aplikasi Web ke Proyek Android

Sekarang, kita salin hasil build dari folder `out` (yang dibuat di Langkah 2) ke dalam proyek Android.

```bash
npx cap sync
```

### Langkah 6: Buka Proyek di Android Studio

Perintah ini akan secara otomatis membuka folder `android` di dalam Android Studio.

```bash
npx cap open android
```

### Langkah 7: Bangun File APK di Android Studio

Ini adalah langkah terakhir. Setelah proyek terbuka di Android Studio:

1.  **Tunggu**: Biarkan Android Studio menyelesaikan semua proses *indexing* dan *Gradle sync*. Ini bisa memakan waktu beberapa menit saat pertama kali.
2.  **Buka Menu Build**: Di bagian atas, klik menu **Build**.
3.  **Pilih Build APK**: Dari menu tersebut, pilih **Build Bundle(s) / APK(s)**, lalu klik **Build APK(s)**.
4.  **Tunggu Proses Build**: Proses pembuatan APK akan dimulai. Anda bisa melihat progresnya di bagian bawah jendela Android Studio.
5.  **Temukan APK**: Setelah selesai, sebuah notifikasi akan muncul di pojok kanan bawah. Klik pada tulisan **"locate"**.

Itu akan membuka folder tempat file `app-debug.apk` Anda berada. File inilah yang bisa Anda salin ke ponsel Android Anda dan instal.

Selesai! Anda telah berhasil membungkus aplikasi web Anda menjadi sebuah aplikasi Android.
