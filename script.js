
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

/* ===== KATALOG ANIME + FILTER GENRE ===== */

let animeCatalog = [];
let selectedAnimeGenre = "__all";

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function normalizeGenres(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function getAnimeTitle(anime) {
  return anime.title_english || anime.title || anime.title_japanese || "Anime tanpa judul";
}

function renderGenreFilters() {
  const container = document.getElementById("genreFilters");
  if (!container) return;

  const genres = [...new Set(animeCatalog.flatMap((anime) => normalizeGenres(anime.genres)))];
  genres.sort((a, b) => a.localeCompare(b, "id"));

  const buttons = [{ value: "__all", label: "Semua" }, ...genres.map((genre) => ({
    value: genre, label: genre
  }))];

  container.innerHTML = buttons.map((item) => `
    <button type="button"
      class="genre-chip${selectedAnimeGenre === item.value ? " active" : ""}"
      data-genre="${escapeHTML(item.value)}"
      aria-pressed="${selectedAnimeGenre === item.value}">
      ${escapeHTML(item.label)}
    </button>
  `).join("");
}

function renderAnimeCatalog() {
  const container = document.getElementById("anime-list");
  const count = document.getElementById("catalogCount");
  const searchInput = document.getElementById("search");
  if (!container) return;

  const keyword = (searchInput?.value || "").trim().toLocaleLowerCase("id");
  const filtered = animeCatalog.filter((anime) => {
    const title = `${getAnimeTitle(anime)} ${anime.title_japanese || ""}`.toLocaleLowerCase("id");
    const genres = normalizeGenres(anime.genres);
    const matchesKeyword = title.includes(keyword) ||
      genres.some((genre) => genre.toLocaleLowerCase("id").includes(keyword));
    const matchesGenre = selectedAnimeGenre === "__all" ||
      genres.some((genre) => genre.toLocaleLowerCase("id") === selectedAnimeGenre.toLocaleLowerCase("id"));
    return matchesKeyword && matchesGenre;
  });

  if (count) count.textContent = `${filtered.length} anime`;
  if (!filtered.length) {
    container.innerHTML = '<p class="empty">Anime tidak ditemukan untuk pencarian atau genre ini.</p>';
    return;
  }

  container.innerHTML = filtered.map((anime) => {
    const title = getAnimeTitle(anime);
    const genres = normalizeGenres(anime.genres);
    const poster = anime.thumbnail_path || anime.thumbnail_url || "";
    const rating = anime.rating == null ? "" : `Rating ${escapeHTML(anime.rating)}/10`;
    return `
      <article class="anime-card">
        ${poster
          ? `<img class="catalog-poster" src="${escapeHTML(poster)}" alt="Poster ${escapeHTML(title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="poster-placeholder" style="display:none" aria-hidden="true">星</div>`
          : '<div class="poster-placeholder" aria-hidden="true">星</div>'}
        <h3>${escapeHTML(title)}</h3>
        ${rating ? `<p class="anime-rating">${rating}</p>` : ""}
        <p class="anime-genres">${genres.length ? escapeHTML(genres.join(" · ")) : "Genre belum ditambahkan"}</p>
      </article>
    `;
  }).join("");
}

function searchAnime() {
  renderAnimeCatalog();
}

async function loadAnimeCatalog() {
  const container = document.getElementById("anime-list");
  const count = document.getElementById("catalogCount");
  if (container) container.innerHTML = '<p class="empty">Memuat katalog anime...</p>';

  const { data, error } = await anistreamDB
    .from("anime")
    .select("id,title_english,title_japanese,rating,thumbnail_path,genres,is_published,created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal memuat katalog anime:", error.message);
    if (container) container.innerHTML = '<p class="empty">Katalog belum bisa dimuat. Periksa policy SELECT publik pada tabel anime.</p>';
    if (count) count.textContent = "Gagal memuat";
    return;
  }

  animeCatalog = data || [];
  renderGenreFilters();
  renderAnimeCatalog();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-genre]");
  if (!button) return;
  selectedAnimeGenre = button.dataset.genre || "__all";
  renderGenreFilters();
  renderAnimeCatalog();
});

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
  loadAnimeCatalog();
});

checkAniStreamLogin();
