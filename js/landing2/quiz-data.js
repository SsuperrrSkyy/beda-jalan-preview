// Quiz copy, from docs/CONTENT.md §9 (questions) and §10 (Peta Minat). Change the wording there first, then here.
// st = leans Sains-Teknologi, sh = leans Sosial-Humaniora, dd = "Dua-duanya seru" (scores nothing).
export const BOTH = 'Dua-duanya seru';

export const QUESTIONS = [
  { q: 'Lagi scroll video, kamu paling sering berhenti di…', st: 'Video cara sesuatu dibuat atau bekerja', sh: 'Video cerita hidup orang atau budaya tempat lain' },
  { q: 'Di kerja kelompok, bagian yang paling kamu nikmati…', st: 'Ngitung, nyusun data, atau bikin alat', sh: 'Wawancara, nulis, atau presentasi' },
  { q: 'Ada berita viral. Kamu paling penasaran…', st: 'Fakta ilmiahnya, bener nggak sih?', sh: 'Kenapa orang ramai membicarakannya' },
  { q: 'Tugas yang bikin kamu lupa waktu…', st: 'Soal yang punya satu jawaban pasti', sh: 'Diskusi yang jawabannya bisa beda-beda' },
  { q: 'Kalau bikin konten, topikmu…', st: 'Eksperimen, teknologi, fakta sains', sh: 'Sejarah, budaya, isu sosial, review buku atau film' },
  { q: 'Liburan ke kota baru, yang paling menarik…', st: 'Bangunan, alam, dan cara kerja transportasinya', sh: 'Kebiasaan warga, bahasa, dan sejarah tempatnya' },
  { q: 'Temanmu curhat soal masalah. Kamu biasanya…', st: 'Bantu urai masalahnya langkah demi langkah', sh: 'Dengerin dulu dan pahami perasaannya' },
  { q: 'Proyek sekolah bebas, kamu pilih…', st: 'Bikin alat atau eksperimen sederhana', sh: 'Bikin survei atau liputan tentang lingkungan sekitar' },
  { q: 'Game atau aplikasi paling seru buatmu…', st: 'Yang menantang logika dan strategi', sh: 'Yang ceritanya kuat dan karakternya hidup' },
  { q: 'Kamu paling bangga waktu…', st: 'Berhasil memecahkan masalah yang susah', sh: 'Berhasil meyakinkan atau membantu orang lain' },
];

export const REMINDER = 'Ini panduan awal, bukan penentu mutlak. Minatmu bisa berkembang.';

export const TYPES = {
  st: {
    name: 'Cara Kerja',
    core: 'Kamu penasaran gimana dunia bekerja, dan senang membuktikannya sendiri.',
    strengths: 'Logika, angka, eksperimen, merancang solusi',
    subjects: ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Informatika'],
    jobs: ['Dokter', 'Insinyur', 'Programmer', 'Peneliti', 'Analis data'],
    next: 'Coba materi dan latihan soal Sains-Teknologi di Ruangguru.',
  },
  sh: {
    name: 'Manusia',
    core: 'Kamu penasaran sama manusia: apa yang mereka pikirkan, rasakan, dan perjuangkan.',
    strengths: 'Komunikasi, empati, berpikir kritis, melihat gambaran besar',
    subjects: ['Ekonomi', 'Sosiologi', 'Geografi', 'Sejarah', 'Bahasa'],
    jobs: ['Diplomat', 'Jurnalis', 'Psikolog', 'Pengacara', 'Guru'],
    next: 'Coba materi dan latihan soal Sosial-Humaniora di Ruangguru.',
  },
  dd: {
    name: 'Dua Dunia',
    core: 'Kamu nggak mau dikotak-kotakkan, dan itu justru kekuatanmu.',
    strengths: 'Menghubungkan ide dari dua bidang, fleksibel, kreatif',
    subjects: ['Matematika', 'Biologi', 'Informatika', 'Ekonomi', 'Sosiologi'],
    jobs: ['Desainer produk', 'Perencana kota', 'Ahli kebijakan kesehatan', 'Ekonom', 'Jurnalis sains'],
    next: 'Coba materi dari dua rumpun, lihat mana yang paling bikin semangat.',
  },
};

// FR-11: count st and sh; |st - sh| <= 2 -> dd, otherwise the higher one. "Dua-duanya seru" adds nothing.
export function scoreType(answers) {
  const st = answers.filter((a) => a === 'st').length, sh = answers.filter((a) => a === 'sh').length;
  if (Math.abs(st - sh) <= 2) return 'dd';
  return st > sh ? 'st' : 'sh';
}
