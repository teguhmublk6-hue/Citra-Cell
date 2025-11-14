# Panduan Mengunggah Proyek ke GitHub

Dokumen ini memberikan panduan lengkap untuk mengunggah kode proyek Anda dari komputer lokal ke sebuah repositori baru di GitHub.

## Prasyarat

1.  **Akun GitHub**: Anda harus memiliki akun di [GitHub.com](https://github.com/).
2.  **Git Terinstal**: Pastikan `git` sudah terinstal di komputer Anda. Anda bisa memeriksanya dengan membuka terminal dan menjalankan perintah `git --version`. Jika belum terinstal, unduh dari [git-scm.com](https://git-scm.com/downloads).

---

## Langkah 0: Unduh Kode Proyek ke Komputer Anda

Karena Anda saat ini berada di lingkungan pengembangan web, Anda tidak memiliki file-file ini secara langsung.

1.  **Cari Tombol "Download"**: Cari tombol atau menu **"Download ZIP"** atau **"Export"** di antarmuka yang sedang Anda gunakan. Ini akan mengunduh semua file proyek sebagai satu file ZIP.
2.  **Ekstrak File ZIP**: Setelah terunduh, temukan file ZIP tersebut di folder "Downloads" komputer Anda, lalu ekstrak isinya. Anda sekarang akan memiliki folder proyek yang sesungguhnya di komputer Anda.
3.  **Buka Terminal di Folder Proyek**: Buka aplikasi terminal Anda (Command Prompt, PowerShell, atau Terminal di Mac/Linux) dan navigasikan ke dalam folder yang baru saja Anda ekstrak.

Setelah Anda berada di dalam folder proyek melalui terminal, Anda dapat melanjutkan ke langkah berikutnya.

---

## Langkah 1: Buat Repositori Baru di GitHub

1.  Buka [github.com](https://github.com) dan masuk ke akun Anda.
2.  Di pojok kanan atas, klik ikon `+` lalu pilih **"New repository"**.
3.  Beri nama repositori Anda (misalnya, `brimo-app`).
4.  Anda bisa menambahkan deskripsi (opsional).
5.  Pastikan repositori diatur ke **"Public"** atau **"Private"** sesuai kebutuhan Anda.
6.  **PENTING**: **Jangan** centang kotak "Add a README file", "Add .gitignore", atau "Choose a license". Kita akan memulai dari repositori yang benar-benar kosong.
7.  Klik tombol **"Create repository"**.
8.  Anda akan diarahkan ke halaman repositori baru Anda. Salin (copy) URL repositori tersebut. URL akan terlihat seperti ini: `https://github.com/NAMA_ANDA/NAMA_REPO.git`.

---

## Langkah 2: Unggah Kode dari Komputer Anda

Jalankan perintah-perintah berikut secara berurutan di dalam terminal Anda (yang sudah terbuka di dalam folder proyek).

### 1. Inisialisasi Git

Perintah ini akan membuat repositori Git lokal di dalam folder proyek Anda.

```bash
git init -b main
```

### 2. Tambahkan Semua File

Perintah ini akan menambahkan semua file proyek ke dalam "staging area" Git, siap untuk di-commit.

```bash
git add .
```

### 3. Buat Commit Pertama

Commit adalah "snapshot" atau rekaman dari perubahan Anda.

```bash
git commit -m "Initial commit"
```

### 4. Hubungkan Repositori Lokal dengan GitHub

Ganti `URL_REPOSITORI_ANDA` dengan URL yang sudah Anda salin dari Langkah 1.

```bash
git remote add origin URL_REPOSITORI_ANDA
```
*Contoh: `git remote add origin https://github.com/john-doe/brimo-app.git`*

### 5. Unggah (Push) Kode Anda

Perintah ini akan mengunggah semua file dan commit Anda dari komputer lokal ke repositori di GitHub.

```bash
git push -u origin main
```

---

Selesai! Sekarang jika Anda membuka kembali halaman repositori Anda di GitHub dan me-refresh halaman tersebut, semua file proyek Anda akan muncul di sana.
