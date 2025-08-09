//    GLOBAL VARIABLES
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const pattern=['狀態描述','比較','建議','因果','對比','描述趨勢','預測','進度報告','趨勢觀察','條件'];

var siteNameVar='',docTitle='',tabs=[];
var items=[],ytnCoverImg='',ytnVideo='',ecoMagContent,url='',html='',coun='',t='',uuids='',lastId='',cursor='',payload={},rt='',rr=0,buildId='';
//const sats=getLastNSats(5);


//    GLOBAL FUNCTIONS
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function createChannelList(site,siteName,top){
  channelList.innerHTML='';
  for (let tab of site){channelList.innerHTML+=`<button class="btn sepia me-1 mb-1" type="button" onclick="get1stList('${siteName}','${top} | ${tab[1]}','${tab[0]}')">${tab[1]}</button>`;}
  openChannelList();
  get1stList(siteName, top+' | '+site[0][1],site[0][0]);
}

function createSearchListDiv(faqList,searchSiteList){
  for (let tab of faqList){searchList.innerHTML+=`<button class="btn sepia me-1 mb-1" type="button" onclick="getFAQSearchResults('${tab[0]}','${tab[1]}','${tab[2]}')">${tab[2]}</button>`;}  
  searchList.innerHTML+='<input type="search" id="search-term" class="form-control my-2">';
  for (let tab of searchSiteList){searchList.innerHTML+=`<button class="btn sepia me-1 mb-1" type="button" onclick="get1stSearchResults('${tab[0]}','${tab[1]}')">${tab[1]}</button>`;}
}

async function get1stList(siteName,top,t){
  rr=0;cursor='';
  getList(siteName,t);
  showTop(top);
}

async function get1stSearchResults(siteName,top){

    rr=0;
    getSearchResults(siteName);
    showTop(top+' | 搜尋：'+document.getElementById('search-term').value);

}

function getFAQSearchResults(siteName,top,t){
  document.getElementById('search-term').value=t;
  get1stSearchResults(siteName,top);
}

async function getList(siteName,t){
  loading.style.display='block';
  siteNameVar=siteName;rr++;rt=t;cursor='';
  if (rr==1){newNews()};
  items=[];html='';
  list.innerHTML+=await window[`${siteName}GetList`](siteName,t);
  loading.style.display='none';
}

async function getContent(siteName,clickedId,id){
  var cEl=document.getElementById(id);html='';
  if (cEl.style.display=='none' || cEl.style.display==''){
    loading.style.display='block';
    cEl.style.display='block';

    if (cEl.innerText.indexOf('句型')==-1){
    //get content
    cEl.innerHTML+=await window[`${siteName}GetContent`](id);
    }
    
    loading.style.display='none';

  } else {
    var e=window.event;
      const selection=window.getSelection();
      const selectedText=selection.toString().trim();
      if (selectedText.length===0){
        cEl.style.display='none';
        cEl.previousElementSibling.previousElementSibling.scrollIntoView()
        // try{
        //   if (msnALL.includes(siteName)){cEl.previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling.scrollIntoView()}
        // } catch {document.body.scrollTop = 0;document.documentElement.scrollTop = 0}
      }
  }
}

async function getSearchResults(siteName){
  loading.style.display='block';
  siteNameVar=siteName;rr++;rt='s';cursor='';
  if (rr==1){newNews()};
  items=[];html='';
  list.innerHTML+=await window[`${siteName}GetSearchResults`](siteName,document.getElementById('search-term').value);
  loading.style.display='none';
}
  
let scrollTimeout;
window.onscroll = function () {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
      if (scrollTop + windowHeight >= documentHeight - 5) {
        if(rt!=='s'){
          getList(siteNameVar,rt);
        }else{
          getSearchResults(siteNameVar);
        }
      }
    
  }, 1000);
};


function showTop(t){topdiv.innerText=t;topdiv.style.display='block';}
function newNews(){options.style.display='none';document.body.scrollTop = 0;document.documentElement.scrollTop = 0;list.innerHTML='';}
function openChannelList(){channelList.style.display='block';searchList.style.display='none';ecoMagList.style.display='none';urlList.style.display='none';options.style.display='block';topdiv.style.display='none';}
function openSearchList(){document.getElementById('search-term').value='';channelList.style.display='none';searchList.style.display='block';ecoMagList.style.display='none';urlList.style.display='none';options.style.display='block';topdiv.style.display='none';}
function openOptions(){if (options.style.display=='none'){options.style.display='block';topdiv.style.display='none';} else {options.style.display='none';topdiv.style.display='block';}}
function cvt2Timezone(timestamp) {const date = new Date(timestamp);return date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});}
function hideOverlay(){document.getElementById('customOverlay').classList.add('d-none');}
function showOverlay(el,elSrc){
  document.getElementById('customOverlay').classList.remove('d-none');
  if (el='blkIframe'){
    document.getElementById('popupChart').dataset.src=elSrc;document.getElementById('gtmImg').src='';
  } else {document.getElementById('gtmImg').src=elSrc;}
}
