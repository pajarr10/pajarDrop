// middleware.js
// Edge Middleware — berjalan di semua request yang cocok matcher di bawah,
// SEBELUM request sampai ke halaman statis/API. Saat admin mengaktifkan
// maintenance mode lewat /admen/dashboard, semua halaman publik yang cocok
// matcher ini akan menampilkan isi /maintenance.html tanpa mengubah URL.
// /admen, /api/*, dan aset statis (css/js/img) sengaja TIDAK dicakup matcher
// ini sehingga admin selalu bisa login dan mematikan maintenance mode lagi.

export const config = {
  matcher: ["/", "/upload", "/uploadong", "/status", "/pajar/:path*", "/pjr/:path*"],
};

export default async function middleware(request) {
  try {
    const statusRes = await fetch(new URL("/api/maintenance-status", request.url));
    if (!statusRes.ok) return; // fail-open: lanjut normal kalau status check gagal

    const data = await statusRes.json();
    if (!data || !data.maintenanceMode) return; // bukan maintenance, lanjut normal

    const pageRes = await fetch(new URL("/maintenance.html", request.url));
    const body = await pageRes.text();

    return new Response(body, {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "retry-after": "3600",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    // fail-open: kalau terjadi error apa pun, jangan sampai mengunci semua
    // orang keluar dari situs — biarkan request lanjut seperti biasa.
    return;
  }
}
