
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
