(() => {
"use strict";
const $=id=>document.getElementById(id);
const state={followers:new Set(),following:new Set(),lists:{notback:[],fans:[],mutual:[]},tab:"notback",visible:50,times:{followers:new Map(),following:new Map()},done:loadDone(),showDone:false};
const fileInputs=[$("followers"),$("following")];
$("year").textContent=new Date().getFullYear();
const validUser=u=>typeof u==="string"&&/^[A-Za-z0-9._]{1,30}$/.test(u);
const normalize=u=>u.trim().replace(/^@/,"").toLowerCase();
function fromUrl(value){
 if(typeof value!=="string")return null;
 try{
  const u=new URL(value);
  if(!["instagram.com","www.instagram.com","m.instagram.com"].includes(u.hostname))return null;
  const parts=u.pathname.split("/").filter(Boolean);
  const name=decodeURIComponent(parts[0]==="_u"?(parts[1]||""):(parts[0]||""));
  if(["p","reel","reels","stories","explore","accounts","direct"].includes(name.toLowerCase()))return null;
  return validUser(name)?normalize(name):null;
 }catch{return null}
}
function usernamesFromEntries(entries){
 const out=new Map();
 for(const entry of entries){
  if(!entry||typeof entry!=="object")continue;
  const values=Array.isArray(entry.string_list_data)?entry.string_list_data:[];
  // One Instagram record represents ONE account. Never count both title and value.
  const candidates=[...values.map(item=>item?.value),entry.title];
  let username=null;
  for(const candidate of candidates){
   if(typeof candidate!=="string")continue;
   const u=normalize(candidate);
   if(validUser(u)){username=u;break}
  }
  if(!username){for(const item of values){username=fromUrl(item?.href);if(username)break}}
  if(username){const ts=Number(values.find(v=>Number.isFinite(Number(v?.timestamp)))?.timestamp)||0;out.set(username,Math.max(out.get(username)||0,ts));}
 }
 return out;
}
function parseJson(text,kind){
 let data;try{data=JSON.parse(text)}catch{throw Error("ملف JSON غير صالح.")}
 let entries;
 if(Array.isArray(data))entries=data;
 else if(data&&typeof data==="object"){
  const keys=kind==="followers"?["relationships_followers","followers"]:["relationships_following","following"];
  entries=keys.map(k=>data[k]).find(Array.isArray);
  if(!entries)throw Error("تركيبة الملف لا تطابق قائمة "+(kind==="followers"?"المتابعين":"المتابَعين")+". تأكد من اختيار الملف الصحيح.");
 }else throw Error("تركيبة JSON غير مدعومة.");
 return usernamesFromEntries(entries);
}
function parseHtml(text){
 const doc=new DOMParser().parseFromString(text,"text/html");
 const out=new Map();
 for(const a of doc.querySelectorAll("a[href]")){
  const user=fromUrl(a.getAttribute("href"));if(user)out.set(user,0);
 }
 return out;
}
async function readFile(file,kind){
 if(!file)throw Error("اختَر الملفين أولًا.");
 if(file.size>200*1024*1024)throw Error("حجم الملف يتجاوز 200MB. جرّب ملفًا أصغر أو تقسيم التصدير.");
 const ext=file.name.split(".").pop().toLowerCase();
 if(!["json","html","htm"].includes(ext))throw Error("الملفات المدعومة: JSON أو HTML فقط.");
 const text=await file.text();
 const result=ext==="json"?parseJson(text,kind):parseHtml(text);
 if(!result.size)throw Error("ما قدرنا نستخرج أسماء حسابات من "+file.name+". تأكد من محتوى الملف.");
 return result;
}
function showMessage(msg){$("message").textContent=msg}
function setFiles(){
 $("followersName").textContent=[...$("followers").files].map(f=>f.name).join("، ")||"اضغط لاختيار ملف أو عدة ملفات";
 $("followingName").textContent=[...$("following").files].map(f=>f.name).join("، ")||"اضغط لاختيار ملف أو عدة ملفات";
 $("analyzeBtn").disabled=!fileInputs.every(x=>x.files.length);
 showMessage("");$("diagnostics").textContent="";
}
fileInputs.forEach(input=>input.addEventListener("change",setFiles));
for(const [input,drop] of [["followers","followersDrop"],["following","followingDrop"]]){
 const el=$(drop);
 el.addEventListener("dragover",e=>{e.preventDefault();el.classList.add("drag")});
 el.addEventListener("dragleave",()=>el.classList.remove("drag"));
 el.addEventListener("drop",e=>{
  e.preventDefault();el.classList.remove("drag");
  const files=[...e.dataTransfer.files];if(!files.length)return;
  const dt=new DataTransfer();for(const f of files)dt.items.add(f);$(input).files=dt.files;setFiles();
 });
}
$("analyzeBtn").addEventListener("click",async()=>{
 const btn=$("analyzeBtn");btn.disabled=true;btn.textContent="جاري التحليل...";
 $("results").classList.add("hidden");showMessage("");
 try{
  const groups=await Promise.all(["followers","following"].map(async kind=>{
   const files=[...$(kind).files];const parts=await Promise.all(files.map(f=>readFile(f,kind)));
   return {users:new Set(parts.flatMap(part=>[...part.keys()])),times:new Map(parts.flatMap(part=>[...part.entries()])),files,parts};
  }));
  const [followers,following]=groups.map(g=>g.users);
  const diag=groups.map((g,i)=>`${i===0?"المتابعون":"المتابَعون"}: ${g.users.size} اسم فريد من ${g.files.length} ملف (${g.files.map((f,j)=>f.name+": "+g.parts[j].size).join("، ")})`);
  $("diagnostics").textContent=diag.join("\n");
  const expected=[Number($("expectedFollowers").value),Number($("expectedFollowing").value)];
  const mismatches=groups.map((g,i)=>$(i===0?"expectedFollowers":"expectedFollowing").value!==""&&g.users.size!==expected[i] ? `${i===0?"المتابعين":"المتابَعين"}: الملف يحتوي ${g.users.size}، بينما الرقم المُدخل ${expected[i]}`:null).filter(Boolean);
  if(mismatches.length)throw Error("تم إيقاف النتائج لتجنب مقارنة مضللة بسبب اختلاف الأعداد:\n"+mismatches.join("\n")+"\nتحقّق من اكتمال ملفات التصدير وتاريخه، أو صحّح العدد المرجعي إذا كان قد تغيّر.");
  state.followers=followers;state.following=following;state.times={followers:groups[0].times,following:groups[1].times};
  state.lists.notback=[...following].filter(x=>!followers.has(x)).sort();
  state.lists.fans=[...followers].filter(x=>!following.has(x)).sort();
  state.lists.mutual=[...following].filter(x=>followers.has(x)).sort();
  $("countFollowers").textContent=followers.size.toLocaleString("en-US");
  $("countFollowing").textContent=following.size.toLocaleString("en-US");
  $("countNotBack").textContent=state.lists.notback.length.toLocaleString("en-US");
  $("countFans").textContent=state.lists.fans.length.toLocaleString("en-US");
  state.tab="notback";state.visible=50;state.showDone=false;$("showDoneBtn").textContent="عرض الحسابات المُعلّمة";$("search").value="";
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===state.tab));
  $("results").classList.remove("hidden");render();
  await saveAnalysisIfEnabled();
  $("results").scrollIntoView({behavior:"smooth"});
 }catch(err){showMessage(err.message||"حدث خطأ أثناء قراءة الملفات.")}
 finally{btn.textContent="تحليل المتابعات ←";btn.disabled=!fileInputs.every(x=>x.files.length)}
});
const DONE_KEY="followcheck_done_v5";
function loadDone(){try{const obj=JSON.parse(localStorage.getItem("followcheck_done_v5")||"{}");return obj&&typeof obj==="object"&&!Array.isArray(obj)?obj:{}}catch{return {}}}
function persistDone(){try{localStorage.setItem(DONE_KEY,JSON.stringify(state.done));return true}catch{showMessage("تعذّر حفظ العلامات على هذا المتصفح. جرّبي مساحة تخزين متاحة أو صدّري القائمة.");return false}}
function markDone(name){state.done[name]=new Date().toISOString();persistDone();render()}
function undoDone(name){delete state.done[name];persistDone();render()}
function downloadFile(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function timeFor(name){return (state.tab==="fans"?state.times.followers:state.times.following).get(name)||0}
function current(){
 const q=normalize($("search").value),order=$("dateSort").value;
 const data=state.lists[state.tab].filter(name=>name.includes(q)&&(state.tab!=="notback"||(state.showDone?Boolean(state.done[name]):!state.done[name])));
 data.sort((a,b)=>order==="newest"?timeFor(b)-timeFor(a)||a.localeCompare(b):order==="oldest"?timeFor(a)-timeFor(b)||a.localeCompare(b):a.localeCompare(b));
 return data;
}
function render(){
 const data=current(), shown=data.slice(0,state.visible), list=$("list");
 list.replaceChildren();
 const fragment=document.createDocumentFragment();
 for(const name of shown){
  const row=document.createElement("div");row.className="user";
  const strong=document.createElement("strong");strong.textContent="@"+name;
  const link=document.createElement("a");link.href="https://www.instagram.com/"+encodeURIComponent(name)+"/";
  link.target="_blank";link.rel="noopener noreferrer";link.textContent="فتح الحساب ↗";
  const date=document.createElement("small");date.className="userdate";const ts=timeFor(name);date.textContent=ts?"تاريخ المتابعة: "+new Date(ts*1000).toLocaleDateString("ar-PS"):"التاريخ غير متوفر";
  const info=document.createElement("div");info.className="user-info";info.append(strong,date);
  const actions=document.createElement("div");actions.className="user-actions";
  if(state.tab==="notback"){
   const done=document.createElement("button");done.type="button";done.className="subtle mark-button";
   done.textContent=state.done[name]?"تراجع عن العلامة":"تم إلغاء متابعته ✓";
   done.addEventListener("click",()=>state.done[name]?undoDone(name):markDone(name));actions.append(done);
  }
  actions.append(link);
  row.append(info,actions);fragment.append(row);
 }
 list.append(fragment);
 $("listCount").textContent=`${data.length.toLocaleString("en-US")} حساب`;
 const marked=state.lists.notback.filter(name=>state.done[name]).length;
 $("progressCount").textContent=`المُعلّم عليها: ${marked} | المتبقية من ملفك: ${state.lists.notback.length-marked}`;
 renderDaily();
 $("showDoneBtn").textContent=state.showDone?"عرض الحسابات المتبقية":"عرض الحسابات المُعلّمة";
 $("moreBtn").classList.toggle("hidden",state.visible>=data.length);
}
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
 state.tab=btn.dataset.tab;state.visible=50;state.showDone=false;
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));render();
}));
$("search").addEventListener("input",()=>{state.visible=50;render()});
for(const id of ["dateSort"])$(id).addEventListener("change",()=>{state.visible=50;render()});
$("moreBtn").addEventListener("click",()=>{state.visible+=50;render()});
$("clearBtn").addEventListener("click",()=>{
 fileInputs.forEach(x=>x.value="");
 $("expectedFollowers").value="";$("expectedFollowing").value="";
 state.followers.clear();state.following.clear();
 state.lists={notback:[],fans:[],mutual:[]};
 $("results").classList.add("hidden");$("search").value="";state.times={followers:new Map(),following:new Map()};setFiles();
});
$("showDoneBtn").addEventListener("click",()=>{state.tab="notback";state.showDone=!state.showDone;state.visible=50;document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab==="notback"));render()});
$("resetDoneBtn").addEventListener("click",()=>{if(!Object.keys(state.done).length)return;if(!confirm("هل تريدين مسح جميع علامات إلغاء المتابعة المحفوظة على هذا الجهاز؟ لن يُلغى أي حساب على إنستغرام."))return;state.done={};persistDone();state.showDone=false;render()});
function exportNames(){return current()}
$("copyUsersBtn").addEventListener("click",async()=>{const names=exportNames().map(x=>"@"+x).join("\n");if(!names){showMessage("ما في أسماء لنسخها في القائمة الحالية.");return}try{await navigator.clipboard.writeText(names);showMessage(`تم نسخ ${exportNames().length} يوزر.`)}catch{showMessage("تعذّر النسخ التلقائي. استخدم تنزيل TXT بدلًا منه.")}});
$("exportTxtBtn").addEventListener("click",()=>{const labels={notback:"not_following_back",fans:"followers_not_followed",mutual:"mutual"};downloadFile("followcheck_"+labels[state.tab]+(state.showDone?"_marked":"")+".txt",exportNames().map(x=>"@"+x).join("\r\n")+"\r\n","text/plain;charset=utf-8")});
$("exportBtn").addEventListener("click",()=>{
 const labels={notback:"not_following_back",fans:"followers_not_followed",mutual:"mutual"};
 const rows=["username,follow_date,marked_done",...exportNames().map(x=>{const ts=timeFor(x);const date=ts?new Date(ts*1000).toISOString().slice(0,10):"";return [x,date,state.done[x]?"yes":"no"].map(v=>'"'+v.replace(/"/g,'""')+'"').join(",")})];
 downloadFile("followcheck_"+labels[state.tab]+(state.showDone?"_marked":"")+".csv","\ufeff"+rows.join("\r\n"),"text/csv;charset=utf-8");
});
// v6: Backup / restore and opt-in browser storage. Never upload anything.
const GOAL_KEY="followcheck_goal_v6", REMEMBER_KEY="followcheck_remember_v6";
const DB_NAME="followcheck_local_v6";
function dataMsg(t){$("dataMessage").textContent=t}
function localDay(date){const d=new Date(date);if(!Number.isFinite(d.getTime()))return "";const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,10)}
function renderDaily(){const today=localDay(new Date()),n=Object.values(state.done).filter(v=>localDay(v)===today).length;const goal=Number($("dailyGoal").value)||30;$("dailyCount").textContent=`علامات اليوم: ${n} / ${goal}. هذا هدف تنظيمي فقط، وليس حدًا آمنًا مضمونًا من إنستغرام.`}
try{$("dailyGoal").value=localStorage.getItem(GOAL_KEY)||"30"}catch{}
$("dailyGoal").addEventListener("change",()=>{let n=Math.max(1,Math.min(500,Number($("dailyGoal").value)||30));$("dailyGoal").value=n;try{localStorage.setItem(GOAL_KEY,String(n))}catch{}renderDaily()});
$("backupBtn").addEventListener("click",()=>{const payload={app:"FollowCheck",version:1,exportedAt:new Date().toISOString(),done:state.done};downloadFile("followcheck-progress-"+localDay(new Date())+".json",JSON.stringify(payload,null,2),"application/json;charset=utf-8");dataMsg("تم تجهيز ملف النسخة الاحتياطية. احفظه في مكان آمن.")});
$("restoreFile").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error("ملف النسخة الاحتياطية كبير جدًا.");const obj=JSON.parse(await file.text());if(obj?.app!=="FollowCheck"||obj?.version!==1||!obj.done||typeof obj.done!=="object"||Array.isArray(obj.done))throw Error("هذا ليس ملف نسخة احتياطية مدعومًا.");const incoming=Object.entries(obj.done);if(incoming.length>200000)throw Error("عدد السجلات غير منطقي.");const clean={};for(const [name,ts] of incoming){if(!validUser(name)||typeof ts!=="string"||!Number.isFinite(Date.parse(ts)))throw Error("النسخة الاحتياطية تحتوي سجلات غير صالحة.");clean[name.toLowerCase()]=ts}if(!confirm(`استرجاع ${Object.keys(clean).length} علامة ودمجها مع العلامات الموجودة؟`))return;state.done={...state.done,...clean};if(!persistDone())throw Error("لم نتمكن من حفظ العلامات؛ تأكد من مساحة التخزين.");render();dataMsg("تم استرجاع العلامات بنجاح.")}catch(err){dataMsg(err.message||"تعذر استرجاع النسخة.")}finally{e.target.value=""}});
function openDB(){return new Promise((resolve,reject)=>{if(!("indexedDB" in window)){reject(Error("هذا المتصفح لا يدعم الحفظ المحلي الموسّع."));return}const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore("data");req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error("تعذر فتح التخزين المحلي"))})}
async function dbOperation(mode,method,value){const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction("data",mode);const request=method==="put"?tx.objectStore("data").put(value,"analysis"):method==="get"?tx.objectStore("data").get("analysis"):tx.objectStore("data").delete("analysis");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
function snapshot(){return {version:1,savedAt:new Date().toISOString(),followers:[...state.followers],following:[...state.following],times:{followers:[...state.times.followers],following:[...state.times.following]}}}
async function saveAnalysisIfEnabled(){if(!$("rememberToggle").checked)return;try{await dbOperation("readwrite","put",snapshot());dataMsg("تم حفظ آخر تحليل محليًا على هذا الجهاز.")}catch(err){dataMsg("تعذّر حفظ التحليل محليًا: "+(err.message||"خطأ في التخزين"))}}
function loadSnapshot(data){if(data?.version!==1||!Array.isArray(data.followers)||!Array.isArray(data.following)||!data.times)throw Error("التحليل المحفوظ غير صالح.");if(data.followers.length>500000||data.following.length>500000)throw Error("التحليل المحفوظ أكبر من الحد المدعوم.");for(const u of [...data.followers,...data.following])if(!validUser(u))throw Error("أسماء الحسابات المحفوظة غير صالحة.");const followers=new Set(data.followers),following=new Set(data.following);state.followers=followers;state.following=following;state.times={followers:new Map(data.times.followers),following:new Map(data.times.following)};state.lists.notback=[...following].filter(x=>!followers.has(x));state.lists.fans=[...followers].filter(x=>!following.has(x));state.lists.mutual=[...following].filter(x=>followers.has(x));$("countFollowers").textContent=followers.size.toLocaleString("en-US");$("countFollowing").textContent=following.size.toLocaleString("en-US");$("countNotBack").textContent=state.lists.notback.length.toLocaleString("en-US");$("countFans").textContent=state.lists.fans.length.toLocaleString("en-US");state.tab="notback";state.visible=50;state.showDone=false;$("search").value="";document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab==="notback"));$("results").classList.remove("hidden");$("diagnostics").textContent="تحليل محفوظ من: "+new Date(data.savedAt).toLocaleString("ar-PS")+". قد تكون البيانات قديمة؛ للحصول على أحدث نتيجة نزّل تصديرًا جديدًا من إنستغرام.";render();$("results").scrollIntoView({behavior:"smooth"})}
try{$("rememberToggle").checked=localStorage.getItem(REMEMBER_KEY)==="yes"}catch{}
$("rememberToggle").addEventListener("change",async()=>{try{localStorage.setItem(REMEMBER_KEY,$("rememberToggle").checked?"yes":"no")}catch{}if($("rememberToggle").checked){if(state.followers.size||state.following.size)await saveAnalysisIfEnabled();else dataMsg("سيتم حفظ التحليل القادم محليًا.")}else{try{await dbOperation("readwrite","delete");dataMsg("تم إيقاف الحفظ وحذف التحليل المحفوظ.")}catch(err){dataMsg("تعذّر حذف التحليل: "+err.message)}}});
$("restoreSessionBtn").addEventListener("click",async()=>{try{const data=await dbOperation("readonly","get");if(!data)throw Error("ما في تحليل محفوظ على هذا الجهاز.");loadSnapshot(data);dataMsg("تم فتح التحليل المحفوظ. تذكّر أنه ليس تحديثًا مباشرًا من إنستغرام.")}catch(err){dataMsg(err.message||"تعذر فتح التحليل")}});
$("deleteSessionBtn").addEventListener("click",async()=>{try{await dbOperation("readwrite","delete");dataMsg("تم حذف التحليل المحفوظ.")}catch(err){dataMsg("تعذر الحذف: "+err.message)}});
$("eraseAllBtn").addEventListener("click",async()=>{if(!confirm("مسح جميع العلامات والتحليل المحفوظ وإعدادات FollowCheck من هذا المتصفح؟ لا يمكن التراجع دون نسخة احتياطية."))return;try{await dbOperation("readwrite","delete")}catch{}for(const key of [DONE_KEY,GOAL_KEY,REMEMBER_KEY])try{localStorage.removeItem(key)}catch{}state.done={};$("rememberToggle").checked=false;$("dailyGoal").value=30;fileInputs.forEach(x=>x.value="");state.followers.clear();state.following.clear();state.lists={notback:[],fans:[],mutual:[]};state.times={followers:new Map(),following:new Map()};$("results").classList.add("hidden");$("diagnostics").textContent="";setFiles();dataMsg("تم مسح البيانات المحلية التي يديرها الموقع.")});
renderDaily();
})();


// Interactive illustrated guide — standalone, no uploads or network requests.
(()=>{
const titles=["افتح حسابك على إنستغرام", "ادخل إلى مركز الحسابات", "اختار معلوماتك وأذوناتك", "اضغط تصدير معلوماتك", "أنشئ ملف تصدير", "اختار حساب إنستغرام", "اختار تصدير إلى الجهاز", "افتح تخصيص المعلومات", "حدّد بيانات التواصل فقط", "احفظ اختيار المتابعين والمتابَعين", "افتح نطاق التاريخ", "اختار طوال الوقت ثم حفظ", "افتح إعداد التنسيق", "اختار JSON ثم حفظ", "اضغط بدء التصدير", "أدخل كلمة السر داخل إنستغرام", "انتظر تجهيز ملف التصدير", "افتح رسالة إنستغرام في بريدك", "اضغط تنزيل من صفحة التصدير", "اضغط Download", "اضغط Open للمتابعة", "اختار الملفات ثم حفظ", "افتح الملف المضغوط ZIP", "استخدم ملفَي المتابعين والمتابَعين"], descriptions=["من ملفك الشخصي افتح قائمة الإعدادات.", "من الإعدادات انتقل إلى مركز الحسابات.", "من مركز الحسابات ادخل إلى معلوماتك وأذوناتك.", "اضغط Export your information.", "اختار إنشاء ملف تصدير جديد.", "حدّد حساب Instagram المطلوب، وليس Threads.", "اختار تصدير إلى الجهاز.", "افتح تخصيص المعلومات بدل تصدير كل المعلومات.", "ضمن عمليات التواصل حدّد المتابعون لك والذين تتابعهم؛ ويمكن إلغاء جهات الاتصال لأنها غير لازمة للمقارنة.", "تأكد أن البيانات المختارة هي المتابعون لك والذين تتابعهم ثم اضغط حفظ.", "اضغط نطاق التاريخ لتغيير الفترة.", "اختار طوال الوقت حتى تكون المقارنة أشمل ثم حفظ.", "افتح خيار التنسيق.", "اختار JSON وليس HTML ثم اضغط حفظ.", "راجع الإعدادات ثم اضغط بدء التصدير.", "قد يطلب إنستغرام كلمة السر للتحقق. أدخلها فقط داخل إنستغرام واضغط متابعة، ولا تدخلها في FollowCheck.", "الطلب قيد التجهيز. انتظر إشعار إنستغرام؛ المدة تختلف وقد تتجاوز 10 دقائق.", "بعد وصول إشعار الجاهزية، افتح رسالة إنستغرام واضغط export your information.", "في صفحة عمليات التنزيل المتوفرة اضغط تنزيل.", "اضغط Download لتنزيل ملف التصدير.", "إذا ظهر تنبيه فتح تطبيق خارجي اضغط Open.", "اختار تطبيق الملفات ثم اضغط حفظ.", "من تطبيق الملفات اضغط ملف ZIP لفك الضغط، ثم افتح المجلد الناتج.", "الملفان المطلوبان: followers_1.json و following.json. اختارهما في FollowCheck لبدء المقارنة."];
const stages=['إعدادات إنستغرام','تحديد البيانات','خيارات التصدير','تنزيل الملفات'];
const stage=(n)=>n<7?stages[0]:n<10?stages[1]:n<16?stages[2]:stages[3];
const $=(id)=>document.getElementById(id);if(!$('guide-wizard'))return;
let current=0;const jump=$('guide-jump');
for(let i=0;i<24;i++){let b=document.createElement('button');b.type='button';b.textContent=i+1;b.setAttribute('aria-label','الخطوة '+(i+1));b.addEventListener('click',()=>render(i));jump.appendChild(b)}
function render(n){current=Math.max(0,Math.min(23,n));$('guide-counter').textContent='الخطوة '+(current+1)+' من 24';$('guide-stage').textContent=stage(current);$('guide-progress-fill').style.width=((current+1)/24*100)+'%';$('guide-number').textContent=String(current+1).padStart(2,'0')+' / 24';$('guide-step-title').textContent=titles[current];$('guide-step-desc').textContent=descriptions[current];$('guide-image').src='guide-images/step-'+String(current+1).padStart(2,'0')+'.webp';$('guide-image').alt='الخطوة '+(current+1)+': '+titles[current];$('guide-prev').disabled=current===0;$('guide-next').textContent=current===23?'العودة للبداية ↺':'التالي ←';[...jump.children].forEach((b,i)=>{if(i===current){b.setAttribute('aria-current','step');b.scrollIntoView({block:'nearest',inline:'nearest'})}else b.removeAttribute('aria-current')})}
// Swipe gestures are only handled when the horizontal movement is intentional.
function attachSwipe(el, previous, next){let start=null;el.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;start={x:e.touches[0].clientX,y:e.touches[0].clientY}}, {passive:true});el.addEventListener('touchend',e=>{if(!start||e.changedTouches.length!==1)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.3)return;if(dx>0)previous();else next()}, {passive:true});el.addEventListener('touchcancel',()=>start=null,{passive:true})}
const prev=()=>render(Math.max(0,current-1)),next=()=>render(Math.min(23,current+1));
$('guide-prev').addEventListener('click',prev);$('guide-next').addEventListener('click',()=>render(current===23?0:current+1));
attachSwipe($('guide-zoom'),prev,next);
const modal=$('guide-modal');let focusBeforeModal=null;
function syncModal(){ $('guide-modal-image').src=$('guide-image').src;$('guide-modal-image').alt=$('guide-image').alt;$('guide-modal-count').textContent=(current+1)+' / 24';$('guide-modal-prev').disabled=current===0;$('guide-modal-next').disabled=current===23 }
$('guide-zoom').addEventListener('click',()=>{focusBeforeModal=document.activeElement;syncModal();modal.hidden=false;document.body.classList.add('modal-open');$('guide-close').focus()});
function close(){if(modal.hidden)return;modal.hidden=true;document.body.classList.remove('modal-open');focusBeforeModal?.focus()}
$('guide-close').addEventListener('click',close);
$('guide-modal-prev').addEventListener('click',()=>{prev();syncModal()});$('guide-modal-next').addEventListener('click',()=>{next();syncModal()});
modal.addEventListener('click',e=>{if(e.target===modal)close()});
attachSwipe($('guide-modal-image'),()=>{prev();syncModal()},()=>{next();syncModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(!modal.hidden){if(e.key==='ArrowRight'){$('guide-modal-prev').click()}if(e.key==='ArrowLeft'){$('guide-modal-next').click()}if(e.key==='Tab'){const controls=[$('guide-close'),$('guide-modal-prev'),$('guide-modal-next')].filter(b=>!b.disabled);if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus()}}}});
render(0);
})();
