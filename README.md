# P4Drop — File Upload & CDN

Dibuat oleh **Pajar** ([pajar.biz.id](https://pajar.biz.id)).

Stack: **Node.js serverless functions** (Vercel `/api`) + **HTML/CSS/JS vanilla** murni di frontend (tanpa React/Next.js/framework berat). Storage pakai **Vercel Blob**, tanpa database terpisah (metadata disimpan sebagai JSON di Blob).

## 1. Setup lokal

```bash
npm install
npm i -g vercel
vercel dev
```

## 2. Environment Variables (wajib di Vercel Project Settings)

Salin dari `.env.example`:

- `BLOB_READ_WRITE_TOKEN` — dari Vercel Dashboard -> Storage -> Blob -> Create Store.
- `ADMIN_SECRET` — password untuk masuk ke `/admen`. Gunakan string acak yang panjang, JANGAN ditanam di frontend/source code.
- `MAX_MEDIA_MB`, `MAX_FILE_MB`, `RATE_LIMIT_PER_MINUTE` — opsional, ada default.

## 3. Domain

Attach dua domain ke project Vercel yang sama:

- `domain.com` (root) — landing page, `/upload`, `/uploadong`, `/status`, `/admen`, `/api/*`
- `c.domain.com` — khusus URL file publik (`/pajar/*`, `/pjr/*`)

Domain **tidak pernah di-hardcode** di source code — semua diambil dari header `Host` / `X-Forwarded-Host` saat request (lihat `lib/domain.js`). Jadi kalau kamu ganti domain, cukup ganti DNS/domain attachment di Vercel, tidak perlu ubah kode.

## 4. Struktur Route

| Route | Keterangan |
|---|---|
| `GET /` | Landing page |
| `GET /upload` | Uploader media (tanpa expiration) |
| `GET /uploadong` | Uploader file/source/archive (dengan expiration) |
| `GET /status` | Statistik real-time |
| `GET /admen` | Login admin |
| `GET /admen/dashboard` | Panel admin (butuh login) |
| `POST /api/upload` | Upload media -> `c.domain.com/pajar/<id>.<ext>` |
| `POST /api/uploadong` | Upload file -> `c.domain.com/pjr/<id>` |
| `GET /api/stats` | Statistik JSON |
| `GET /pajar/<id>.<ext>` | Redirect ke file media asli (hanya di host `c.`) |
| `GET /pjr/<id>` | Landing page file, `?dl=1` untuk download |

## 5. Maintenance Mode

Admin bisa mengaktifkan/mematikan maintenance mode dari `/admen/dashboard` (menu **Maintenance**). Saat aktif:

- Semua halaman publik (`/`, `/upload`, `/uploadong`, `/status`, `/pajar/*`, `/pjr/*`) otomatis menampilkan `public/maintenance.html` (HTTP 503), URL tetap sama.
- `/admen` dan seluruh `/api/*` tetap bisa diakses normal, supaya admin selalu bisa login dan mematikan mode ini lagi.
- Implementasi lewat `middleware.js` (Vercel Edge Middleware) yang mengecek status ke `GET /api/maintenance-status` setiap request. Kalau pengecekan gagal karena alasan apa pun, sistem **fail-open** (tetap tampil normal) supaya error tidak pernah mengunci semua pengguna keluar dari situs.
- Halaman maintenance auto-refresh setiap 30 detik.

## 6. Keamanan yang sudah diimplementasikan

- File dari `/uploadong` **tidak pernah dieksekusi** di server — selalu disimpan & disajikan sebagai `application/octet-stream` attachment, apa pun ekstensinya (termasuk `.php`, `.sh`, `.exe`, `.html`, `.svg`, dll).
- Archive (`.zip`, `.rar`, `.7z`, `.tar`) **tidak pernah diekstrak otomatis**.
- Validasi ekstensi & ukuran file di kedua endpoint upload.
- Nama file di-generate acak (`nanoid`, alfabet tanpa karakter ambigu) — nama asli user tidak dipakai sebagai path storage.
- Rate limit 100 file/menit/client, disimpan di shared store (Blob) — bukan memory lokal proses, supaya konsisten di multi-instance serverless.
- Directory listing `/pajar/` dan `/pjr/` diblokir (403 custom page).
- `/admen` pakai cookie sesi ber-signature HMAC (bukan key statis di frontend), `HttpOnly`, `Secure`, `SameSite=Strict`.
- Security headers dasar (`X-Content-Type-Options`, `X-Frame-Options`, dll) via `vercel.json`.
- Tidak ada secret yang di-hardcode — semua lewat environment variables.

## 7. Catatan skala & pengembangan lanjutan

- Rate limiting & metadata saat ini disimpan sebagai JSON tunggal di Vercel Blob (read-modify-write). Ini **cukup untuk trafik kecil-menengah**, tapi punya risiko race condition kecil saat trafik sangat tinggi bersamaan. Untuk produksi skala besar, disarankan pindah ke **Vercel KV / Upstash Redis** untuk counter atomic, dan/atau database asli (Postgres/Turso) untuk metadata.
- Cleanup fisik file expired dari Blob storage belum otomatis (saat ini file expired cukup "tidak bisa diakses" secara logis). Bisa ditambahkan **Vercel Cron Job** yang memanggil endpoint cleanup harian.
- Menu admin (`Storage Overview`, `File Type Settings`, dll) sudah menampilkan data nyata dari sistem dan siap dikembangkan lebih lanjut sesuai kebutuhan.

## 8. Kontak

- Portfolio: https://pajar.biz.id
- WhatsApp: https://wa.me/6285708557587
- Telegram: https://t.me/JarzGoslingF
