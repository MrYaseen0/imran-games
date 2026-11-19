/* ==========================================================================
   Imran Games — Admin Dashboard App (app.js)
   Wave 3 (2026-11-19): the dashboard side of the split. This page is only
   reachable with a valid Supabase session (see the boot guard at the end)
   and only shows the dashboard after the is_admin() check passes.
   The Supabase/auth core and all data functions below are moved verbatim
   from the old adminaccess/index.html (same code, same behaviour). The
   only logic changes are the split adaptations documented in
   docs/admin/AUTH.md: showAdmin / signOutAdmin / igShowAdminIfAllowed
   redirect to login.html instead of toggling a login view that no longer
   exists on this page, and the shell (hash routing, topbar, search) is new.
   ========================================================================== */
var SB_URL="https://vnbaizpqucimomrfvfpd.supabase.co";
var SB_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuYmFpenBxdWNpbW9tcmZ2ZnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5ODA4NDMsImV4cCI6MjExMDU1Njg0M30.9-Zsqx811GKk0QP7ASoxQATbATzwmBtNy521jYeE1mg";
/* H-05 (2026-11-19): Remember me defaults to UNCHECKED — tokens live in
   sessionStorage unless the box is checked (localStorage). A missing flag is
   treated as unchecked (sessionStorage), so old localStorage sessions are
   not silently restored as persistent. */
var igStorage={
  getItem:function(k){try{return (localStorage.getItem("ig_remember")==="1"?localStorage:sessionStorage).getItem(k)}catch(e){return null}},
  setItem:function(k,v){try{(localStorage.getItem("ig_remember")==="1"?localStorage:sessionStorage).setItem(k,v)}catch(e){}},
  removeItem:function(k){try{localStorage.removeItem(k)}catch(e){}try{sessionStorage.removeItem(k)}catch(e){}}
};
/* H-05: idle timeout — 30 minutes without activity signs the admin out.
   Activity = mouse/keyboard/touch/scroll + any network request. Last-activity
   is persisted (throttled) so a stale session is also refused at boot. */
var IG_IDLE_MS=30*60*1000; /* 30 minutes — do not shorten in the shipped page */
var igLastActivity=Date.now();
var _igLastPersisted=0;
function igBumpActivity(){igLastActivity=Date.now();if(igLastActivity-_igLastPersisted>30000){_igLastPersisted=igLastActivity;try{localStorage.setItem("ig_last_activity",String(igLastActivity))}catch(e){}}}
function igStoredLastActivity(){try{var v=parseInt(localStorage.getItem("ig_last_activity")||"0",10);return v>0?v:0}catch(e){return 0}}
function igClearAuthStorage(){
  /* L-03: explicitly remove stored auth tokens from BOTH storages — the SDK's
     own cleanup is not relied on alone. Supabase token keys start with "sb-". */
  try{Object.keys(localStorage).forEach(function(k){if(k.indexOf("sb-")===0)localStorage.removeItem(k)})}catch(e){}
  try{Object.keys(sessionStorage).forEach(function(k){if(k.indexOf("sb-")===0)sessionStorage.removeItem(k)})}catch(e){}
  try{localStorage.removeItem("ig_remember")}catch(e){}
  try{localStorage.removeItem("ig_last_activity")}catch(e){}
  try{sessionStorage.removeItem("ig_last_activity")}catch(e){}
}
var sb=null; /* created lazily by ensureSb() — a client-init failure must never kill the page */
try{if(window.supabase&&window.supabase.createClient){sb=window.supabase.createClient(SB_URL,SB_ANON,{auth:{storage:igStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});}}catch(e){sb=null;}

/* H-05: wire activity events + network activity into the idle clock, and check
   once a minute — 30 idle minutes signs the admin out (redirect to login). */
["mousemove","keydown","mousedown","touchstart","wheel","scroll"].forEach(function(ev){try{window.addEventListener(ev,igBumpActivity,{passive:true})}catch(e){try{window.addEventListener(ev,igBumpActivity)}catch(e2){}}});
try{var _igFetch=window.fetch;window.fetch=function(){igBumpActivity();return _igFetch.apply(this,arguments);};}
catch(e){/* fetch cannot be wrapped — user events still reset the clock */}
setInterval(function(){
  if(!ADMIN_UNLOCKED)return;
  if(Date.now()-igLastActivity>IG_IDLE_MS){
    try{signOutAdmin("idle");}catch(e){}
  }
},60000);

function igLoadSupabaseLib(){
  if(window.supabase&&window.supabase.createClient)return Promise.resolve(true);
  return new Promise(function(resolve){
    var done=false;
    var finish=function(ok){if(!done){done=true;resolve(ok);}};
    try{
      var s=document.createElement("script");
      s.src="/vendor/supabase-js-2.119.1.min.js";
      s.onload=function(){finish(!!(window.supabase&&window.supabase.createClient));};
      s.onerror=function(){finish(false);};
      document.head.appendChild(s);
      setTimeout(function(){finish(!!(window.supabase&&window.supabase.createClient));},10000);
    }catch(e){finish(false);}
  });
}
async function ensureSb(){
  if(sb)return sb;
  try{
    if(window.supabase&&window.supabase.createClient){
      sb=window.supabase.createClient(SB_URL,SB_ANON,{auth:{storage:igStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
      if(sb)return sb;
    }
  }catch(e){sb=null;}
  var ok=await igLoadSupabaseLib();
  if(!ok)return null;
  try{
    sb=window.supabase.createClient(SB_URL,SB_ANON,{auth:{storage:igStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
  }catch(e){sb=null;}
  return sb;
}

/* ===== DATA — products for the admin panel only ===== */
var PRODUCTS=[];
var nextNumId=1000;
var CATMAP={"Consoles":["hardware","Consoles"],"Premium Tech":["hardware","Premium Tech"],"Controllers":["controls","Controllers"],"Headsets":["controls","Headsets"],"Racing Wheels":["controls","Racing Wheels"],"PS4 Games":["games","PS4 Games"],"PS5 Games":["games","PS5 Games"],"Gift Cards":["accessories","Gift Cards"],"Gaming Chairs":["accessories","Gaming Chairs"],"Gaming Setups":["accessories","Gaming Setups"],"Room Lighting":["accessories","Room Lighting"]};
function toAdminProduct(r,fallbackId){
  var m=String(r.slug||"").match(/^(\d+)-(.+)$/);
  var id=m?+m[1]:fallbackId;
  var slug=m?m[2]:(r.slug||"item");
  var cm=CATMAP[r.category]||["accessories",r.category||"Accessories"];
  var rawImgs=(r.image_urls||[]).filter(function(u){return !!u});
  var imgs=rawImgs.slice();
  if(!imgs.length)imgs=["/logo.png"];
  while(imgs.length<3)imgs.push(imgs[0]);
  return {id:id,uuid:r.id,slug:slug,name:r.name,brand:r.brand||"",cat:cm[0],catLabel:cm[1],price:r.price,old:(r.was_price||r.price),stock:r.stock,soldOut:r.stock===0,hot:!!r.is_hot,isNew:!!r.is_new,imgs:imgs,img:imgs[0],rawImgs:rawImgs,version:(r.version||1)};
}
async function loadProducts(){
  try{
    var res=await fetch(SB_URL+"/rest/v1/products?select=*&order=created_at",{headers:{"apikey":SB_ANON,"Authorization":"Bearer "+SB_ANON}});
    if(!res.ok)throw new Error("HTTP "+res.status);
    var rows=await res.json();
    var maxId=0;
    PRODUCTS=rows.map(function(r){var m=String(r.slug||"").match(/^(\d+)-/);if(m)maxId=Math.max(maxId,+m[1]);return toAdminProduct(r,0);});
    var nid=Math.max(1000,maxId+1);
    PRODUCTS.forEach(function(p){if(!p.id){p.id=nid++;}});
    nextNumId=Math.max(1000,maxId+1);
    if(ADMIN_UNLOCKED){renderAdminList();renderAnalytics();try{renderProductTiles();}catch(e){}}
  }catch(err){
    var b=document.getElementById("adminList");
    if(b&&ADMIN_UNLOCKED)b.innerHTML='<p style="color:var(--danger)">Could not load products — '+escHtml(err.message||"")+'</p>';
  }
}
function subscribeRealtime(){
  if(!sb){setInterval(function(){loadProducts()},30000);return}
  sb.channel("ig-admin-products").on("postgres_changes",{event:"*",schema:"public",table:"products"},function(){loadProducts();}).subscribe();
}

var ADMIN_UNLOCKED=false;
var SB_REST=SB_URL+"/rest/v1/products";
async function sbHeaders(){
  var token=SB_ANON;
  if(sb){try{var sess=await sb.auth.getSession();if(sess&&sess.data&&sess.data.session)token=sess.data.session.access_token}catch(e){}}
  return {"apikey":SB_ANON,"Authorization":"Bearer "+token,"Content-Type":"application/json","Prefer":"return=representation"};
}
async function sbWrite(method,path,body){
  var res=await fetch(SB_REST+path,{method:method,headers:await sbHeaders(),body:body?JSON.stringify(body):undefined});
  var txt=await res.text(),data=null;try{data=JSON.parse(txt)}catch(e){}
  if(!res.ok){var msg=(data&&data.message)||("HTTP "+res.status);if(res.status===401||res.status===403)msg="Not signed in — log in again with your admin email and password.";throw new Error(msg)}
  return data;
}
function slugify(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"item"}

/* ===== AUDIT LOG — every admin event is recorded in Supabase audit_log ===== */
var SB_AUDIT=SB_URL+"/rest/v1/audit_log";
var ADMIN_IP=null;
async function getAdminIP(){
  if(ADMIN_IP)return ADMIN_IP;
  try{
    var ctl=new AbortController();var to=setTimeout(function(){ctl.abort()},3000);
    var r=await fetch("https://api.ipify.org?format=json",{signal:ctl.signal});
    clearTimeout(to);
    var j=await r.json();ADMIN_IP=(j&&j.ip)||"unknown";
  }catch(e){ADMIN_IP="unknown";}
  return ADMIN_IP;
}
async function currentActorEmail(){
  try{if(sb){var s=await sb.auth.getSession();if(s&&s.data&&s.data.session&&s.data.session.user)return s.data.session.user.email}}catch(e){}
  return null;
}
async function logAudit(action,entity,recordId,recordName,details){
  try{
    var email=await currentActorEmail();if(!email)return;
    var ip=await getAdminIP();
    var headers=await sbHeaders();
    await fetch(SB_AUDIT,{method:"POST",headers:headers,body:JSON.stringify({actor_email:email,action:action,entity:entity||"product",record_id:recordId||null,record_name:recordName||null,details:details||{},ip_address:ip,user_agent:navigator.userAgent||null})});
  }catch(e){/* audit must never block an admin action */}
}
async function logFailedLogin(email){
  try{
    var ip=await getAdminIP();
    await fetch(SB_URL+"/rest/v1/rpc/log_failed_login",{method:"POST",headers:{"apikey":SB_ANON,"Authorization":"Bearer "+SB_ANON,"Content-Type":"application/json"},body:JSON.stringify({p_email:email,p_ip:ip,p_ua:navigator.userAgent||null})});
  }catch(e){}
}
function fmtPKT(iso){
  try{return new Date(iso).toLocaleString("en-GB",{timeZone:"Asia/Karachi",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}catch(e){return iso}
}
/* H-04 (2026-11-19): escape &, <, >, ", ' and ` — used for EVERY value
   interpolated into innerHTML, including attribute values. */
function escHtml(x){return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/`/g,"&#96;")}
/* H-04: image URLs may only be https:// or site-relative. javascript:, data:,
   vbscript:, protocol-relative and any other scheme are rejected. */
function igSafeImgUrl(u){
  var s=String(u||"").trim();
  if(!s)return "";
  if(/^(javascript|data|vbscript):/i.test(s))return "";
  if(s.indexOf("//")===0)return "";
  if(/^[a-z][a-z0-9+.-]*:/i.test(s)&&s.toLowerCase().indexOf("https://")!==0)return "";
  return s;
}
/* H-04 follow-up: a missing product photo (file gone, not just an unsafe URL)
   falls back to the site logo instead of a broken icon. */
document.addEventListener("error",function(e){var t=e.target;if(!t||t.tagName!=="IMG")return;var cur=t.getAttribute("src");if(!cur||cur.indexOf("logo.png")!==-1||t.getAttribute("data-logo-fb"))return;t.setAttribute("data-logo-fb","1");t.setAttribute("src","/logo.png")},true);
async function loadAuditLog(){
  var box=document.getElementById("auditList");if(!box)return;
  try{
    var headers=await sbHeaders();
    var res=await fetch(SB_AUDIT+"?select=*&order=created_at.desc&limit=50",{headers:headers});
    if(!res.ok)throw new Error("HTTP "+res.status);
    var rows=await res.json();
    AUDIT_ROWS=rows||[];
    renderFlow(AUDIT_ROWS);
    document.getElementById("auditCount").textContent=rows.length;
    if(!rows.length){box.innerHTML='<p class="ig-muted ig-small" style="margin:0">No admin activity recorded yet.</p>';return}
    box.innerHTML=rows.map(function(r){
      return '<div style="display:flex;gap:10px;align-items:baseline;padding:9px 0;border-top:1px solid var(--table-line);flex-wrap:wrap;font-size:13px">'
      +'<span class="ig-muted" style="min-width:180px">'+fmtPKT(r.created_at)+'</span>'
      +'<b style="min-width:130px">'+escHtml(r.action)+'</b>'
      +'<span style="flex:1;min-width:140px">'+(r.record_name?escHtml(r.record_name):"—")+'</span>'
      +'<span class="ig-muted">'+escHtml(r.actor_email)+'</span>'
      +'<span class="ig-muted ig-small">'+escHtml(r.ip_address||"unknown")+'</span>'
      +'</div>';
    }).join("");
  }catch(err){box.innerHTML='<p style="color:var(--danger);font-size:13px;margin:0">Could not load history — '+escHtml(err.message||"try again")+'</p>';}
}


/* ===== C-01 (2026-11-19): admin-role gate — defence in depth =====
   Server-side enforcement is the RLS policies in supabase.sql /
   migrations/2026-11-19-c01-admin-flag.sql. This JS check only decides
   whether the dashboard is shown: a non-admin who signs in is signed
   straight back out and never sees the admin UI. */
async function isCurrentUserAdmin(client){
  var c=client||sb;
  if(!c)return false;
  try{
    var r=await c.rpc("is_admin");
    return !r.error && r.data===true;
  }catch(e){return false;}
}
async function igShowAdminIfAllowed(email,client){
  var admin=await isCurrentUserAdmin(client);
  if(!admin){
    try{await (client||sb).auth.signOut();}catch(e){}
    try{igClearAuthStorage();}catch(e){}
    /* Wave 3: this page has no login view to show the message in — the
       login page shows it from the ?error=not-admin reason instead. */
    location.replace("/adminaccess/login.html?error=not-admin");
    return false;
  }
  showAdmin(email);
  return true;
}
function showAdmin(email){
  /* Wave 3: this page IS the dashboard, so there is no loginView/dashView
     to toggle. Unlocking means revealing the admin body and filling the
     signed-in identity (page + topbar avatar). */
  ADMIN_UNLOCKED=true;
  var body=document.getElementById("adminBody");
  if(body)body.style.display="block";
  var who=document.getElementById("adminWho");
  if(who)who.textContent=email||"";
  var avN=document.getElementById("avatarName");
  if(avN)avN.textContent=email||"Admin";
  var avI=document.getElementById("avatarInitials");
  if(avI)avI.textContent=(email||"A").charAt(0).toUpperCase();
  renderAdminList();
  getAdminIP();
  loadAuditLog();
  renderAnalytics();
  /* Wave 4: fetch the real role (for the avatar label + write gating) and
     load the reference dashboard (KPIs, charts, recent orders). */
  loadMyRole();
  loadDashboard();
}
async function signOutAdmin(reason){
  try{var em=await currentActorEmail();if(em)await logAudit("logout","admin",null,em,{});}catch(e){}
  try{if(sb)await sb.auth.signOut()}catch(e){}
  /* L-03: explicitly clear stored auth tokens from BOTH storages — the SDK's
     own cleanup is not relied on alone. */
  igClearAuthStorage();
  ADMIN_UNLOCKED=false;
  /* Wave 3: no login view on this page — hand over to login.html, which
     shows "Signed out." (or the idle message for reason "idle"). */
  location.replace("/adminaccess/login.html?signed-out="+(reason==="idle"?"idle":"1"));
}

/* ===== ANALYTICS — live numbers + charts, computed from Supabase ===== */
var AN_CHARTS={};
var AUDIT_ROWS=[];
function fmtNum(n){try{return Number(n).toLocaleString("en-PK")}catch(e){return String(n)}}
function renderFlow(rows){
  var box=document.getElementById("flowList");if(!box)return;
  if(!rows||!rows.length){box.innerHTML='<p class="ig-muted ig-small" style="margin:0">No admin activity recorded yet.</p>';return}
  box.innerHTML=rows.slice(0,20).map(function(r,i){
    return '<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--table-line);font-size:13px;align-items:baseline;flex-wrap:wrap">'
    +'<span style="color:var(--primary);font-weight:700;min-width:22px">'+(i+1)+'.</span>'
    +'<span class="ig-muted" style="min-width:170px">'+fmtPKT(r.created_at)+'</span>'
    +'<span>'+escHtml(r.actor_email||"")+'</span>'
    +'<b>'+escHtml(r.action||"")+'</b>'
    +'<span style="flex:1;min-width:120px">'+(r.record_name?escHtml(r.record_name):"—")+'</span>'
    +'<span class="ig-muted ig-small">'+escHtml(r.ip_address||"unknown")+'</span>'
    +'</div>';
  }).join("");
}
function drawChart(key,elId,cfg){
  var el=document.getElementById(elId);if(!el||!window.Chart)return;
  if(AN_CHARTS[key]){try{AN_CHARTS[key].destroy()}catch(e){}}
  if(window.Chart.defaults)window.Chart.defaults.color=igChartTheme().tick;
  AN_CHARTS[key]=new window.Chart(el.getContext("2d"),cfg);
}
async function renderAnalytics(){
  if(!document.getElementById("adminBody")||document.getElementById("adminBody").style.display==="none")return;
  var total=PRODUCTS.length,units=0,value=0,soldOut=0;
  var byCat={},bands=[0,0,0,0];
  PRODUCTS.forEach(function(p){
    units+=p.stock||0;value+=(p.price||0)*(p.stock||0);
    if(p.soldOut||p.stock===0)soldOut++;
    byCat[p.catLabel||"Other"]=(byCat[p.catLabel||"Other"]||0)+1;
    if(p.price<10000)bands[0]++;else if(p.price<50000)bands[1]++;else if(p.price<150000)bands[2]++;else bands[3]++;
  });
  var set=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v};
  set("anTotal",fmtNum(total));set("anStock",fmtNum(units));
  set("anValue","Rs. "+fmtNum(value));set("anSoldOut",fmtNum(soldOut));
  var msg=document.getElementById("anMsg");
  if(!window.Chart){if(msg)msg.textContent="Charts could not load (chart library unreachable) — numbers above are still live.";renderFlow(AUDIT_ROWS);return}
  if(msg)msg.textContent="";
  var palette=["#EC008C","#00AEEF","#7C5CFF","#22C55E","#F59E0B","#EF4444","#14B8A6","#F97316","#A855F7","#84CC16","#06B6D4"];
  var catLabels=Object.keys(byCat),catData=catLabels.map(function(k){return byCat[k]});
  drawChart("cat","chCat",{type:"doughnut",data:{labels:catLabels,datasets:[{data:catData,backgroundColor:palette}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:12,font:{size:11}}}}}});
  drawChart("stock","chStock",{type:"doughnut",data:{labels:["In stock","Sold out"],datasets:[{data:[total-soldOut,soldOut],backgroundColor:["#22C55E","#EF4444"]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom"}}}});
  drawChart("price","chPrice",{type:"bar",data:{labels:["Under Rs 10,000","Rs 10k – 50k","Rs 50k – 150k","Above Rs 150k"],datasets:[{data:bands,backgroundColor:["#00AEEF","#7C5CFF","#EC008C","#F59E0B"]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{stepSize:1},grid:{color:igChartTheme().grid}},x:{grid:{display:false}}}}});
  try{
    var headers=await sbHeaders();
    var rc=await fetch(SB_AUDIT+"?select=id&limit=1",{headers:Object.assign({},headers,{Prefer:"count=exact"})});
    var cr=rc.headers.get("content-range")||"";var tot=parseInt((cr.split("/")[1]||"0"),10);
    set("anActions",isNaN(tot)?"—":fmtNum(tot));
    var ra=await fetch(SB_AUDIT+"?select=action,created_at&order=created_at.desc&limit=500",{headers:headers});
    var rows=await ra.json();
    var days=[],keys=[];
    for(var d=6;d>=0;d--){var dt=new Date(Date.now()-d*86400000);var key=dt.toLocaleDateString("en-GB",{timeZone:"Asia/Karachi",day:"2-digit",month:"short"});days.push(key);keys.push(key)}
    var types=["login_success","login_failed","product_added","product_edited","product_deleted","logout"];
    var tcol={login_success:"#22C55E",login_failed:"#EF4444",product_added:"#00AEEF",product_edited:"#F59E0B",product_deleted:"#EC008C",logout:"#8A90A8"};
    var counts={};types.forEach(function(t){counts[t]=[0,0,0,0,0,0,0]});
    (rows||[]).forEach(function(r){
      var k=new Date(r.created_at).toLocaleDateString("en-GB",{timeZone:"Asia/Karachi",day:"2-digit",month:"short"});
      var i=keys.indexOf(k);if(i<0||!counts[r.action])return;counts[r.action][i]++;
    });
    var ds=types.filter(function(t){return counts[t].some(function(v){return v>0})}).map(function(t){return {label:t,data:counts[t],backgroundColor:tcol[t]}});
    if(!ds.length)ds=[{label:"admin actions",data:[0,0,0,0,0,0,0],backgroundColor:"#00AEEF"}];
    drawChart("act","chActivity",{type:"bar",data:{labels:days,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:12,font:{size:11}}}},scales:{y:{ticks:{stepSize:1},stacked:true,grid:{color:igChartTheme().grid}},x:{stacked:true,grid:{display:false}}}}});
  }catch(e){set("anActions","—")}
  renderFlow(AUDIT_ROWS);
}
/* Wave 4: the product list is a real table now (reference screenshot 04),
   paginated 10/page, filtered by the global search. Save/Delete behaviour
   is unchanged (optimistic locking via version, tap-twice delete). */
var PROD_LIST_PAGE=1, PROD_LIST_SIZE=10, PROD_LIST_FILTER="";
function renderAdminList(){
  var box=document.getElementById("adminList");if(!box)return;
  var countEl=document.getElementById("adminCount");if(countEl)countEl.textContent=PRODUCTS.length;
  var needle=String(PROD_LIST_FILTER||"").toLowerCase();
  var rows=PRODUCTS.slice().sort(function(a,b){return a.id-b.id}).filter(function(p){
    return !needle||((p.name||"")+" "+(p.brand||"")+" "+(p.catLabel||"")).toLowerCase().indexOf(needle)!==-1;
  });
  var pg=IGAdminUI.paginate(rows.length,PROD_LIST_PAGE,PROD_LIST_SIZE);
  PROD_LIST_PAGE=pg.page;
  var page=rows.slice((pg.page-1)*PROD_LIST_SIZE,pg.page*PROD_LIST_SIZE);
  if(!page.length){
    box.innerHTML='<tr><td colspan="7"><div class="ig-state"><b>No products match</b><p>'+(PRODUCTS.length?"Try a different search or category.":"No products yet — add one with “+ Add New Item”.")+'</p></div></td></tr>';
  }else{
    box.innerHTML=page.map(function(p){
      /* H-04: every interpolated value is escaped; the image URL is validated and
         falls back to the local logo when unsafe. Numbers are coerced to numbers. */
      return '<tr class="arow" data-uuid="'+escHtml(p.uuid)+'" data-version="'+(Number(p.version)||1)+'">'
      +'<td><img src="'+escHtml(igSafeImgUrl(p.img)||"/logo.png")+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:10px"/></td>'
      +'<td><b style="font-size:13px">'+escHtml(p.name)+'</b><br/><span class="ig-muted ig-small">'+escHtml(p.catLabel)+' • '+escHtml(p.brand)+(p.soldOut?' • <span style="color:var(--danger)">SOLD OUT</span>':'')+'</span></td>'
      +'<td><input class="aprice ig-input" type="number" value="'+(Number(p.price)||0)+'" style="width:96px"/></td>'
      +'<td><input class="awas ig-input" type="number" value="'+(Number(p.old)||0)+'" style="width:96px"/></td>'
      +'<td><input class="astock ig-input" type="number" value="'+(Number(p.stock)||0)+'" style="width:76px"/></td>'
      +'<td><textarea class="aphotos ig-textarea" rows="2" style="min-width:180px;font-size:12px">'+escHtml((p.rawImgs||[]).join("\n"))+'</textarea></td>'
      +'<td class="ig-actions">'+(igCanWrite()?'<button class="ig-btn ig-btn-primary ig-btn-sm asave" type="button">Save</button> ':"")+(igCanDelete()?'<button class="ig-btn ig-btn-ghost ig-btn-sm adel" type="button">Delete</button>':"")+'</td>'
      +'</tr>';
    }).join("");
  }
  var pager=document.getElementById("prodListPager");
  if(pager){
    pager.innerHTML="";
    if(rows.length>PROD_LIST_SIZE)pager.appendChild(IGAdminUI.buildPagination(rows.length,pg.page,PROD_LIST_SIZE,function(n){PROD_LIST_PAGE=n;renderAdminList();}));
    else if(rows.length)pager.innerHTML='<p class="ig-muted ig-small" style="margin:10px 0 0">Showing '+pg.start+'–'+pg.end+' of '+rows.length+'</p>';
  }
}

function showToast(msg){var t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.classList.add("show");clearTimeout(showToast._t);showToast._t=setTimeout(function(){t.classList.remove("show")},2600);}
document.getElementById("adminLock").addEventListener("click",signOutAdmin);
document.getElementById("adminLockTop").addEventListener("click",signOutAdmin);
document.getElementById("avatarLogout").addEventListener("click",signOutAdmin);
document.getElementById("npAdd").addEventListener("click",async function(){
  var name=document.getElementById("npName").value.trim();
  var brand=document.getElementById("npBrand").value.trim()||"Imran Games";
  var cat=document.getElementById("npCat").value;
  var price=parseInt(document.getElementById("npPrice").value,10);
  var was=parseInt(document.getElementById("npWas").value,10);
  var stock=parseInt(document.getElementById("npStock").value,10);
  var urls=document.getElementById("npImgs").value.split("\n").map(function(s){return s.trim()}).filter(Boolean).slice(0,3);
  var msg=document.getElementById("npMsg");
  if(!name||!(price>0)||isNaN(stock)){msg.textContent="✖ Fill in the name, a price above 0, and stock.";return}
  if(!urls.length){msg.textContent="✖ Paste at least 1 photo URL (Supabase Storage link).";return}
  /* H-04: reject unsafe photo URLs at write time too (render path also validates). */
  if(urls.some(function(u){return !igSafeImgUrl(u)})){msg.textContent="✖ Photo URLs must be https:// links or site-relative paths.";return}
  while(urls.length<3)urls.push(urls[0]);
  var slug=nextNumId+"-"+slugify(name);
  msg.textContent="Adding…";
  try{
    var added=await sbWrite("POST","",{name:name,slug:slug,category:cat,brand:brand,price:price,was_price:isNaN(was)?price:was,stock:stock,is_hot:document.getElementById("npHot").checked,is_new:document.getElementById("npNew").checked,image_urls:urls});if(!added||!added.length)throw new Error("Add failed — nothing was saved. Check that you are signed in and try again.");
    await logAudit("product_added","product",added[0].id,name,{price:price,was_price:isNaN(was)?price:was,stock:stock,category:cat});
    loadAuditLog();renderAnalytics();
    nextNumId++;
    msg.textContent="✓ Added — live on the shop now.";
    ["npName","npBrand","npPrice","npWas","npStock","npImgs"].forEach(function(id){document.getElementById(id).value=""});
    document.getElementById("npHot").checked=false;document.getElementById("npNew").checked=false;
    loadProducts();
    /* Wave 4: the add form lives in a modal now — close it and toast. */
    try{IGAdminUI.closeModal("prodModal");}catch(e){}
    showToast("Added ✓ — live on the shop now");
  }catch(err){msg.textContent="✖ "+err.message;}
});
document.getElementById("adminList").addEventListener("click",async function(e){
  var row=e.target.closest(".arow");if(!row)return;
  var uuid=row.getAttribute("data-uuid");
  var p=PRODUCTS.find(function(x){return x.uuid===uuid});
  if(e.target.closest(".asave")){
    var price=parseInt(row.querySelector(".aprice").value,10);
    var was=parseInt(row.querySelector(".awas").value,10);
    var stock=parseInt(row.querySelector(".astock").value,10);
    if(!(price>0)||isNaN(stock)){showToast("✖ Price must be above 0 and stock a number");return}
    var photoEl=row.querySelector(".aphotos");
    var photoUrls=photoEl?photoEl.value.split("\n").map(function(s){return s.trim()}).filter(Boolean).slice(0,3):[];
    /* H-04: reject unsafe photo URLs at write time too. */
    if(photoUrls.some(function(u){return !igSafeImgUrl(u)})){showToast("✖ Photo URLs must be https:// links or site-relative paths");return}
    var btn=e.target.closest(".asave");btn.textContent="Saving…";
    try{var loadedVer=parseInt(row.getAttribute("data-version")||"1",10);if(!(loadedVer>0))loadedVer=(p&&p.version)||1;var patchBody={price:price,was_price:isNaN(was)?price:was,stock:stock,version:loadedVer+1};if(photoUrls.length)patchBody.image_urls=photoUrls;var upd=await sbWrite("PATCH","?id=eq."+uuid+"&version=eq."+loadedVer,patchBody);if(!upd||!upd.length){showToast("Someone changed this product — refresh and try again");btn.textContent="Save";loadProducts();return}var auditDetails={old_price:p?p.price:null,new_price:price,old_was_price:p?p.old:null,new_was_price:isNaN(was)?price:was,old_stock:p?p.stock:null,new_stock:stock};if(photoUrls.length)auditDetails.new_image_urls=photoUrls;await logAudit("product_edited","product",uuid,p?p.name:null,auditDetails);loadAuditLog();renderAnalytics();showToast("Saved ✓ — live on the shop now");loadProducts();}
    catch(err){showToast("✖ "+err.message);btn.textContent="Save";}
  }
  if(e.target.closest(".adel")){
    if(!p)return;
    var delBtn=e.target.closest(".adel");
    if(delBtn.getAttribute("data-arm")!=="1"){
      delBtn.setAttribute("data-arm","1");
      delBtn.textContent="Sure? Tap again to delete";
      delBtn.style.background="#7F1D1D";delBtn.style.borderColor="#EF4444";
      setTimeout(function(){try{delBtn.removeAttribute("data-arm");delBtn.textContent="Delete";delBtn.style.background="";delBtn.style.borderColor="";}catch(e){}},5000);
      return;
    }
    try{var del=await sbWrite("DELETE","?id=eq."+uuid);if(!del||!del.length)throw new Error("Delete failed — nothing was deleted. Are you still signed in?");await logAudit("product_deleted","product",uuid,p?p.name:null,{price:p?p.price:null,stock:p?p.stock:null});loadAuditLog();renderAnalytics();showToast("Deleted ✓");loadProducts();}
    catch(err){showToast("✖ "+err.message);}
  }
});

/* ===== SHELL — hash routing, sidebar, topbar, search (Wave 3, new) ===== */
var IG_ROUTES=["dashboard","orders","products","reports","customers","settings"];
function igCurrentRoute(){var h=(location.hash||"").replace(/^#\/?/,"");return IG_ROUTES.indexOf(h)!==-1?h:"dashboard";}
function igRenderRoute(){
  var r=igCurrentRoute();
  document.querySelectorAll(".ig-nav-item").forEach(function(a){a.classList.toggle("active",a.getAttribute("data-route")===r);});
  IG_ROUTES.forEach(function(name){var s=document.getElementById("route-"+name);if(s)s.hidden=(name!==r);});
  document.body.classList.remove("ig-sidebar-open");
  /* Wave 4: each route loads its own real data when it becomes visible. */
  if(ADMIN_UNLOCKED){
    if(r==="dashboard"){try{renderAdminList();}catch(e){}try{renderAnalytics();}catch(e){}try{loadDashboard();}catch(e){}}
    else if(r==="orders"){try{loadOrdersPage();}catch(e){}}
    else if(r==="products"){try{loadProductsPage();}catch(e){}}
    else if(r==="reports"){try{loadReportsPage();}catch(e){}}
    else if(r==="customers"){try{loadCustomersPage();}catch(e){}}
    else if(r==="settings"){try{loadSettingsPage();}catch(e){}}
  }
  try{localStorage.setItem("ig-admin-route","#/"+r);}catch(e){}
}
window.addEventListener("hashchange",igRenderRoute);
function igInitRoute(){
  if(!location.hash){
    var last=null;try{last=localStorage.getItem("ig-admin-route");}catch(e){}
    if(last&&IG_ROUTES.indexOf(last.replace(/^#\/?/,""))!==-1){location.hash=last;}
    else{location.hash="#/dashboard";}
  }
  igRenderRoute();
}
/* Sidebar collapse to the 72px rail (1024–1279px it also collapses by CSS). */
var railBtn=document.getElementById("railToggle");
if(railBtn){railBtn.addEventListener("click",function(){
  var rail=document.body.classList.toggle("ig-rail");
  railBtn.textContent=rail?"»":"«";
  railBtn.setAttribute("aria-label",rail?"Expand sidebar":"Collapse sidebar");
  railBtn.setAttribute("title",rail?"Expand sidebar":"Collapse sidebar");
});}
try{IGAdminUI.initTopbar();}catch(e){}
try{IGAdminUI.setBellCount(0);}catch(e){}
try{
  /* Global search filters the product list + tiles (via the filter string,
     re-rendered) and the visible rows of the orders/customers/reports
     tables (DOM-level only — it hides non-matching rows, it never
     changes data). */
  IGAdminUI.initGlobalSearch(function(q){
    PROD_LIST_FILTER=q||"";
    PROD_TILE_PAGE=1;PROD_LIST_PAGE=1;
    try{renderAdminList();}catch(e){}
    try{renderProductTiles();}catch(e){}
    try{filterVisibleTables(q||"");}catch(e){}
  });
}catch(e){}
igInitRoute();

/* ===== WAVE 4 — reference dashboard / orders / products (2026-11-19) =====
   Rebuilds the admin pages to the reference screenshots (02 dashboard,
   03 orders, 04 products, 05 dark mode) with REAL Supabase data only:
   - KPIs + deltas from get_kpi_deltas (PKT days); real 0s, NULL deltas
     render as "—", never demo numbers.
   - Market Overview from v_revenue_daily; Sales by Category donut from
     v_sales_by_category (items sold, labelled as sales).
   - Orders: manual "+ Add Order" only (the shop checkout is untouched);
     stock is deducted only via deduct_stock_for_order, never reserve_stock.
   - Products: tiles + list from the live products table; rating is NULL
     in the DB, so tiles show "No ratings yet", never invented stars.
   - Roles: admin_role() drives the avatar label and hides what a role
     cannot do; the database (RLS) still enforces everything.
   ========================================================================== */

/* Chart.js cannot resolve CSS var() in canvas colours — real hex per theme. */
function igChartTheme(){
  var dark=document.documentElement.getAttribute("data-theme")==="dark";
  return {tick:dark?"#A9B2E0":"#7A7A85",grid:dark?"rgba(255,255,255,.12)":"rgba(20,20,60,.08)",blue:dark?"#5A5AFF":"#0A00FF"};
}
function igTodayPKT(){try{return new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Karachi"});}catch(e){return new Date().toISOString().slice(0,10);}}
function igRangeDays(n){
  var end=igTodayPKT();var p=end.split("-");
  var t=Date.UTC(+p[0],+p[1]-1,+p[2])-(n-1)*86400000;var s=new Date(t);
  var start=s.getUTCFullYear()+"-"+String(s.getUTCMonth()+1).padStart(2,"0")+"-"+String(s.getUTCDate()).padStart(2,"0");
  return {start:start,end:end};
}
var IG_RANGE_DASH=igRangeDays(30), IG_RANGE_ORD=igRangeDays(30), IG_RANGE_REP=igRangeDays(30);
var IG_MARKET_SEG="Weekly";
var IG_DASH_DAILY=[];

async function igRest(method,path,body){
  var h=await sbHeaders();
  var res=await fetch(SB_URL+"/rest/v1"+path,{method:method,headers:h,body:body?JSON.stringify(body):undefined});
  var txt=await res.text(),data=null;try{data=JSON.parse(txt)}catch(e){}
  if(!res.ok){var msg=(data&&data.message)||("HTTP "+res.status);if(res.status===401||res.status===403)msg="Not signed in — log in again with your admin email and password.";throw new Error(msg)}
  return data;
}
async function igRpc(name,body){
  var h=await sbHeaders();
  var res=await fetch(SB_URL+"/rest/v1/rpc/"+name,{method:"POST",headers:h,body:JSON.stringify(body||{})});
  var txt=await res.text(),data=null;try{data=JSON.parse(txt)}catch(e){}
  if(!res.ok){var msg=(data&&data.message)||("HTTP "+res.status);if(res.status===401||res.status===403)msg="Not signed in — log in again with your admin email and password.";throw new Error(msg)}
  return data;
}
function igDailySeries(byDay,endISO,field){
  var out=[];
  for(var i=29;i>=0;i--){
    var d=new Date(Date.UTC(+endISO.slice(0,4),+endISO.slice(5,7)-1,+endISO.slice(8,10))-i*86400000);
    var key=d.toISOString().slice(0,10);
    var row=byDay[key]||{};
    out.push(Number(row[field]||0));
  }
  return out;
}
function igKpiCard(label,metric,spark,fmt,sub){
  var v=metric?Number(metric.current_value||0):0;
  var d=metric?metric.delta_pct:null;
  var dt=d==null?"—":((Number(d)>0?"+":"")+Number(d).toFixed(1)+"%");
  var kind=d==null||Number(d)===0?"flat":(Number(d)>0?"pos":"neg");
  return IGAdminUI.buildKpiCard({label:label,value:fmt(v),deltaText:dt,deltaKind:kind,sparkValues:spark||[],sparkColor:"#0a00ff",sub:sub||""});
}

/* ----- Dashboard ----- */
async function loadDashboard(){
  if(!ADMIN_UNLOCKED)return;
  var kpiBox=document.getElementById("dashKpis");
  try{
    var results=await Promise.all([
      igRpc("get_kpi_deltas",{p_start:IG_RANGE_DASH.start,p_end:IG_RANGE_DASH.end}),
      igRest("GET","/v_revenue_daily?select=*&period_date=gte."+IG_RANGE_DASH.start+"&period_date=lte."+IG_RANGE_DASH.end+"&order=period_date.asc")
    ]);
    var deltas=results[0]||[],daily=results[1]||[];
    IG_DASH_DAILY=daily;
    var m={};deltas.forEach(function(r){m[r.metric]=r;});
    var byDay={};daily.forEach(function(r){byDay[r.period_date]=r;});
    if(kpiBox){
      kpiBox.innerHTML="";
      kpiBox.appendChild(igKpiCard("Revenue",m.revenue,igDailySeries(byDay,IG_RANGE_DASH.end,"revenue_pkr"),function(v){return IGAdminUI.formatPKR(v);}));
      kpiBox.appendChild(igKpiCard("Orders",m.orders,igDailySeries(byDay,IG_RANGE_DASH.end,"orders_count"),function(v){return IGAdminUI.formatFull(v);}));
      kpiBox.appendChild(igKpiCard("Orders Paid",m.orders_paid,igDailySeries(byDay,IG_RANGE_DASH.end,"paid_count"),function(v){return IGAdminUI.formatFull(v);}));
      kpiBox.appendChild(igKpiCard("Low stock items",m.low_stock_items,[],function(v){return IGAdminUI.formatFull(v);},"Published, stock 1–10"));
    }
    igDrawMarket(daily);
    igDrawDonut();
    var recent=await igRest("GET","/orders?select=*,order_items(product_name,qty)&order=created_at.desc&limit=8");
    igRenderOrdersTable(document.getElementById("recentOrdersWrap"),recent||[],{compact:true,size:8,page:1});
  }catch(e){
    if(kpiBox)kpiBox.innerHTML='<div class="ig-state"><b>Could not load dashboard</b><p>'+escHtml(e.message||"try again")+'</p></div>';
  }
}
async function igDrawMarket(daily){
  var el=document.getElementById("chMarket");if(!el||!window.Chart)return;
  var mode=IG_MARKET_SEG,rows=daily||IG_DASH_DAILY;
  if(mode==="Yearly"){
    try{
      var r365=await igRest("GET","/v_revenue_daily?select=*&period_date=gte."+igRangeDays(365).start+"&period_date=lte."+igRangeDays(365).end+"&order=period_date.asc");
      rows=r365||[];
    }catch(e){rows=[];}
  }
  var labels=[],rev=[],sale=[];
  if(mode==="Yearly"){
    var byMonth={},order=[];
    rows.forEach(function(r){var k=String(r.period_date).slice(0,7);if(!byMonth[k]){byMonth[k]={revenue_pkr:0,orders_count:0};order.push(k);}byMonth[k].revenue_pkr+=Number(r.revenue_pkr||0);byMonth[k].orders_count+=Number(r.orders_count||0);});
    order.sort();
    var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    labels=order.map(function(k){var p=k.split("-");return MON[+p[1]-1]+" "+p[0];});
    rev=order.map(function(k){return byMonth[k].revenue_pkr;});
    sale=order.map(function(k){return byMonth[k].orders_count;});
  }else{
    var days=mode==="Monthly"?30:7;
    var map={};rows.forEach(function(r){map[r.period_date]=r;});
    for(var i=days-1;i>=0;i--){
      var d=new Date(Date.now()-i*86400000);
      var key=d.toLocaleDateString("en-CA",{timeZone:"Asia/Karachi"});
      var r=map[key]||{revenue_pkr:0,orders_count:0};
      labels.push(d.toLocaleDateString("en-GB",{timeZone:"Asia/Karachi",weekday:"short"}));
      rev.push(Number(r.revenue_pkr||0));sale.push(Number(r.orders_count||0));
    }
  }
  var th=igChartTheme();
  drawChart("market","chMarket",{type:"line",data:{labels:labels,datasets:[
    {label:"Total Revenue",data:rev,borderColor:"#0a00ff",backgroundColor:"#0a00ff",tension:0.4,pointRadius:3,yAxisID:"y"},
    {label:"Total Sale",data:sale,borderColor:"#a8d98a",backgroundColor:"#a8d98a",tension:0.4,pointRadius:3,yAxisID:"y1"}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return " "+c.dataset.label+": "+(c.datasetIndex===0?IGAdminUI.formatPKR(c.parsed.y):IGAdminUI.formatFull(c.parsed.y)+" orders");}}}},scales:{y:{ticks:{callback:function(v){return "Rs "+IGAdminUI.formatNum(v);}},grid:{color:th.grid}},y1:{position:"right",ticks:{stepSize:1},grid:{drawOnChartArea:false}},x:{grid:{display:false}}}}});
  var msg=document.getElementById("marketMsg");
  if(msg){var tot=rev.reduce(function(a,b){return a+b;},0);msg.textContent=(mode==="Weekly"?"Last 7 days":mode==="Monthly"?"Last 30 days":"Last 12 months")+" — revenue "+IGAdminUI.formatPKR(tot)+".";}
}
var IG_SEG_BUILT=false;
function igInitMarketSeg(){
  if(IG_SEG_BUILT)return;var c=document.getElementById("marketSeg");if(!c)return;
  IGAdminUI.buildSegmented(c,["Weekly","Monthly","Yearly"],function(label){IG_MARKET_SEG=label;igDrawMarket(IG_DASH_DAILY);});
  IG_SEG_BUILT=true;
}
async function igDrawDonut(){
  var el=document.getElementById("chDonut");if(!el)return;
  var leg=document.getElementById("donutLegend"),emp=document.getElementById("donutEmpty");
  try{
    var rows=await igRest("GET","/v_sales_by_category?select=*&order=items_sold.desc");
    rows=rows||[];
    if(!rows.length){
      if(AN_CHARTS.donut){try{AN_CHARTS.donut.destroy();}catch(e){}delete AN_CHARTS.donut;}
      el.style.display="none";
      if(leg)leg.innerHTML="";
      if(emp)emp.innerHTML='<div class="ig-state"><b>No sales yet</b><p>Add an order to see sales by category.</p></div>';
      return;
    }
    el.style.display="";if(emp)emp.innerHTML="";
    var palette=["#0a00ff","#e8650a","#ffeb00","#c4c4c4","#22c55e","#00aeef","#7c5cff","#f59e0b","#ef4444","#14b8a6","#f97316"];
    var labels=rows.map(function(r){return r.category;}),data=rows.map(function(r){return Number(r.items_sold||0);});
    drawChart("donut","chDonut",{type:"doughnut",data:{labels:labels,datasets:[{data:data,backgroundColor:palette}]},options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return " "+c.label+": "+IGAdminUI.formatFull(c.parsed)+" items sold";}}}}}});
    if(leg)leg.innerHTML=rows.map(function(r,i){return '<span><span class="ig-dot" style="background:'+palette[i%palette.length]+'"></span>'+escHtml(r.category)+' — '+IGAdminUI.formatFull(r.items_sold)+' sold</span>';}).join("");
  }catch(e){
    if(emp)emp.innerHTML='<div class="ig-state"><b>Could not load sales</b><p>'+escHtml(e.message||"try again")+'</p></div>';
  }
}

/* ----- Orders table (shared by Dashboard recent orders + Orders page) ----- */
function igOrdersTableHTML(rows,compact){
  if(!rows.length)return "";
  return '<div class="ig-table-wrap"><table class="ig-table"><thead><tr><th>Order ID</th><th>Product</th><th class="ig-num">Amount</th><th>Date</th><th>Status</th><th>Customer</th>'+(compact?"":'<th class="ig-actions">Actions</th>')+'</tr></thead><tbody>'
  +rows.map(function(o){
    var items=o.order_items||[];
    var prod=items.length?escHtml(items[0].product_name||"—")+(items.length>1?" +"+(items.length-1)+" more":""):"—";
    var statusCell=(!compact&&igCanWrite())
      ?'<select class="ord-status ig-select" data-id="'+escHtml(o.id)+'" style="width:140px;padding:6px 8px">'+["Pending","Paid","Processing","Shipped","Delivered","Canceled","Refunded"].map(function(s){return '<option'+(o.status===s?" selected":"")+'>'+s+'</option>';}).join("")+'</select>'
      :IGAdminUI.statusPill(o.status);
    var acts="";
    if(!compact&&igCanWrite()){
      if(o.status==="Canceled"&&o.stock_deducted)acts+='<button class="ig-btn ig-btn-ghost ig-btn-sm ord-restore" type="button" data-id="'+escHtml(o.id)+'">Restore stock</button> ';
      if(igCanDelete())acts+='<button class="ig-btn ig-btn-ghost ig-btn-sm ord-del" type="button" data-id="'+escHtml(o.id)+'">Delete</button>';
    }
    return '<tr><td><b>'+escHtml(o.order_number||("#"+String(o.id).slice(0,8)))+'</b></td><td>'+prod+'</td><td class="ig-num">'+escHtml(IGAdminUI.formatPKR(o.total))+'</td><td>'+IGAdminUI.formatDateDDMMYYYY(o.created_at)+'</td><td>'+statusCell+'</td><td>'+escHtml(o.customer_name||"—")+'</td>'+(compact?"":'<td class="ig-actions">'+acts+'</td>')+'</tr>';
  }).join("")+'</tbody></table></div>';
}
function igRenderOrdersTable(container,rows,opts){
  var o=opts||{};
  if(!container)return;
  if(!rows.length){
    container.innerHTML="";
    container.appendChild(IGAdminUI.emptyState({title:"No orders yet",message:"Orders appear here once you add one — use “+ Add Order”.",actionLabel:igCanWrite()?"Add your first order":null,onAction:igCanWrite()?function(){igOpenOrderForm();}:null}));
    if(o.pagerEl)o.pagerEl.innerHTML="";
    return;
  }
  var size=o.size||10,page=o.page||1;
  var pg=IGAdminUI.paginate(rows.length,page,size);
  var slice=rows.slice((pg.page-1)*size,pg.page*size);
  container.innerHTML=igOrdersTableHTML(slice,!!o.compact);
  if(o.pagerEl){
    o.pagerEl.innerHTML="";
    if(rows.length>size)o.pagerEl.appendChild(IGAdminUI.buildPagination(rows.length,pg.page,size,function(n){if(typeof o.onPage==="function")o.onPage(n);}));
    else o.pagerEl.innerHTML='<p class="ig-muted ig-small" style="margin:10px 0 0">Showing '+pg.start+'–'+pg.end+' of '+rows.length+'</p>';
  }
}
var ORD_PAGE=1, ORD_SIZE=10, ORD_ROWS=[];
function igRenderOrdersPage(){
  igRenderOrdersTable(document.getElementById("ordersTableWrap"),ORD_ROWS,{page:ORD_PAGE,size:ORD_SIZE,pagerEl:document.getElementById("ordersPager"),onPage:function(n){ORD_PAGE=n;igRenderOrdersPage();}});
}
async function loadOrdersPage(){
  if(!ADMIN_UNLOCKED)return;
  var box=document.getElementById("ordKpis");
  try{
    var results=await Promise.all([
      igRpc("get_kpi_deltas",{p_start:IG_RANGE_ORD.start,p_end:IG_RANGE_ORD.end}),
      igRest("GET","/v_revenue_daily?select=*&period_date=gte."+IG_RANGE_ORD.start+"&period_date=lte."+IG_RANGE_ORD.end+"&order=period_date.asc")
    ]);
    var deltas=results[0]||[],daily=results[1]||[];
    var m={};deltas.forEach(function(r){m[r.metric]=r;});
    var byDay={};daily.forEach(function(r){byDay[r.period_date]=r;});
    if(box){
      box.innerHTML="";
      box.appendChild(igKpiCard("Orders",m.orders,igDailySeries(byDay,IG_RANGE_ORD.end,"orders_count"),function(v){return IGAdminUI.formatFull(v);}));
      box.appendChild(igKpiCard("Orders Paid",m.orders_paid,igDailySeries(byDay,IG_RANGE_ORD.end,"paid_count"),function(v){return IGAdminUI.formatFull(v);}));
      box.appendChild(igKpiCard("Discounts",m.discounts,igDailySeries(byDay,IG_RANGE_ORD.end,"discounts_pkr"),function(v){return IGAdminUI.formatPKR(v);}));
      box.appendChild(igKpiCard("Refunds",m.refunds,igDailySeries(byDay,IG_RANGE_ORD.end,"refunds_pkr"),function(v){return IGAdminUI.formatPKR(v);}));
    }
  }catch(e){
    if(box)box.innerHTML='<div class="ig-state"><b>Could not load order totals</b><p>'+escHtml(e.message||"try again")+'</p></div>';
  }
  try{
    var rows=await igRest("GET","/orders?select=*,order_items(product_name,qty)&order=created_at.desc&limit=200");
    ORD_ROWS=rows||[];
    igRenderOrdersPage();
  }catch(e){
    var w=document.getElementById("ordersTableWrap");
    if(w){w.innerHTML="";w.appendChild(IGAdminUI.emptyState({title:"Could not load orders",message:e.message||"try again"}));}
  }
}

/* ----- Add Order form (DATA.md §4 flow — never reserve_stock here) ----- */
var OF_ITEMS=[];
function igOpenOrderForm(){
  var c=document.getElementById("orderFormCard");if(!c)return;
  if(location.hash!=="#/orders"){location.hash="#/orders";}
  if(!PRODUCTS.length){loadProducts().then(function(){igFillOrderProducts();}).catch(function(){});}
  igFillOrderProducts();
  c.hidden=false;
  try{c.scrollIntoView({behavior:"smooth",block:"start"});}catch(e){}
  var f=document.getElementById("ofName");if(f)f.focus();
}
function igCloseOrderForm(){var c=document.getElementById("orderFormCard");if(c)c.hidden=true;}
function igFillOrderProducts(){
  var sel=document.getElementById("ofProd");if(!sel)return;
  var cur=sel.value;
  sel.innerHTML=PRODUCTS.slice().sort(function(a,b){return a.name.localeCompare(b.name);}).map(function(p){
    return '<option value="'+escHtml(p.uuid)+'">'+escHtml(p.name)+' — '+escHtml(IGAdminUI.formatPKR(p.price))+(p.stock===0?" (sold out)":"")+'</option>';
  }).join("");
  if(cur)sel.value=cur;
}
function ofRenderItems(){
  var box=document.getElementById("ofItems");if(!box)return;
  var sub=0;
  box.innerHTML=OF_ITEMS.map(function(it,i){
    sub+=it.price*it.qty;
    return '<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--table-line);font-size:13px">'
    +'<span style="flex:1">'+escHtml(it.name)+' × '+it.qty+'</span>'
    +'<b>'+escHtml(IGAdminUI.formatPKR(it.price*it.qty))+'</b>'
    +'<button class="ig-btn ig-btn-ghost ig-btn-sm" type="button" data-of-remove="'+i+'">Remove</button>'
    +'</div>';
  }).join("")||'<p class="ig-muted ig-small" style="margin:0">No items yet — pick a product above.</p>';
  var disc=parseInt((document.getElementById("ofDisc")||{}).value||"0",10)||0;
  var fee=parseInt((document.getElementById("ofFee")||{}).value||"0",10)||0;
  var tot=Math.max(sub-disc+fee,0);
  var t=document.getElementById("ofTotals");if(t)t.textContent="Subtotal "+IGAdminUI.formatPKR(sub)+" — Total "+IGAdminUI.formatPKR(tot);
}
async function igSubmitOrder(){
  var msg=document.getElementById("ofMsg");
  var name=(document.getElementById("ofName").value||"").trim();
  var phone=(document.getElementById("ofPhone").value||"").trim();
  var city=(document.getElementById("ofCity").value||"").trim()||"Peshawar";
  var address=(document.getElementById("ofAddress").value||"").trim();
  var pay=document.getElementById("ofPay").value;
  var status=document.getElementById("ofStatus").value;
  var disc=parseInt(document.getElementById("ofDisc").value||"0",10)||0;
  var code=(document.getElementById("ofCode").value||"").trim();
  var fee=parseInt(document.getElementById("ofFee").value||"0",10)||0;
  var notes=(document.getElementById("ofNotes").value||"").trim();
  var deduct=document.getElementById("ofDeduct").checked;
  if(!name||!phone||!address){msg.textContent="✖ Fill in customer name, phone and address.";return}
  if(!OF_ITEMS.length){msg.textContent="✖ Add at least one item.";return}
  if(disc<0||fee<0){msg.textContent="✖ Discount and delivery fee cannot be negative.";return}
  msg.textContent="Saving…";
  try{
    var me=null;
    try{var s=await sb.auth.getSession();me=s&&s.data&&s.data.session?s.data.session.user:null;}catch(e){}
    var created=await igRest("POST","/orders",{customer_name:name,phone:phone,city:city,address:address,payment_method:pay,status:status,discount_amount:disc,discount_code:code||null,delivery_fee:fee,notes:notes||null,deduct_stock:deduct,created_by:me?me.id:null});
    var order=created&&created[0];
    if(!order||!order.id)throw new Error("Order was not saved — try again.");
    var items=OF_ITEMS.map(function(it){return {order_id:order.id,product_id:it.product_id,product_name:it.name,price:it.price,qty:it.qty};});
    await igRest("POST","/order_items",items);
    await igRpc("recalc_order_totals",{p_order_id:order.id});
    if(deduct){
      /* Permanent decrement (not a 15-min reservation). Raises on
         insufficient stock and changes nothing — the order row stays. */
      await igRpc("deduct_stock_for_order",{p_order_id:order.id});
    }
    await logAudit("order_added","order",order.id,order.order_number||order.id,{customer:phone,total:order.total,status:status});
    OF_ITEMS=[];ofRenderItems();
    ["ofName","ofPhone","ofAddress","ofCode","ofNotes"].forEach(function(id){document.getElementById(id).value="";});
    document.getElementById("ofDisc").value="0";document.getElementById("ofFee").value="350";
    document.getElementById("ofDeduct").checked=false;
    msg.textContent="";
    igCloseOrderForm();
    showToast("Order "+(order.order_number||"")+" saved ✓");
    loadOrdersPage();loadDashboard();loadProducts();
  }catch(err){msg.textContent="✖ "+(err.message||"Could not save the order.");}
}

/* ----- Products page: tiles + list ----- */
var PROD_TILE_PAGE=1, PROD_TILE_SIZE=8, PROD_CAT_FILTER="";
function renderProductTiles(){
  var grid=document.getElementById("prodTiles");if(!grid)return;
  var needle=String(PROD_LIST_FILTER||"").toLowerCase();
  var rows=PRODUCTS.slice().sort(function(a,b){return a.id-b.id;}).filter(function(p){
    if(PROD_CAT_FILTER&&p.catLabel!==PROD_CAT_FILTER)return false;
    return !needle||((p.name||"")+" "+(p.brand||"")+" "+(p.catLabel||"")).toLowerCase().indexOf(needle)!==-1;
  });
  var pg=IGAdminUI.paginate(rows.length,PROD_TILE_PAGE,PROD_TILE_SIZE);
  PROD_TILE_PAGE=pg.page;
  var page=rows.slice((pg.page-1)*PROD_TILE_SIZE,pg.page*PROD_TILE_SIZE);
  grid.innerHTML="";
  if(!page.length){
    grid.appendChild(IGAdminUI.emptyState({title:"No products match",message:PRODUCTS.length?"Try a different search or category.":"No products yet — add one with “+ Add New Item”."}));
  }else{
    page.forEach(function(p){
      var tile=IGAdminUI.buildProductTile({name:p.name,category:p.catLabel,price:p.price,oldPrice:p.old,imageUrl:p.img,isHot:p.hot,isNew:p.isNew,soldOut:p.soldOut,rating:null,reviewCount:null});
      if(igCanWrite()||igCanDelete()){
        var act=document.createElement("div");act.className="ig-tile-actions";
        if(igCanWrite()){
          var eb=document.createElement("button");eb.type="button";eb.className="ig-btn ig-btn-primary ig-btn-sm";eb.textContent="Edit";
          eb.addEventListener("click",function(){igOpenEditProduct(p.uuid);});
          act.appendChild(eb);
        }
        if(igCanDelete()){
          var db=document.createElement("button");db.type="button";db.className="ig-btn ig-btn-ghost ig-btn-sm";db.textContent="Delete";
          db.addEventListener("click",function(){igDeleteProductTile(db,p);});
          act.appendChild(db);
        }
        tile.appendChild(act);
      }
      grid.appendChild(tile);
    });
  }
  var pager=document.getElementById("prodPager");
  if(pager){
    pager.innerHTML="";
    if(rows.length>PROD_TILE_SIZE)pager.appendChild(IGAdminUI.buildPagination(rows.length,pg.page,PROD_TILE_SIZE,function(n){PROD_TILE_PAGE=n;renderProductTiles();}));
    else if(rows.length)pager.innerHTML='<p class="ig-muted ig-small" style="margin:10px 0 0">Showing '+pg.start+'–'+pg.end+' of '+rows.length+'</p>';
  }
  var cnt=document.getElementById("prodCount");if(cnt)cnt.textContent=rows.length+" of "+PRODUCTS.length+" products";
}
async function igFillCatFilter(){
  var sel=document.getElementById("prodCatFilter");if(!sel||sel.options.length>1)return;
  var cats=[];
  try{var rows=await igRest("GET","/categories?select=name&order=sort_order.asc");cats=(rows||[]).map(function(r){return r.name;});}catch(e){cats=[];}
  if(!cats.length){var seen={};PRODUCTS.forEach(function(p){if(p.catLabel&&!seen[p.catLabel]){seen[p.catLabel]=1;cats.push(p.catLabel);}});}
  cats.forEach(function(c){var o=document.createElement("option");o.value=c;o.textContent=c;sel.appendChild(o);});
}
async function loadProductsPage(){
  if(!ADMIN_UNLOCKED)return;
  await igFillCatFilter();
  renderProductTiles();
  renderAdminList();
}
function igOpenEditProduct(uuid){
  var p=PRODUCTS.find(function(x){return x.uuid===uuid});if(!p)return;
  document.getElementById("epUuid").value=p.uuid;
  document.getElementById("epVersion").value=p.version||1;
  document.getElementById("epName").textContent=p.name;
  document.getElementById("epPrice").value=p.price;
  document.getElementById("epWas").value=p.old;
  document.getElementById("epStock").value=p.stock;
  document.getElementById("epPhotos").value=(p.rawImgs||[]).join("\n");
  document.getElementById("epMsg").textContent="";
  IGAdminUI.openModal("prodEditModal");
}
async function igSaveEditProduct(){
  var uuid=document.getElementById("epUuid").value;
  var p=PRODUCTS.find(function(x){return x.uuid===uuid});if(!p)return;
  var price=parseInt(document.getElementById("epPrice").value,10);
  var was=parseInt(document.getElementById("epWas").value,10);
  var stock=parseInt(document.getElementById("epStock").value,10);
  var msg=document.getElementById("epMsg");
  if(!(price>0)||isNaN(stock)){msg.textContent="✖ Price must be above 0 and stock a number";return}
  var photoUrls=document.getElementById("epPhotos").value.split("\n").map(function(s){return s.trim()}).filter(Boolean).slice(0,3);
  if(photoUrls.some(function(u){return !igSafeImgUrl(u)})){msg.textContent="✖ Photo URLs must be https:// links or site-relative paths";return}
  var btn=document.getElementById("epSave");btn.textContent="Saving…";
  try{
    var loadedVer=parseInt(document.getElementById("epVersion").value||"1",10);if(!(loadedVer>0))loadedVer=p.version||1;
    var patchBody={price:price,was_price:isNaN(was)?price:was,stock:stock,version:loadedVer+1};
    if(photoUrls.length)patchBody.image_urls=photoUrls;
    var upd=await sbWrite("PATCH","?id=eq."+uuid+"&version=eq."+loadedVer,patchBody);
    if(!upd||!upd.length){msg.textContent="Someone changed this product — refresh and try again";btn.textContent="Save";loadProducts();return}
    await logAudit("product_edited","product",uuid,p.name,{old_price:p.price,new_price:price,old_was_price:p.old,new_was_price:isNaN(was)?price:was,old_stock:p.stock,new_stock:stock});
    loadAuditLog();renderAnalytics();
    btn.textContent="Save";
    try{IGAdminUI.closeModal("prodEditModal");}catch(e){}
    showToast("Saved ✓ — live on the shop now");
    loadProducts();
  }catch(err){msg.textContent="✖ "+err.message;btn.textContent="Save";}
}
async function igDeleteProductTile(btn,p){
  if(btn.getAttribute("data-arm")!=="1"){
    btn.setAttribute("data-arm","1");btn.textContent="Sure? Tap again";
    setTimeout(function(){try{btn.removeAttribute("data-arm");btn.textContent="Delete";}catch(e){}},5000);
    return;
  }
  try{
    var del=await sbWrite("DELETE","?id=eq."+p.uuid);
    if(!del||!del.length)throw new Error("Delete failed — nothing was deleted. Are you still signed in?");
    await logAudit("product_deleted","product",p.uuid,p.name,{price:p.price,stock:p.stock});
    loadAuditLog();renderAnalytics();showToast("Deleted ✓");loadProducts();
  }catch(err){showToast("✖ "+err.message);}
}

/* ----- Reports / Customers / Settings ----- */
async function loadReportsPage(){
  if(!ADMIN_UNLOCKED)return;
  try{
    var daily=await igRest("GET","/v_revenue_daily?select=*&period_date=gte."+IG_RANGE_REP.start+"&period_date=lte."+IG_RANGE_REP.end+"&order=period_date.asc");
    daily=daily||[];
    var th=igChartTheme();
    drawChart("repRev","chRepRev",{type:"bar",data:{labels:daily.map(function(r){return IGAdminUI.formatDateDDMMYYYY(r.period_date);}),datasets:[{label:"Revenue",data:daily.map(function(r){return Number(r.revenue_pkr||0);}),backgroundColor:"#0a00ff"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return " Revenue: "+IGAdminUI.formatPKR(c.parsed.y);}}}},scales:{y:{ticks:{callback:function(v){return "Rs "+IGAdminUI.formatNum(v);}},grid:{color:th.grid}},x:{grid:{display:false}}}}});
    var tot=daily.reduce(function(a,r){return a+Number(r.revenue_pkr||0);},0);
    var m=document.getElementById("repMsg");if(m)m.textContent="Revenue "+IGAdminUI.formatPKR(tot)+" in the selected range.";
  }catch(e){var m2=document.getElementById("repMsg");if(m2)m2.textContent="Could not load revenue — "+(e.message||"try again");}
  try{
    var top=await igRest("GET","/v_top_products?select=*&order=revenue_pkr.desc&limit=10");
    var w=document.getElementById("repTopWrap");
    if(w){
      if(!top||!top.length){w.innerHTML="";w.appendChild(IGAdminUI.emptyState({title:"No sales yet",message:"Top products appear once orders exist."}));}
      else w.innerHTML='<div class="ig-table-wrap"><table class="ig-table"><thead><tr><th>Product</th><th class="ig-num">Qty sold</th><th class="ig-num">Revenue</th><th class="ig-num">Orders</th></tr></thead><tbody>'+top.map(function(r){return '<tr><td>'+escHtml(r.product_name||"—")+'</td><td class="ig-num">'+IGAdminUI.formatFull(r.qty_sold)+'</td><td class="ig-num">'+escHtml(IGAdminUI.formatPKR(r.revenue_pkr))+'</td><td class="ig-num">'+IGAdminUI.formatFull(r.orders_count)+'</td></tr>';}).join("")+'</tbody></table></div>';
    }
  }catch(e){}
  try{
    var st=await igRest("GET","/v_orders_by_status?select=*&order=orders_count.desc");
    var w2=document.getElementById("repStatusWrap");
    if(w2){
      if(!st||!st.length){w2.innerHTML="";w2.appendChild(IGAdminUI.emptyState({title:"No orders yet",message:"Orders by status appear once orders exist."}));}
      else w2.innerHTML='<div class="ig-table-wrap"><table class="ig-table"><thead><tr><th>Status</th><th class="ig-num">Orders</th><th class="ig-num">Total</th></tr></thead><tbody>'+st.map(function(r){return '<tr><td>'+IGAdminUI.statusPill(r.status)+'</td><td class="ig-num">'+IGAdminUI.formatFull(r.orders_count)+'</td><td class="ig-num">'+escHtml(IGAdminUI.formatPKR(r.total_pkr))+'</td></tr>';}).join("")+'</tbody></table></div>';
    }
  }catch(e){}
}
async function loadCustomersPage(){
  if(!ADMIN_UNLOCKED)return;
  var w=document.getElementById("custTableWrap");if(!w)return;
  try{
    var rows=await igRest("GET","/customers?select=*&order=total_spent_pkr.desc&limit=100");
    rows=rows||[];
    if(!rows.length){w.innerHTML="";w.appendChild(IGAdminUI.emptyState({title:"No customers yet",message:"Customers appear here once you add an order."}));return;}
    w.innerHTML='<div class="ig-table-wrap"><table class="ig-table"><thead><tr><th>Name</th><th>Phone</th><th>City</th><th class="ig-num">Orders</th><th class="ig-num">Total spent</th><th>Last order</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+escHtml(r.name||"—")+'</td><td>'+escHtml(r.phone||"—")+'</td><td>'+escHtml(r.city||"—")+'</td><td class="ig-num">'+IGAdminUI.formatFull(r.orders_count)+'</td><td class="ig-num">'+escHtml(IGAdminUI.formatPKR(r.total_spent_pkr))+'</td><td>'+(r.last_order_at?IGAdminUI.formatDateDDMMYYYY(r.last_order_at):"—")+'</td></tr>';}).join("")+'</tbody></table></div>';
  }catch(e){w.innerHTML="";w.appendChild(IGAdminUI.emptyState({title:"Could not load customers",message:e.message||"try again"}));}
}
var SET_AUDIT_ROWS=[];
async function loadSettingsPage(){
  if(!ADMIN_UNLOCKED)return;
  try{var em=await currentActorEmail();var e1=document.getElementById("setEmail");if(e1)e1.textContent=em||"—";}catch(e){}
  try{await loadMyRole();}catch(e){}
  igRenderSettingsAudit();
}
async function igRenderSettingsAudit(){
  var box=document.getElementById("setAuditList");if(!box)return;
  try{
    if(!SET_AUDIT_ROWS.length){
      var rows=await igRest("GET","/audit_log?select=*&order=created_at.desc&limit=100");
      SET_AUDIT_ROWS=rows||[];
    }
    var f=(document.getElementById("auditFilter")||{}).value||"";
    var q=String((document.getElementById("auditSearch")||{}).value||"").toLowerCase();
    var list=SET_AUDIT_ROWS.filter(function(r){
      if(f&&r.action!==f)return false;
      if(q&&((r.actor_email||"")+" "+(r.record_name||"")+" "+(r.action||"")).toLowerCase().indexOf(q)===-1)return false;
      return true;
    });
    var c=document.getElementById("setAuditCount");if(c)c.textContent=list.length;
    if(!list.length){box.innerHTML='<div class="ig-state"><b>No matching activity</b><p>Try a different filter or search.</p></div>';return;}
    box.innerHTML=list.slice(0,50).map(function(r){
      return '<div style="display:flex;gap:10px;align-items:baseline;padding:9px 0;border-top:1px solid var(--table-line);flex-wrap:wrap;font-size:13px">'
      +'<span class="ig-muted" style="min-width:180px">'+fmtPKT(r.created_at)+'</span>'
      +'<b style="min-width:130px">'+escHtml(r.action)+'</b>'
      +'<span style="flex:1;min-width:140px">'+(r.record_name?escHtml(r.record_name):"—")+'</span>'
      +'<span class="ig-muted">'+escHtml(r.actor_email)+'</span>'
      +'<span class="ig-muted ig-small">'+escHtml(r.ip_address||"unknown")+'</span>'
      +'</div>';
    }).join("");
  }catch(e){box.innerHTML='<p style="color:var(--danger);font-size:13px;margin:0">Could not load history — '+escHtml(e.message||"try again")+'</p>';}
}

/* ----- Roles ----- */
var IG_ROLE=null;
async function loadMyRole(){
  try{
    var r=await igRpc("admin_role",{});
    IG_ROLE=(typeof r==="string"&&r)?r:null;
  }catch(e){IG_ROLE=null;}
  var roleLabel=IG_ROLE?IG_ROLE.charAt(0).toUpperCase()+IG_ROLE.slice(1):"Admin";
  var avR=document.getElementById("avatarRole");if(avR)avR.textContent=roleLabel;
  var sR=document.getElementById("setRole");if(sR)sR.textContent=roleLabel;
  /* Viewers never see write buttons; Managers never see delete buttons. */
  var dis=!igCanWrite();
  ["prodAddBtn","ordAddBtn","dashAddOrder"].forEach(function(id){var b=document.getElementById(id);if(b)b.style.display=dis?"none":"";});
  try{renderAdminList();}catch(e){}
  try{renderProductTiles();}catch(e){}
  try{igRenderOrdersPage();}catch(e){}
  return IG_ROLE;
}
function igCanWrite(){return IG_ROLE!=="viewer";}
function igCanDelete(){return IG_ROLE!=="manager"&&IG_ROLE!=="viewer";}

/* ----- Global search: filter the visible table rows (DOM-level only) ----- */
function filterVisibleTables(q){
  var needle=String(q||"").toLowerCase();
  ["ordersTableWrap","custTableWrap","repTopWrap","repStatusWrap","recentOrdersWrap"].forEach(function(id){
    var w=document.getElementById(id);if(!w)return;
    w.querySelectorAll("tbody tr").forEach(function(tr){tr.style.display=(!needle||tr.textContent.toLowerCase().indexOf(needle)!==-1)?"":"none";});
  });
}

/* ----- Wave 4 wiring (runs once at script load; all elements exist) ----- */
try{IGAdminUI.buildDateRangePicker(document.getElementById("dashRange"),{defaultPreset:"30 days",onChange:function(r){if(r.start&&r.end){IG_RANGE_DASH={start:r.start,end:r.end};if(ADMIN_UNLOCKED)loadDashboard();}}});}catch(e){}
try{IGAdminUI.buildDateRangePicker(document.getElementById("ordRange"),{defaultPreset:"30 days",onChange:function(r){if(r.start&&r.end){IG_RANGE_ORD={start:r.start,end:r.end};if(ADMIN_UNLOCKED)loadOrdersPage();}}});}catch(e){}
try{IGAdminUI.buildDateRangePicker(document.getElementById("repRange"),{defaultPreset:"30 days",onChange:function(r){if(r.start&&r.end){IG_RANGE_REP={start:r.start,end:r.end};if(ADMIN_UNLOCKED)loadReportsPage();}}});}catch(e){}
igInitMarketSeg();
document.getElementById("ordAddBtn").addEventListener("click",function(){igOpenOrderForm();});
document.getElementById("dashAddOrder").addEventListener("click",function(){igOpenOrderForm();});
document.getElementById("orderFormClose").addEventListener("click",function(){igCloseOrderForm();});
document.getElementById("ofSubmit").addEventListener("click",function(){igSubmitOrder();});
document.getElementById("ofAddItem").addEventListener("click",function(){
  var sel=document.getElementById("ofProd");
  var uuid=sel?sel.value:"";
  var p=PRODUCTS.find(function(x){return x.uuid===uuid;});
  var qty=parseInt((document.getElementById("ofQty")||{}).value||"1",10)||1;
  var msg=document.getElementById("ofMsg");
  if(!p){msg.textContent="✖ Pick a product first.";return}
  if(qty<1){msg.textContent="✖ Quantity must be at least 1.";return}
  var ex=OF_ITEMS.find(function(it){return it.product_id===p.uuid;});
  if(ex)ex.qty+=qty;else OF_ITEMS.push({product_id:p.uuid,name:p.name,price:p.price,qty:qty});
  msg.textContent="";
  ofRenderItems();
});
document.getElementById("ofItems").addEventListener("click",function(e){
  var b=e.target.closest("[data-of-remove]");if(!b)return;
  OF_ITEMS.splice(parseInt(b.getAttribute("data-of-remove"),10),1);
  ofRenderItems();
});
["ofDisc","ofFee"].forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener("input",function(){ofRenderItems();});});
document.getElementById("prodAddBtn").addEventListener("click",function(){
  if(!igCanWrite()){showToast("Your role is read-only.");return}
  IGAdminUI.openModal("prodModal");
});
document.getElementById("prodCatFilter").addEventListener("change",function(){PROD_CAT_FILTER=this.value;PROD_TILE_PAGE=1;renderProductTiles();});
document.getElementById("epSave").addEventListener("click",function(){igSaveEditProduct();});
document.getElementById("ordersTableWrap").addEventListener("change",async function(e){
  var sel=e.target.closest(".ord-status");if(!sel)return;
  var id=sel.getAttribute("data-id"),st=sel.value;
  sel.disabled=true;
  try{
    await igRest("PATCH","/orders?id=eq."+id,{status:st});
    await logAudit("order_edited","order",id,null,{status:st});
    var row=ORD_ROWS.find(function(o){return o.id===id;});if(row)row.status=st;
    showToast("Order updated ✓");
    loadOrdersPage();loadDashboard();
  }catch(err){showToast("✖ "+(err.message||"Could not update status"));sel.disabled=false;loadOrdersPage();}
});
document.getElementById("ordersTableWrap").addEventListener("click",async function(e){
  var del=e.target.closest(".ord-del");
  if(del){
    var id=del.getAttribute("data-id");
    if(del.getAttribute("data-arm")!=="1"){
      del.setAttribute("data-arm","1");del.textContent="Sure? Tap again";
      setTimeout(function(){try{del.removeAttribute("data-arm");del.textContent="Delete";}catch(err){}},5000);
      return;
    }
    try{
      await igRest("DELETE","/orders?id=eq."+id);
      await logAudit("order_deleted","order",id,null,{});
      showToast("Order deleted ✓");
      loadOrdersPage();loadDashboard();
    }catch(err){showToast("✖ "+(err.message||"Could not delete order"));}
    return;
  }
  var res=e.target.closest(".ord-restore");
  if(res){
    var rid=res.getAttribute("data-id");
    res.disabled=true;
    try{
      var ok=await igRpc("restore_stock_for_order",{p_order_id:rid});
      await logAudit("order_edited","order",rid,null,{stock_restored:!!ok});
      showToast(ok?"Stock restored ✓":"Nothing to restore");
      loadOrdersPage();loadProducts();
    }catch(err){showToast("✖ "+(err.message||"Could not restore stock"));}
    res.disabled=false;
  }
});
document.getElementById("setThemeLight").addEventListener("click",function(){IGAdminUI.setTheme("light");});
document.getElementById("setThemeDark").addEventListener("click",function(){IGAdminUI.setTheme("dark");});
document.getElementById("setThemeSystem").addEventListener("click",function(){
  var t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  try{document.documentElement.setAttribute("data-theme",t);localStorage.removeItem("ig-admin-theme");}catch(e){}
});
document.getElementById("auditFilter").addEventListener("change",function(){igRenderSettingsAudit();});
document.getElementById("auditSearch").addEventListener("input",function(){igRenderSettingsAudit();});

/* ===== BOOT — session guard (Wave 3, new) =====
   No session (or Supabase lib unloadable) → login.html. A stale session
   (last activity > 30 min) is refused the same way the login page refuses
   it. Only after the guard passes do products / realtime load. */
(async function igBoot(){
  var client=null;
  try{client=await ensureSb();}catch(e){client=null;}
  if(!client){location.replace("/adminaccess/login.html");return;}
  var sess=null;
  try{var r=await client.auth.getSession();sess=r&&r.data?r.data.session:null;}catch(e){sess=null;}
  if(!sess){location.replace("/adminaccess/login.html");return;}
  var _last=igStoredLastActivity();
  if(_last&&Date.now()-_last>IG_IDLE_MS){
    try{await client.auth.signOut();}catch(e){}
    igClearAuthStorage();
    location.replace("/adminaccess/login.html?signed-out=idle");
    return;
  }
  igBumpActivity();
  try{await igShowAdminIfAllowed(sess.user?sess.user.email:"",client);}catch(e){}
  if(ADMIN_UNLOCKED){
    try{loadProducts();}catch(e){}
    try{subscribeRealtime();}catch(e){}
  }
})();
