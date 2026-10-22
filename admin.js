/* AniStream Admin — gunakan publishable key saja, jangan gunakan service_role key. */
const SUPABASE_URL = "https://quzojidxduqghuwkhaay.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fnw0E3q3Zru7domEB7Wryg_kb0h9lCu";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
const state = { user: null, anime: [], episodes: [], role: null };

function status(message, type = "") {
  const el = $("status");
  el.textContent = message;
  el.className = `status ${type}`.trim();
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function isStaff(role) { return ["developer", "admin", "owner"].includes(String(role || "").toLowerCase()); }
function formatType(type, number) {
  if (type === "ova") return "OVA";
  if (type === "movie") return "Movie";
  return `Episode ${number ?? "?"}`;
}

async function initialize() {
  const { data, error } = await db.auth.getSession();
  if (error) { status("Gagal memeriksa sesi: " + error.message, "error"); return; }
  await handleSession(data.session);
  db.auth.onAuthStateChange((_event, session) => {
    // Tunda operasi jaringan agar tidak berjalan di dalam callback auth.
    setTimeout(() => handleSession(session), 0);
  });
}

async function handleSession(session) {
  state.user = session?.user || null;
  $("loginPanel").classList.toggle("hidden", Boolean(state.user));
  $("logoutBtn").classList.toggle("hidden", !state.user);
  $("dashboard").classList.add("hidden");
  if (!state.user) {
    status("Silakan login dengan akun yang memiliki role developer, admin, atau owner.");
    return;
  }

  status("Memeriksa izin akun…");
  const { data: profile, error } = await db.from("profiles")
    .select("role")
    .eq("id", state.user.id)
    .maybeSingle();
  if (error) {
    status("Tidak bisa membaca role profil. Periksa kebijakan RLS tabel profiles. Detail: " + error.message, "error");
    return;
  }
  state.role = profile?.role || "user";
  if (!isStaff(state.role)) {
    status(`Akun ini belum memiliki izin admin. Role saat ini: ${state.role}. Minta pemilik proyek mengatur role melalui cara yang aman.`, "error");
    return;
  }
  $("dashboard").classList.remove("hidden");
  status(`Login sebagai ${state.user.email || "pengguna"} · Role: ${state.role}`, "good");
  await loadAnime();
}

async function login() {
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href }
  });
  if (error) status("Login gagal: " + error.message, "error");
}
async function logout() {
  const { error } = await db.auth.signOut();
  if (error) status("Gagal keluar: " + error.message, "error");
}

async function loadAnime() {
  status("Memuat katalog anime…");
  const { data, error } = await db.from("anime")
    .select("id,title_english,title_japanese,synopsis,genres,rating,thumbnail_path,is_published,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) {
    status("Gagal memuat anime: " + error.message + "\nPastikan tabel anime sudah dibuat dan policy admin mengizinkan role ini.", "error");
    return;
  }
  state.anime = data || [];
  renderAnimeList();
  renderAnimeSelect();
  await loadEpisodes();
  status(`Katalog dimuat: ${state.anime.length} anime.`, "good");
}

function renderAnimeList() {
  const query = $("filterAnime").value.trim().toLowerCase();
  const rows = state.anime.filter(a => `${a.title_english} ${a.title_japanese || ""} ${(a.genres || []).join(" ")}`.toLowerCase().includes(query));
  if (!rows.length) {
    $("animeList").innerHTML = '<p class="muted">Belum ada anime yang cocok. Tambahkan melalui formulir di atas.</p>';
    return;
  }
  $("animeList").innerHTML = rows.map(a => {
    const poster = a.thumbnail_path || "";
    return `<article class="anime-item">
      ${poster ? `<img class="poster" src="${escapeHTML(poster)}" alt="Poster" loading="lazy" onerror="this.style.visibility='hidden'">` : '<div class="poster" aria-hidden="true"></div>'}
      <div class="anime-meta"><strong>${escapeHTML(a.title_english)}</strong><div class="muted">${escapeHTML(a.title_japanese || "Judul Jepang belum diisi")} · Rating: ${a.rating == null ? "—" : escapeHTML(a.rating)}</div><div class="muted">Genre: ${escapeHTML((a.genres || []).join(", ") || "Belum diisi")}</div><span class="pill">${a.is_published ? "Dipublikasikan" : "Draft"}</span> <span class="pill">${a.status === "complete" ? "Complete" : "Ongoing"}</span></div>
      <div class="item-actions"><button class="secondary small" data-edit-anime="${a.id}">Edit</button><button class="secondary small" data-episodes-anime="${a.id}">Episode</button><button class="danger small" data-delete-anime="${a.id}">Hapus</button></div>
    </article>`;
  }).join("");
}
function renderAnimeSelect() {
  const previous = $("episodeAnime").value;
  $("episodeAnime").innerHTML = '<option value="">Pilih anime…</option>' + state.anime.map(a => `<option value="${a.id}">${escapeHTML(a.title_english)}${a.is_published ? "" : " (Draft)"}</option>`).join("");
  if (state.anime.some(a => a.id === previous)) $("episodeAnime").value = previous;
}

async function loadEpisodes() {
  const { data, error } = await db.from("episodes")
    .select("id,anime_id,episode_type,episode_number,title,video_path,is_published,created_at")
    .order("created_at", { ascending: false });
  if (error) { $("episodeList").innerHTML = `<p class="muted">Episode belum bisa dimuat: ${escapeHTML(error.message)}</p>`; return; }
  state.episodes = data || [];
  renderEpisodes();
}
function renderEpisodes() {
  const animeId = $("episodeAnime").value;
  const rows = state.episodes.filter(e => e.anime_id === animeId);
  if (!animeId) { $("episodeList").innerHTML = '<p class="muted">Pilih anime untuk melihat daftar episodenya.</p>'; return; }
  if (!rows.length) { $("episodeList").innerHTML = '<p class="muted">Belum ada episode untuk anime ini.</p>'; return; }
  $("episodeList").innerHTML = rows.map(e => `<div class="episode-row"><div><strong>${escapeHTML(formatType(e.episode_type,e.episode_number))}</strong>${e.title ? ` — ${escapeHTML(e.title)}` : ""}<div class="muted">${e.is_published ? "Dipublikasikan" : "Draft"}${e.video_path ? " · URL video tersedia" : " · URL video belum diisi"}</div></div><div class="item-actions"><button class="secondary small" data-edit-episode="${e.id}">Edit</button><button class="danger small" data-delete-episode="${e.id}">Hapus</button></div></div>`).join("");
}

function resetAnimeForm() {
  $("animeForm").reset(); $("animeId").value = ""; $("thumbnailUrl").value = ""; $("formTitle").textContent = "Tambah anime"; $("saveAnimeBtn").textContent = "Simpan anime";
}
function editAnime(id) {
  const a = state.anime.find(item => item.id === id); if (!a) return;
  $("animeId").value = a.id; $("titleEnglish").value = a.title_english || ""; $("titleJapanese").value = a.title_japanese || ""; $("synopsis").value = a.synopsis || ""; $("genres").value = (a.genres || []).join(", "); $("rating").value = a.rating ?? ""; $("animeStatus").value = a.status === "complete" ? "complete" : "ongoing"; $("thumbnailUrl").value = a.thumbnail_path || ""; $("published").checked = Boolean(a.is_published);
  $("formTitle").textContent = "Edit anime"; $("saveAnimeBtn").textContent = "Simpan perubahan"; window.scrollTo({top:0,behavior:"smooth"});
}

async function uploadThumbnail(file, animeId) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("File thumbnail harus berupa gambar.");
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${animeId}/${Date.now()}.${extension}`;
  const { error } = await db.storage.from("anime-thumbnails").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error("Upload thumbnail gagal: " + error.message + ". Pastikan bucket anime-thumbnails ada dan policy upload mengizinkan akun staff.");
  const { data } = db.storage.from("anime-thumbnails").getPublicUrl(path);
  return data.publicUrl;
}

async function saveAnime(event) {
  event.preventDefault();
  const button = $("saveAnimeBtn"); button.disabled = true;
  try {
    const id = $("animeId").value || crypto.randomUUID();
    let thumbnailPath = $("thumbnailUrl").value.trim() || null;
    const file = $("thumbnail").files[0];
    if (file) thumbnailPath = await uploadThumbnail(file, id);
    const payload = {
      title_english: $("titleEnglish").value.trim(),
      title_japanese: $("titleJapanese").value.trim() || null,
      synopsis: $("synopsis").value.trim() || null,
      genres: [...new Set($("genres").value.split(/[,;\n]/).map(g => g.trim()).filter(Boolean))],
      rating: $("rating").value === "" ? null : Number($("rating").value),
      status: $("animeStatus").value === "complete" ? "complete" : "ongoing",
      thumbnail_path: thumbnailPath,
      is_published: $("published").checked,
      updated_at: new Date().toISOString()
    };
    if (!payload.title_english) throw new Error("Judul utama wajib diisi.");
    if (payload.rating !== null && (payload.rating < 0 || payload.rating > 10)) throw new Error("Rating harus antara 0 dan 10.");
    let result;
    if ($("animeId").value) {
      result = await db.from("anime").update(payload).eq("id", id).select("id").single();
    } else {
      result = await db.from("anime").insert({...payload, id, created_by: state.user.id}).select("id").single();
    }
    if (result.error) throw result.error;
    status("Anime berhasil disimpan.", "good"); resetAnimeForm(); await loadAnime();
  } catch (error) { status("Gagal menyimpan anime: " + (error.message || error), "error"); }
  finally { button.disabled = false; }
}

function resetEpisodeForm() {
  const animeId = $("episodeAnime").value;
  $("episodeForm").reset(); $("episodeId").value = ""; $("episodeAnime").value = animeId; $("episodeType").value = "episode"; $("episodeNumber").disabled = false; $("episodeNumber").required = true; $("episodeFormTitle").textContent = "Tambah episode untuk anime"; $("saveEpisodeBtn").textContent = "Simpan episode"; renderEpisodes();
}
function updateEpisodeNumberField() {
  const isNormal = $("episodeType").value === "episode";
  $("episodeNumber").disabled = !isNormal; $("episodeNumber").required = isNormal;
  if (!isNormal) $("episodeNumber").value = "";
  $("episodeNumber").placeholder = isNormal ? "Contoh: 1" : "Tidak diperlukan untuk OVA/Movie";
}
function editEpisode(id) {
  const e = state.episodes.find(item => item.id === id); if (!e) return;
  $("episodeId").value = e.id; $("episodeAnime").value = e.anime_id; $("episodeType").value = e.episode_type; updateEpisodeNumberField(); $("episodeNumber").value = e.episode_number ?? ""; $("episodeTitle").value = e.title || ""; $("videoUrl").value = e.video_path || ""; $("episodePublished").checked = Boolean(e.is_published); $("episodeFormTitle").textContent = "Edit episode"; $("saveEpisodeBtn").textContent = "Simpan perubahan"; renderEpisodes(); window.scrollTo({top:document.querySelectorAll(".panel")[1].offsetTop,behavior:"smooth"});
}
async function saveEpisode(event) {
  event.preventDefault(); const button = $("saveEpisodeBtn"); button.disabled = true;
  try {
    const id = $("episodeId").value;
    const type = $("episodeType").value;
    const animeId = $("episodeAnime").value;
    if (!animeId) throw new Error("Pilih anime terlebih dahulu.");
    const number = type === "episode" ? Number($("episodeNumber").value) : null;
    if (type === "episode" && (!Number.isInteger(number) || number < 1)) throw new Error("Nomor episode biasa wajib berupa angka minimal 1.");
    const payload = {anime_id:animeId,episode_type:type,episode_number:number,title:$("episodeTitle").value.trim() || null,video_path:$("videoUrl").value.trim() || null,is_published:$("episodePublished").checked};
    const result = id ? await db.from("episodes").update(payload).eq("id",id).select("id").single() : await db.from("episodes").insert(payload).select("id").single();
    if (result.error) throw result.error;
    status("Episode berhasil disimpan.", "good"); resetEpisodeForm(); await loadEpisodes();
  } catch (error) { status("Gagal menyimpan episode: " + (error.message || error), "error"); }
  finally { button.disabled = false; }
}

async function deleteAnime(id) {
  const a = state.anime.find(item => item.id === id); if (!a || !confirm(`Hapus anime “${a.title_english}” beserta episode terkait?`)) return;
  const { error } = await db.from("anime").delete().eq("id",id);
  if (error) { status("Gagal menghapus anime: " + error.message, "error"); return; }
  status("Anime berhasil dihapus.", "good"); await loadAnime();
}
async function deleteEpisode(id) {
  const e = state.episodes.find(item => item.id === id); if (!e || !confirm(`Hapus ${formatType(e.episode_type,e.episode_number)}?`)) return;
  const { error } = await db.from("episodes").delete().eq("id",id);
  if (error) { status("Gagal menghapus episode: " + error.message, "error"); return; }
  status("Episode berhasil dihapus.", "good"); await loadEpisodes();
}

$("loginBtn").addEventListener("click", login);
$("logoutBtn").addEventListener("click", logout);
$("animeForm").addEventListener("submit", saveAnime);
$("episodeForm").addEventListener("submit", saveEpisode);
$("resetAnimeBtn").addEventListener("click", resetAnimeForm);
$("resetEpisodeBtn").addEventListener("click", resetEpisodeForm);
$("filterAnime").addEventListener("input", renderAnimeList);
$("episodeAnime").addEventListener("change", renderEpisodes);
$("episodeType").addEventListener("change", updateEpisodeNumberField);
$("animeList").addEventListener("click", (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.dataset.editAnime) editAnime(button.dataset.editAnime);
  if (button.dataset.deleteAnime) deleteAnime(button.dataset.deleteAnime);
  if (button.dataset.episodesAnime) { $("episodeAnime").value = button.dataset.episodesAnime; renderEpisodes(); document.querySelectorAll(".panel")[1].scrollIntoView({behavior:"smooth"}); }
});
$("episodeList").addEventListener("click", (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.dataset.editEpisode) editEpisode(button.dataset.editEpisode);
  if (button.dataset.deleteEpisode) deleteEpisode(button.dataset.deleteEpisode);
});
updateEpisodeNumberField();
initialize();
