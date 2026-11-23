(() => {
  "use strict";
  const key = "cn.personnel-ledger-mobile.github-pages.v1";
  const deptNames = [
    "办公室","预算科","街镇科","国库科","资产管理科","绩效评价科","政府采购管理科","基本建设科","综合科","农业科","金融科","教科文科","行政政法科",
    "市政管理科","社会保障科","企业科","财源建设一科","财源建设二科","会计管理科","人事教育科","党建工作科","行政财务科","内控法制科","监督检查大队","信息中心","调研员"
  ];
  const previousReferencePresets = [
    ["u-inspection","财政监督检查大队","reference",20,1,3],
    ["u-payment","财政支付中心","reference",28,1,3],
    ["u-budget","预算编审中心","reference",10,1,2],
    ["u-performance","绩效考评中心","reference",10,1,2]
  ];
  const unitPresets = [
    ["u-civil","公务员编制","civil",94,24,23],
    ["u-reference","参公编制","reference",68,4,10],
    ["u-institution","事业编制","institution",22,1,3]
  ];
  const quotaCatalogVersion=2;
  const rankPresets = {research34:20,principal12:50,principal34:50};
  const makeUnits = (presets=unitPresets) => presets.map(([id,name,categoryGroup,quota,chiefQuota,deputyQuota])=>({id,name,categoryGroup,quota,chiefQuota,deputyQuota}));
  const initial = () => ({
    people:[],depts:deptNames.map((name,i)=>({id:"a"+(i+1),name,parentId:""})),
    establishmentUnits:makeUnits(),quotaCatalogVersion,policies:[],unitPostQuotas:{...rankPresets}
  });
  const has = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  const esc = str => String(str==null?"":str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  const today = () => iso(new Date());
  const jobTitles = {
    position:["科长","副科长"],
    rank:["三级调研员","四级调研员","一级主任科员","二级主任科员","三级主任科员","四级主任科员","一级科员","七级职员","八级职员","九级职员"]
  };
  const staffCategories = new Map([
    ...["公务员","公务员(行政编)","公务员(行政编制)","行政编","行政编制"].map(name=>[name,"civil"]),
    ...["参公","参公编制","参公人员","参公管理人员","参公事业编","参公事业编制"].map(name=>[name,"reference"]),
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
      {key:"research34",label:"三、四级调研员",allowSeparate:true,titles:["三级调研员","四级调研员"]},
      {key:"principal12",label:"一、二级主任科员",titles:["一级主任科员","二级主任科员"]},
      {key:"principal34",label:"三、四级主任科员",allowSeparate:true,titles:["三级主任科员","四级主任科员"]}
    ]
  };
  const separateRankTitles=new Set(quotaGroups.ranks.filter(group=>group.allowSeparate).flatMap(group=>group.titles));
  function isDoctoralEducation(education){
    const label=String(education||"").normalize("NFKC").trim().replace(/\s+/g,"");
    if(/^研究生(?:学历)?[(\/]博士(?:研究生)?\)?$/.test(label))return true;
    const primary=label.split(/[(\/、,]/)[0];
    return /^(?:全日制|非全日制|在职)?(?:[\u4e00-\u9fff]{1,8}学|工程|教育|专业)?博士(?:研究生|学位|学历|后)?(?:毕业)?$/.test(primary) ||
      /^(?:ph\.?d\.?|doctorate|doctorofphilosophy)$/i.test(primary);
  }
  const separateRankEligible=(rank,education)=>separateRankTitles.has(rank) && !isDoctoralEducation(education);
  const separateRank=person=>person.rankSeparate===true && separateRankEligible(person.rank,person.education);
  const quotaKeys=new Set([...quotaGroups.positions,...quotaGroups.ranks].map(group=>group.key));
  const quotaValue=value=>Number.isSafeInteger(value)&&value>=0;
  function validPostQuotas(quotas){
    return !!quotas && typeof quotas==="object" && !Array.isArray(quotas) &&
      Object.entries(quotas).every(([key,n])=>quotaKeys.has(key)&&(n===null||quotaValue(n)));
  }
  function migrateUnitQuotas(depts){
    const quotas={};
    if(!depts.length)return quotas;
    const officialNames=new Set([...unitPresets,...previousReferencePresets].map(unit=>unit[1]));
    if(depts.some(d=>!officialNames.has(d.name)) || new Set(depts.map(d=>d.name)).size!==depts.length)return quotas;
    for(const {key} of quotaGroups.ranks){
      const values=depts.map(d=>d.postQuotas && d.postQuotas[key]);
      if(values.every(quotaValue)){
        const total=values.reduce((sum,n)=>sum+n,0);
        if(Number.isSafeInteger(total))quotas[key]=total;
      }
    }
    return quotas;
  }
  const positionField = slot => slot.title==="科长" ? "chiefQuota" : "deputyQuota";
  function unitTarget(key,ledger=HR.state){
    if(has(ledger.unitPostQuotas,key))return ledger.unitPostQuotas[key];
    const slot=quotaGroups.positions.find(slot=>slot.key===key);
    if(!slot)return null;
    const units=ledger.establishmentUnits.filter(u=>!u.legacy && u.categoryGroup===slot.group);
    const field=positionField(slot);
    if(units.some(u=>!quotaValue(u[field])))return null;
    const sum=units.reduce((total,u)=>total+u[field],0);
    return quotaValue(sum)?sum:null;
  }
  function clearUnitTargetOverride(group,field){
    const slot=quotaGroups.positions.find(slot=>slot.group===group && positionField(slot)===field);
    if(slot)delete HR.state.unitPostQuotas[slot.key];
  }
  function mergeReferenceQuotas(data){
    const units=data.establishmentUnits;
    const oldIds=new Set(previousReferencePresets.map(([id])=>id));
    const items=units.filter(u=>!u.legacy && u.categoryGroup==="reference" && oldIds.has(u.id));
    if(items.length){
      const usedIds=new Set(units.map(u=>String(u.id)));
      const mergedIds=new Set(items.map(u=>u.id));
      let id="u-reference",suffix=1;
      while(usedIds.has(id))id="u-reference-"+suffix++;
      const merged={id,name:"参公编制",categoryGroup:"reference"};
      for(const field of ["quota","chiefQuota","deputyQuota"]){
        const sum=items.reduce((n,u)=>n+(u[field]??0),0);
        merged[field]=items.every(u=>quotaValue(u[field])) && quotaValue(sum)?sum:null;
      }
      const parent=items[0].parentId;
      if(parent!=null && parent!=="" && !mergedIds.has(String(parent)) &&
         items.every(u=>String(u.parentId)===String(parent)))merged.parentId=parent;
      data.establishmentUnits=[];
      for(const u of units){
        if(u===items[0])data.establishmentUnits.push(merged);
        if(mergedIds.has(u.id))continue;
        if(mergedIds.has(u.parentId))u.parentId=id;
        data.establishmentUnits.push(u);
      }
    }
    data.quotaCatalogVersion=quotaCatalogVersion;
  }
  function migrateCatalogs(data){
    const original=data.depts;
    const names=new Map();
    for(const d of original){
      const matches=names.get(d.name)||[];
      matches.push(d);names.set(d.name,matches);
    }
    const units=makeUnits([unitPresets[0],...previousReferencePresets,unitPresets[2]]);
    const officialByName=new Map(units.map(u=>[u.name,u]));
    for(const d of original){
      const official=names.get(d.name).length===1 && officialByName.get(d.name);
      if(official){
        if(has(d,"quota"))official.quota=d.quota;
        for(const slot of quotaGroups.positions.filter(slot=>slot.group===official.categoryGroup)){
          if(d.postQuotas && has(d.postQuotas,slot.key))official[positionField(slot)]=d.postQuotas[slot.key];
        }
      }
    }
    const reserved=new Set(original.map(d=>String(d.id))), reused=new Set();
    data.depts=deptNames.map((name,i)=>{
      const existing=names.get(name);
      if(existing){reused.add(existing[0]);return existing[0];}
      const base="a"+(i+1);
      let id=base, suffix=1;
      while(reserved.has(id))id=base+"-"+suffix++;
      return {id,name,parentId:""};
    });
    for(const d of original)if(!reused.has(d))data.depts.push(d);
    const previous=data.unitPostQuotas;
    data.establishmentUnits=units;
    data.unitPostQuotas={...rankPresets};
    for(const [key,value] of Object.entries(previous)){
      if(quotaValue(value))data.unitPostQuotas[key]=value;
    }
  }
  function jobChoices(kind,previous){
    const titles = kind==="target" ? [...jobTitles.position,...jobTitles.rank] : jobTitles[kind] || [];
    const pairs = titles.map(title=>[title,title]);
    if(previous && !titles.includes(previous))pairs.push([previous,previous+"（原记录）"]);
    return pairs;
  }
  function roleHistoryValues(entry){
    const originalType=entry.type||"",originalTitle=entry.title||"";
    const known=originalType==="职务" || originalType==="职级";
    return {
      position:entry.position ?? (originalType==="职务"?originalTitle:""),
      rank:entry.rank ?? (originalType==="职级"?originalTitle:""),
      otherType:known?"":originalType,otherTitle:known?"":originalTitle
    };
  }
  function updateRoleHistory(entry,position,rank){
    const previous=roleHistoryValues(entry);
    const typed=typeof entry.type==="string" && typeof entry.title==="string";
    if(typeof position!=="string" || typeof rank!=="string")throw Error("任职经历的职务或职级无效");
    if(typed && position===previous.position && rank===previous.rank)return entry;
    if(!position && !rank && !previous.otherType && !previous.otherTitle && !entry.autoRoleHistory)throw Error("请选择任职经历的职务或职级");
    entry.position=position;
    entry.rank=rank;
    if(!previous.otherType && !previous.otherTitle){
      entry.type=position?"职务":rank?"职级":"";
      entry.title=position||rank;
    }
    return entry;
  }
  function validResumeLinks(h){
    if(!has(h,"resumeParts"))return !has(h,"resumeDirect") && !has(h,"resumeRoleRefs");
    if(!Array.isArray(h.resumeParts) || typeof h.resumeDirect!=="boolean" || !Array.isArray(h.resumeRoleRefs) ||
      !h.resumeRoleRefs.every(id=>typeof id==="string" && id.length>0))return false;
    return h.resumeParts.every(r=>r && typeof r==="object" &&
      ["start","end","actualDeptName","position","rank","otherType","otherTitle"].every(k=>typeof r[k]==="string") &&
      [r.start,r.end].every(v=>!v || exactDay(v) || isMonth(v)) && !!r.end &&
      (!r.start||r.start.slice(0,7)<=r.end.slice(0,7)) &&
      ["roleEndUnknown","timelineCurrent","timelineDerived"].every(k=>r[k]===false));
  }
  function validRoleEntry(entry){
    if(!entry || typeof entry!=="object" || Array.isArray(entry) || !isDate(entry.start) || !isDate(entry.end))return false;
    if(has(entry,"resumeId") && (typeof entry.resumeId!=="string" || !entry.resumeId))return false;
    if(entry.actualDeptName!=null && typeof entry.actualDeptName!=="string")return false;
    if(["startMonth","endMonth"].some(k=>has(entry,k)&&!isMonth(entry[k])))return false;
    if(has(entry,"autoRoleHistory") && typeof entry.autoRoleHistory!=="boolean")return false;
    if(["position","rank"].some(k=>has(entry,k) && typeof entry[k]!=="string"))return false;
    if(has(entry,"type") || has(entry,"title")){
      if(typeof entry.type!=="string" || typeof entry.title!=="string")return false;
      if(!has(entry,"position") && !has(entry,"rank"))return true;
      const values=roleHistoryValues(entry);
      return !!(values.position || values.rank || values.otherType || values.otherTitle || (entry.autoRoleHistory && entry.actualDeptName));
    }
    if(!entry.position && !entry.rank)return false;
    updateRoleHistory(entry,entry.position||"",entry.rank||"");
    return true;
  }
  const roleAxes=["position","rank"];
  function priorDay(day){
    const date=new Date(day+"T00:00:00Z");
    date.setUTCDate(date.getUTCDate()-1);
    return date.toISOString().slice(0,10);
  }
  function workName(person){
    return person.deptId==null || person.deptId===""?"":HR.deptName(person.deptId);
  }
  function roleSegments(before,after=before,dates={},previousDeptName=workName(before)){
    const changes=Object.values(dates).sort();
    const first=changes[0]||"",last=changes[changes.length-1]||"";
    const floor=before.roleTimelineSince||"";
    const lower=[floor,before.deptSince||""].sort()[1];
    const unknownRoles=roleAxes.filter(k=>before[k] && !before[k+"Since"] && !floor);
    const unknownDept=!!(previousDeptName && !before.deptSince && !floor);
    const rows=[];
    function append(start,end,dept,position,rank){
      if(!dept && !position && !rank)return;
      rows.push({start,end,actualDeptName:dept,position,rank,
        type:position?"职务":rank?"职级":"",title:position||rank,autoRoleHistory:true});
    }
    // Unknown appointments are observations, not evidence that a title was held
    // on the date of another appointment or the date of arrival.
    if(unknownRoles.length || unknownDept){
      const dept=first && before.deptSince && first<=before.deptSince?"":previousDeptName;
      append("",first?priorDay(first):"",dept,
        unknownRoles.includes("position")?before.position:"",unknownRoles.includes("rank")?before.rank:"");
    }
    const starts=roleAxes.filter(axis=>before[axis]).map(axis=>before[axis+"Since"]);
    const points=[...new Set([lower,...starts,...changes].filter(day=>day && day>=lower && (!last || day<=last)))].sort();
    for(let i=0;i<points.length;i++){
      const start=points[i];
      if(start===last)break;
      const confirmed=!!first && start>=first;
      const dept=dates.dept && start>=dates.dept?workName(after):unknownDept&&!confirmed?"":previousDeptName;
      const values=roleAxes.map(axis=>{
        if(dates[axis] && start>=dates[axis])return after[axis]||"";
        const since=before[axis+"Since"];
        if(since)return since<=start?before[axis]||"":"";
        return !floor && !confirmed?"":before[axis]||"";
      });
      const next=points[i+1];
      append(start,next?priorDay(next):"",dept,values[0],values[1]);
    }
    return rows;
  }
  function sameRolePeriod(a,b){
    const left=roleHistoryValues(a),right=roleHistoryValues(b);
    return !left.otherType && !left.otherTitle && (a.startMonth||a.start||"")===(b.startMonth||b.start||"") &&
      (a.actualDeptName||"")===(b.actualDeptName||"") &&
      left.position===right.position && left.rank===right.rank;
  }
  function matchesRecordedRole(record,segment){
    if(sameRolePeriod(record,segment))return true;
    if(!record.start || record.start!==segment.start || !record.actualDeptName || record.actualDeptName!==segment.actualDeptName)return false;
    const values=roleHistoryValues(record);
    return !values.otherType && !values.otherTitle && !!(values.position || values.rank) &&
      (!values.position || values.position===segment.position) && (!values.rank || values.rank===segment.rank);
  }
  function roleTimeline(person){
    const rows=(person.history||[]).map((entry,historyIndex)=>({...entry,start:entry.startMonth||entry.start,end:entry.endMonth||entry.end,historyIndex,timelineCurrent:false,timelineDerived:false}));
    const combined=new Set();
    for(const current of roleSegments(person).filter(entry=>!entry.end)){
      const matches=rows.filter(entry=>!entry.end && !entry.roleEndUnknown && !entry.timelineCurrent && !combined.has(entry) && matchesRecordedRole(entry,current));
      if(matches.length){
        const first=matches[0];
        first.timelineCurrent=true;
        first.historyIndices=matches.map(entry=>entry.historyIndex);
        if(!sameRolePeriod(first,current))updateRoleHistory(first,current.position,current.rank);
        for(const entry of matches.slice(1))combined.add(entry);
      }else rows.push({...current,timelineCurrent:true,timelineDerived:true});
    }
    return rows.filter(r=>!combined.has(r)).sort((a,b)=>Number(b.timelineCurrent)-Number(a.timelineCurrent) || (b.start||"").localeCompare(a.start||""));
  }
  function syncRoleHistory(draft,previous,options={}){
    if(!previous)return;
    const dates={},provided=options.dates||{};
    for(const key of ["dept",...roleAxes]){
      const field=key==="dept"?"deptId":key;
      if(String(draft[field]??"")===String(previous[field]??""))continue;
      if(options.mode==="change"){
        const date=provided[key];
        if(!date || !isDate(date) || date>today())throw Error("请核对变更生效日期");
        if(previous.roleTimelineSince && date<previous.roleTimelineSince)throw Error("变更日期早于最近一次已记录的变动，请核对历史任期");
        dates[key]=date;
      }
    }
    const records=[...(draft.history||[])];
    const changed=Object.keys(dates).length || ["deptId","deptSince","position","positionSince","rank","rankSince"]
      .some(k=>(previous[k]??"")!==(draft[k]??""));
    if(changed && previous.deptId && records.some(r=>!r.actualDeptName && r.start && !r.end && !r.endMonth && !r.roleEndUnknown)){
      // Close an old manual appointment the unified resume already identified as current.
      for(const row of mergedRoles({...previous,history:records})){
        if(!row.timelineCurrent || !row.actualDeptName)continue;
        for(const index of row.historyIndices){
          if(!records[index].actualDeptName)records[index]={...records[index],actualDeptName:row.actualDeptName};
        }
      }
    }
    if(Object.keys(dates).length){
      const sortedDates=Object.values(dates).sort();
      const last=sortedDates[sortedDates.length-1];
      for(const part of roleSegments(previous,draft,dates,options.previousDeptName)){
        if(!part.end)continue;
        const matches=records.filter(r=>matchesRecordedRole(r,part) && (r.end===part.end || (!r.end && !r.endMonth && !r.roleEndUnknown)));
        if(!matches.length){records.push(part);continue;}
        for(const original of matches){
          const entry={...original,end:part.end};
          if(matches.length===1 && !sameRolePeriod(original,part))updateRoleHistory(entry,part.position,part.rank);
          records[records.indexOf(original)]=entry;
        }
      }
      draft.history=records;
      draft.roleTimelineSince=last;
    }else if(options.mode==="correct"){
      const before=roleSegments(previous).filter(r=>!r.end);
      const after=roleSegments(draft).filter(r=>!r.end);
      for(const source of before){
        if(after.some(r=>sameRolePeriod(r,source)))continue;
        const target=after.length===1?after[0]:after.find(r=>
          !!r.position===!!source.position && !!r.rank===!!source.rank);
        const matches=records.filter(r=>!r.end && !r.endMonth && !r.roleEndUnknown && matchesRecordedRole(r,source));
        for(const original of matches){
          const index=records.indexOf(original);
          if(!target){records[index]={...original,roleEndUnknown:true};continue;}
          const changed={...original,start:target.start,actualDeptName:target.actualDeptName};
          const prior=roleHistoryValues(original);
          const position=matches.length===1||prior.position?target.position:"";
          const rank=matches.length===1||prior.rank?target.rank:"";
          if(!position && !rank)changed.autoRoleHistory=true;
          updateRoleHistory(changed,position,rank);
          records[index]=changed;
        }
      }
      if(records.some((r,i)=>r!==draft.history[i]))draft.history=records;
    }
  }
  const isMonth = value => typeof value==="string" && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(value);
  function historyMonths(record){
    return {
      start:record.startMonth ?? (record.start||"").slice(0,7),
      end:record.endMonth ?? (record.effectiveDate||record.end||"").slice(0,7)
    };
  }
  function updateHistoryMonths(record,start,end){
    if((start!=="" && !isMonth(start)) || !isMonth(end) || (start && start>end))throw Error("过往经历的起止年月有误");
    const original=historyMonths(record);
    if(start!==original.start){
      delete record.start;
      if(start)record.startMonth=start;else delete record.startMonth;
    }
    if(end!==original.end){
      delete record.effectiveDate;
      record.endMonth=end;
    }
    return record;
  }
  function validHistoryMonths(record){
    if(!has(record,"startMonth") && !has(record,"endMonth"))return true;
    if(has(record,"startMonth") && (!isMonth(record.startMonth) || (record.start && !record.start.startsWith(record.startMonth+"-"))))return false;
    if(has(record,"endMonth") && (!isMonth(record.endMonth) || (record.effectiveDate && !record.effectiveDate.startsWith(record.endMonth+"-"))))return false;
    const {start,end}=historyMonths(record);
    return !start || start<=end;
  }
  function nextDay(day){
    const date=new Date(day+"T00:00:00Z");date.setUTCDate(date.getUTCDate()+1);
    return date.toISOString().slice(0,10);
  }
  const exactDay=s=>typeof s==="string" && s.length===10 && isDate(s);
  const compatibleRoles=(a,b)=>!roleAxes.some(k=>a[k]&&b[k]&&a[k]!==b[k]) &&
    !(a.otherTitle && b.otherTitle && (a.otherTitle!==b.otherTitle || a.otherType!==b.otherType));
  const sameKnownDate=(a,b)=>!!a&&!!b&&(a===b||((isMonth(a)||isMonth(b))&&a.slice(0,7)===b.slice(0,7)));
  function mergedRoles(person){
    const rows=roleTimeline(person).map(source=>({
      ...roleHistoryValues(source),start:source.start||"",end:source.end||"",actualDeptName:source.actualDeptName||"",
      roleEndUnknown:!!source.roleEndUnknown,timelineCurrent:!!source.timelineCurrent,timelineDerived:!!source.timelineDerived,
      historyIndices:source.historyIndices?.slice() || (source.historyIndex==null?[]:[source.historyIndex]),_deptRefs:[]
    }));
    function groups(items,key){
      const map=new Map();
      for(const item of items){
        const value=key(item);
        if(!map.has(value))map.set(value,[]);
        map.get(value).push(item);
      }
      return map.values();
    }
    function join(parts){
      const first=parts[0],current=parts.some(p=>p.timelineCurrent);
      return {...first,position:parts.find(p=>p.position)?.position||"",rank:parts.find(p=>p.rank)?.rank||"",
        timelineCurrent:current,timelineDerived:current && parts.every(p=>!p.historyIndices.length),
        historyIndices:[].concat(...parts.map(p=>p.historyIndices))};
    }
    const result=[];
    const officePeriods=(person.deptHistory||[]).filter(h=>!Array.isArray(h.resumeParts)).map(archiveSpan);
    // An unknown start is not an identifiable period. Keep each original entry.
    for(const period of groups(rows,r=>r.start?JSON.stringify([r.start,r.end,r.roleEndUnknown,r.otherType,r.otherTitle]):r)){
      if(period.length===1){result.push(period[0]);continue;}
      const named=period.filter(r=>r.actualDeptName);
      for(const r of period.filter(r=>!r.actualDeptName)){
        const compatible=named.filter(n=>compatibleRoles(r,n));
        const oldOffices=officePeriods.filter(a=>archiveExact(a,r));
        const offices=new Set([...compatible,...oldOffices].map(n=>n.actualDeptName));
        if(offices.size===1 && (oldOffices.length || compatible.some(n=>roleAxes.some(k=>r[k] && r[k]===n[k])))){
          r.actualDeptName=offices.values().next().value;
        }
      }
      for(const office of groups(period,r=>r.actualDeptName||r)){
        const kinds=Array.from(groups(office,r=>JSON.stringify([r.position,r.rank])),join);
        // A rank-only record compatible with two different posts cannot be assigned to either.
        const ambiguous=new Set(kinds.filter(r=>{
          const peers=kinds.filter(n=>compatibleRoles(r,n));
          return roleAxes.some(k=>new Set(peers.map(n=>n[k]).filter(Boolean)).size>1);
        }));
        const remaining=new Set(kinds);
        for(const r of kinds){
          if(!remaining.has(r))continue;
          const parts=ambiguous.has(r)?[r]:[...remaining].filter(n=>!ambiguous.has(n) && compatibleRoles(r,n));
          for(const part of parts)remaining.delete(part);
          result.push(join(parts));
        }
      }
    }
    return result;
  }
  function archiveSpan(h){
    return {actualDeptName:h.name,start:h.startMonth||h.start||"",
      end:h.endMonth||(h.effectiveDate?priorDay(h.effectiveDate):(h.end||"").slice(0,7)),
      position:h.position||"",rank:h.rank||"",otherType:"",otherTitle:"",effective:h.effectiveDate||"",
      positionSince:h.positionSince||"",rankSince:h.rankSince||""};
  }
  function archiveExact(a,r){
    return !r.timelineCurrent && sameKnownDate(a.start,r.start) &&
      (sameKnownDate(a.end,r.end)||!!a.effective&&r.end===a.effective) && compatibleRoles(a,r);
  }
  function claim(row,index,kind,part=-1){
    row._deptRefs.push({index,kind,part});
  }
  function gapRow(a,start,end,whole,last){
    const ownsTitle=k=>{
      if(!a[k])return "";
      const since=a[k+"Since"];
      if(!since)return whole||last?a[k]:"";
      return start && (start.length===7?start>since.slice(0,7):start>=since)?a[k]:"";
    };
    return {start,end,actualDeptName:a.actualDeptName,position:ownsTitle("position"),rank:ownsTitle("rank"),
      otherType:"",otherTitle:"",roleEndUnknown:false,timelineCurrent:false,timelineDerived:false,historyIndices:[],_deptRefs:[]};
  }
  function addArchiveRow(rows,row,index,kind,part=-1){
    const same=rows.find(r=>!r.timelineCurrent && !r.historyIndices.length && r.actualDeptName===row.actualDeptName &&
      r.start===row.start && r.end===row.end && r.position===row.position && r.rank===row.rank);
    if(same)claim(same,index,kind,part);
    else {claim(row,index,kind,part);rows.push(row);}
  }
  function archiveBounds(a,children){
    const starts=children.map(r=>r.start).filter(d=>d.slice(0,7)===a.start).sort();
    const ends=children.map(r=>r.end).filter(d=>d.slice(0,7)===a.end).sort();
    const start=isMonth(a.start)?(starts[0]||a.start+"-01"):a.start;
    let end=a.end;
    if(isMonth(end)){
      const date=new Date(end+"-01T00:00:00Z");
      date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);
      end=ends[ends.length-1]||date.toISOString().slice(0,10);
    }
    return {start,end};
  }
  function archiveGaps(a,children){
    const range=archiveBounds(a,children);
    if(!exactDay(range.start)||!exactDay(range.end)||range.end<range.start)return [gapRow(a,a.start,a.end,true,true)];
    const cuts=new Set([range.start,nextDay(range.end)]);
    for(const date of [a.positionSince,a.rankSince])if(date>range.start && date<=range.end)cuts.add(date);
    for(const c of children){
      if(c.start>range.start && c.start<=range.end)cuts.add(c.start);
      if(c.end>=range.start && c.end<range.end)cuts.add(nextDay(c.end));
    }
    const dates=[...cuts].sort(), result=[];
    for(let i=0;i+1<dates.length;i++){
      const start=dates[i],end=priorDay(dates[i+1]);
      if(children.some(r=>r.start<=start && r.end>=end))continue;
      const row=gapRow(a,start,end,dates.length===2,end===range.end);
      const last=result[result.length-1];
      if(last && nextDay(last.end)===start && last.position===row.position && last.rank===row.rank)last.end=end;
      else result.push(row);
    }
    for(const r of result){
      if(r.start===range.start)r.start=a.start;
      if(r.end===range.end)r.end=a.end;
    }
    return result;
  }
  function fillArchiveRoles(row,a){
    if(!row.actualDeptName)row.actualDeptName=a.actualDeptName;
    for(const k of roleAxes)if(!row[k] && (!a[k+"Since"] || (row.start && row.start>=a[k+"Since"])))row[k]=a[k];
  }
  function splitRoleAtAppointment(roles,r,a){
    if(!exactDay(r.start)||!exactDay(r.end))return;
    const changes=roleAxes.map(k=>!r[k] && a[k] && a[k+"Since"]).filter(d=>d>r.start && d<=r.end);
    if(!changes.length)return;
    const cuts=[...new Set([r.start,...changes])].sort();
    const parts=cuts.map((start,i)=>{
      const segment={...r,start,end:i+1<cuts.length?priorDay(cuts[i+1]):r.end,
        actualDeptName:r.actualDeptName||a.actualDeptName,_splitRole:true,_deptRefs:r._deptRefs.slice()};
      for(const k of roleAxes)if(!segment[k] && a[k] && a[k+"Since"] && start>=a[k+"Since"])segment[k]=a[k];
      return segment;
    });
    roles.splice(roles.indexOf(r),1,...parts);
  }
  function resumeTimeline(person){
    const roles=mergedRoles(person);
    const archives=(person.deptHistory||[]).map(archiveSpan);
    for(const [i,a] of archives.entries()){
      if(Array.isArray(person.deptHistory[i].resumeParts))continue;
      const range=archiveBounds(a,[]);
      for(const r of roles.slice()){
        if(r.timelineCurrent || !compatibleRoles(a,r) || r.start<range.start || r.end>range.end)continue;
        const unique=!r.actualDeptName && archiveExact(a,r) && new Set(archives.filter(d=>archiveExact(d,r)).map(d=>d.actualDeptName)).size===1;
        if(r.actualDeptName===a.actualDeptName||unique)splitRoleAtAppointment(roles,r,a);
      }
    }
    const rows=roles.slice();
    (person.deptHistory||[]).forEach((h,index)=>{
      const a=archives[index];
      if(Array.isArray(h.resumeParts)){
        const ids=new Set(h.resumeRoleRefs||[]);
        for(const r of roles)if(r.historyIndices.some(i=>ids.has(person.history[i].resumeId))){
          if(h.resumeDirect)fillArchiveRoles(r,a);
          claim(r,index,h.resumeDirect?"direct":"cover");
        }
        h.resumeParts.forEach((part,i)=>addArchiveRow(rows,{...part,historyIndices:[],_deptRefs:[]},index,"part",i));
        return;
      }
      const singlePlace=r=>r.actualDeptName===a.actualDeptName || (!r.actualDeptName &&
        new Set(archives.filter(s=>archiveExact(s,r)).map(s=>s.actualDeptName)).size===1);
      const exact=roles.filter(r=>singlePlace(r) && archiveExact(a,r));
      if(exact.length===1){
        const row=exact[0];
        fillArchiveRoles(row,a);
        claim(row,index,"direct");
        return;
      }
      const range=archiveBounds(a,[]);
      const children=exactDay(range.start)&&exactDay(range.end)?roles.filter(r=>
        !r.timelineCurrent && r.actualDeptName===a.actualDeptName && exactDay(r.start) && exactDay(r.end) &&
        r.end>=range.start && r.start<=range.end &&
        !roleAxes.some(k=>a[k] && r[k] && a[k]!==r[k] && ((sameKnownDate(r.start,a.start) && sameKnownDate(r.end,a.end)) || (a[k+"Since"] && r.end>=a[k+"Since"])))
      ):[];
      for(const r of children){
        claim(r,index,"cover");
        for(const k of roleAxes)if(!r[k] && a[k] && a[k+"Since"] && r.start>=a[k+"Since"])r[k]=a[k];
      }
      const gaps=archiveGaps(a,children);
      for(const row of gaps)addArchiveRow(rows,row,index,!children.length && gaps.length===1?"direct":"gap");
    });
    for(const r of rows){
      r.deptHistoryIndices=r._deptRefs.filter(x=>x.kind!=="cover").map(x=>x.index);
      r.coveredDeptIndices=r._deptRefs.filter(x=>x.kind==="cover").map(x=>x.index);
      r.editPrecision=r.deptHistoryIndices.length||isMonth(r.start)||isMonth(r.end)?"month":"day";
    }
    const end=r=>r.end || (!r.roleEndUnknown?"9999-12-31":r.start||"");
    return rows.sort((a,b)=>Number(b.timelineCurrent)-Number(a.timelineCurrent)||end(b).localeCompare(end(a))||b.start.localeCompare(a.start));
  }
  function resumePiece(r){
    return {start:r.start,end:r.end,actualDeptName:r.actualDeptName,position:r.position,rank:r.rank,otherType:r.otherType||"",otherTitle:r.otherTitle||"",
      roleEndUnknown:!!r.roleEndUnknown,timelineCurrent:false,timelineDerived:false};
  }
  function reservedResumeIds(person){
    const ids=new Set((person.history||[]).map(h=>h.resumeId).filter(Boolean));
    for(const d of person.deptHistory||[])for(const id of d.resumeRoleRefs||[])ids.add(id);
    return ids;
  }
  function materializeResumeSplits(person,row){
    if(!row._deptRefs.length)return row;
    const depts=new Set(row._deptRefs.map(ref=>ref.index));
    const all=resumeTimeline(person), selected=new Set();
    for(const r of all)if(r._splitRole && r._deptRefs.some(ref=>depts.has(ref.index)))for(const i of r.historyIndices)selected.add(i);
    if(!selected.size)return row;
    const ids=reservedResumeIds(person);
    let counter=0;
    for(const i of selected){
      const original=person.history[i];
      const pieces=all.filter(r=>r.historyIndices.includes(i)).sort((a,b)=>a.start.localeCompare(b.start));
      const newIds=[];
      for(const [j,part] of pieces.entries()){
        const h={...original,start:part.start,end:part.end,actualDeptName:part.actualDeptName};
        delete h.startMonth;delete h.endMonth;
        if(!part.position && !part.rank)h.autoRoleHistory=true;
        updateRoleHistory(h,part.position,part.rank);
        if(j===0){person.history[i]=h;continue;}
        if(h.resumeId){
          let id;
          do{id="r"+(++counter);}while(ids.has(id));
          h.resumeId=id;ids.add(id);newIds.push(id);
        }
        person.history.push(h);
      }
      if(newIds.length)for(const d of person.deptHistory){
        if(Array.isArray(d.resumeRoleRefs) && d.resumeRoleRefs.includes(original.resumeId))d.resumeRoleRefs.push(...newIds);
      }
    }
    const updated=resumeTimeline(person).find(r=>r.start===row.start && r.end===row.end &&
      r.actualDeptName===row.actualDeptName && r.position===row.position && r.rank===row.rank &&
      r._deptRefs.some(ref=>depts.has(ref.index)));
    if(!updated)throw Error("简历已变更，请重新打开这段经历");
    return updated;
  }
  function bindResumeSources(person,row){
    const refs=row._deptRefs.map(x=>({...x}));
    if(!refs.length)return refs;
    const all=resumeTimeline(person), existing=reservedResumeIds(person);
    let n=0;
    function idFor(i){
      const h=person.history[i];
      if(!h.resumeId){
        let key;
        do{key="r"+(++n);}while(existing.has(key));
        h.resumeId=key;existing.add(key);
      }
      return h.resumeId;
    }
    for(const ref of refs){
      const h=person.deptHistory[ref.index];
      if(Array.isArray(h.resumeParts) || (ref.kind==="direct" && !row.historyIndices.length))continue;
      h.resumeParts=[];h.resumeRoleRefs=[];h.resumeDirect=ref.kind==="direct";
      for(const source of all){
        const link=source._deptRefs.find(x=>x.index===ref.index);
        if(!link)continue;
        if(source.historyIndices.length){
          for(const i of source.historyIndices)h.resumeRoleRefs.push(idFor(i));
        }else{
          const slot=h.resumeParts.push(resumePiece(source))-1;
          if(ref.kind==="gap" && row.start===source.start && row.end===source.end && row.position===source.position && row.rank===source.rank){
            ref.kind="part";ref.part=slot;
          }
        }
      }
    }
    return refs;
  }
  function updateResumeEntry(person,row,changes){
    if(row.timelineCurrent)throw Error("请在当前任职中修改");
    const month=row.editPrecision==="month", src=date=>month?(date||"").slice(0,7):(date||"");
    const old={...resumePiece(row),start:src(row.start),end:src(row.end)};
    const v={...old,...changes};
    if([v.start,v.end].some(d=>d && !(month?isMonth(d):exactDay(d))) || (v.start && v.end && v.start>v.end))throw Error("简历起止日期有误");
    if(typeof v.actualDeptName!=="string" || typeof v.position!=="string" || typeof v.rank!=="string")throw Error("简历信息有误");
    if(row.deptHistoryIndices.length && !v.actualDeptName.trim())throw Error("请填写历史工作科室");
    if(!v.end && row.deptHistoryIndices.length)throw Error("请填写这段已结束经历的结束年月");
    if(!v.end && typeof v.roleEndUnknown!=="boolean")throw Error("结束日期有误");
    if(["start","end","actualDeptName","position","rank","roleEndUnknown"].every(k=>v[k]===old[k]))return person;
    row=materializeResumeSplits(person,row);
    const refs=bindResumeSources(person,row);
    const roleEntries=row.historyIndices.map(i=>person.history[i]);
    const hadAxis={};
    for(const k of roleAxes)hadAxis[k]=roleEntries.some(e=>roleHistoryValues(e)[k]);
    for(const [index,h] of roleEntries.entries()){
      for(const k of ["start","end"]){
        if(v[k]===old[k])continue;
        delete h[k+"Month"];
        if(month){delete h[k];if(v[k])h[k+"Month"]=v[k];}else h[k]=v[k];
      }
      if(v.end)delete h.roleEndUnknown;else if(v.roleEndUnknown)h.roleEndUnknown=true;else delete h.roleEndUnknown;
      if(v.actualDeptName!==old.actualDeptName)h.actualDeptName=v.actualDeptName;
      const roles=roleHistoryValues(h);
      for(const k of roleAxes)if(v[k]!==old[k] && (roleEntries.length===1 || roles[k] || (!index && !hadAxis[k])))roles[k]=v[k];
      if(!roles.position && !roles.rank && !roles.otherTitle && v.actualDeptName)h.autoRoleHistory=true;
      updateRoleHistory(h,roles.position,roles.rank);
    }
    for(const ref of refs){
      const d=person.deptHistory[ref.index];
      if(ref.kind==="part"){
        const part=d.resumeParts[ref.part];
        for(const k of ["start","end","actualDeptName","position","rank","roleEndUnknown"])if(v[k]!==old[k])part[k]=v[k];
      }else if(ref.kind==="direct"){
        if(v.actualDeptName!==old.actualDeptName)d.name=v.actualDeptName;
        for(const k of roleAxes)if(v[k]!==old[k])d[k]=v[k];
        if(v.start!==old.start){delete d.start;if(v.start)d.startMonth=v.start;else delete d.startMonth;}
        if(v.end!==old.end){delete d.effectiveDate;d.endMonth=v.end;}
      }
    }
    return person;
  }
  function removeResumeEntry(person,row){
    if(row.timelineCurrent)throw Error("请先在当前任职中更正");
    row=materializeResumeSplits(person,row);
    const refs=bindResumeSources(person,row), removeDepts=new Set();
    for(const ref of refs){
      if(ref.kind==="direct")removeDepts.add(ref.index);
      if(ref.kind==="part")person.deptHistory[ref.index].resumeParts.splice(ref.part,1);
    }
    if(removeDepts.size)person.deptHistory=person.deptHistory.filter((_,i)=>!removeDepts.has(i));
    const ids=new Set(row.historyIndices);
    if(ids.size)person.history=person.history.filter((_,i)=>!ids.has(i));
    return person;
  }
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
  function validHierarchy(items){
    const parents=new Map(items.map(d=>[String(d.id),String(d.parentId==null?"":d.parentId)]));
    const depths=new Map([["",0]]);
    for(const id of parents.keys()){
      const path=new Set();
      let p=id;
      while(!depths.has(p)){
        if(!parents.has(p)||path.has(p)||path.size>=65)return false;
        path.add(p);p=parents.get(p);
      }
      let depth=depths.get(p);
      if(depth+path.size>65)return false;
      for(const node of [...path].reverse())depths.set(node,++depth);
    }
    return true;
  }
  function removeLegacyUnits(data){
    const retired=new Map(data.establishmentUnits.filter(u=>u.legacy===true).map(u=>[String(u.id),u.parentId]));
    data.establishmentUnits=data.establishmentUnits.filter(u=>u.legacy!==true);
    for(const u of data.establishmentUnits){
      let parent=u.parentId;
      const seen=new Set();
      while(parent!=null && parent!=="" && retired.has(String(parent))){
        const id=String(parent);
        if(seen.has(id)){parent="";break;}
        seen.add(id);
        parent=retired.get(id);
      }
      if(seen.size)u.parentId=parent==null?"":parent;
      delete u.legacy;
      delete u.legacyQuota;
      delete u.legacyPostQuotas;
      delete u.previousItems;
    }
  }
  const ownershipFields=["establishmentDeptId","establishmentDeptName","establishmentName","establishmentSince","establishmentStart","establishmentEffectiveDate","establishmentDate","establishmentChanged"];
  function removeOwnership(record){
    for(const field of ownershipFields)delete record[field];
  }
  function cleanPerson(p){
    removeOwnership(p);
    if(Array.isArray(p.history)){
      for(const entry of p.history)if(entry && typeof entry==="object")removeOwnership(entry);
    }
    if(Array.isArray(p.deptHistory)){
      p.deptHistory=p.deptHistory.filter(h=>!h || h.actualChanged!==false);
      for(const h of p.deptHistory){
        if(!h || typeof h!=="object")continue;
        if(h.actualEffectiveDate)h.effectiveDate=h.actualEffectiveDate;
        else if(has(h,"actualEffectiveDate") && h.establishmentEffectiveDate && h.effectiveDate===h.establishmentEffectiveDate)delete h.effectiveDate;
        removeOwnership(h);
        delete h.actualChanged;
        delete h.actualEffectiveDate;
      }
    }
  }
  function validate(data){
    const bad = () => {throw Error("备份格式或数据关联有误");};
    if(!data || !["people","depts","policies"].every(k=>Array.isArray(data[k]))) bad();
    const separateCatalogs=has(data,"establishmentUnits");
    if(has(data,"quotaCatalogVersion") && data.quotaCatalogVersion!==quotaCatalogVersion)bad();
    if(separateCatalogs && !Array.isArray(data.establishmentUnits))bad();
    const lists=[data.people,data.depts,data.policies];
    if(separateCatalogs)lists.push(data.establishmentUnits);
    for(const list of lists){
      if(!list.every(x=>x && typeof x==="object" && idOK(x.id))||new Set(list.map(x=>String(x.id))).size!==list.length) bad();
    }
    const actualIds=new Set(data.depts.map(d=>String(d.id)));
    for(const d of data.depts){
      if(typeof d.name!=="string"||!d.name.trim()||!flat(d,["parentId"]))bad();
      if(!separateCatalogs && d.quota!=null && !quotaValue(d.quota))bad();
      if(!separateCatalogs && d.postQuotas!=null && !validPostQuotas(d.postQuotas))bad();
    }
    if(!validHierarchy(data.depts))bad();
    if(separateCatalogs){
      removeLegacyUnits(data);
      for(const unit of data.establishmentUnits){
        if(typeof unit.name!=="string" || !unit.name.trim() || !flat(unit,["parentId"]))bad();
        if(!["civil","reference","institution"].includes(unit.categoryGroup))bad();
        if(["quota","chiefQuota","deputyQuota"].some(k=>unit[k]!=null && !quotaValue(unit[k])))bad();
      }
      if(!validHierarchy(data.establishmentUnits))bad();
    }
    for(const p of data.people){
      cleanPerson(p);
      if(typeof p.name!=="string"||!p.name.trim()||!flat(p,["gender","birth","age","ageAsOf","education","category","position","rank","deptSince","rankSince","positionSince"]))bad();
      if(p.deptId==="" ? !!p.deptSince : !idOK(p.deptId)||!actualIds.has(String(p.deptId)))bad();
      if(p.deptHistory!=null&&(!Array.isArray(p.deptHistory)||!p.deptHistory.every(h=>
        h && typeof h.name==="string" && h.name.trim() && isDate(h.start) && !!h.end && isDate(h.end) &&
        ["effectiveDate","positionSince","rankSince"].every(k=>isDate(h[k])) &&
        ["position","rank"].every(k=>h[k]==null||typeof h[k]==="string") &&
        (!h.effectiveDate || (h.effectiveDate<=h.end && (!h.start || h.effectiveDate>=h.start))) &&
        validHistoryMonths(h) && validResumeLinks(h)
      )))bad();
      if(["gender","education","category","rank","position"].some(k=>p[k]!=null&&typeof p[k]!=="string"))bad();
      if(has(p,"rankSeparate") && typeof p.rankSeparate!=="boolean")bad();
      if(!isMonth(p.birth)&&!isDate(p.birth))bad();
      if(!isDate(p.roleTimelineSince))bad();
      if(["ageAsOf","deptSince","rankSince","positionSince"].some(k=>!isDate(p[k])))bad();
      if(p.age!=null&&p.age!==""&&(!Number.isInteger(Number(p.age))||+p.age<0||+p.age>130))bad();
      if(p.history!=null && (!Array.isArray(p.history)||!p.history.every(validRoleEntry)))bad();
    }
    if(typeof window.validatePolicies==="function"&&!window.validatePolicies(data.policies))bad();
    if(has(data,"unitPostQuotas")){
      if(!validPostQuotas(data.unitPostQuotas))bad();
    }else{
      data.unitPostQuotas=separateCatalogs?{}:migrateUnitQuotas(data.depts);
    }
    for(const p of data.people){
      if(p.birth)p.birth=p.birth.slice(0,7);
      if(p.rankSeparate===true && isDoctoralEducation(p.education))p.rankSeparate=false;
    }
    if(!separateCatalogs)migrateCatalogs(data);
    if(!separateCatalogs || data.quotaCatalogVersion!==quotaCatalogVersion)mergeReferenceQuotas(data);
    for(const d of data.depts){
      delete d.quota;
      delete d.postQuotas;
    }
    return data;
  }
  function persistUpgrade(previous,updated){
    if(localStorage.getItem(key)===previous)localStorage.setItem(key,updated);
  }
  let state=initial(), unreadable=false;
  try{
    const stored=localStorage.getItem(key);
    if(stored){
      const parsed=JSON.parse(stored);
      const before=JSON.stringify(parsed);
      state=validate(parsed);
      const updated=JSON.stringify(state);
      if(updated!==before){
        try{persistUpgrade(stored,updated);}
        catch(error){
          if(typeof document!=="undefined")setTimeout(()=>notify("本次升级未能保存到本机，原台账已保留。请检查可用空间后重新打开。"),0);
        }
      }
    }
  }
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
    rememberDept:(person,previous=person,effectiveDate="")=>{
      const entry={
        name:HR.deptName(previous.deptId),start:previous.deptSince||"",end:today(),
        position:previous.position||"",positionSince:previous.positionSince||"",rank:previous.rank||"",rankSince:previous.rankSince||""
      };
      if(effectiveDate)entry.effectiveDate=effectiveDate;
      person.deptHistory=(person.deptHistory||[]).concat(entry);
    },
    age:(p,date=today())=>{
      if(!p.birth)return p.age==null||p.age===""?null:Number(p.age);
      const when=typeof date==="string"?date:iso(date);
      const n=Number(when.slice(0,4))-Number(p.birth.slice(0,4))-(when.slice(5,7)<p.birth.slice(5,7)?1:0);
      return Number.isFinite(n)&&n>=0?n:null;
    },isUnreadable:()=>unreadable, raw:()=>localStorage.getItem(key)};
  Object.assign(HR,{jobTitles,jobChoices,roleHistoryValues,updateRoleHistory,roleTimeline,resumeTimeline,updateResumeEntry,removeResumeEntry,syncRoleHistory,isMonth,historyMonths,updateHistoryMonths,quotaGroups,staffGroup,isDoctoralEducation,separateRankEligible,separateRank,unitTarget,clearUnitTargetOverride});
})();
