
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


/* ===== KATALOG ANIME SUPABASE + FILTER GENRE ===== */
const genreFilter = document.getElementById("genre-filter");
const animeList = document.getElementById("anime-list");
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
    animeList.innerHTML = '<p class="empty">Belum ada anime yang cocok dengan genre ini.</p>';
    return;
  }

  animeList.innerHTML = filtered.map(a => {
    const title = a.title_english || "Tanpa judul";
    const genres = catalogGenres(a.genres);
    const poster = a.thumbnail_path
      ? `<img class="poster" src="${catalogSafeText(a.thumbnail_path)}" alt="Poster ${catalogSafeText(title)}" loading="lazy">`
      : '<div class="poster"><span class="poster-symbol">星</span></div>';
    const tags = genres.map(g => `<span class="genre-tag">${catalogSafeText(g)}</span>`).join("");
    const rating = a.rating == null ? "" : `<p class="anime-rating">Rating: ${catalogSafeText(a.rating)}/10</p>`;
    return `<article class="anime-card" role="button" tabindex="0" data-anime-id="${catalogSafeText(a.id)}" data-title="${catalogSafeText(title)}" aria-label="Detail ${catalogSafeText(title)}">
      ${poster}<h3>${catalogSafeText(title)}</h3>
      ${a.title_japanese ? `<p>${catalogSafeText(a.title_japanese)}</p>` : ""}
      ${rating}
      <p class="detail-muted">Status: ${a.status === "complete" ? "Complete" : "Ongoing"}</p>
      <div class="genre-tags">${tags || '<span class="genre-tag">Genre belum diisi</span>'}</div>
    </article>`;
  }).join("");
}

async function loadAnimeCatalog() {
  if (!animeList) return;
  animeList.innerHTML = '<p class="empty">Memuat katalog anime…</p>';
  try {
    const { data, error } = await anistreamDB.from("anime")
      .select("id,title_english,title_japanese,synopsis,rating,thumbnail_path,genres,status,is_published,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    publicAnimeRows = (data || []).filter(anime => (anime.status || "ongoing") === "ongoing");
    rebuildGenreFilter(publicAnimeRows);
    renderAnimeCatalog(publicAnimeRows);
    renderHotAnime(publicAnimeRows);
  } catch (error) {
    console.error("Gagal memuat katalog anime:", error.message || error);
    animeList.innerHTML = '<p class="empty">Katalog belum bisa dimuat. Periksa koneksi dan kebijakan baca tabel anime di Supabase.</p>';
  }
}

if (genreFilter) genreFilter.addEventListener("change", () => renderAnimeCatalog(publicAnimeRows));
document.addEventListener("DOMContentLoaded", loadAnimeCatalog);


/* ===== DETAIL ANIME & HOT ANIME ===== */
let currentDetailAnime = null;

function detailSafe(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}

function renderHotAnime(rows) {
  const target = document.getElementById("hot-anime-list");
  if (!target) return;
  const hot = [...rows]
    .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
    .slice(0, 6);
  if (!hot.length) {
    target.innerHTML = '<p class="empty">Belum ada anime untuk ditampilkan.</p>';
    return;
  }
  target.innerHTML = hot.map(a => {
    const title = a.title_english || "Tanpa judul";
    const poster = a.thumbnail_path
      ? `<img class="poster" src="${detailSafe(a.thumbnail_path)}" alt="Poster ${detailSafe(title)}" loading="lazy">`
      : '<div class="poster poster-one"><span class="poster-symbol">星</span></div>';
    return `<article class="anime-card" role="button" tabindex="0" data-anime-id="${detailSafe(a.id)}" aria-label="Detail ${detailSafe(title)}">
      ${poster}<h3>${detailSafe(title)}</h3>
      <p>⭐ ${a.rating == null ? "Belum ada rating" : detailSafe(a.rating + "/10")}</p>
    </article>`;
  }).join("");
}

function openAnimeDetail(animeId) {
  const anime = publicAnimeRows.find(item => String(item.id) === String(animeId));
  if (!anime) return;
  currentDetailAnime = anime;
  const modal = document.getElementById("anime-detail-modal");
  const content = document.getElementById("detail-content");
  if (!modal || !content) return;
  const title = anime.title_english || "Tanpa judul";
  const poster = anime.thumbnail_path
    ? `<img class="detail-poster" src="${detailSafe(anime.thumbnail_path)}" alt="Poster ${detailSafe(title)}">`
    : '<div class="detail-poster"></div>';
  const genres = catalogGenres(anime.genres);
  content.innerHTML = `
    <div class="detail-hero">
      ${poster}
      <div>
        <p class="eyebrow">DETAIL ANIME</p>
        <h2 class="detail-title" id="detail-title">${detailSafe(title)}</h2>
        ${anime.title_japanese ? `<p class="detail-muted">${detailSafe(anime.title_japanese)}</p>` : ""}
        <p class="detail-muted">⭐ Rating: ${anime.rating == null ? "Belum tersedia" : detailSafe(anime.rating + "/10")}</p>
        <p class="detail-muted">Status: ${detailSafe(anime.status || "ongoing") === "complete" ? "Complete" : "Ongoing"}</p>
      </div>
    </div>
    <div class="detail-tags">${genres.length ? genres.map(g => `<span>${detailSafe(g)}</span>`).join("") : '<span>Genre belum diisi</span>'}</div>
    <h3 class="detail-section-title">Sinopsis</h3>
    <p class="detail-synopsis">${detailSafe(anime.synopsis || "Sinopsis belum tersedia.")}</p>
    <h3 class="detail-section-title">Katalog Episode</h3>
    <div class="detail-empty">Katalog episode akan ditampilkan setelah data episode dihubungkan ke halaman ini. Data anime kamu tidak diubah.</div>
  `;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAnimeDetail() {
  const modal = document.getElementById("anime-detail-modal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

document.addEventListener("click", event => {
  const card = event.target.closest(".anime-card[data-anime-id]");
  if (card) openAnimeDetail(card.dataset.animeId);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAnimeDetail();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".anime-card[data-anime-id]")) {
    event.preventDefault();
    openAnimeDetail(event.target.dataset.animeId);
  }
});


/* Sinkronkan pencarian dengan kartu katalog yang dirender dari Supabase. */
function applyAnimeSearch() {
  const input = document.getElementById("search");
  if (!input) return;
  const keyword = input.value.trim().toLowerCase();
  document.querySelectorAll(".anime-card").forEach(card => {
    const title = (card.dataset.title || card.querySelector("h3")?.textContent || "").toLowerCase();
    card.style.display = title.includes(keyword) ? "" : "none";
  });
}
const animeSearchInput = document.getElementById("search");
if (animeSearchInput) animeSearchInput.addEventListener("input", applyAnimeSearch);
