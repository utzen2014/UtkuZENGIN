// ==========================================================
// UTKU ZENGİN — app.js
// Routing + Firebase (Auth / Firestore / Storage) + UI logic
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseApp = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

let isAdmin = false;

// ----------------------------------------------------------
// ROUTING
// ----------------------------------------------------------
const views = {
  home: document.getElementById("view-home"),
  about: document.getElementById("view-about"),
  blog: document.getElementById("view-blog"),
  post: document.getElementById("view-post"),
  projects: document.getElementById("view-projects"),
};

function showView(name){
  Object.values(views).forEach(v => { v.classList.remove("active"); v.classList.remove("view-enter"); });
  const target = views[name] || views.home;
  target.classList.add("active");
  // force reflow so animation retriggers
  void target.offsetWidth;
  target.classList.add("view-enter");
  window.scrollTo({top:0, behavior:"instant" in window ? "instant" : "auto"});
  document.querySelectorAll("[data-route]").forEach(el=>{
    el.classList.toggle("active", el.dataset.route === name);
  });
}

function routeFromHash(){
  const hash = (location.hash || "#home").replace("#","");
  if (hash.startsWith("post/")){
    const id = hash.split("/")[1];
    openPost(id);
    return;
  }
  if (views[hash]) showView(hash);
  else showView("home");
}

window.addEventListener("hashchange", routeFromHash);
document.querySelectorAll("[data-route]").forEach(el=>{
  el.addEventListener("click", (e)=>{
    e.preventDefault();
    location.hash = "#" + el.dataset.route;
  });
});

// ----------------------------------------------------------
// HELPERS
// ----------------------------------------------------------
function formatDate(ts){
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("tr-TR", {day:"2-digit", month:"long", year:"numeric"});
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function slugForName(name){
  return (name||"").trim().toLowerCase()
    .replace(/ç/g,"c").replace(/ğ/g,"g").replace(/ı/g,"i").replace(/ö/g,"o")
    .replace(/ş/g,"s").replace(/ü/g,"u")
    .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || "isimsiz";
}

function openModal(id){ document.getElementById(id).classList.add("visible"); }
function closeModal(id){ document.getElementById(id).classList.remove("visible"); }

// ----------------------------------------------------------
// AUTH / LOCK SYSTEM (shared admin account for blog + projects)
// ----------------------------------------------------------
onAuthStateChanged(auth, (user)=>{
  isAdmin = !!user;
  updateLockUI("blog");
  updateLockUI("proj");
});

function updateLockUI(prefix){
  const btn = document.getElementById(`${prefix}-lock-btn`);
  const label = document.getElementById(`${prefix}-lock-label`);
  const addBtn = document.getElementById(`${prefix}-add-btn`);
  const loginForm = document.getElementById(`${prefix}-login-form`);
  if (isAdmin){
    btn.classList.add("unlocked");
    label.textContent = "Kilit açık";
    btn.querySelector(".icon").textContent = "🔓";
    addBtn.classList.add("visible");
    loginForm.classList.remove("visible");
  } else {
    btn.classList.remove("unlocked");
    label.textContent = "Kilitli";
    btn.querySelector(".icon").textContent = "🔒";
    addBtn.classList.remove("visible");
  }
  // re-render admin-only controls in currently open post/comments
  refreshAdminControls();
}

function wireLock(prefix){
  const btn = document.getElementById(`${prefix}-lock-btn`);
  const loginForm = document.getElementById(`${prefix}-login-form`);
  const cancelBtn = document.getElementById(`${prefix}-login-cancel`);
  const submitBtn = document.getElementById(`${prefix}-login-submit`);
  const emailInput = document.getElementById(`${prefix}-login-email`);
  const passInput = document.getElementById(`${prefix}-login-pass`);
  const errorEl = document.getElementById(`${prefix}-login-error`);

  btn.addEventListener("click", async ()=>{
    if (isAdmin){
      await signOut(auth);
      return;
    }
    loginForm.classList.toggle("visible");
    errorEl.classList.remove("visible");
  });

  cancelBtn.addEventListener("click", ()=>{
    loginForm.classList.remove("visible");
    errorEl.classList.remove("visible");
  });

  submitBtn.addEventListener("click", async ()=>{
    errorEl.classList.remove("visible");
    try{
      await signInWithEmailAndPassword(auth, emailInput.value.trim(), passInput.value);
      emailInput.value = ""; passInput.value = "";
      loginForm.classList.remove("visible");
    }catch(err){
      errorEl.classList.add("visible");
    }
  });
}
wireLock("blog");
wireLock("proj");

// ==========================================================
// BLOG
// ==========================================================
let allPosts = [];
let activeTag = "all";

const postListEl = document.getElementById("blog-post-list");
const tagFiltersEl = document.getElementById("blog-tag-filters");

const postsQuery = query(collection(db,"posts"), orderBy("createdAt","desc"));
onSnapshot(postsQuery, (snap)=>{
  allPosts = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderTagFilters();
  renderPostList();
}, (err)=>{
  postListEl.innerHTML = `<div class="empty-state">Yazılar yüklenemedi. Firebase yapılandırmanı kontrol et.</div>`;
});

function renderTagFilters(){
  const tags = new Set();
  allPosts.forEach(p => (p.tags||[]).forEach(t=>tags.add(t)));
  tagFiltersEl.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className = "tag-tab" + (activeTag==="all" ? " active":"");
  allBtn.textContent = "Tümü";
  allBtn.addEventListener("click", ()=>{activeTag="all"; renderTagFilters(); renderPostList();});
  tagFiltersEl.appendChild(allBtn);
  [...tags].sort().forEach(t=>{
    const b = document.createElement("button");
    b.className = "tag-tab" + (activeTag===t ? " active":"");
    b.textContent = t;
    b.addEventListener("click", ()=>{activeTag=t; renderTagFilters(); renderPostList();});
    tagFiltersEl.appendChild(b);
  });
}

function renderPostList(){
  const filtered = activeTag==="all" ? allPosts : allPosts.filter(p=>(p.tags||[]).includes(activeTag));
  if (!filtered.length){
    postListEl.innerHTML = `<div class="empty-state">Henüz yazı yok.</div>`;
    return;
  }
  postListEl.innerHTML = "";
  filtered.forEach(p=>{
    const row = document.createElement("div");
    row.className = "post-row";
    row.innerHTML = `
      <div class="post-date">${formatDate(p.createdAt)}</div>
      <div class="post-main">
        <div class="post-title">${escapeHtml(p.title)}</div>
        <div class="post-desc">${escapeHtml(p.description||"")}</div>
        <div class="post-tags">${(p.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join("")}</div>
      </div>
      <div class="post-side"><span class="link-btn">Oku →</span></div>
    `;
    row.addEventListener("click", ()=>{ location.hash = "#post/" + p.id; });
    postListEl.appendChild(row);
  });
}

// ---- add post modal ----
const modalPost = "modal-post";
document.getElementById("blog-add-btn").addEventListener("click", ()=>{
  document.getElementById("modal-post-title").textContent = "Yeni yazı";
  document.getElementById("pf-title").value = "";
  document.getElementById("pf-desc").value = "";
  document.getElementById("pf-content").value = "";
  document.getElementById("pf-tags").value = "";
  document.getElementById("pf-image").value = "";
  document.getElementById("pf-status").textContent = "";
  document.getElementById("pf-status").classList.remove("error");
  openModal(modalPost);
});
document.getElementById("modal-post-close").addEventListener("click", ()=>closeModal(modalPost));
document.getElementById("pf-cancel").addEventListener("click", ()=>closeModal(modalPost));

document.getElementById("pf-submit").addEventListener("click", async ()=>{
  const title = document.getElementById("pf-title").value.trim();
  const description = document.getElementById("pf-desc").value.trim();
  const content = document.getElementById("pf-content").value.trim();
  const tags = document.getElementById("pf-tags").value.split(",").map(t=>t.trim()).filter(Boolean);
  const file = document.getElementById("pf-image").files[0];
  const statusEl = document.getElementById("pf-status");

  if (!title || !content){
    statusEl.textContent = "Başlık ve içerik zorunlu.";
    statusEl.classList.add("error");
    return;
  }
  statusEl.classList.remove("error");
  statusEl.textContent = "Yayınlanıyor…";

  try{
    let imageUrl = "";
    if (file){
      const path = `blog-images/${Date.now()}-${file.name}`;
      const sref = ref(storage, path);
      await uploadBytes(sref, file);
      imageUrl = await getDownloadURL(sref);
    }
    await addDoc(collection(db,"posts"), {
      title, description, content, tags, imageUrl,
      createdAt: serverTimestamp()
    });
    statusEl.textContent = "Yayınlandı.";
    setTimeout(()=>closeModal(modalPost), 500);
  }catch(err){
    statusEl.textContent = "Hata: yayınlanamadı.";
    statusEl.classList.add("error");
  }
});

// ---- post detail ----
async function openPost(id){
  showView("post");
  const body = document.getElementById("post-detail-body");
  body.innerHTML = `<div class="empty-state">Yükleniyor…</div>`;
  const snap = await getDoc(doc(db,"posts",id));
  if (!snap.exists()){
    body.innerHTML = `<a href="#blog" class="link-btn back-link" data-route="blog">← Blog'a dön</a><p>Bu yazı bulunamadı.</p>`;
    return;
  }
  const p = {id:snap.id, ...snap.data()};
  body.innerHTML = `
    <a href="#blog" class="link-btn back-link">← Blog'a dön</a>
    <div class="pd-date">${formatDate(p.createdAt)}</div>
    <h1>${escapeHtml(p.title)}</h1>
    ${p.description ? `<div class="pd-desc">${escapeHtml(p.description)}</div>` : ""}
    ${p.imageUrl ? `<div class="pd-image"><img src="${p.imageUrl}" alt="${escapeHtml(p.title)}"></div>` : ""}
    <div class="pd-content">${escapeHtml(p.content)}</div>
    <div class="pd-admin-row hidden" id="pd-admin-row">
      <button class="link-btn accent" id="pd-delete-post">Yazıyı sil</button>
    </div>
    <div class="comments-block" id="post-comments-mount"></div>
  `;
  body.querySelector(".back-link").addEventListener("click",(e)=>{e.preventDefault(); location.hash="#blog";});

  const adminRow = document.getElementById("pd-admin-row");
  if (isAdmin) adminRow.classList.remove("hidden");
  document.getElementById("pd-delete-post")?.addEventListener("click", async ()=>{
    if (!confirm("Bu yazıyı silmek istediğine emin misin?")) return;
    await deleteDoc(doc(db,"posts",id));
    location.hash = "#blog";
  });

  mountComments(document.getElementById("post-comments-mount"), "posts", id);
}

// ==========================================================
// PROJECTS
// ==========================================================
const projectListEl = document.getElementById("project-list");
const projectsQuery = query(collection(db,"projects"), orderBy("createdAt","desc"));
onSnapshot(projectsQuery, (snap)=>{
  const projects = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderProjects(projects);
}, ()=>{
  projectListEl.innerHTML = `<div class="empty-state">Projeler yüklenemedi. Firebase yapılandırmanı kontrol et.</div>`;
});

function renderProjects(projects){
  if (!projects.length){
    projectListEl.innerHTML = `<div class="empty-state">Henüz proje yok.</div>`;
    return;
  }
  projectListEl.innerHTML = "";
  projects.forEach(p=>{
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      ${p.imageUrl ? `<div class="project-image"><img src="${p.imageUrl}" alt="${escapeHtml(p.title)}"></div>` : ""}
      <div class="project-title">${escapeHtml(p.title)}</div>
      <div class="project-desc">${escapeHtml(p.description||"")}</div>
      <div class="project-footer">
        <div class="project-meta">
          ${p.fileUrl ? `<a class="link-btn accent" href="${p.fileUrl}" download>İndir${p.fileName ? " · " + escapeHtml(p.fileName) : ""}</a>` : `<span class="link-btn" style="opacity:.4">Dosya yok</span>`}
          <button class="link-btn" data-toggle-comments>Yorumlar</button>
        </div>
        ${isAdmin ? `<button class="link-btn accent" data-delete-project>Sil</button>` : ""}
      </div>
      <div class="comments-block hidden" data-comments-mount></div>
    `;
    const toggleBtn = card.querySelector("[data-toggle-comments]");
    const mount = card.querySelector("[data-comments-mount]");
    let mounted = false;
    toggleBtn.addEventListener("click", ()=>{
      mount.classList.toggle("hidden");
      if (!mounted){
        mountComments(mount, "projects", p.id);
        mounted = true;
      }
    });
    card.querySelector("[data-delete-project]")?.addEventListener("click", async ()=>{
      if (!confirm("Bu projeyi silmek istediğine emin misin?")) return;
      await deleteDoc(doc(db,"projects",p.id));
    });
    projectListEl.appendChild(card);
  });
}

// ---- add project modal ----
const modalProject = "modal-project";
document.getElementById("proj-add-btn").addEventListener("click", ()=>{
  document.getElementById("modal-project-title").textContent = "Yeni proje";
  document.getElementById("prf-title").value = "";
  document.getElementById("prf-desc").value = "";
  document.getElementById("prf-image").value = "";
  document.getElementById("prf-file").value = "";
  document.getElementById("prf-status").textContent = "";
  document.getElementById("prf-status").classList.remove("error");
  openModal(modalProject);
});
document.getElementById("modal-project-close").addEventListener("click", ()=>closeModal(modalProject));
document.getElementById("prf-cancel").addEventListener("click", ()=>closeModal(modalProject));

document.getElementById("prf-submit").addEventListener("click", async ()=>{
  const title = document.getElementById("prf-title").value.trim();
  const description = document.getElementById("prf-desc").value.trim();
  const imageFile = document.getElementById("prf-image").files[0];
  const downloadFile = document.getElementById("prf-file").files[0];
  const statusEl = document.getElementById("prf-status");

  if (!title){
    statusEl.textContent = "Proje adı zorunlu.";
    statusEl.classList.add("error");
    return;
  }
  statusEl.classList.remove("error");
  statusEl.textContent = "Yayınlanıyor…";

  try{
    let imageUrl = "", fileUrl = "", fileName = "";
    if (imageFile){
      const sref = ref(storage, `project-images/${Date.now()}-${imageFile.name}`);
      await uploadBytes(sref, imageFile);
      imageUrl = await getDownloadURL(sref);
    }
    if (downloadFile){
      const sref = ref(storage, `project-files/${Date.now()}-${downloadFile.name}`);
      await uploadBytes(sref, downloadFile);
      fileUrl = await getDownloadURL(sref);
      fileName = downloadFile.name;
    }
    await addDoc(collection(db,"projects"), {
      title, description, imageUrl, fileUrl, fileName,
      createdAt: serverTimestamp()
    });
    statusEl.textContent = "Yayınlandı.";
    setTimeout(()=>closeModal(modalProject), 500);
  }catch(err){
    statusEl.textContent = "Hata: yayınlanamadı.";
    statusEl.classList.add("error");
  }
});

// ==========================================================
// COMMENTS + LIKES (shared component, used by blog posts & projects)
// ==========================================================
const commentMounts = []; // {container, parentCollection, parentId, selected:Set}

function refreshAdminControls(){
  commentMounts.forEach(m => renderCommentAdminState(m));
}

function mountComments(container, parentCollection, parentId){
  const state = { container, parentCollection, parentId, selected: new Set(), comments: [], likes: [] };
  commentMounts.push(state);

  container.innerHTML = `
    <div class="comments-head">
      <div class="comments-title">Yorumlar</div>
      <div class="like-widget">
        <button class="like-heart" data-like-heart>♡</button>
        <div>
          <div class="like-count" data-like-count>0 beğeni</div>
          <div class="like-names hidden" data-like-names></div>
        </div>
      </div>
    </div>
    <div class="comment-form">
      <input type="text" placeholder="İsim" data-cf-name>
      <textarea placeholder="Yorumun…" data-cf-text></textarea>
      <div class="submit-row">
        <button class="link-btn accent" data-cf-submit>Yayınla</button>
      </div>
    </div>
    <div class="bulk-actions" data-bulk-actions>
      <span class="modal-status" data-bulk-count">0 seçili</span>
      <button class="link-btn" data-bulk-edit>Düzenle</button>
      <button class="link-btn accent" data-bulk-delete>Sil</button>
    </div>
    <div class="comment-items" data-comment-items></div>
  `;

  // comment submit
  container.querySelector("[data-cf-submit]").addEventListener("click", async ()=>{
    const nameEl = container.querySelector("[data-cf-name]");
    const textEl = container.querySelector("[data-cf-text]");
    const name = nameEl.value.trim();
    const text = textEl.value.trim();
    if (!name || !text) return;
    await addDoc(collection(db, parentCollection, parentId, "comments"), {
      name, text, createdAt: serverTimestamp()
    });
    nameEl.value = ""; textEl.value = "";
  });

  // like heart
  container.querySelector("[data-like-heart]").addEventListener("click", ()=>{
    openLikeModal(parentCollection, parentId);
  });

  // bulk actions
  container.querySelector("[data-bulk-delete]").addEventListener("click", async ()=>{
    if (!state.selected.size) return;
    if (!confirm(`${state.selected.size} yorumu silmek istediğine emin misin?`)) return;
    for (const cid of state.selected){
      await deleteDoc(doc(db, parentCollection, parentId, "comments", cid));
    }
    state.selected.clear();
    renderCommentAdminState(state);
  });
  container.querySelector("[data-bulk-edit]").addEventListener("click", ()=>{
    if (state.selected.size !== 1) return;
    const cid = [...state.selected][0];
    const c = state.comments.find(x=>x.id===cid);
    if (!c) return;
    openEditCommentModal(parentCollection, parentId, c);
  });

  // realtime comments
  const cq = query(collection(db, parentCollection, parentId, "comments"), orderBy("createdAt","asc"));
  onSnapshot(cq, (snap)=>{
    state.comments = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderComments(state);
  });

  // realtime likes
  const lq = collection(db, parentCollection, parentId, "likes");
  onSnapshot(lq, (snap)=>{
    state.likes = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderLikes(state);
  });

  return state;
}

function renderComments(state){
  const itemsEl = state.container.querySelector("[data-comment-items]");
  if (!state.comments.length){
    itemsEl.innerHTML = `<div class="empty-state" style="border:none; padding:24px 0;">Henüz yorum yok. İlk yorumu sen yaz.</div>`;
  } else {
    itemsEl.innerHTML = "";
    state.comments.forEach(c=>{
      const row = document.createElement("div");
      row.className = "comment-item";
      row.innerHTML = `
        <input type="checkbox" class="select-check ${isAdmin ? "visible":""}" data-cid="${c.id}">
        <div>
          <span class="cm-name">${escapeHtml(c.name)}</span><span class="cm-date">${formatDate(c.createdAt)}</span>
          <div class="cm-text">${escapeHtml(c.text)}</div>
        </div>
      `;
      const check = row.querySelector("input");
      check.checked = state.selected.has(c.id);
      check.classList.toggle("checked", check.checked);
      check.addEventListener("change", ()=>{
        if (check.checked) state.selected.add(c.id); else state.selected.delete(c.id);
        check.classList.toggle("checked", check.checked);
        renderCommentAdminState(state);
      });
      itemsEl.appendChild(row);
    });
  }
  renderCommentAdminState(state);
}

function renderCommentAdminState(state){
  const checks = state.container.querySelectorAll(".select-check");
  checks.forEach(ch => ch.classList.toggle("visible", isAdmin));
  const bulk = state.container.querySelector("[data-bulk-actions]");
  const countEl = state.container.querySelector("[data-bulk-count]");
  const editBtn = state.container.querySelector("[data-bulk-edit]");
  if (!bulk) return;
  const n = state.selected.size;
  bulk.classList.toggle("visible", isAdmin && n > 0);
  if (countEl) countEl.textContent = `${n} seçili`;
  if (editBtn) editBtn.style.display = (n === 1) ? "inline-block" : "none";
}

function renderLikes(state){
  const heart = state.container.querySelector("[data-like-heart]");
  const countEl = state.container.querySelector("[data-like-count]");
  const namesEl = state.container.querySelector("[data-like-names]");
  countEl.textContent = `${state.likes.length} beğeni`;
  const myName = localStorage.getItem("uz-visitor-name");
  const liked = myName && state.likes.some(l=>l.id === slugForName(myName));
  heart.classList.toggle("liked", !!liked);
  heart.textContent = liked ? "♥" : "♡";
  if (isAdmin && state.likes.length){
    namesEl.classList.remove("hidden");
    namesEl.textContent = "Beğenenler: " + state.likes.map(l=>l.name).join(", ");
  } else {
    namesEl.classList.add("hidden");
  }
}

// ---- like modal ----
let pendingLike = null;
function openLikeModal(parentCollection, parentId){
  pendingLike = {parentCollection, parentId};
  const savedName = localStorage.getItem("uz-visitor-name") || "";
  document.getElementById("like-name").value = savedName;
  document.getElementById("like-status").textContent = "";
  openModal("modal-like");
}
document.getElementById("modal-like-close").addEventListener("click", ()=>closeModal("modal-like"));
document.getElementById("like-submit").addEventListener("click", async ()=>{
  const name = document.getElementById("like-name").value.trim();
  const statusEl = document.getElementById("like-status");
  if (!name){ statusEl.textContent = "İsim gerekli."; statusEl.classList.add("error"); return; }
  if (!pendingLike) return;
  localStorage.setItem("uz-visitor-name", name);
  const {parentCollection, parentId} = pendingLike;
  const likeId = slugForName(name);
  await setDoc(doc(db, parentCollection, parentId, "likes", likeId), {
    name, createdAt: serverTimestamp()
  });
  closeModal("modal-like");
});

// ---- edit comment modal ----
let pendingEdit = null;
function openEditCommentModal(parentCollection, parentId, comment){
  pendingEdit = {parentCollection, parentId, commentId: comment.id};
  document.getElementById("ec-name").value = comment.name;
  document.getElementById("ec-text").value = comment.text;
  document.getElementById("ec-status").textContent = "";
  openModal("modal-edit-comment");
}
document.getElementById("modal-edit-comment-close").addEventListener("click", ()=>closeModal("modal-edit-comment"));
document.getElementById("ec-cancel").addEventListener("click", ()=>closeModal("modal-edit-comment"));
document.getElementById("ec-submit").addEventListener("click", async ()=>{
  if (!pendingEdit) return;
  const name = document.getElementById("ec-name").value.trim();
  const text = document.getElementById("ec-text").value.trim();
  if (!name || !text) return;
  const {parentCollection, parentId, commentId} = pendingEdit;
  await updateDoc(doc(db, parentCollection, parentId, "comments", commentId), {name, text});
  closeModal("modal-edit-comment");
});

// ----------------------------------------------------------
// INIT
// ----------------------------------------------------------
routeFromHash();
