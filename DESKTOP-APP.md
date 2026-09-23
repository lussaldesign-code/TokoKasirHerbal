# TokoKasirHerbal Windows

Repository ini sekarang dapat dibangun menjadi aplikasi Windows menggunakan Electron.

## Menjalankan di komputer pengembang

1. Install Node.js LTS.
2. Jalankan `npm install`.
3. Jalankan `npm start`.

## Membuat installer

Jalankan:

`npm run dist`

Installer akan dibuat di folder `dist/` dengan format:

`TokoKasirHerbal-Setup-1.0.0.exe`

Installer menggunakan NSIS dan membuat shortcut Desktop serta Start Menu.

## Build otomatis

GitHub Actions workflow `.github/workflows/build-windows.yml` membuat installer Windows setiap kali ada perubahan yang relevan di branch `main`, dan juga dapat dijalankan manual dari tab Actions.

Aplikasi desktop tetap memakai Supabase sebagai database online, sehingga komputer membutuhkan koneksi internet untuk login dan sinkronisasi data.
