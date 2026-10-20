
/* ===== KONEKSI SUPABASE ANISTREAM ===== */

const SUPABASE_URL = "https://quzojidxduqghuwkhaay.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fnw0E3q3Zru7domEB7Wryg_kb0h9lCu";

const anistreamDB = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

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

// Fitur pencarian anime
function searchAnime() {
  const searchInput = document.getElementById("search");
  const animeCards = document.querySelectorAll(".anime-card");

  if (!searchInput) return;

  const keyword = searchInput.value
    .trim()
    .toLowerCase();

  let visibleCount = 0;

  animeCards.forEach((card) => {
    const title = (
      card.dataset.title ||
      card.querySelector("h3")?.textContent ||
      ""
    ).toLowerCase();

    const isMatch = title.includes(keyword);

    card.style.display = isMatch ? "" : "none";

    if (isMatch) {
      visibleCount++;
    }
  });

  if (keyword && visibleCount === 0) {
    showMessage("Anime tidak ditemukan.");
  }
}

// Navigasi menu bawah
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

  showMessage(
    messages[tab] || "Fitur akan segera hadir!"
  );
}

// Pesan ketika halaman selesai dibuka
document.addEventListener("DOMContentLoaded", () => {
  console.log("AniStream berhasil dimuat!");

  const crystal = document.getElementById("crystal");

  if (crystal) {
    crystal.textContent = "0";
  }
});

/* ===== TES KONEKSI ANISTREAM ===== */

console.log(
  "Supabase library:",
  typeof window.supabase
);

console.log(
  "AniStream DB:",
  typeof anistreamDB
);

/* ===== GOOGLE LOGIN ANISTREAM ===== */

const googleLoginBtn = document.getElementById("googleLoginBtn");

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    googleLoginBtn.disabled = true;
    googleLoginBtn.textContent = "Menghubungkan...";

    try {
      const { data, error } = await anistreamDB.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.href
        }
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      alert("Login gagal: " + error.message);
      googleLoginBtn.disabled = false;
      googleLoginBtn.textContent = "Login dengan Google";
    }
  });
}
