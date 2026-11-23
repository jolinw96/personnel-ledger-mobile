(() => {
  "use strict";
  const key = "cn.personnel-ledger-mobile.github-pages.v1";
  const deptNames = ["办公室","人事教育科","预算科","国库科","行政政法科","科教文科","经济建设科","农业农村科","社会保障科","国有资产管理科","监督评价科","政府采购管理科","会计科","信息中心"];
  const initial = () => ({people:[],depts:deptNames.map((name,i)=>({id:"d"+(i+1),name,parentId:""})),policies:[]});
  const esc = str => String(str==null?"":str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  const today = () => iso(new Date());
  const jobTitles = {
    position:["科长","副科长"],
    rank:["三级调研员","四级调研员","一级主任科员","二级主任科员","三级主任科员","四级主任科员","一级科员","七级职员","八级职员","九级职员"]
  };
  const staffCategories = new Map([
    ...["公务员","公务员(行政编)","公务员(行政编制)","行政编","行政编制"].map(name=>[name,"civil"]),
    ...["参公","参公人员","参公管理人员","参公事业编","参公事业编制"].map(name=>[name,"reference"]),
    ...["事业编","事业编制","事业编制人员"].map(name=>[name,"institution"])
  ]);
  const staffGroup = p => staffCategories.get(String(p.category||"").trim().replace(/（/g,"(").replace(/）/g,")")) || "";
  const quotaGroups = {
    positions:[
      {key:"civilChief",label:"公务员科长",group:"civil",title:"科长"},
      {key:"civilDeputy",label:"公务员副科长",group:"civil",title:"副科长"},
      {key:"referenceChief",label:"参公科长",group:"reference",title:"科长"},
      {key:"referenceDeputy",label:"参公副科长",group:"reference",title:"副科长"}
    ],
    ranks:[
      {key:"research34",label:"三、四级调研员",titles:["三级调研员","四级调研员"]},
      {key:"principal12",label:"一、二级主任科员",titles:["一级主任科员","二级主任科员"]},
      {key:"principal34",label:"三、四级主任科员",titles:["三级主任科员","四级主任科员"]}
    ]
  };
  const quotaKeys=new Set([...quotaGroups.positions,...quotaGroups.ranks].map(group=>group.key));
  function jobChoices(kind,previous){
    const titles = kind==="target" ? [...jobTitles.position,...jobTitles.rank] : jobTitles[kind] || [];
    const pairs = titles.map(title=>[title,title]);
    if(previous && !titles.includes(previous))pairs.push([previous,previous+"（原记录）"]);
    return pairs;
  }
  const isMonth = value => typeof value==="string" && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(value);
  const icons = {
    book:'<path d="M4 4.5h6c1.2 0 2 .8 2 2 0-1.2.8-2 2-2h6v14h-6c-1.2 0-2 .8-2 1.5 0-.7-.8-1.5-2-1.5H4z"/><path d="M12 6.5V20"/>',
    device:'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18h4"/>',
    overview:'<path d="M4 19.5h16M5.5 15v-4m6 4V4m6 11V8"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m0-15a3.5 3.5 0 0 1 0 7m2 2.5a5 5 0 0 1 4 5"/>',
    org:'<rect x="9" y="3" width="6" height="4.5" rx=".8"/><rect x="2.5" y="16" width="6" height="4.5" rx=".8"/><rect x="15.5" y="16" width="6" height="4.5" rx=".8"/><path d="M12 8v4M5.5 16v-4h13v4"/>',
    policy:'<path d="M5 20V4h9l4 4v4M13 4v5h5M8 12h4m1 5 2.5 2.5L21 14"/>',
    filter:'<path d="M3 5h18l-7 8v5l-4 2v-7z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>'
  };
  const icon = (name,size=21) => '<svg aria-hidden="true" focusable="false" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
  const idOK = id => (typeof id==="string" || Number.isSafeInteger(id)) && /^[A-Za-z0-9_-]{1,100}$/.test(String(id)) && !["constructor","__proto__","prototype"].includes(String(id));
  const flat = (obj,fields) => fields.every(k=>obj[k]==null||typeof obj[k]==="string"||typeof obj[k]==="number");
  function isDate(value){
    if(value==null||value==="")return true;
    if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+"T00:00:00Z");
    return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
  }
  function validate(data){
    const bad = () => {throw Error("备份格式或数据关联有误");};
    if(!data || !["people","depts","policies"].every(k=>Array.isArray(data[k]))) bad();
    for(const list of [data.people,data.depts,data.policies]){
      if(!list.every(x=>x && typeof x==="object" && idOK(x.id))||new Set(list.map(x=>String(x.id))).size!==list.length) bad();
    }
    const parents=new Map();
    for(const d of data.depts){
      if(typeof d.name!=="string"||!d.name.trim()||!flat(d,["parentId"]))bad();
      if(d.quota!=null&&(!Number.isSafeInteger(d.quota)||d.quota<0))bad();
      if(d.postQuotas!=null && (typeof d.postQuotas!=="object" || Array.isArray(d.postQuotas) ||
        !Object.entries(d.postQuotas).every(([key,value])=>quotaKeys.has(key) &&
          (value===null || (Number.isSafeInteger(value) && value>=0)))))bad();
      parents.set(String(d.id),String(d.parentId||""));
    }
    const resolved=new Set();
    for(const id of parents.keys()){
      const path=new Set();
      let p=id;
      while(p&&!resolved.has(p)){
        if(!parents.has(p)||path.has(p)||path.size>64)bad();
        path.add(p);p=parents.get(p);
      }
      path.forEach(v=>resolved.add(v));
    }
    for(const p of data.people){
      if(typeof p.name!=="string"||!p.name.trim()||!flat(p,["gender","birth","age","ageAsOf","education","category","position","rank","deptSince","rankSince","positionSince"]))bad();
      if(p.deptId==="" ? !!p.deptSince : !idOK(p.deptId)||!parents.has(String(p.deptId)))bad();
      if(p.establishmentDeptId==null || p.establishmentDeptId===""){
        if(p.establishmentSince)bad();
      }else if(!idOK(p.establishmentDeptId)||!parents.has(String(p.establishmentDeptId)))bad();
      if(!isDate(p.establishmentSince))bad();
      if(p.deptHistory!=null&&(!Array.isArray(p.deptHistory)||!p.deptHistory.every(h=>
        h && typeof h.name==="string" && h.name.trim() && isDate(h.start) && !!h.end && isDate(h.end) &&
        ["effectiveDate","positionSince","rankSince","establishmentStart","actualEffectiveDate","establishmentEffectiveDate"].every(k=>isDate(h[k])) &&
        ["position","rank","establishmentName"].every(k=>h[k]==null||typeof h[k]==="string") &&
        ["actualChanged","establishmentChanged"].every(k=>h[k]==null||typeof h[k]==="boolean") &&
        (!h.effectiveDate || (h.effectiveDate<=h.end && (h.actualChanged===false || !h.start || h.effectiveDate>=h.start))) &&
        (!h.actualEffectiveDate || (h.actualEffectiveDate<=h.end && (!h.start || h.actualEffectiveDate>=h.start))) &&
        (!h.establishmentEffectiveDate || (h.establishmentEffectiveDate<=h.end && (!h.establishmentStart || h.establishmentEffectiveDate>=h.establishmentStart)))
      )))bad();
      if(["gender","education","category","rank","position"].some(k=>p[k]!=null&&typeof p[k]!=="string"))bad();
      if(!isMonth(p.birth)&&!isDate(p.birth))bad();
      if(["ageAsOf","deptSince","rankSince","positionSince"].some(k=>!isDate(p[k])))bad();
      if(p.age!=null&&p.age!==""&&(!Number.isInteger(Number(p.age))||+p.age<0||+p.age>130))bad();
      if(p.history!=null && (!Array.isArray(p.history)||!p.history.every(h=>h&&typeof h==="object"&&typeof h.title==="string"&&typeof h.type==="string"&&isDate(h.start)&&isDate(h.end)&&
        ["actualDeptName","establishmentDeptName"].every(k=>h[k]==null||typeof h[k]==="string"))))bad();
    }
    if(typeof window.validatePolicies==="function"&&!window.validatePolicies(data.policies))bad();
    for(const p of data.people){
      if(p.birth)p.birth=p.birth.slice(0,7);
      if(!Object.prototype.hasOwnProperty.call(p,"establishmentDeptId")){
        p.establishmentDeptId=p.deptId;
        p.establishmentSince="";
      }
    }
    return data;
  }
  let state=initial(), unreadable=false;
  try{const raw=localStorage.getItem(key); if(raw)state=validate(JSON.parse(raw));}
  catch(e){unreadable=true;}
  let snapshot=JSON.stringify(state);
  function notify(msg){
    const el=document.getElementById("toast");el.textContent=msg;el.className="on";
    clearTimeout(notify.timer);notify.timer=setTimeout(()=>{el.className="";},3500);
  }
  function save(){
    try{
      if(unreadable)throw Error("原台账读取失败，请先导出原始文件或从备份恢复");
      const raw=JSON.stringify(HR.state);
      localStorage.setItem(key,raw);
      snapshot=raw; return true;
    }catch(e){HR.state=JSON.parse(snapshot);notify(unreadable?e.message:"本机保存失败，请检查可用空间");return false;}
  }
  function restore(data){
    validate(data);
    const raw=JSON.stringify(data);
    localStorage.setItem(key,raw);HR.state=data;snapshot=raw;unreadable=false;
  }
  const HR=window.HR={state,save,restore,validate,initial,esc,icon,today,notify,subBack:null,container:()=>document.getElementById("content"),
    deptName:id=>{if(id==="")return "未分配科室";const d=HR.state.depts.find(d=>String(d.id)===String(id));return d?d.name:"未登记";},
    establishmentName:p=>p.establishmentDeptId==null?"待核实":HR.deptName(p.establishmentDeptId),
    rememberDept:(person,previous=person,effectiveDate="",changes={actual:true,establishment:false})=>{
      if(!changes.actual&&!changes.establishment)return;
      const entry={
        name:HR.deptName(previous.deptId),start:previous.deptSince||"",end:today(),
        establishmentName:HR.establishmentName(previous),establishmentStart:previous.establishmentSince||"",
        actualChanged:changes.actual,establishmentChanged:changes.establishment,
        actualEffectiveDate:changes.actual?(changes.actualDate||effectiveDate):"",
        establishmentEffectiveDate:changes.establishment?(changes.establishmentDate||effectiveDate):"",
        position:previous.position||"",positionSince:previous.positionSince||"",rank:previous.rank||"",rankSince:previous.rankSince||""
      };
      if(entry.actualEffectiveDate||entry.establishmentEffectiveDate)entry.effectiveDate=entry.actualEffectiveDate||entry.establishmentEffectiveDate;
      person.deptHistory=(person.deptHistory||[]).concat(entry);
    },
    age:(p,date=today())=>{
      if(!p.birth)return p.age==null||p.age===""?null:Number(p.age);
      const when=typeof date==="string"?date:iso(date);
      const n=Number(when.slice(0,4))-Number(p.birth.slice(0,4))-(when.slice(5,7)<p.birth.slice(5,7)?1:0);
      return Number.isFinite(n)&&n>=0?n:null;
    },isUnreadable:()=>unreadable, raw:()=>localStorage.getItem(key)};
  Object.assign(HR,{jobTitles,jobChoices,isMonth,quotaGroups,staffGroup});
})();
