

//    DEFINE NAME OF ELEMENTS (same in main.bml.js)
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const options=document.getElementById('btn-group');
const btn=document.getElementById('btn');
const notebookBtn = document.getElementById('notebookBtn');
const uploadBtn = document.getElementById('uploadBtn');
const channelList=document.getElementById('channelList');
const searchList=document.getElementById('searchList');
//const ecoMagList=document.getElementById('ecoMagList');
//const urlList=document.getElementById('urlList');
const list=document.getElementById('list');
const topdiv=document.getElementById('top');
const loading=document.getElementById('loading');

const closeBtn=document.getElementById('overlayCloseBtn');
const backdrop=document.getElementById('overlayBackdrop');
const overlay=document.getElementById('customOverlay');
const isVisible=!overlay.classList.contains('d-none');
document.addEventListener('keydown', function (e) {if (isVisible && e.key === 'Escape') {hideOverlay()}});
const backendURL = 'https://newsbeiter.onrender.com';



//    LESSONS UPLOADER
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

uploadBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        let textContent = await navigator.clipboard.readText();
        if (textContent.startsWith('{')){let confirmUpload = confirm('是否上傳筆記？');}
      }
    } catch (err) {
      alert('無學習內容可上傳');
    }
    if (textContent && confirmUpload) {
        fetch(`${backendURL}/lesson/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({content:textContent})
        }).then(res => {
            if (!res.ok) alert('❌ 上傳失敗');
        });
    }
});



//    2SPEAK LESSON
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function lessonGetList(siteName,t){
  try{url=`${backendURL}/lessons/list?rr=${rr}`;
  const res = await fetch(url);const str = await res.json();
  for (let h of str){html+=`<p class="title" onclick="getContent('${siteName}',this.id,'${h.path}')">${h.title}</p><div id="${h.path}" class="content" onclick="getContent('${siteName}',this.id,'${h.path}')"></div><hr>`}
  }catch{html='<p>尚無內容</p>'}
  return html;
}

async function lessonGetContent(id){
  try{url=`${backendURL}/notes/read`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({category:'2speak', path:id})
  });
  if (!res.ok) throw new Error('無法讀取筆記');
  const str=await res.json();
  for (let s of str){
    if (s) {var h=JSON.parse(s);console.log(h);
    html+=`
      <p class="fs12 fw-bold" style="color:#4b7bf5">${h.content.en}<br>${h.content.zh}</p>
      <p>${h.tag}：<span style="color:#4b7bf5">${h.content.pattern}</span><br>${h.content.grammar}</p>
      <p>${h.content.mistake_to_avoid}</p>
      <p class="fs10 fw-normal">${h.src} | ${h.content.tone} | ${h.content.register} | ${h.content.cefr}</p>
      <br><hr>
      `;
    }
  }
  }catch{html='<p>尚無內容</p>'}
  return html;
}

async function lessonGetSearchResults(siteName,t){
  try{url=`${backendURL}/lessons/search?q=${encodeURIComponent(t)}`;
  let res=await fetch(url);
  let str=await res.json();
  for (let h of str){
    html+=`<p class="title" onclick="getContent('${siteName}',this.id,'${h.path}')">${h.title}</p><div id="${h.path}" class="content" onclick="getContent('${siteName}',this.id,'${h.path}')"></div><hr>`;
  }
  if (html==='') html+='<p>尚無內容</p>';
  else html=html.slice(0,html.length-4);
  }catch{html='<p>尚無內容</p>'}
  return html;
}