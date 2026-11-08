# Keputusan desain FilmLog API

Catatan ini merangkum keputusan desain utama di backend FilmLog: apa yang saya pilih, alasannya, dan harga yang dibayar untuk pilihan itu.

## Database

**SQLite lewat libSQL.** Lokal cukup satu berkas tanpa server, sehingga penilai bisa menjalankan proyek dalam beberapa perintah. Produksi memakai Turso dengan klien dan dialek SQL yang sama. Harganya: SQLite hanya punya satu penulis pada satu waktu. Untuk tugas ini tidak masalah, tetapi akan membatasi kalau trafik tulis tinggi.

**Tabel `STRICT`.** Tanpa ini SQLite menerima teks di kolom integer.

**`genres` dan `movie_genres` dipisah, `cast_members` tidak.** Genre difilter, sehingga layak dinormalisasi dan diberi indeks. Pemeran hanya ditampilkan, jadi cukup array JSON di satu kolom. Kalau nanti butuh "semua film aktor X", kolom ini harus dipecah menjadi tabel.

**Primary key komposit di `watchlists`.** Pasangan `(user_id, movie_id)` secara alami unik, sehingga tidak perlu kolom id tambahan. Indeksnya juga melayani pencarian per user. Indeks tambahan di `movie_id` melayani arah sebaliknya dan operasi cascade.

**`seed.sql` tidak dipakai.** `SERIAL` tidak menghasilkan auto-increment di SQLite dan genre di sana berupa teks berpisah koma. Seeder membaca `movies.json`, dan aman dijalankan berulang karena memakai upsert.

**Foreign key dicek saat start.** SQLite biasa mematikannya secara bawaan, sedangkan libSQL mengaktifkannya di setiap koneksi. Skema ini bergantung padanya, jadi server memeriksa `PRAGMA foreign_keys` saat start dan menolak berjalan kalau nonaktif. Ada test yang memastikan database benar-benar menolak baris dengan referensi tak valid.

## API

**Satu review per user per film, dengan upsert.** Kontrak tidak punya endpoint edit, sementara frontend selalu menampilkan tombol Log Review. Dengan upsert, user tetap bisa mengoreksi review. Kirim pertama 201, berikutnya 200. Harganya: riwayat nonton ulang tidak tercatat seperti diary Letterboxd.

**Status `watched` dan `watchlist` berdiri sendiri.** Menandai film sebagai ditonton tidak menghapusnya dari watchlist. Frontend tidak memuat ulang watchlist setelah `POST /watched`, sehingga penghapusan otomatis akan membuat tombol berikutnya berujung 404.

**`movie` bersarang di respons `/watched`.** Frontend membaca `item.rating` sebagai bintang user. Kalau objeknya datar, rating film 8.8 akan menimpanya dan frontend menggambar 9 bintang.

**Field tak dikenal diabaikan.** Frontend mengirim `movie_id` di samping `movieId` dan `opinion` di samping `review`. Validasi yang ketat akan menolak request yang sah.

**Duplikat diserahkan ke constraint database.** Pola "cek dulu, baru insert" bisa lolos saat dua request datang bersamaan. Constraint tidak bisa.

## Keamanan

**Bcrypt cost 12, password maksimal 72 byte.** Bcrypt hanya membaca 72 byte pertama, sehingga password yang lebih panjang akan terpotong diam-diam kalau tidak ditolak.

**Login tak bisa dipakai menebak email.** Email tak dikenal dan password salah mendapat pesan yang sama. Email tak dikenal juga tetap menjalankan bcrypt terhadap hash palsu, agar waktunya tidak berbeda. Catatan jujur: register tetap membalas 409 untuk email terpakai, jadi keberadaan email masih bisa diketahui dari sana. Kontrak dan UX pendaftaran membutuhkan pesan itu, dan rate limit memperlambat penyalahgunaannya.

**JWT HS256 dengan algoritma dikunci, berlaku 7 hari.** Mengunci algoritma menutup serangan `alg: none`. Tidak ada refresh token dan token tidak bisa dicabut satu per satu, karena tugas ini tidak memintanya. Sebagai gantinya, setiap request privat mengecek user masih ada, dengan biaya satu query primary key.

**Tidak ada 403.** `user_id` selalu berasal dari token, tidak pernah dari body atau URL, dan setiap query difilter dengannya. Tidak ada jalur untuk menyebut data milik user lain, sehingga kasus "boleh login tetapi tidak berhak" tidak muncul. Mencoba menghapus item yang bukan miliknya menghasilkan 404, yang juga tidak mengungkap keberadaan data orang lain. Membuat 403 hanya demi memenuhi daftar akan jadi kode tanpa fungsi.

**Rate limit.** `/recommend` publik dan memakai kuota Gemini, jadi dibatasi 10 request per menit per IP. `/auth/*` dibatasi 20 per 15 menit untuk memperlambat tebakan password. Hitungannya ada di memori, jadi hanya akurat untuk satu instance.

**CORS `*`.** Aman karena auth memakai header Bearer tanpa cookie, sehingga situs lain tidak bisa menumpang sesi browser. Dengan alasan yang sama, `Cross-Origin-Resource-Policy` dibuka ke `cross-origin`, sehingga frontend yang di-hosting terpisah tetap bisa memakai API ini.

**Celah yang ada di frontend.** Frontend merender data dengan `innerHTML` dan menyimpan token di `localStorage`. Spesifikasi hanya meminta backend, jadi frontend hanya diubah di dua tempat: alamat API bawaan kini mengikuti origin halaman agar satu deployment bisa melayani keduanya, dan bug popup log review yang langsung tertutup karena timer penutup modal sebelumnya belum dibatalkan. Backend mengurangi risikonya: username dibatasi karakternya dan `<` `>` dibuang dari `reasoning`. Teks review tetap disimpan apa adanya, dan hanya ditampilkan kepada penulisnya sendiri.

## Grounding Gemini

Penjaminnya berlapis, dengan asumsi setiap lapis di atas bisa gagal:

1. **Katalog dari database.** Daftar kandidat diambil saat request, jadi tidak ada judul yang tertulis di kode dan film baru otomatis ikut.
2. **System instruction.** Aturan ada terpisah dari data, dan isi `<user_request>` dinyatakan sebagai data, bukan instruksi. Karakter `<` `>` di prompt pengguna diganti agar tidak bisa menutup blok itu.
3. **JSON schema dengan enum.** `movie_id` dibatasi ke ID kandidat. Enum berupa string karena begitu cara dokumentasi Gemini mendefinisikannya, lalu diubah kembali menjadi angka.
4. **Validasi server.** Inilah jaminan sebenarnya. Tiga lapis di atas hanya membuat jawaban yang benar lebih mungkin; lapis ini memastikan ID di luar kandidat tidak pernah sampai ke pengguna.
5. **Coba ulang sekali, lalu gagal terang-terangan.** Percobaan kedua membawa catatan koreksi. Kalau tetap salah, balas 502. Film acak sebagai cadangan tidak dipakai, karena pengguna akan menerima alasan palsu.

**Personalisasi.** Kalau token valid, film yang sudah ditonton dikeluarkan dari kandidat dan judul serta rating user dikirim sebagai petunjuk selera. Teks review sengaja tidak dikirim, karena isinya bebas ditulis user dan bisa menjadi prompt injection tersimpan, selain soal privasi. Token rusak diperlakukan sebagai anonim karena frontend mengirim token lama secara otomatis.

**Beberapa API key.** Kuota gratis Gemini per key kecil. `GEMINI_API_KEY` menerima beberapa key dipisah koma. Key yang membalas 429, 401, atau 403 dilewati dalam request yang sama, dan key yang terakhir berhasil dipakai lebih dulu di request berikutnya. Timeout dan 5xx tidak memutar key, karena masalahnya ada di Gemini, bukan di key. Log hanya mencatat nomor urut key, tidak pernah isinya. Harganya: memutar key untuk menghindari limit melanggar semangat batas kuota per proyek, jadi ini hanya cocok untuk demo, bukan produksi.

**Permintaan yang tidak nyambung.** Kontrak selalu meminta `movie_id`, jadi model memilih yang paling mendekati dan mengatakan terus terang bahwa kecocokannya terbatas.

**Batas yang perlu diakui.** Validasi membuktikan ID-nya ada, tetapi tidak membuktikan `reasoning` bebas dari karangan. Instruksi dan temperature 0.4 mengurangi risikonya, dan `npm run eval:recommend` memberi cara memeriksanya dengan mata.

## Test

Integration test berjalan lewat HTTP dengan database SQLite di memori, sehingga SQL dan constraint ikut teruji. Hanya Gemini yang diganti tiruan, dan itu membuat kasus yang sulit dipancing dari model asli bisa diuji: ID halusinasi, JSON rusak, retry. Harganya: test tidak membuktikan perilaku model sungguhan. Itulah tugas `eval:recommend`.
