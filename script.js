// script.js (module) — Rocky's Drive (secure)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Use your project URL and bucket
const SUPABASE_URL = 'https://eogdsmdypdaxvshaociu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2RzbWR5cGRheHZzaGFvY2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDEzOTYsImV4cCI6MjA3MDMxNzM5Nn0.MTd38DP8nAU1_4MqHDnisQvaSKova5N995tla4Vko8s';
const BUCKET = 'asbacademicdocuments';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* DOM */
const loginCard = document.getElementById('loginCard');
const uploadPanel = document.getElementById('uploadPanel');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const signOutBtn = document.getElementById('signOutBtn');

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const progressInner = document.getElementById('progressInner');
const progressText = document.getElementById('progressText');

const fileListEl = document.getElementById('fileList');
const emptyMsg = document.getElementById('emptyMsg');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const dropArea = document.getElementById('dropArea');

let currentFiles = [];
let uploading = false;

/* ---------- Auth & Session ---------- */
async function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    showLoginError('Enter email and password.');
    return;
  }
  loginError.classList.add('hidden');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showLoginError(error.message);
    return;
  }
  await checkSession();
}

window.login = login;

async function checkSession() {
  const { data } = await supabase.auth.getUser();
  if (data && data.user) {
    // logged in
    loginCard.classList.add('hidden');
    uploadPanel.classList.remove('hidden');
    signOutBtn.classList.remove('hidden');
    loadFiles();
  } else {
    loginCard.classList.remove('hidden');
    uploadPanel.classList.add('hidden');
    signOutBtn.classList.add('hidden');
  }
}

signOutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

/* ---------- Upload (XHR for progress) ---------- */
uploadBtn.addEventListener('click', () => {
  const f = fileInput.files[0];
  if (!f) return alert('Choose a file first.');
  uploadFileWithProgress(f);
});

fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (f) progressText.textContent = `${f.name} ready`;
});

/* drag & drop UX */
['dragenter','dragover'].forEach(e => dropArea.addEventListener(e, (ev) => { ev.preventDefault(); dropArea.classList.add('ring-2','ring-white/6'); }));
['dragleave','drop'].forEach(e => dropArea.addEventListener(e, (ev) => { ev.preventDefault(); setTimeout(()=>dropArea.classList.remove('ring-2','ring-white/6'),80); }));
dropArea.addEventListener('drop', (ev) => {
  const f = (ev.dataTransfer.files || [])[0];
  if (!f) return;
  fileInput.files = ev.dataTransfer.files;
  uploadFileWithProgress(f);
});

async function uploadFileWithProgress(file) {
  if (uploading) return alert('Wait for current upload to finish.');
  uploading = true;
  progressInner.style.width = '0%';
  progressText.textContent = `Uploading ${file.name}...`;

  try {
    const nameEnc = encodeURIComponent(file.name);
    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${nameEnc}?upsert=true`;

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_KEY}`);
      xhr.setRequestHeader('apikey', SUPABASE_KEY);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round(ev.loaded / ev.total * 100);
          progressInner.style.width = pct + '%';
          progressText.textContent = `${pct}% — ${file.name}`;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} — ${xhr.responseText}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(file);
    });

    progressInner.style.width = '100%';
    progressText.textContent = `Uploaded ${file.name}`;
    setTimeout(()=> loadFiles(), 400);
  } catch (err) {
    alert(err.message || 'Upload failed');
    console.error(err);
  } finally {
    uploading = false;
    setTimeout(()=> { progressInner.style.width = '0%'; progressText.textContent = 'Idle'; }, 1000);
  }
}

/* ---------- Listing, search, sort, download, delete ---------- */
async function loadFiles() {
  fileListEl.innerHTML = '';
  emptyMsg.style.display = 'none';
  progressText.textContent = 'Loading files...';

  try {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
    if (error) throw error;
    currentFiles = (data || []).map(f => ({ name: f.name, updated_at: f.updated_at || f.created_at, size: f.size || (f.metadata && f.metadata.size) || null }));
    renderFileList();
  } catch (err) {
    console.error(err);
    alert('Failed to load files: ' + (err.message || err));
    emptyMsg.style.display = 'block';
  } finally {
    progressText.textContent = 'Idle';
  }
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0, n = Number(bytes);
  while (n >= 1024 && i < units.length-1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function iconFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return '🖼️';
  if (ext==='pdf') return '📄';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return '🗜️';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  return '📁';
}

function renderFileList() {
  const q = (searchInput.value || '').toLowerCase().trim();
  let list = currentFiles.slice();

  if (q) list = list.filter(f => f.name.toLowerCase().includes(q));
  const s = sortSelect.value;
  if (s === 'updated_desc') list.sort((a,b)=> (b.updated_at||'').localeCompare(a.updated_at||''));
  else if (s === 'updated_asc') list.sort((a,b)=> (a.updated_at||'').localeCompare(b.updated_at||''));
  else if (s === 'name_asc') list.sort((a,b)=> a.name.localeCompare(b.name));
  else if (s === 'name_desc') list.sort((a,b)=> b.name.localeCompare(a.name));

  fileListEl.innerHTML = '';
  if (!list.length) { emptyMsg.style.display = 'block'; return; } else emptyMsg.style.display = 'none';

  list.forEach(f => {
    const li = document.createElement('li');
    li.className = 'p-3 rounded-lg bg-white/3 flex items-center justify-between gap-3 transition hover:bg-white/6';
    li.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-md bg-white/6 flex items-center justify-center text-sm font-semibold">${iconFromName(f.name)}</div>
          <div class="min-w-0">
            <div class="font-medium truncate">${escapeHtml(f.name)}</div>
            <div class="small text-white/60">${f.updated_at ? new Date(f.updated_at).toLocaleString() : '—'} • ${formatBytes(f.size)}</div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="downloadBtn px-3 py-1 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white small">Download</button>
        <button class="deleteBtn px-3 py-1 rounded-md bg-red-600/90 text-white small">Delete</button>
      </div>
    `;

    const downloadBtn = li.querySelector('.downloadBtn');
    const deleteBtn = li.querySelector('.deleteBtn');

    downloadBtn.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Preparing...';
      try {
        const { data, error } = await supabase.storage
  .from(BUCKET)
  .createSignedUrl(f.name, 60);

if (error) throw error;

if (data && data.signedUrl) {
  window.open(data.signedUrl, '_blank');
} else {
  throw new Error('No signed URL returned');
}
      } catch (err) {
        alert('Download failed: ' + (err.message || err));
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download';
      }
    });

    deleteBtn.addEventListener('click', async () => {
      const ok = confirm(`Delete "${f.name}"? This action cannot be undone.`);
      if (!ok) return;
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting...';
      try {
        const { error } = await supabase.storage.from(BUCKET).remove([f.name]);
        if (error) throw error;
        li.style.transition = 'opacity .25s, transform .25s';
        li.style.opacity = '0'; li.style.transform = 'translateY(8px)';
        setTimeout(()=> li.remove(), 300);
        setTimeout(loadFiles, 600);
      } catch (err) {
        alert('Delete failed: ' + (err.message || err));
        deleteBtn.disabled = false; deleteBtn.textContent = 'Delete';
      }
    });

    fileListEl.appendChild(li);
  });
}

/* ---------- events ---------- */
searchInput.addEventListener('input', () => renderFileList());
sortSelect.addEventListener('change', () => renderFileList());

/* ---------- init ---------- */
(async function init(){
  await checkSession();
})();


