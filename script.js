
/* ===== KONEKSI SUPABASE ANISTREAM ===== */

const SUPABASE_URL = "https://quzojidxduqghuwkhaay.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fnw0E3q3Zru7domEB7Wryg_kb0h9lCu";

const anistreamDB = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

/* ===== PESAN ANIStream ===== */

function showMessage(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* ===== PENCARIAN ANIME ===== */

function searchAnime() {
  const input = document.getElementById("search");
  const cards = document.querySelectorAll(".anime-card");

  if (!input) return;

  const keyword = input.value.trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach((card) => {
    const title = (
      card.dataset.title ||
      card.querySelector("h3")?.textContent ||
      ""
    ).toLowerCase();

    const match = title.includes(keyword);
    card.style.display = match ? "" : "none";

    if (match) visibleCount++;
  });

  if (keyword && visibleCount === 0) {
    showMessage("Anime tidak ditemukan.");
  }
}

/* ===== NAVIGASI ===== */

function setTab(button, tab) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  button.classList.add("active");

  const messages = {
    Beranda: "Kamu berada di halaman Beranda.",
    Jadwal: "Fitur Jadwal Anime akan segera hadir!",
    Subscribe: "Fitur Subscribe Anime akan segera hadir!",
    Riwayat: "Riwayat tontonan akan tersedia di sini.",
    Aktivitas: "Aktivitas teman dan pengumuman akan segera hadir!"
  };

  showMessage(messages[tab] || "Fitur akan segera hadir!");
}

/* ===== PROFIL PENGGUNA ===== */

function updateProfileUI(profile, user) {
  const nameElement = document.querySelector(".profile-info h2");
  const infoElement = document.querySelector(".profile-info p");
  const avatarElement = document.querySelector(".avatar");
  const crystalElement = document.getElementById("crystal");
  const loginButton = document.getElementById("googleLoginBtn");

  if (!profile || !user) {
    if (nameElement) {
      const badge = nameElement.querySelector(".badge");
      nameElement.textContent = "AniStream ";
      if (badge) nameElement.appendChild(badge);
    }

    if (infoElement) {
      infoElement.textContent = "Belum login";
    }

    if (avatarElement) avatarElement.textContent = "A";
    if (crystalElement) crystalElement.textContent = "0";

    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "Login dengan Google";
    }

    return;
  }

  const displayName =
    profile.username ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "Pengguna AniStream";

  if (nameElement) {
    const badge = nameElement.querySelector(".badge");
    nameElement.textContent = displayName + " ";
    if (badge) nameElement.appendChild(badge);
  }

  if (infoElement) {
    infoElement.textContent =
      `ID: #${profile.public_id} · Level ${profile.level}`;
  }

  if (avatarElement) {
    avatarElement.textContent =
      displayName.charAt(0).toUpperCase();
  }

  if (crystalElement) {
    crystalElement.textContent =
      Number(profile.crystal).toLocaleString("id-ID");
  }

  if (loginButton) {
    loginButton.disabled = false;
    loginButton.textContent = "Keluar";
  }
}

/* ===== AMBIL PROFIL DARI SUPABASE ===== */

async function loadAniStreamProfile(user) {
  if (!user) {
    updateProfileUI(null, null);
    return;
  }

  const { data: profile, error } = await anistreamDB
    .from("profiles")
    .select("public_id, username, level, crystal")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Gagal mengambil profil:", error.message);
    showMessage("Profil gagal dimuat. Coba muat ulang halaman.");
    return;
  }

  updateProfileUI(profile, user);
  console.log("Profil AniStream berhasil dimuat.");
}

/* ===== GOOGLE LOGIN DAN LOGOUT ===== */

const googleLoginBtn = document.getElementById("googleLoginBtn");

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    googleLoginBtn.disabled = true;

    try {
      const { data: sessionData } =
        await anistreamDB.auth.getSession();

      if (sessionData.session) {
        const { error } = await anistreamDB.auth.signOut();

        if (error) throw error;

        updateProfileUI(null, null);
        showMessage("Kamu berhasil logout.");
        return;
      }

      googleLoginBtn.textContent = "Menghubungkan...";

      const { error } = await anistreamDB.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin +
            window.location.pathname
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error("Autentikasi gagal:", error.message);
      showMessage("Login/logout gagal. Silakan coba lagi.");

      googleLoginBtn.disabled = false;
      googleLoginBtn.textContent = "Login dengan Google";
    }
  });
}

/* ===== STATUS LOGIN DAN PEMBARUAN SESI ===== */

async function checkAniStreamLogin() {
  const { data, error } = await anistreamDB.auth.getSession();

  if (error) {
    console.error("Gagal memeriksa sesi:", error.message);
    return;
  }

  await loadAniStreamProfile(data.session?.user ?? null);
}

anistreamDB.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION") return;

  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    // Jalankan setelah callback autentikasi selesai.
    Promise.resolve().then(() => {
      loadAniStreamProfile(session?.user ?? null);
    });
  }

  if (event === "SIGNED_OUT") {
    updateProfileUI(null, null);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("AniStream berhasil dimuat!");
});

checkAniStreamLogin();


/* ===== KATALOG ANIME SUPABASE + FILTER GENRE + HOT ANIME ===== */
const genreFilter = document.getElementById("genre-filter");
const animeList = document.getElementById("anime-list");
const hotAnimeList = document.getElementById("hot-anime-list");
let publishedAnimeRows = [];
let publicAnimeRows = [];

function catalogSafeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}

function catalogGenres(value) {
  if (Array.isArray(value)) return value.map(g => String(g).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\n]/).map(g => g.trim()).filter(Boolean);
  return [];
}

function catalogPoster(anime) {
  const title = anime.title_english || anime.title_japanese || "Anime";
  return anime.thumbnail_path
    ? `<img class="poster" src="${catalogSafeText(anime.thumbnail_path)}" alt="Poster ${catalogSafeText(title)}" loading="lazy">`
    : '<div class="poster"><span class="poster-symbol">星</span></div>';
}

function catalogCard(anime) {
  const title = anime.title_english || anime.title_japanese || "Tanpa judul";
  const genres = catalogGenres(anime.genres);
  const tags = genres.map(g => `<span class="genre-tag">${catalogSafeText(g)}</span>`).join("");
  const rating = anime.rating == null ? "" : `<p class="anime-rating">Rating: ${catalogSafeText(anime.rating)}/10</p>`;
  return `<article class="anime-card" data-title="${catalogSafeText(title)}">
    ${catalogPoster(anime)}
    <h3>${catalogSafeText(title)}</h3>
    ${anime.title_japanese ? `<p>${catalogSafeText(anime.title_japanese)}</p>` : ""}
    ${rating}
    ${anime.synopsis ? `<p>${catalogSafeText(anime.synopsis)}</p>` : ""}
    <div class="genre-tags">${tags || '<span class="genre-tag">Genre belum diisi</span>'}</div>
  </article>`;
}

function rebuildGenreFilter(rows) {
  if (!genreFilter) return;
  const selected = genreFilter.value;
  const genres = [...new Set(rows.flatMap(a => catalogGenres(a.genres)))];
  genres.sort((a,b) => a.localeCompare(b, "id"));
  genreFilter.innerHTML = '<option value="">Semua genre</option>' +
    genres.map(g => `<option value="${catalogSafeText(g)}">${catalogSafeText(g)}</option>`).join("");
  if (genres.includes(selected)) genreFilter.value = selected;
}

function renderAnimeCatalog(rows) {
  if (!animeList) return;
  const selected = genreFilter?.value || "";
  const filtered = rows.filter(a => !selected ||
    catalogGenres(a.genres).some(g => g.toLowerCase() === selected.toLowerCase()));

  if (!filtered.length) {
    animeList.innerHTML = rows.length
      ? '<p class="empty">Belum ada anime yang cocok dengan genre ini.</p>'
      : '<p class="empty">Belum ada anime ongoing yang dipublikasikan. Periksa status dan publikasi anime di dashboard admin.</p>';
    return;
  }
  animeList.innerHTML = filtered.map(catalogCard).join("");
}

function renderHotAnime(rows) {
  if (!hotAnimeList) return;
  const sorted = [...rows].sort((a, b) => {
    const ratingA = Number(a.rating) || 0;
    const ratingB = Number(b.rating) || 0;
    return ratingB - ratingA;
  });
  hotAnimeList.innerHTML = sorted.length
    ? sorted.slice(0, 12).map(catalogCard).join("")
    : '<p class="empty">Belum ada anime yang dipublikasikan untuk ditampilkan.</p>';
}

async function loadAnimeCatalog() {
  if (!animeList) return;
  animeList.innerHTML = '<p class="empty">Memuat katalog anime…</p>';
  if (hotAnimeList) hotAnimeList.innerHTML = '<p class="empty">Memuat Hot Anime…</p>';
  try {
    const { data, error } = await anistreamDB.from("anime")
      .select("id,title_english,title_japanese,synopsis,rating,thumbnail_path,genres,status,is_published,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (error) throw error;

    publishedAnimeRows = data || [];
    publicAnimeRows = publishedAnimeRows.filter(anime =>
      String(anime.status || "ongoing").toLowerCase() === "ongoing"
    );

    rebuildGenreFilter(publicAnimeRows);
    renderAnimeCatalog(publicAnimeRows);
    renderHotAnime(publishedAnimeRows);
    console.log(`AniStream katalog: ${publishedAnimeRows.length} anime terpublikasi, ${publicAnimeRows.length} anime ongoing.`);
  } catch (error) {
    console.error("Gagal memuat katalog anime:", error.message || error);
    const message = 'Katalog gagal dimuat. Periksa kebijakan SELECT tabel anime di Supabase.';
    animeList.innerHTML = `<p class="empty">${message}</p>`;
    if (hotAnimeList) hotAnimeList.innerHTML = `<p class="empty">${message}</p>`;
  }
}

if (genreFilter) genreFilter.addEventListener("change", () => renderAnimeCatalog(publicAnimeRows));
document.addEventListener("DOMContentLoaded", loadAnimeCatalog);
