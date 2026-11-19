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
  /* Wave 5: no padding — a product has 1–4 real photos, never duplicates.
     deal is the optional special price (NULL = no deal). */
  var deal=(r.deal_price!=null&&Number(r.deal_price)>0)?Number(r.deal_price):null;
  return {id:id,uuid:r.id,slug:slug,name:r.name,brand:r.brand||"",cat:cm[0],catLabel:cm[1],price:r.price,old:(r.was_price||r.price),deal:deal,stock:r.stock,soldOut:r.stock===0,hot:!!r.is_hot,isNew:!!r.is_new,imgs:imgs,img:imgs[0],rawImgs:rawImgs,version:(r.version||1)};
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
  sb.channel("ig-admin-products").on("postgres_changes",{event:"*",schema:"public",table:"products"},function(){
    loadProducts();
    /* Wave 5: the dashboard KPIs (incl. Low stock) refresh live too. */
    try{if(igCurrentRoute()==="dashboard")loadDashboard();}catch(e){}
  }).subscribe();
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
    box.innerHTML='<tr><td colspan="8"><div class="ig-state"><b>No products match</b><p>'+(PRODUCTS.length?"Try a different search or category.":"No products yet — add one with “+ Add New Item”.")+'</p></div></td></tr>';
  }else{
    box.innerHTML=page.map(function(p){
      /* H-04: every interpolated value is escaped; the image URL is validated and
         falls back to the local logo when unsafe. Numbers are coerced to numbers. */
      return '<tr class="arow" data-uuid="'+escHtml(p.uuid)+'" data-version="'+(Number(p.version)||1)+'">'
      +'<td><img src="'+escHtml(igSafeImgUrl(p.img)||"/logo.png")+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:10px"/></td>'
      +'<td><b style="font-size:13px">'+escHtml(p.name)+'</b><br/><span class="ig-muted ig-small">'+escHtml(p.catLabel)+' • '+escHtml(p.brand)+(p.soldOut?' • <span style="color:var(--danger-text)">SOLD OUT</span>':'')+(p.deal?' • <span style="color:var(--success)">DEAL '+escHtml(IGAdminUI.formatPKR(p.deal))+'</span>':'')+'</span></td>'
      +'<td><input class="aprice ig-input" type="number" value="'+(Number(p.price)||0)+'" style="width:96px"/></td>'
      +'<td><input class="awas ig-input" type="number" value="'+(Number(p.old)||0)+'" style="width:96px"/></td>'
      +'<td><input class="adeal ig-input" type="number" value="'+(p.deal!=null?p.deal:"")+'" placeholder="—" style="width:96px"/></td>'
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
/* ===== WAVE 5 — product modal: one modal for Add AND Edit ================
   Images 1–4: drag & drop / Choose from device (compressed to WebP ≤1600px,
   XHR upload with a real progress bar) or ONE Image URL field (Google
   Drive share links, Facebook image links, any direct link) — the URL is
   sent to the import-image Edge Function, which COPIES it into the
   product-images bucket; the original link is never stored or hotlinked.
   Save writes the row immediately (optimistic locking via version).
   Delete removes the row AND its Storage files. Every add/edit/delete
   writes an audit_log entry. See docs/admin/PRODUCT_IMAGES.md.
   ========================================================================== */
var PM={mode:"add",uuid:null,version:1,images:[],draftKey:null,sessionPaths:[],saved:false,open:false};
var PM_CATS=[];
var PM_FALLBACK_CATS=["Consoles","Premium Tech","Controllers","Headsets","Racing Wheels","PS4 Games","PS5 Games","Gift Cards","Gaming Chairs","Gaming Setups","Room Lighting"];
var PM_MAX_IMAGES=4, PM_MAX_BYTES=8*1024*1024;
var PM_ALLOWED_TYPES={"image/jpeg":1,"image/png":1,"image/webp":1};
function igPmEl(id){return document.getElementById(id);}
function igPmUUID(){try{if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();}catch(e){}return "d"+Date.now().toString(36)+Math.random().toString(36).slice(2,10);}
function igStoragePathFromUrl(url){
  var s=String(url||"");
  var prefix=SB_URL+"/storage/v1/object/public/product-images/";
  if(s.indexOf(prefix)===0)return s.slice(prefix.length);
  return "";
}
async function igStorageRemove(paths){
  paths=(paths||[]).filter(Boolean);
  if(!paths.length)return true;
  try{
    var h=await sbHeaders();
    var res=await fetch(SB_URL+"/storage/v1/object/product-images",{method:"DELETE",headers:h,body:JSON.stringify({prefixes:paths})});
    return res.ok;
  }catch(e){return false;}
}
/* Delete every Storage file that belongs to a product: the exact paths
   stored in image_urls, plus anything listed under the product-uuid
   prefix (files uploaded while editing). Returns true when nothing is
   left behind (or there was nothing to delete). */
async function igDeleteProductFiles(p){
  if(!p)return true;
  var paths=[];
  (p.rawImgs||[]).forEach(function(u){var pt=igStoragePathFromUrl(u);if(pt&&paths.indexOf(pt)===-1)paths.push(pt);});
  try{
    var h=await sbHeaders();
    var res=await fetch(SB_URL+"/storage/v1/object/list/product-images",{method:"POST",headers:h,body:JSON.stringify({prefix:p.uuid+"/",limit:100})});
    if(res.ok){var listed=await res.json();(listed||[]).forEach(function(o){if(o&&o.name){var pt=p.uuid+"/"+o.name;if(paths.indexOf(pt)===-1)paths.push(pt);}});}
  }catch(e){/* listing is best-effort — the exact paths above are the main set */}
  if(!paths.length)return true;
  return await igStorageRemove(paths);
}
async function igFillPmCats(selected){
  var sel=igPmEl("pmCat");if(!sel)return;
  if(!PM_CATS.length){
    try{var rows=await igRest("GET","/categories?select=name&order=sort_order.asc");PM_CATS=(rows||[]).map(function(r){return r.name;});}catch(e){PM_CATS=[];}
    if(!PM_CATS.length)PM_CATS=PM_FALLBACK_CATS.slice();
  }
  sel.innerHTML=PM_CATS.map(function(c){return '<option value="'+escHtml(c)+'">'+escHtml(c)+'</option>';}).join("");
  if(selected&&PM_CATS.indexOf(selected)!==-1)sel.value=selected;
}
function igOpenProductModal(mode,uuid){
  if(!igCanWrite()){showToast("Your role is read-only.");return}
  var p=null;
  if(mode==="edit"){
    p=PRODUCTS.find(function(x){return x.uuid===uuid});
    if(!p)return;
  }
  PM.mode=mode;PM.uuid=p?p.uuid:null;PM.version=p?(p.version||1):1;
  PM.images=[];PM.sessionPaths=[];PM.saved=false;PM.open=true;
  PM.draftKey=igPmUUID();
  igPmEl("pmTitle").textContent=mode==="edit"?"Edit product":"Add a new product";
  igPmEl("pmUuid").value=PM.uuid||"";
  igPmEl("pmVersion").value=PM.version;
  igPmEl("pmName").value=p?p.name:"";
  igPmEl("pmBrand").value=p?p.brand:"";
  igPmEl("pmPrice").value=p?p.price:"";
  igPmEl("pmOld").value=p?(p.old!==p.price?p.old:""):"";
  igPmEl("pmDeal").value=p?(p.deal!=null?p.deal:""):"";
  igPmEl("pmStock").value=p?p.stock:"";
  igPmEl("pmHot").checked=p?!!p.hot:false;
  igPmEl("pmNew").checked=p?!!p.isNew:false;
  igPmEl("pmImgUrl").value="";
  igPmEl("pmMsg").textContent="";
  ["pmNameErr","pmBrandErr","pmCatErr","pmPriceErr","pmOldErr","pmDealErr","pmStockErr","pmImgErr"].forEach(function(id){var e=igPmEl(id);if(e){e.hidden=true;e.textContent="";}});
  ["pmName","pmBrand","pmCat","pmPrice","pmOld","pmDeal","pmStock"].forEach(function(id){var e=igPmEl(id);if(e)e.removeAttribute("aria-invalid");});
  if(p){
    PM.images=(p.rawImgs||[]).slice(0,PM_MAX_IMAGES).map(function(u){
      return {url:u,path:igStoragePathFromUrl(u),state:"ready",progress:100,name:u.split("/").pop()||"photo"};
    });
  }
  igFillPmCats(p?p.catLabel:null);
  igRenderPmThumbs();
  var saveBtn=igPmEl("pmSave");saveBtn.textContent="Save product";saveBtn.disabled=false;
  IGAdminUI.openModal("prodModal");
}
function igRenderPmThumbs(){
  var box=igPmEl("pmThumbs");if(!box)return;
  box.innerHTML="";
  PM.images.forEach(function(im,i){
    var d=document.createElement("div");
    d.className="ig-pm-thumb"+(i===0?" first":"");
    d.draggable=(im.state==="ready");
    var img=document.createElement("img");
    img.alt="Photo "+(i+1);
    img.src=im.url?(igSafeImgUrl(im.url)||"/logo.png"):(im.preview||"/logo.png");
    d.appendChild(img);
    if(i===0){var cb=document.createElement("span");cb.className="ig-pm-cover";cb.textContent="Cover";d.appendChild(cb);}
    var rm=document.createElement("button");
    rm.type="button";rm.className="ig-pm-remove";rm.textContent="✕";rm.setAttribute("aria-label","Remove photo "+(i+1));
    rm.addEventListener("click",function(ev){ev.stopPropagation();igPmRemoveImage(i);});
    d.appendChild(rm);
    if(im.state==="uploading"){
      var pr=document.createElement("div");
      pr.className="ig-pm-prog"+(im.progress==null?" indet":"");
      var sp=document.createElement("span");
      if(im.progress!=null)sp.style.width=Math.round(im.progress)+"%";
      pr.appendChild(sp);d.appendChild(pr);
      var nm=document.createElement("div");nm.className="ig-pm-name";
      nm.textContent=im.progress==null?"Importing…":"Uploading… "+Math.round(im.progress)+"%";
      d.appendChild(nm);
    }else if(im.name){
      var nm2=document.createElement("div");nm2.className="ig-pm-name";nm2.textContent=im.name;d.appendChild(nm2);
    }
    d.addEventListener("dragstart",function(ev){ev.dataTransfer.setData("text/plain",String(i));d.classList.add("dragging");});
    d.addEventListener("dragend",function(){d.classList.remove("dragging");});
    d.addEventListener("dragover",function(ev){ev.preventDefault();d.classList.add("dragover");});
    d.addEventListener("dragleave",function(){d.classList.remove("dragover");});
    d.addEventListener("drop",function(ev){
      ev.preventDefault();d.classList.remove("dragover");
      var from=parseInt(ev.dataTransfer.getData("text/plain"),10);
      if(isNaN(from)||from===i)return;
      var it=PM.images.splice(from,1)[0];
      PM.images.splice(i,0,it);
      igRenderPmThumbs();
    });
    box.appendChild(d);
  });
  var c=igPmEl("pmCount");
  if(c)c.textContent=PM.images.length+" of "+PM_MAX_IMAGES+" photos — first photo is the card photo";
  var addBtn=igPmEl("pmImgUrlAdd");
  if(addBtn)addBtn.disabled=PM.images.length>=PM_MAX_IMAGES;
  var ch=igPmEl("pmChoose");
  if(ch)ch.disabled=PM.images.length>=PM_MAX_IMAGES;
}
function igPmRemoveImage(i){
  var im=PM.images[i];if(!im)return;
  PM.images.splice(i,1);
  /* A file uploaded in this modal session that is removed before saving
     is deleted straight away so it never becomes an orphan. Files that
     belong to the saved product are deleted on Save instead (so Cancel
     keeps the product's photos). */
  if(im.path&&PM.sessionPaths.indexOf(im.path)!==-1){
    PM.sessionPaths.splice(PM.sessionPaths.indexOf(im.path),1);
    igStorageRemove([im.path]);
  }
  igRenderPmThumbs();
}
function igPmSetImgError(msg){
  var e=igPmEl("pmImgErr");
  if(!e)return;
  if(msg){e.textContent=msg;e.hidden=false;}else{e.textContent="";e.hidden=true;}
}
function igPmHandleFiles(list){
  var files=Array.prototype.slice.call(list||[]);
  for(var k=0;k<files.length;k++){
    if(PM.images.length>=PM_MAX_IMAGES){igPmSetImgError("Only 4 photos per product — remove one first.");break;}
    var f=files[k];
    if(!f.size){igPmSetImgError("“"+f.name+"” is empty (0 bytes) — pick a different photo or use the Image URL field.");continue;}
    if(!PM_ALLOWED_TYPES[f.type]){igPmSetImgError("“"+f.name+"” is not a JPG, PNG or WebP photo.");continue;}
    if(f.size>PM_MAX_BYTES){igPmSetImgError("“"+f.name+"” is over 8 MB.");continue;}
    igPmSetImgError("");
    var entry={url:null,path:null,state:"uploading",progress:0,name:f.name,preview:""};
    try{entry.preview=URL.createObjectURL(f);}catch(e){}
    PM.images.push(entry);
    igRenderPmThumbs();
    igPmUploadFile(entry,f);
  }
}
function igPmFmtSize(n){
  if(!n)return "0 bytes";
  if(n<1024)return n+" bytes";
  if(n<1024*1024)return (n/1024).toFixed(n<10240?1:0)+" KB";
  return (n/1048576).toFixed(1)+" MB";
}
/* Draw any decoded image source (Image, ImageBitmap) to canvas and
   compress to WebP, max 1600px on the long side, quality 0.85. */
function igPmCanvasBlob(src,w,h){
  return new Promise(function(resolve,reject){
    try{
      var scale=Math.min(1,1600/Math.max(w,h));
      var cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
      var cv=document.createElement("canvas");cv.width=cw;cv.height=ch;
      var ctx=cv.getContext("2d");
      if(!ctx){reject(new Error("Canvas is unavailable in this browser"));return;}
      ctx.drawImage(src,0,0,cw,ch);
      cv.toBlob(function(blob){
        if(!blob)reject(new Error("Could not compress that photo."));
        else resolve(blob);
      },"image/webp",0.85);
    }catch(e){reject(e);}
  });
}
function igPmLoadImageFromUrl(url){
  return new Promise(function(resolve,reject){
    var img=new Image();
    img.onload=function(){resolve(img);};
    img.onerror=function(){reject(new Error("decode"));};
    img.src=url;
  });
}
/* Wave 5 fix: robust decode — the cloud-browser test failed with
   "That file could not be read as a photo" on valid PNGs, so try three
   decodes in order: (a) createImageBitmap, (b) <img> + object URL,
   (c) FileReader data URL + <img>. A failure names the file and its
   size, and points at the Image URL field instead. */
async function igPmCompress(file){
  var label="“"+(file&&file.name?file.name:"photo")+"” ("+igPmFmtSize(file?file.size:0)+")";
  if(!file||file.size===0){
    throw new Error(label+" is empty (0 bytes) — pick a different photo or use the Image URL field.");
  }
  /* (a) createImageBitmap — the most reliable decode in modern browsers. */
  if(window.createImageBitmap){
    try{
      var bmp=await createImageBitmap(file);
      try{return await igPmCanvasBlob(bmp,bmp.width,bmp.height);}
      finally{try{bmp.close();}catch(e){}}
    }catch(e){/* fall through to the next decode */}
  }
  /* (b) <img> + object URL (the previous path). */
  var url=null;
  try{url=URL.createObjectURL(file);}catch(e){url=null;}
  if(url){
    try{
      var img=await igPmLoadImageFromUrl(url);
      return await igPmCanvasBlob(img,img.naturalWidth||img.width,img.naturalHeight||img.height);
    }catch(e){/* fall through to the last decode */}
    finally{try{URL.revokeObjectURL(url);}catch(e){}}
  }
  /* (c) FileReader data URL + <img> — last resort for browsers where
     object URLs cannot be decoded (some cloud/remote browsers). */
  try{
    var dataUrl=await new Promise(function(resolve,reject){
      var fr=new FileReader();
      fr.onload=function(){resolve(fr.result);};
      fr.onerror=function(){reject(new Error("decode"));};
      fr.readAsDataURL(file);
    });
    var img2=await igPmLoadImageFromUrl(dataUrl);
    return await igPmCanvasBlob(img2,img2.naturalWidth||img2.width,img2.naturalHeight||img2.height);
  }catch(e){/* all three decodes failed */}
  throw new Error(label+" could not be read as a photo in this browser — try the Image URL field instead.");
}
function igPmXhrUpload(path,blob,token,onProgress){
  return new Promise(function(resolve){
    var xhr=new XMLHttpRequest();
    xhr.open("POST",SB_URL+"/storage/v1/object/product-images/"+path,true);
    xhr.setRequestHeader("apikey",SB_ANON);
    xhr.setRequestHeader("Authorization","Bearer "+token);
    xhr.setRequestHeader("Content-Type","image/webp");
    xhr.setRequestHeader("x-upsert","false");
    xhr.upload.onprogress=function(ev){if(ev.lengthComputable&&onProgress)onProgress(ev.loaded/ev.total*100);};
    xhr.onload=function(){resolve(xhr.status>=200&&xhr.status<300);};
    xhr.onerror=function(){resolve(false);};
    xhr.send(blob);
  });
}
async function igPmUploadFile(entry,file){
  var prefix=(PM.mode==="edit"&&PM.uuid)?PM.uuid:("draft-"+PM.draftKey);
  var path=prefix+"/"+igPmUUID()+".webp";
  try{
    var blob=await igPmCompress(file);
    var sess=null;
    try{var s=await sb.auth.getSession();sess=s&&s.data?s.data.session:null;}catch(e){}
    if(!sess)throw new Error("Not signed in — log in again and retry.");
    var ok=await igPmXhrUpload(path,blob,sess.access_token,function(pct){entry.progress=pct;igRenderPmThumbs();});
    if(!ok)throw new Error("Upload failed — try again.");
    entry.url=SB_URL+"/storage/v1/object/public/product-images/"+path;
    entry.path=path;
    entry.state="ready";entry.progress=100;
    PM.sessionPaths.push(path);
    if(entry.preview){try{URL.revokeObjectURL(entry.preview);}catch(e){}entry.preview="";}
  }catch(err){
    var ix=PM.images.indexOf(entry);
    if(ix!==-1)PM.images.splice(ix,1);
    igPmSetImgError(err&&err.message?err.message:"Upload failed — try again.");
  }
  igRenderPmThumbs();
}
async function igPmImportUrl(){
  var input=igPmEl("pmImgUrl");
  var raw=(input.value||"").trim();
  if(!raw){igPmSetImgError("Paste an image link first.");return;}
  if(PM.images.length>=PM_MAX_IMAGES){igPmSetImgError("Only 4 photos per product — remove one first.");return;}
  if(!igSafeImgUrl(raw)){igPmSetImgError("That link is not a secure (https) image link.");return;}
  var btn=igPmEl("pmImgUrlAdd");if(btn)btn.disabled=true;
  var entry={url:null,path:null,state:"uploading",progress:null,name:"Importing…",preview:""};
  PM.images.push(entry);
  igRenderPmThumbs();
  try{
    var sess=null;
    try{var s=await sb.auth.getSession();sess=s&&s.data?s.data.session:null;}catch(e){}
    if(!sess)throw new Error("Not signed in — log in again and retry.");
    var res=await fetch(SB_URL+"/functions/v1/import-image",{method:"POST",headers:{"apikey":SB_ANON,"Authorization":"Bearer "+sess.access_token,"Content-Type":"application/json"},body:JSON.stringify({url:raw,prefix:(PM.mode==="edit"&&PM.uuid)?PM.uuid:("draft-"+PM.draftKey)})});
    var data=null;try{data=await res.json();}catch(e){}
    if(!res.ok)throw new Error((data&&data.error)||("Import failed (HTTP "+res.status+")"));
    if(!data||!data.url)throw new Error("Import failed — no image came back.");
    entry.url=data.url;entry.path=data.path||igStoragePathFromUrl(data.url);
    entry.state="ready";entry.progress=100;entry.name=(data.path||"").split("/").pop()||"imported image";
    if(entry.path)PM.sessionPaths.push(entry.path);
    input.value="";
    igPmSetImgError("");
  }catch(err){
    var ix=PM.images.indexOf(entry);
    if(ix!==-1)PM.images.splice(ix,1);
    igPmSetImgError(err&&err.message?err.message:"That image could not be imported.");
  }
  if(btn)btn.disabled=false;
  igRenderPmThumbs();
}
function igPmSetErr(id,msg){
  var e=igPmEl(id);
  if(e){if(msg){e.textContent=msg;e.hidden=false;}else{e.textContent="";e.hidden=true;}}
}
function igPmValidate(){
  var errs=[];
  var name=igPmEl("pmName").value.trim();
  var brand=igPmEl("pmBrand").value.trim();
  var cat=igPmEl("pmCat").value;
  var price=parseInt(igPmEl("pmPrice").value,10);
  var oldRaw=igPmEl("pmOld").value;var old=(oldRaw==null||String(oldRaw).trim()==="")?null:parseInt(oldRaw,10);
  var dealRaw=igPmEl("pmDeal").value;var deal=(dealRaw==null||String(dealRaw).trim()==="")?null:parseInt(dealRaw,10);
  var stockRaw=igPmEl("pmStock").value;var stock=parseInt(stockRaw,10);
  var bad=function(inputId,errId,msg){var el=igPmEl(inputId);if(el)el.setAttribute("aria-invalid","true");igPmSetErr(errId,msg);errs.push(msg);};
  var ok=function(inputId,errId){var el=igPmEl(inputId);if(el)el.removeAttribute("aria-invalid");igPmSetErr(errId,"");};
  if(!name)bad("pmName","pmNameErr","Product name is required.");
  else if(name.length>120)bad("pmName","pmNameErr","Product name must be 120 characters or less.");
  else ok("pmName","pmNameErr");
  if(!brand)bad("pmBrand","pmBrandErr","Brand is required.");else ok("pmBrand","pmBrandErr");
  if(!cat)bad("pmCat","pmCatErr","Pick a category.");else ok("pmCat","pmCatErr");
  if(isNaN(price)||price<=0)bad("pmPrice","pmPriceErr","New price must be above 0.");else ok("pmPrice","pmPriceErr");
  if(old!=null&&(isNaN(old)||old<0))bad("pmOld","pmOldErr","Old price cannot be negative.");
  else if(old!=null&&!isNaN(price)&&price>old)bad("pmOld","pmOldErr","New price must be at or below the old price.");
  else ok("pmOld","pmOldErr");
  if(deal!=null&&(isNaN(deal)||deal<=0))bad("pmDeal","pmDealErr","Deal price must be above 0.");
  else if(deal!=null&&!isNaN(price)&&deal>=price)bad("pmDeal","pmDealErr","Deal price must be below the new price.");
  else ok("pmDeal","pmDealErr");
  if(isNaN(stock)||stock<0||String(stockRaw).indexOf(".")!==-1)bad("pmStock","pmStockErr","Stock must be a whole number, 0 or more.");
  else ok("pmStock","pmStockErr");
  var ready=PM.images.filter(function(im){return im.state==="ready"&&im.url;});
  if(PM.images.some(function(im){return im.state==="uploading";}))igPmSetImgError("Wait for the uploads to finish first.");
  else if(ready.length<1)igPmSetImgError("Add at least 1 photo.");
  else if(ready.length>PM_MAX_IMAGES)igPmSetImgError("Only 4 photos per product.");
  else igPmSetImgError("");
  if(PM.images.some(function(im){return im.state==="uploading";})||ready.length<1)errs.push("photos");
  return errs.length?null:{name:name,brand:brand,category:cat,price:price,was_price:old==null?price:old,deal_price:deal,stock:stock,is_hot:igPmEl("pmHot").checked,is_new:igPmEl("pmNew").checked,image_urls:ready.slice(0,PM_MAX_IMAGES).map(function(im){return im.url;})};
}
async function igSaveProductModal(){
  var v=igPmValidate();
  var msg=igPmEl("pmMsg");
  if(!v){msg.textContent="✖ Fix the highlighted fields first.";return;}
  var btn=igPmEl("pmSave");btn.disabled=true;btn.textContent="Saving…";
  msg.textContent="Saving…";
  try{
    if(PM.mode==="add"){
      var slug=nextNumId+"-"+slugify(v.name);
      var added=await sbWrite("POST","",{name:v.name,slug:slug,category:v.category,brand:v.brand,price:v.price,was_price:v.was_price,deal_price:v.deal_price,stock:v.stock,is_hot:v.is_hot,is_new:v.is_new,image_urls:v.image_urls});
      if(!added||!added.length)throw new Error("Add failed — nothing was saved. Check that you are signed in and try again.");
      await logAudit("product_added","product",added[0].id,v.name,{price:v.price,was_price:v.was_price,deal_price:v.deal_price,stock:v.stock,category:v.category,photos:v.image_urls.length});
      nextNumId++;
      PM.saved=true;
      try{IGAdminUI.closeModal("prodModal");}catch(e){}
      loadProducts();loadAuditLog();renderAnalytics();
      showToast("Added ✓ — live on the shop now");
    }else{
      var p=PRODUCTS.find(function(x){return x.uuid===PM.uuid});
      if(!p)throw new Error("That product is gone — refresh and try again.");
      var loadedVer=PM.version||p.version||1;
      var oldPaths=(p.rawImgs||[]).map(igStoragePathFromUrl).filter(Boolean);
      var patchBody={name:v.name,brand:v.brand,category:v.category,price:v.price,was_price:v.was_price,deal_price:v.deal_price,stock:v.stock,is_hot:v.is_hot,is_new:v.is_new,image_urls:v.image_urls,version:loadedVer+1};
      var upd=await sbWrite("PATCH","?id=eq."+PM.uuid+"&version=eq."+loadedVer,patchBody);
      if(!upd||!upd.length){msg.textContent="✖ Someone changed this product — refresh and try again.";btn.disabled=false;btn.textContent="Save product";loadProducts();return;}
      /* Files removed from the product in this edit are deleted now. */
      var newPaths=v.image_urls.map(igStoragePathFromUrl).filter(Boolean);
      var removed=oldPaths.filter(function(pt){return newPaths.indexOf(pt)===-1;});
      var cleaned=true;
      if(removed.length)cleaned=await igStorageRemove(removed);
      await logAudit("product_edited","product",PM.uuid,v.name,{old_price:p.price,new_price:v.price,old_was_price:p.old,new_was_price:v.was_price,old_deal_price:p.deal,new_deal_price:v.deal_price,old_stock:p.stock,new_stock:v.stock,old_photos:p.rawImgs.length,new_photos:v.image_urls.length,storage_files_removed:cleaned});
      PM.saved=true;
      try{IGAdminUI.closeModal("prodModal");}catch(e){}
      loadProducts();loadAuditLog();renderAnalytics();
      showToast(cleaned?"Saved ✓ — live on the shop now":"Saved ✓ (some removed photos could not be deleted from Storage)");
    }
  }catch(err){
    msg.textContent="✖ "+(err&&err.message?err.message:"Could not save.");
    btn.disabled=false;btn.textContent="Save product";
  }
}
/* If the modal closes WITHOUT saving (Cancel, overlay click, ESC), delete
   any files uploaded in this session — they are not referenced by any
   product and would otherwise be orphaned. */
try{
  var _pmModal=document.getElementById("prodModal");
  if(_pmModal&&window.MutationObserver){
    new MutationObserver(function(){
      if(!PM.open)return;
      if(_pmModal.classList.contains("open"))return;
      PM.open=false;
      if(PM.saved)return;
      var orphans=PM.sessionPaths.slice();
      PM.sessionPaths=[];
      if(orphans.length)igStorageRemove(orphans);
    }).observe(_pmModal,{attributes:true,attributeFilter:["class"]});
  }
}catch(e){}
document.getElementById("adminList").addEventListener("click",async function(e){
  var row=e.target.closest(".arow");if(!row)return;
  var uuid=row.getAttribute("data-uuid");
  var p=PRODUCTS.find(function(x){return x.uuid===uuid});
  if(e.target.closest(".asave")){
    var price=parseInt(row.querySelector(".aprice").value,10);
    var was=parseInt(row.querySelector(".awas").value,10);
    var dealRaw=(row.querySelector(".adeal")||{}).value;
    var deal=(dealRaw==null||String(dealRaw).trim()==="")?null:parseInt(dealRaw,10);
    var stock=parseInt(row.querySelector(".astock").value,10);
    if(!(price>0)||isNaN(stock)){showToast("✖ Price must be above 0 and stock a number");return}
    /* Wave 5: deal price must be below the new price (and above 0). */
    if(deal!=null&&(isNaN(deal)||deal<=0||deal>=price)){showToast("✖ Deal price must be below the new price");return}
    var photoEl=row.querySelector(".aphotos");
    var photoUrls=photoEl?photoEl.value.split("\n").map(function(s){return s.trim()}).filter(Boolean).slice(0,4):[];
    /* H-04: reject unsafe photo URLs at write time too. */
    if(photoUrls.some(function(u){return !igSafeImgUrl(u)})){showToast("✖ Photo URLs must be https:// links or site-relative paths");return}
    var btn=e.target.closest(".asave");btn.textContent="Saving…";
    try{var loadedVer=parseInt(row.getAttribute("data-version")||"1",10);if(!(loadedVer>0))loadedVer=(p&&p.version)||1;var patchBody={price:price,was_price:isNaN(was)?price:was,deal_price:deal,stock:stock,version:loadedVer+1};if(photoUrls.length)patchBody.image_urls=photoUrls;var upd=await sbWrite("PATCH","?id=eq."+uuid+"&version=eq."+loadedVer,patchBody);if(!upd||!upd.length){showToast("Someone changed this product — refresh and try again");btn.textContent="Save";loadProducts();return}var auditDetails={old_price:p?p.price:null,new_price:price,old_was_price:p?p.old:null,new_was_price:isNaN(was)?price:was,old_deal_price:p?p.deal:null,new_deal_price:deal,old_stock:p?p.stock:null,new_stock:stock};if(photoUrls.length)auditDetails.new_image_urls=photoUrls;await logAudit("product_edited","product",uuid,p?p.name:null,auditDetails);loadAuditLog();renderAnalytics();showToast("Saved ✓ — live on the shop now");loadProducts();}
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
    try{var del=await sbWrite("DELETE","?id=eq."+uuid);if(!del||!del.length)throw new Error("Delete failed — nothing was deleted. Are you still signed in?");
    /* Wave 5: remove the product's Storage files too — no orphaned images. */
    var cleaned=await igDeleteProductFiles(p);
    await logAudit("product_deleted","product",uuid,p?p.name:null,{price:p?p.price:null,stock:p?p.stock:null,storage_files_removed:cleaned});
    loadAuditLog();renderAnalytics();
    showToast(cleaned?"Deleted ✓":"Deleted ✓ (some photos could not be removed from Storage — check the bucket)");
    /* Wave 5 fix: drop the row from the list at once — do not wait for
       the reload round-trip, or the deleted row lingers after the toast. */
    var ix=PRODUCTS.findIndex(function(x){return x.uuid===uuid;});
    if(ix!==-1){PRODUCTS.splice(ix,1);renderAdminList();try{renderProductTiles();}catch(e){}}
    loadProducts();}
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
  /* Wave 5: tick labels use the muted-text token — light was #7A7A85 (4.25:1, failed). */
  return {tick:dark?"#A9B2E0":"#5F5F6B",grid:dark?"rgba(255,255,255,.12)":"rgba(20,20,60,.08)",blue:dark?"#5A5AFF":"#0A00FF"};
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
      /* Wave 5: tiles show the deal price (with the old price struck
         through) whenever a deal is set — same as the shop. */
      var tile=IGAdminUI.buildProductTile({name:p.name,category:p.catLabel,price:(p.deal!=null?p.deal:p.price),oldPrice:p.old,imageUrl:p.img,isHot:p.hot,isNew:p.isNew,soldOut:p.soldOut,rating:null,reviewCount:null});
      if(igCanWrite()||igCanDelete()){
        var act=document.createElement("div");act.className="ig-tile-actions";
        if(igCanWrite()){
          var eb=document.createElement("button");eb.type="button";eb.className="ig-btn ig-btn-primary ig-btn-sm";eb.textContent="Edit";
          eb.addEventListener("click",function(){igOpenProductModal("edit",p.uuid);});
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
/* Wave 5: edit now goes through the unified product modal (igOpenProductModal) —
   the old price-only edit modal (prodEditModal) is gone. */
async function igDeleteProductTile(btn,p){
  if(btn.getAttribute("data-arm")!=="1"){
    btn.setAttribute("data-arm","1");btn.textContent="Sure? Tap again";
    setTimeout(function(){try{btn.removeAttribute("data-arm");btn.textContent="Delete";}catch(e){}},5000);
    return;
  }
  try{
    var del=await sbWrite("DELETE","?id=eq."+p.uuid);
    if(!del||!del.length)throw new Error("Delete failed — nothing was deleted. Are you still signed in?");
    /* Wave 5: remove the product's Storage files too — no orphaned images. */
    var cleaned=await igDeleteProductFiles(p);
    await logAudit("product_deleted","product",p.uuid,p.name,{price:p.price,stock:p.stock,storage_files_removed:cleaned});
    loadAuditLog();renderAnalytics();
    showToast(cleaned?"Deleted ✓":"Deleted ✓ (some photos could not be removed from Storage — check the bucket)");
    /* Wave 5 fix: drop the tile from the list at once — do not wait for
       the reload round-trip, or the deleted tile lingers after the toast. */
    var ix2=PRODUCTS.findIndex(function(x){return x.uuid===p.uuid;});
    if(ix2!==-1){PRODUCTS.splice(ix2,1);renderAdminList();try{renderProductTiles();}catch(e){}}
    loadProducts();
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
/* Wave 5: one modal for Add AND Edit — prodAddBtn opens it in "add" mode. */
document.getElementById("prodAddBtn").addEventListener("click",function(){igOpenProductModal("add");});
document.getElementById("pmSave").addEventListener("click",function(){igSaveProductModal();});
document.getElementById("pmChoose").addEventListener("click",function(){document.getElementById("pmFile").click();});
document.getElementById("pmDrop").addEventListener("click",function(e){if(e.target.closest("#pmChoose"))return;document.getElementById("pmFile").click();});
document.getElementById("pmFile").addEventListener("change",function(){igPmHandleFiles(this.files);this.value="";});
document.getElementById("pmDrop").addEventListener("dragover",function(e){e.preventDefault();this.classList.add("dragging");});
document.getElementById("pmDrop").addEventListener("dragleave",function(){this.classList.remove("dragging");});
document.getElementById("pmDrop").addEventListener("drop",function(e){e.preventDefault();this.classList.remove("dragging");igPmHandleFiles(e.dataTransfer.files);});
document.getElementById("pmDrop").addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();document.getElementById("pmFile").click();}});
document.getElementById("pmImgUrlAdd").addEventListener("click",function(){igPmImportUrl();});
document.getElementById("pmImgUrl").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();igPmImportUrl();}});
/* Wave 5 fix: clear each field's own error as soon as that field is
   edited, and hide the "Fix the highlighted fields first." banner once
   every field error is gone (it no longer lingers after a fix). */
function igPmMaybeClearBanner(){
  var anyErr=["pmNameErr","pmBrandErr","pmCatErr","pmPriceErr","pmOldErr","pmDealErr","pmStockErr","pmImgErr"].some(function(id){var e=igPmEl(id);return e&&!e.hidden&&e.textContent;});
  if(!anyErr){var m=igPmEl("pmMsg");if(m)m.textContent="";}
}
[["pmName","pmNameErr"],["pmBrand","pmBrandErr"],["pmCat","pmCatErr"],["pmPrice","pmPriceErr"],["pmOld","pmOldErr"],["pmDeal","pmDealErr"],["pmStock","pmStockErr"]].forEach(function(pair){
  var el=document.getElementById(pair[0]);if(!el)return;
  el.addEventListener(el.tagName==="SELECT"?"change":"input",function(){
    el.removeAttribute("aria-invalid");igPmSetErr(pair[1],"");igPmMaybeClearBanner();
  });
});
document.getElementById("pmImgUrl").addEventListener("input",function(){igPmSetImgError("");igPmMaybeClearBanner();});
document.getElementById("prodCatFilter").addEventListener("change",function(){PROD_CAT_FILTER=this.value;PROD_TILE_PAGE=1;renderProductTiles();});
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
  /* Wave 5: "System" clears the saved preference — and the default theme
     is the BLUE light theme, not the OS theme. So this returns to light. */
  try{localStorage.removeItem("ig-admin-theme");}catch(e){}
  try{document.documentElement.setAttribute("data-theme","light");}catch(e){}
  try{IGAdminUI.initTheme();}catch(e){}
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
