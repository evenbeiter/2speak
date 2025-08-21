const pattern=['比較','對比','建議','因果','條件','進度報告','狀態描述','描述趨勢','預測','趨勢觀察'];

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


channelList.innerHTML='';
for (let p of pattern){channelList.innerHTML+=`<button class="btn sepia me-1 mb-1" type="button" onclick="get1stList('lesson','句型 | ${p}','${p}')">${p}</button>`;}
openChannelList();
get1stList('lesson','句型','')
//get1stList(siteName, top+' | '+site[0][1],site[0][0]);


//    LESSONS UPLOADER
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

uploadBtn.addEventListener('click', async () => {
    let textContent = '';
    let confirmUpload = false;
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        textContent = await navigator.clipboard.readText();
        if (textContent.startsWith('{')){confirmUpload = confirm('是否上傳筆記？');} else {alert('無學習內容可上傳');}
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
  if(t===''){
  try{url=`${backendURL}/lessons/list?rr=${rr}`;
  const res = await fetch(url);const str = await res.json();
    for (let h of str){html+=`<p class="title" onclick="getContent('${siteName}',this.id,'${h.path}')">${h.title}</p><div id="${h.path}" class="content" onclick="getContent('${siteName}',this.id,'${h.path}')"></div><hr>`}

  }catch{html='<p>尚無內容</p>'}
  return html;
  } else {
  lessonGetSearchResults(siteName,t);
  }
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
      <p>${h.content.mistake_to_avoid}</p>`;
    html+=h.content.extra_examples?`<p class="fs12">${h.content.extra_examples[0]}</p><p class="fs12">${h.content.extra_examples[1]}</p>`:'';
    html+=`<p class="fs10 fw-normal">${h.src}<br>
      ${h.content.tone} | ${h.content.register} | ${h.content.cefr}</p>
      <br><hr>`;
    }
  }
  if (html==='') html+='<p>尚無內容</p>';
  else html=html.slice(0,html.length-4);
  }catch{html='<p>尚無內容</p>'}
  return html;
}

async function lessonGetSearchResults(siteName,t){
  try{url=`${backendURL}/lessons/search?q=${encodeURIComponent(t)}`;
  let res=await fetch(url);
  let str=await res.json();
  for (let a of str){
    url=`${backendURL}/notes/read`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({category:'2speak', path:a.path})
    });
    if (!res.ok) throw new Error('無法讀取筆記');
    const ss=await res.json();
    for (let s of ss){
    if (s) {
        var h=JSON.parse(s);
        if(h.tag==t+'句型'){items.push(h);
    html+=`
      <p class="fs12 fw-bold" style="color:#4b7bf5">${h.content.en}<br>${h.content.zh}</p>
      <p>${h.tag}：<span style="color:#4b7bf5">${h.content.pattern}</span><br>${h.content.grammar}</p>
      <p>${h.content.mistake_to_avoid}</p>`;
    html+=h.content.extra_examples?`<p class="fs12">${h.content.extra_examples[0]}</p><p class="fs12">${h.content.extra_examples[1]}</p>`:'';
    html+=`<p class="fs10 fw-normal">${h.src}<br>
      ${h.content.tone} | ${h.content.register} | ${h.content.cefr}</p>
      <br><hr>`;
    }
  }
  }
  }
  }catch{if(html==''){html='<p>尚無內容</p>'}else{return html}}
  return html;
}
