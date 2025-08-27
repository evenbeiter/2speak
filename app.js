/* ====== 輔助：簡易儲存 localStorage ====== */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const authKey = 'gh.noteapp.auth';
const gridColsKey = 'grid.columns';
const clipboardKey = 'note.clipboard'; // 跨主題「貼上」暫存

function saveAuth() {
  const data = {
    token: $('#ghToken').value.trim(),
    dailyOwner: $('#dailyOwner').value.trim(),
    dailyRepo: $('#dailyRepo').value.trim(),
    topicOwner: $('#topicOwner').value.trim(),
    topicRepo: $('#topicRepo').value.trim(),
  };
  localStorage.setItem(authKey, JSON.stringify(data));
  toast('已儲存連線設定（僅存在本機瀏覽器）');
}
function loadAuthIntoInputs() {
  const data = JSON.parse(localStorage.getItem(authKey) || '{}');
  $('#ghToken').value = data.token || '';
  $('#dailyOwner').value = data.dailyOwner || '';
  $('#dailyRepo').value = data.dailyRepo || '';
  $('#topicOwner').value = data.topicOwner || '';
  $('#topicRepo').value = data.topicRepo || '';
  return data;
}

/* ====== UI：Toast ====== */
let toastObj;
function toast(msg) {
  $('#toastMsg').textContent = msg;
  if (!toastObj) toastObj = new bootstrap.Toast($('#appToast'), { delay: 2200 });
  toastObj.show();
}

/* ====== GitHub API（Contents API） ====== */
function ghHeaders() {
  const { token } = JSON.parse(localStorage.getItem(authKey) || '{}');
  const h = { Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
async function ghListRoot(owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GH list root failed: ${res.status}`);
  return res.json();
}
async function ghGetFile(owner, repo, path) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    headers: ghHeaders()
  });
  if (!res.ok) throw new Error(`GH get file failed: ${path} ${res.status}`);
  const json = await res.json();
  const content = atob(json.content || '');
  return { sha: json.sha, content };
}
async function ghPutFile(owner, repo, path, content, message, sha=null) {
  const body = {
    message, content: btoa(content), branch: undefined
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(`GH put file failed: ${path} ${res.status} ${JSON.stringify(err)}`);
  }
  return res.json();
}
async function ghDeleteFile(owner, repo, path, message, sha) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha })
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(`GH delete file failed: ${path} ${res.status} ${JSON.stringify(err)}`);
  }
  return res.json();
}

/* ====== 資料模型 ======
 每日筆記（daily repo，無資料夾）：
   - root 下 *.txt，檔名：yyyymmdd.txt
   - 檔案內容：每行一則「筆記項」，建議 JSON；若非 JSON，會包成 {text: line, filed:'n'}
 主題筆記（topic repo，有資料夾）：
   - root 有 index.json，內容為 ["Folder1/NoteA.txt","Folder2/NoteB.txt", ...]（自上到下、左到右）
   - 各資料夾為主題大標；內含多個 .txt（主題小標）
   - 各主題 .txt 檔案內容同上，每行一則筆記項（建議 JSON）
========================================= */

const state = {
  daily: {
    files: [],       // [{name:'20250826.txt', sha, items:[{id,text,filed,...}, raw], changed:boolean}, ...]
    fileMap: new Map()
  },
  topics: {
    folders: [],     // [{name:'主題A', cards:[{title:'小標X', path:'主題A/小標X.txt', sha, items, changed}], changedOrder:boolean}]
    indexSha: null,  // index.json sha
    removedPaths: new Set(), // 被刪除的檔案（rename 舊檔或使用者刪卡片）
    renameMap: new Map()     // oldPath -> newPath
  },
  clipboard: null    // {text, raw? ...} 由 modal 複製（貼上按鈕）
};

/* ====== 解析/序列化 ====== */
function parseLinesToItems(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  return lines.map(line => {
    try {
      const obj = JSON.parse(line);
      const id = obj.id || crypto.randomUUID();
      return { ...obj, id, raw: line, filed: obj.filed ?? 'n' };
    } catch {
      // 純文字行
      return { id: crypto.randomUUID(), text: line, filed: 'n', raw: JSON.stringify({ text: line, filed: 'n' }) };
    }
  });
}
function itemsToText(items) {
  // 優先保存原生 JSON 行（若使用者有編輯 text 就覆蓋 raw）
  return items.map(it => {
    if (it.raw && !it._forceRebuild) {
      try { JSON.parse(it.raw); return it.raw; } catch {}
    }
    const obj = { ...it };
    delete obj.raw; delete obj._forceRebuild;
    return JSON.stringify(obj);
  }).join('\n');
}

/* ====== 載入流程 ====== */
async function loadDaily() {
  const { dailyOwner, dailyRepo } = JSON.parse(localStorage.getItem(authKey) || '{}');
  const list = await ghListRoot(dailyOwner, dailyRepo);
  const files = list.filter(x => x.type === 'file' && /\.txt$/i.test(x.name));
  // 檔名倒序（yyyymmdd.txt）
  files.sort((a, b) => b.name.localeCompare(a.name));
  const out = [];
  for (const f of files) {
    const { sha, content } = await ghGetFile(dailyOwner, dailyRepo, f.name);
    const items = parseLinesToItems(content);
    const o = { name: f.name, sha, items, changed: false };
    out.push(o);
    state.daily.fileMap.set(f.name, o);
  }
  state.daily.files = out;
  renderDaily();
}
async function loadTopics() {
  const { topicOwner, topicRepo } = JSON.parse(localStorage.getItem(authKey) || '{}');
  // 讀 index.json
  const { sha: indexSha, content } = await ghGetFile(topicOwner, topicRepo, 'index.json');
  state.topics.indexSha = indexSha;
  let list;
  try { list = JSON.parse(content); } catch { list = []; }
  // 依 index 順序產出 folder 與 cards
  const folderMap = new Map();
  for (const path of list) {
    const [folderName, fileName] = path.split('/');
    if (!folderMap.has(folderName)) folderMap.set(folderName, []);
    folderMap.get(folderName).push(fileName);
  }
  const folders = [];
  for (const [name, files] of folderMap.entries()) {
    const cards = [];
    for (const file of files) {
      try {
        const { sha, content } = await ghGetFile(topicOwner, topicRepo, `${name}/${file}`);
        cards.push({
          title: file.replace(/\.txt$/i, ''),
          path: `${name}/${file}`,
          sha, items: parseLinesToItems(content),
          changed: false
        });
      } catch (e) {
        console.warn('skip missing file', name, file, e);
      }
    }
    folders.push({ name, cards, changedOrder: false });
  }
  state.topics.folders = folders;
  renderFolders();
}

/* ====== 渲染：每日筆記（左） ====== */
function renderDaily() {
  const acc = $('#dailyAccordion');
  acc.innerHTML = '';
  state.daily.files.forEach((file, idx) => {
    const accId = `acc-${idx}`;
    const card = document.createElement('div');
    card.className = 'accordion-item';
    card.innerHTML = `
      <h2 class="accordion-header" id="heading-${accId}">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${accId}">
          ${file.name.replace('.txt','')}
        </button>
      </h2>
      <div id="collapse-${accId}" class="accordion-collapse collapse" data-bs-parent="#dailyAccordion">
        <div class="accordion-body"></div>
      </div>
    `;
    acc.appendChild(card);
    const body = $('.accordion-body', card);
    file.items.forEach((it) => {
      const div = document.createElement('div');
      div.className = 'daily-note-card' + (it.filed === 'y' ? ' filed' : '');
      div.draggable = true;
      div.dataset.source = JSON.stringify({ file: file.name, id: it.id });
      div.innerHTML = `
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="flex-grow-1">${escapeHtml(it.text ?? it.content ?? '')}</div>
          <div class="d-flex align-items-center gap-1">
            <button class="btn btn-sm ${it.filed==='y'?'btn-secondary':'btn-outline-secondary'} btnToggleFiled">
              ${it.filed==='y'?'已反灰':'反灰'}
            </button>
          </div>
        </div>
      `;
      // DnD source
      div.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('application/json', JSON.stringify({
          kind: 'dailyItem',
          file: file.name,
          item: it
        }));
      });
      // Toggle filed
      $('.btnToggleFiled', div).addEventListener('click', () => {
        it.filed = it.filed === 'y' ? 'n' : 'y';
        div.classList.toggle('filed', it.filed === 'y');
        $('.btnToggleFiled', div).className = 'btn btn-sm ' + (it.filed === 'y' ? 'btn-secondary' : 'btn-outline-secondary') + ' btnToggleFiled';
        $('.btnToggleFiled', div).textContent = it.filed === 'y' ? '已反灰' : '反灰';
        const f = state.daily.fileMap.get(file.name);
        f.changed = true;
      });
      body.appendChild(div);
    });
  });
}
function escapeHtml(s){ return (s??'').toString().replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/* ====== 渲染：主題（右） ====== */
function renderFolders() {
  const root = $('#foldersContainer');
  root.innerHTML = '';
  state.topics.folders.forEach((folder, fi) => {
    const el = document.createElement('div');
    el.className = 'folder';
    el.draggable = true;
    el.dataset.folderIndex = fi;

    // Header
    const header = document.createElement('div');
    header.className = 'folder-header';
    header.innerHTML = `
      <div class="me-auto" contenteditable="true" spellcheck="false">${escapeHtml(folder.name)}</div>
      <div class="folder-actions d-flex align-items-center gap-1">
        <button class="btn btn-sm btn-outline-secondary btnAddCard">＋ 小標</button>
        <button class="btn btn-sm btn-outline-danger btnDeleteFolder">刪除</button>
      </div>
    `;
    el.appendChild(header);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'folder-grid';
    grid.dataset.folderIndex = fi;
    el.appendChild(grid);

    // 填卡片
    folder.cards.forEach((card, ci) => {
      grid.appendChild(makeTopicCard(fi, ci, card));
    });

    // DnD：folder 自身排序（上下拖動）
    el.addEventListener('dragstart', e=>{
      if (e.target === el) {
        e.dataTransfer.setData('application/json', JSON.stringify({ kind:'folder', fi }));
      }
    });
    el.addEventListener('dragover', e=>{ e.preventDefault(); el.classList.add('drop-target'); });
    el.addEventListener('dragleave', ()=> el.classList.remove('drop-target'));
    el.addEventListener('drop', (e)=>{
      e.preventDefault(); el.classList.remove('drop-target');
      const data = readDnD(e);
      if (!data) return;
      // 1) 資料卡拖到「卡片」上處理，不進 header
      if (data.kind === 'folder') {
        const srcFi = data.fi;
        if (srcFi !== fi) {
          const arr = state.topics.folders;
          const moved = arr.splice(srcFi, 1)[0];
          arr.splice(fi, 0, moved);
          renderFolders();
        }
      }
    });

    // header：改名、增刪
    header.firstElementChild.addEventListener('input', () => {
      folder.name = header.firstElementChild.textContent.trim() || '未命名主題';
    });
    $('.btnAddCard', header).addEventListener('click', () => {
      folder.cards.push({ title: '新筆記', path: `${folder.name}/新筆記.txt`, sha: null, items: [], changed: true });
      renderFolders();
    });
    $('.btnDeleteFolder', header).addEventListener('click', async () => {
      if (!confirm(`確定刪除整個主題「${folder.name}」？（僅刪除 index 與卡片，不會自動刪 GitHub 資料夾本身）`)) return;
      // 標記其下所有卡片檔需自 index 移除（實際刪檔採保守策略：不自動刪檔，若要刪可打開卡片後刪空保存）
      folder.cards.forEach(c => state.topics.removedPaths.add(c.path));
      state.topics.folders.splice(fi, 1);
      renderFolders();
    });

    root.appendChild(el);
  });

  // 允許把每日卡拖到「任一主題卡片」上：在 makeTopicCard 內處理
}

/* 生成主題卡片（小標） */
function makeTopicCard(fi, ci, card) {
  const div = document.createElement('div');
  div.className = 'topic-card';
  div.draggable = true;
  div.dataset.fi = fi;
  div.dataset.ci = ci;

  div.innerHTML = `
    <div class="title-row">
      <div class="title" contenteditable="true" spellcheck="false">${escapeHtml(card.title)}</div>
      <div class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-secondary btnOpen">打開</button>
        <button class="btn btn-sm btn-outline-secondary btnPaste">貼上</button>
        <button class="btn btn-sm btn-outline-danger btnDelete">刪除</button>
      </div>
    </div>
    <div class="small text-muted">${escapeHtml(card.path)}</div>
  `;

  // 改名（僅在儲存時處理 rename：oldPath -> newPath）
  $('.title', div).addEventListener('input', ()=>{
    const oldPath = card.path;
    card.title = $('.title', div).textContent.trim() || '未命名';
    const folderName = state.topics.folders[fi].name;
    card.path = `${folderName}/${card.title}.txt`;
    card.changed = true;
    $('.small', div).textContent = card.path;
    if (oldPath !== card.path) state.topics.renameMap.set(oldPath, card.path);
  });

  // 刪除卡片（標記從 index 移除；實檔保守不自動刪）
  $('.btnDelete', div).addEventListener('click', ()=>{
    if (!confirm(`確定刪除主題小標「${card.title}」？`)) return;
    state.topics.removedPaths.add(card.path);
    state.topics.folders[fi].cards.splice(ci, 1);
    renderFolders();
  });

  // 打開 modal 編輯
  $('.btnOpen', div).addEventListener('click', ()=>{
    openNoteModal(fi, ci);
  });

  // 貼上（從 clipboard 複製的單一卡）
  $('.btnPaste', div).addEventListener('click', ()=>{
    const clip = JSON.parse(localStorage.getItem(clipboardKey) || 'null');
    if (!clip) { toast('剪貼簿是空的，請先在 modal 選一則按「複製所選」'); return; }
    card.items.push(sanitizeItem(clip));
    card.changed = true;
    flashTick(div);
  });

  // DnD：拖移卡片（調整排序 or 跨 folder 移動）
  div.addEventListener('dragstart', (e)=>{
    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'topicCard', fi, ci }));
  });
  div.addEventListener('dragover', (e)=>{ e.preventDefault(); div.classList.add('drop-target'); });
  div.addEventListener('dragleave', ()=> div.classList.remove('drop-target'));
  div.addEventListener('drop', (e)=>{
    e.preventDefault(); div.classList.remove('drop-target');
    const data = readDnD(e);
    if (!data) return;

    if (data.kind === 'topicCard') {
      // 重新排序或跨 folder
      const srcF = state.topics.folders[data.fi];
      const dstF = state.topics.folders[fi];
      const moved = srcF.cards.splice(data.ci, 1)[0];
      let dropIndex = Array.from(div.parentElement.children).indexOf(div);
      dstF.cards.splice(dropIndex, 0, moved);
      renderFolders();
    }
    else if (data.kind === 'dailyItem') {
      // 複製每日筆記到此卡
      try {
        const item = sanitizeItem(data.item);
        state.topics.folders[fi].cards[ci].items.push(item);
        state.topics.folders[fi].cards[ci].changed = true;
        // 來源 daily 反灰
        const src = state.daily.fileMap.get(data.file);
        const it = src.items.find(x => x.id === data.item.id);
        if (it) { it.filed = 'y'; src.changed = true; }
        // UI 動畫與左側同步反灰
        flashTick(div);
        renderDaily();
      } catch (err) {
        toast('複製失敗：' + err.message);
      }
    }
  });

  return div;
}
function sanitizeItem(it) {
  const text = it.text ?? it.content ?? '';
  const id = it.id || crypto.randomUUID();
  return { id, text, filed: it.filed ?? 'n', _forceRebuild: true };
}
function readDnD(e) {
  try { return JSON.parse(e.dataTransfer.getData('application/json')); } catch { return null; }
}
function flashTick(target) {
  const fx = document.createElement('div');
  fx.className = 'copy-success';
  target.appendChild(fx);
  setTimeout(()=> fx.remove(), 950);
}

/* ====== Modal：編輯主題小標內容 ====== */
let modalInst;
let modalCtx = { fi: null, ci: null };
function openNoteModal(fi, ci) {
  const card = state.topics.folders[fi].cards[ci];
  $('#modalNoteTitle').value = card.title;
  const list = $('#modalNoteList');
  list.innerHTML = '';
  card.items.forEach((it, idx) => list.appendChild(makeModalItem(it, idx)));

  modalCtx = { fi, ci };
  if (!modalInst) modalInst = new bootstrap.Modal($('#noteModal'));
  modalInst.show();
}
function makeModalItem(it, idx) {
  const row = document.createElement('div');
  row.className = 'stack-item';
  row.draggable = true;
  row.dataset.id = it.id;

  row.innerHTML = `
    <div class="handle">≡</div>
    <div class="content" contenteditable="true" spellcheck="false">${escapeHtml(it.text ?? '')}</div>
    <div class="tools">
      <input type="checkbox" class="form-check-input me-1 sel"/>
      <button class="btn btn-sm btn-outline-secondary btnClone">複製</button>
    </div>
  `;
  // DnD sort
  row.addEventListener('dragstart', e=>{
    e.dataTransfer.setData('application/json', JSON.stringify({ kind:'modalItem', id: it.id }));
  });
  row.addEventListener('dragover', e=>{ e.preventDefault(); row.classList.add('drop-target'); });
  row.addEventListener('dragleave', ()=> row.classList.remove('drop-target'));
  row.addEventListener('drop', e=>{
    e.preventDefault(); row.classList.remove('drop-target');
    const data = readDnD(e);
    if (!data || data.kind !== 'modalItem') return;
    const list = row.parentElement;
    const src = $(`.stack-item[data-id="${data.id}"]`, list);
    if (src && src !== row) {
      const nodes = Array.from(list.children);
      const dropIndex = nodes.indexOf(row);
      list.removeChild(src);
      list.insertBefore(src, nodes[dropIndex]);
    }
  });

  // 勾選
  $('.sel', row).addEventListener('change', ()=> row.classList.toggle('selected', $('.sel', row).checked));
  // 複製 -> 全域剪貼簿
  $('.btnClone', row).addEventListener('click', ()=>{
    const content = $('.content', row).textContent.trim();
    const payload = { id: it.id, text: content, filed:'n' };
    localStorage.setItem(clipboardKey, JSON.stringify(payload));
    toast('已複製到剪貼簿（到其他主題卡按「貼上」）');
  });

  return row;
}

/* Modal 操作 */
$('#modalBtnAddLine').addEventListener('click', ()=>{
  const it = { id: crypto.randomUUID(), text: '（新筆記）', filed:'n' };
  $('#modalNoteList').appendChild(makeModalItem(it));
});
$('#modalBtnCopySelected').addEventListener('click', ()=>{
  const sel = $$('.stack-item.selected', $('#modalNoteList'));
  if (!sel.length) { toast('請先勾選要複製的卡片'); return; }
  const first = sel[0];
  const content = $('.content', first).textContent.trim();
  localStorage.setItem(clipboardKey, JSON.stringify({ id: crypto.randomUUID(), text: content, filed:'n' }));
  toast('已複製所選第一則到剪貼簿');
});
$('#modalBtnDeleteSelected').addEventListener('click', ()=>{
  const sel = $$('.stack-item.selected', $('#modalNoteList'));
  sel.forEach(node => node.remove());
});
$('#modalBtnConfirm').addEventListener('click', ()=>{
  // 回寫到 card.items（不直接保存到 GitHub，等待右上角「儲存」）
  const { fi, ci } = modalCtx;
  const card = state.topics.folders[fi].cards[ci];
  card.title = $('#modalNoteTitle').value.trim() || '未命名';
  const folderName = state.topics.folders[fi].name;
  const newPath = `${folderName}/${card.title}.txt`;
  if (card.path !== newPath) state.topics.renameMap.set(card.path, newPath);
  card.path = newPath;

  const list = $('#modalNoteList');
  const items = [];
  $$('.stack-item', list).forEach(node => {
    const id = node.dataset.id || crypto.randomUUID();
    const text = $('.content', node).textContent.trim();
    items.push({ id, text, filed:'n', _forceRebuild:true });
  });
  card.items = items;
  card.changed = true;
  renderFolders();
});

/* ====== 事件：頂部按鈕、載入、儲存 ====== */
$('#btnSaveAuth').addEventListener('click', saveAuth);
$('#btnLoadAll').addEventListener('click', async ()=>{
  try {
    await Promise.all([loadDaily(), loadTopics()]);
    toast('載入完成');
  } catch (e) { toast('載入失敗：' + e.message); }
});
$('#btnUnfileAll').addEventListener('click', ()=>{
  state.daily.files.forEach(f => f.items.forEach(it => it.filed = 'n'));
  state.daily.files.forEach(f => f.changed = true);
  renderDaily();
});

$('#btnAddFolder').addEventListener('click', ()=>{
  state.topics.folders.push({ name:'新主題', cards:[], changedOrder:false });
  renderFolders();
});

$('#btnSaveAll').addEventListener('click', async ()=>{
  try {
    await saveAll();
    toast('全部儲存完成');
  } catch (e) {
    console.error(e);
    toast('儲存發生錯誤：' + e.message);
  }
});

/* ====== 儲存 (a)(b)(c) ====== */
async function saveAll() {
  const { topicOwner, topicRepo, dailyOwner, dailyRepo } = JSON.parse(localStorage.getItem(authKey) || '{}');

  // b) 儲存所有主題小標卡片內容（含 rename 新增/刪舊）
  //   - 若 rename: 新檔 put，新內容；舊檔不自動刪（除非也在 removedPaths）
  for (const folder of state.topics.folders) {
    for (const card of folder.cards) {
      const path = card.path;
      // 若有舊路徑 -> 新路徑（rename）
      const oldPath = [...state.topics.renameMap.entries()].find(([, v]) => v === path)?.[0];
      const content = itemsToText(card.items);
      if (oldPath && oldPath !== path) {
        // 先寫新檔（沒有 sha）
        await ghPutFile(topicOwner, topicRepo, path, content, `rename/new save: ${path}`);
        // 原卡若有 sha，保留；視使用者是否也刪除舊路徑
      } else {
        // 正常更新
        await ghPutFile(topicOwner, topicRepo, path, content, `update note: ${path}`, card.sha || null);
      }
    }
  }
  // 刪除被移除的路徑（保守：只有使用者刪卡片才刪）
  for (const path of state.topics.removedPaths) {
    try {
      const { sha } = await ghGetFile(topicOwner, topicRepo, path);
      await ghDeleteFile(topicOwner, topicRepo, path, `delete note: ${path}`, sha);
    } catch (e) {
      console.warn('skip delete not found', path);
    }
  }

  // a) 更新 index.json：按目前畫面自上而下、左到右掃描
  const indexList = [];
  for (const folder of state.topics.folders) {
    const folderName = folder.name;
    for (const card of folder.cards) {
      indexList.push(`${folderName}/${card.title}.txt`);
    }
  }
  await ghPutFile(topicOwner, topicRepo, 'index.json',
    JSON.stringify(indexList, null, 2), 'update index.json', state.topics.indexSha);

  // c) 更新每日筆記（反灰 filed 標記）
  for (const f of state.daily.files) {
    if (!f.changed) continue;
    const content = itemsToText(f.items);
    await ghPutFile(dailyOwner, dailyRepo, f.name, content, `update daily: ${f.name}`, f.sha);
    f.changed = false;
  }

  // 清理暫存
  state.topics.removedPaths.clear();
  state.topics.renameMap.clear();
}

/* ====== 初始化 ====== */
(function init(){
  loadAuthIntoInputs();
  // 允許未來切換每列卡片數（可選）：localStorage grid.columns
  const cols = parseInt(localStorage.getItem(gridColsKey) || '6', 10);
  $$('.folder-grid').forEach(g => g.style.gridTemplateColumns = `repeat(${cols}, minmax(0,1fr))`);
})();