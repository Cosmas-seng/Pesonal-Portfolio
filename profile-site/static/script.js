const $=id=>document.getElementById(id);
const SK=["Python","JavaScript","HTML","CSS","VB.NET","C++","C","Java"];
let active=null,projects=[],canEdit=false;

// theme
$("theme").onclick=()=>{
  const r=document.documentElement,d=r.dataset.theme==="dark"||(!r.dataset.theme&&matchMedia("(prefers-color-scheme:dark)").matches);
  r.dataset.theme=d?"light":"dark"
};

// typing effect
const roles=["Software Engineer","Systems Analyst","Desktop App Developer","Problem Solver"];
let ri=0,ci=0,del=false;
(
  function type(){
    const w=roles[ri];
    $("typed").textContent=w.slice(0,ci)+"▍";
    if(!del&&ci===w.length){
      del=true;
      return setTimeout(type,1400)
    }
    if(del&&ci===0){
      del=false;
      ri=(ri+1)%roles.length
    }
    ci+=del?-1:1;setTimeout(type,del?40:80)
  }
)();

// count-up stats
function count(el,to){
  let n=0;
  const s=()=>{
    el.textContent=n+(to&&el.dataset.plus?"+":"");
    if(n<to){
      n++;
      setTimeout(s,150)
    }
  };
  s()
}
const io=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting){
  const b=x.target;
  count(b,+b.dataset.n);
  io.unobserve(b)
}}));
document.querySelectorAll("[data-n]").forEach(b=>{
  if(b.id!=="pc")io.observe(b)
  });

// skills
function drawChips(){
  $("chips").innerHTML="";
  SK.forEach(s=>{
    const b=document.createElement("button");
    b.className="chip"+(active===s?" on":"");
    b.textContent=s;
    b.onclick=()=>{
      active=active===s?null:s;
      drawChips();
      drawProjects();
      if(active)$("projects").scrollIntoView()
      }
    $("chips").append(b)
  })
}

// projects
function drawProjects(){
  const box=$("plist");
  box.innerHTML="";
  const list=projects.filter(p=>!active||(p.tags||[]).some(t=>t.toLowerCase()===active.toLowerCase()));
  $("pc").textContent=projects.length||"0";
  if(!list.length){
    box.innerHTML='<p class="muted">'+(projects.length?"No projects with this skill yet.":"No projects yet. They'll appear here once added.")+"</p>";
    return
  }
  list.forEach(p=>
    {
      const c=document.createElement("div");
      c.className="card proj";
    if(canEdit){
      const x=document.createElement("button");
      x.className="del";
      x.textContent="✕";
      x.title="Delete";
      x.onclick=()=>confirm("Delete this project?")&&api("DELETE","/api/projects/"+p.id).then(load);
      c.append(x)
    }
    const h=document.createElement("h3");
    h.textContent=p.title;c.append(h);
    const d=document.createElement("p");
    d.className="muted";
    d.textContent=p.description||"";
    c.append(d);
    (p.tags||[]).forEach(t=>
      {const s=document.createElement("span");
        s.className="tag";
        s.textContent=t;
        c.append(s)
      }
    );
    if(/^https?:\/\//.test(p.link||"")){
      const a=document.createElement("a");
      a.href=p.link;
      a.target="_blank";
      a.rel="noopener";
      a.textContent=" View →";
      c.append(a)
    }
    box.append(c)
  })
}

// contact copy
$("cp").onclick=async()=>
  {try
    {await navigator.clipboard.writeText($("em").textContent);
      $("cp").textContent="Copied ✓"
    }
    catch(e){
      $("cp").textContent="Select & copy"
    }
    setTimeout(()=>$("cp").textContent="Copy",1500)
  };
drawChips();
drawProjects();

// backend (Flask + MySQL)
async function api(method,url,body){
  const r=await fetch(url,{
    method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||r.statusText);return j
}
async function load(){
  try{
    projects=await api("GET","/api/projects");
    drawProjects()
  }
  catch(e){
    $("plist").innerHTML='<p class="muted">Could not load projects.</p>'
  }
}
function setAdmin(a){
  canEdit=a;$("admin").hidden=!a;$("login").textContent=a?"Log out":"Admin";
  drawProjects()
}
$("login").onclick=async()=>{try{
  if(canEdit){
    await api("POST","/api/logout");
    return setAdmin(false)
  }
  const pw=prompt("Admin password");
  if(!pw)return;
  await api("POST","/api/login",{password:pw});
  setAdmin(true)
}
catch(e){
  alert(e.message)
}};
$("f").onsubmit=async e=>{
  e.preventDefault();
  try{
    await api("POST","/api/projects",{title:$("t").value,description:$("d").value,link:$("l").value,
    tags:$("g").value.split(",").map(x=>x.trim()).filter(Boolean)});$("f").reset();load()}catch(err){
      alert(err.message)
    }
  };
(async()=>{
  await load();
  try{
    setAdmin((await api("GET","/api/me")).admin)
  }
  catch(e){}
})();
