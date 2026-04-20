// script.js (FULL REWRITTEN VERSION)
// Rocky's Drive - Secure + Fixed Upload + Fixed Download + Better Auth

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/* --------------------------------------------------
   CONFIG
-------------------------------------------------- */
const SUPABASE_URL = 'https://eogdsmdypdaxvshaociu.supabase.co';
const SUPABASE_KEY ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2RzbWR5cGRheHZzaGFvY2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDEzOTYsImV4cCI6MjA3MDMxNzM5Nn0.MTd38DP8nAU1_4MqHDnisQvaSKova5N995tla4Vko8s';

const BUCKET = 'asbacademicdocuments';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* --------------------------------------------------
   DOM
-------------------------------------------------- */
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

let currentFiles = [];
let uploading = false;

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */
function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function clearError() {
  loginError.classList.add('hidden');
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[m]);
}

/* --------------------------------------------------
   AUTH
-------------------------------------------------- */
async function login() {
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showError('Enter email and password.');
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showError(error.message);
    return;
  }

  await checkSession();
}

window.login = login;

async function checkSession() {
  const { data } = await supabase.auth.getUser();

  if (data.user) {
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

/* --------------------------------------------------
   UPLOAD
-------------------------------------------------- */
uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert('Choose file first.');
    return;
  }

  await uploadFile(file);
});

async function uploadFile(file) {
  if (uploading) return;

  uploading = true;

  try {
    progressText.textContent = 'Uploading...';
    progressInner.style.width = '30%';

    const filePath = file.name;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, {
        upsert: true,
      });

    if (error) throw error;

    progressInner.style.width = '100%';
    progressText.textContent = 'Upload complete';

    fileInput.value = '';
    await loadFiles();

    setTimeout(() => {
      progressInner.style.width = '0%';
      progressText.textContent = 'Idle';
    }, 1200);

  } catch (err) {
    alert('Upload failed: ' + err.message);
    progressText.textContent = 'Upload failed';
    progressInner.style.width = '0%';
  } finally {
    uploading = false;
  }
}

/* --------------------------------------------------
   LOAD FILES
-------------------------------------------------- */
async function loadFiles() {
  fileListEl.innerHTML = '';
  emptyMsg.style.display = 'none';

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', {
      limit: 1000,
      sortBy: { column: 'updated_at', order: 'desc' }
    });

  if (error) {
    alert('Load failed: ' + error.message);
    return;
  }

  currentFiles = data || [];
  renderFiles();
}

/* --------------------------------------------------
   RENDER
-------------------------------------------------- */
function renderFiles() {
  let files = [...currentFiles];

  const q = searchInput.value.trim().toLowerCase();

  if (q) {
    files = files.filter(f => f.name.toLowerCase().includes(q));
  }

  const sort = sortSelect.value;

  if (sort === 'name_asc') {
    files.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sort === 'name_desc') {
    files.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (!files.length) {
    emptyMsg.style.display = 'block';
    return;
  }

  fileListEl.innerHTML = '';

  files.forEach(file => {
    const li = document.createElement('li');

    li.className =
      'p-3 rounded-lg bg-white/5 flex items-center justify-between gap-3';

    li.innerHTML = `
      <div class="flex-1">
        <div class="font-medium truncate">${escapeHtml(file.name)}</div>
        <div class="small text-white/60">
          ${formatBytes(file.metadata?.size)}
        </div>
      </div>

      <div class="flex gap-2">
        <button class="downloadBtn px-3 py-1 rounded bg-blue-600 text-white small">
          Download
        </button>

        <button class="deleteBtn px-3 py-1 rounded bg-red-600 text-white small">
          Delete
        </button>
      </div>
    `;

    /* DOWNLOAD */
    li.querySelector('.downloadBtn').addEventListener('click', async () => {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(file.name, 60);

        if (error) throw error;

        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
        } else {
          throw new Error('No signed URL');
        }

      } catch (err) {
        alert('Download failed: ' + err.message);
      }
    });

    /* DELETE */
    li.querySelector('.deleteBtn').addEventListener('click', async () => {
      const ok = confirm(`Delete "${file.name}"?`);
      if (!ok) return;

      const { error } = await supabase.storage
        .from(BUCKET)
        .remove([file.name]);

      if (error) {
        alert('Delete failed: ' + error.message);
        return;
      }

      await loadFiles();
    });

    fileListEl.appendChild(li);
  });
}

/* --------------------------------------------------
   SEARCH / SORT
-------------------------------------------------- */
searchInput.addEventListener('input', renderFiles);
sortSelect.addEventListener('change', renderFiles);

/* --------------------------------------------------
   INIT
-------------------------------------------------- */
(async () => {
  await checkSession();
})();
