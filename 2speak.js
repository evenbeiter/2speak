

//    DEFINE NAME OF ELEMENTS (same in main.bml.js)
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const options=document.getElementById('btn-group');
const btn=document.getElementById('btn');
const uploadBtn = document.getElementById('uploadBtn');
const channelList=document.getElementById('channelList');
const searchList=document.getElementById('searchList');
//const ecoMagList=document.getElementById('ecoMagList');
const urlList=document.getElementById('urlList');
const list=document.getElementById('list');
const topdiv=document.getElementById('top');
const loading=document.getElementById('loading');

const closeBtn=document.getElementById('overlayCloseBtn');
const backdrop=document.getElementById('overlayBackdrop');
const overlay=document.getElementById('customOverlay');
const isVisible=!overlay.classList.contains('d-none');
document.addEventListener('keydown', function (e) {if (isVisible && e.key === 'Escape') {hideOverlay()}});
const backendURL = 'https://newsbeiter.onrender.com';



//    NOTES UPLOADER
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

uploadBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        textContent = await navigator.clipboard.readText();
      }
    } catch (err) {
      alert('無學習內容可上傳');
    }
    if (textContent) {
        fetch(`${backendURL}/lesson/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({content:textContent})
        }).then(res => {
            if (!res.ok) alert('❌ 上傳失敗');
        });
    }
});
