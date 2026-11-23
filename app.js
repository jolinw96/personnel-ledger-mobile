(() => {
  "use strict";
  const H=window.HR, e=H.esc, icon=H.icon, main=H.container();
  const navItems=[["overview","结构总览"],["people","人员台账"],["org","组织架构"],["policy","晋升测算"]];
  const attrs={gender:"性别",education:"学历",category:"人员类别",rank:"职级",position:"职务",ageBand:"年龄段"};
  const bands=["30岁以下","30–39岁","40–49岁","50–59岁","60岁及以上"];
  const chartAttrs={category:"人员类别",education:"学历",gender:"性别",ageBand:"年龄段"};
  let page="overview", chart="category", staffTab="departments", ratio={attr:"gender",value:"女",threshold:100}, orgOpen=new Set();
  const click=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
  const option=(value,label,selected)=>'<option value="'+e(value)+'" '+(String(value)===String(selected)?"selected":"")+'>'+e(label)+'</option>';
  const backTitle=name=>'<div class="heading"><h1>'+e(name)+'</h1><button id="local-back" class="secondary">返回</button></div>';
  function top(){window.scrollTo(0,0);}
  function val(p,attr){
    if(attr==="ageBand"){
      const n=H.age(p);return n===null||!Number.isFinite(n)?"":bands[n<30?0:n<40?1:n<50?2:n<60?3:4];
    }
    return p[attr]||"";
  }
  function allowNavigation(){
    const form=main.querySelector("form[data-changed]");
    return !form || confirm("有尚未保存的修改。放弃修改并切换页面？");
  }
  function markChanged(ev){
    const form=ev.target.closest("form");
    if(form)form.dataset.changed="1";
  }
  main.addEventListener("input",markChanged);
  main.addEventListener("change",markChanged);
  main.addEventListener("click",ev=>{
    if(ev.target.closest("#pol-parse,#pe-add-history,[data-remove]"))markChanged(ev);
  },true);
  function go(next){
    H.subBack=null;page=next;render();top();
  }
  function chrome(){
    document.getElementById("nav").innerHTML=navItems.map(([id,name])=>'<button data-page="'+id+'" '+(id===page||(id==="overview"&&page==="ratio")?'class="active" aria-current="page"':'')+'><i>'+icon(id)+'</i>'+name+'</button>').join("");
    document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>{if(allowNavigation())go(b.dataset.page);});
    document.getElementById("storage").classList.toggle("active",page==="storage");
  }
  function render(){
    H.subBack=null;chrome();
    if(page==="overview")overview();
    else if(page==="ratio")showRatio();
    else if(page==="org")org();
    else if(page==="people")window.renderPeople();
    else if(page==="policy")window.renderPolicy();
    else storage();
  }
  function staffingStats(){
    const rows=H.state.depts.map(dept=>({dept,work:0,staffed:0,posts:new Map()}));
    const byDept=new Map(rows.map(row=>[String(row.dept.id),row]));
    const unverifiedPosts=new Map();
    let noWork=0, unverified=0, unassigned=0;
    for(const person of H.state.people){
      const workplace=byDept.get(String(person.deptId));
      if(workplace)workplace.work++;else noWork++;
      const category=H.staffGroup(person);
      if(!category)continue;
      const owner=person.establishmentDeptId==null?null:byDept.get(String(person.establishmentDeptId));
      if(owner)owner.staffed++;
      else if(person.establishmentDeptId==null)unverified++;
      else {unassigned++;continue;}
      const counts=owner?owner.posts:unverifiedPosts;
      for(const slot of H.quotaGroups.positions){
        if(category===slot.group && person.position===slot.title)counts.set(slot.key,(counts.get(slot.key)||0)+1);
      }
      if(category==="civil" || category==="reference"){
        for(const slot of H.quotaGroups.ranks){
          if(slot.titles.includes(person.rank))counts.set(slot.key,(counts.get(slot.key)||0)+1);
        }
      }
    }
    return {rows,noWork,unverified,unassigned,unverifiedPosts};
  }
  function staffingTable(stats){
    const {rows,noWork,unverified,unassigned}=stats;
    const people=H.state.people.length;
    const share=count=>people?(100*count/people).toFixed(1)+"%":"—";
    const headcount=count=>count+'<small>'+share(count)+'</small>';
    const gap=value=>value===null?"—":value<0?value+'<small class="staff-over">超编</small>':String(value);
    const missing=rows.filter(({dept})=>dept.quota==null).length;
    const quotaSum=rows.reduce((sum,{dept})=>sum+(dept.quota||0),0);
    const quotaTotal=missing||!Number.isSafeInteger(quotaSum)?null:quotaSum;
    const staffedTotal=rows.reduce((sum,row)=>sum+row.staffed,0);
    const body=rows.map(({dept,work,staffed})=>{
      const quota=dept.quota==null?null:dept.quota;
      return '<tr data-staff-row="'+e(dept.id)+'"><th scope="row">'+e(dept.name)+'</th><td>'+headcount(work)+'</td><td><button class="staff-edit" data-staff-edit="'+e(dept.id)+'" aria-label="编辑'+e(dept.name)+'的编制和岗位名额">'+(quota===null?"未设置":quota)+'</button></td><td>'+staffed+'</td><td>'+gap(quota===null?null:quota-staffed)+'</td></tr>';
    }).join("");
    const note='<p class="hint staff-note">空编 = 编制数 − 编制实有。按编制所在科室统计公务员、参公和事业编制人员，借调人员不占编。点编制数可设置名额。</p>';
    const table=rows.length?'<table class="staff-table"><thead><tr><th scope="col">科室</th><th scope="col">实际工作人数</th><th scope="col">编制数</th><th scope="col">编制实有</th><th scope="col">'+(unverified?"暂算空编":"空编")+'</th></tr></thead><tbody>'+body+'</tbody><tfoot><tr><th scope="row">科室合计</th><td>'+headcount(people-noWork)+'</td><td>'+(quotaTotal===null?"—":quotaTotal)+'</td><td>'+staffedTotal+'</td><td>'+gap(quotaTotal===null?null:quotaTotal-staffedTotal)+'</td></tr></tfoot></table>':'<div class="empty">请先在组织架构中添加科室。</div>';
    const statuses=[];
    if(unverified)statuses.push(unverified+' 名在编人员的编制科室待核实，当前空编为暂算数。');
    if(unassigned)statuses.push(unassigned+' 名在编人员尚未分配编制科室。');
    if(missing)statuses.push(missing+' 个科室尚未设置编制数，补全后显示合计空编。');
    if(noWork)statuses.push('未分配实际工作科室 '+noWork+' 人（'+share(noWork)+'）。');
    return note+table+statuses.map(text=>'<p class="hint staff-note">'+text+'</p>').join("");
  }
  function vacancyCard(slot,stats){
    const entries=stats.rows.map(({dept,posts})=>{
      const quota=dept.postQuotas && dept.postQuotas[slot.key];
      const actual=posts.get(slot.key)||0;
      return {dept,quota,actual,gap:quota==null?null:quota-actual};
    });
    const known=entries.filter(row=>row.gap!==null);
    const vacancies=known.reduce((sum,row)=>sum+Math.max(0,row.gap),0);
    const pending=stats.unverifiedPosts.get(slot.key)||0;
    const missing=entries.length-known.length;
    entries.sort((a,b)=>{
      if(a.gap===null)return b.gap===null?0:1;
      if(b.gap===null)return -1;
      return b.gap-a.gap;
    });
    const rows=entries.map(({dept,quota,actual,gap})=>{
      const vacancy=gap===null?"—":gap<0?'<span class="post-over">超配 '+(-gap)+'</span>':String(gap);
      const quotaLabel=quota==null?"未设置":quota;
      return '<tr data-vacancy-dept="'+e(dept.id)+'"><th scope="row">'+e(dept.name)+'</th><td><button class="staff-edit" data-staff-edit="'+e(dept.id)+'" data-post-key="'+e(slot.key)+'" aria-label="设置'+e(dept.name)+e(slot.label)+'名额">'+quotaLabel+'</button></td><td>'+actual+'</td><td>'+vacancy+'</td></tr>';
    }).join("");
    const count=known.length&&Number.isSafeInteger(vacancies)?String(vacancies):"—";
    const scope=known.length===0?"名额待设置":missing?'已设 '+known.length+' / '+entries.length+' 个科室':"";
    return '<details class="vacancy-card" data-vacancy="'+e(slot.key)+'"><summary><span class="post-name">'+e(slot.label)+'</span><span class="post-total"><b data-vacant-total>'+count+'</b>'+(known.length?' 个'+(pending?' · 暂算':''):'')+(scope?'<small>'+scope+'</small>':'')+'</span></summary>'+
      '<div class="post-body">'+(pending?'<p class="hint staff-note">有 '+pending+' 名符合该岗位的人员待核实编制科室。</p>':'')+
      '<table class="staff-table post-table"><thead><tr><th scope="col">科室</th><th scope="col">核定名额</th><th scope="col">编制实有</th><th scope="col">空缺</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
  }
  function vacancyBoard(stats){
    if(!stats.rows.length)return '<div class="empty">请先在组织架构中添加科室和岗位名额。</div>';
    function section(title,slots){
      return '<section class="post-section"><h3>'+title+'</h3>'+slots.map(s=>vacancyCard(s,stats)).join("")+'</section>';
    }
    return '<p class="hint staff-note">点击岗位展开科室明细，可修改核定名额。空缺汇总各科室的正缺口，超配另列。未设置名额的科室暂不计入。</p>'+
      section("职务空编",H.quotaGroups.positions)+section("职级空编",H.quotaGroups.ranks);
  }
  function establishmentPanel(){
    const stats=staffingStats();
    return '<section class="panel" id="establishment-panel" aria-labelledby="staff-heading"><div class="panel-head"><h2 id="staff-heading">编制分布</h2></div><div class="switches">'+
      [["departments","科室"],["vacancies","空编情况"]].map(([id,name])=>'<button data-staff-tab="'+id+'" aria-pressed="'+(staffTab===id)+'" class="chip">'+name+'</button>').join("")+
      '</div>'+(staffTab==="departments"?staffingTable(stats):vacancyBoard(stats))+'</section>';
  }
  function overview(){
    const people=H.state.people, n=people.length, ages=people.map(p=>H.age(p)).filter(a=>a!==null&&Number.isFinite(a));
    const hist=new Map();
    people.forEach(p=>{const k=val(p,chart)||"未登记";hist.set(k,(hist.get(k)||0)+1);});
    const rows=[...hist].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"zh-CN"));
    main.innerHTML='<div class="heading"><div><h1>人员结构</h1><div class="date">'+new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})+'</div></div><button class="primary" id="add">'+icon("plus",17)+'录入人员</button></div>'+
      '<section class="ledger"><div class="ledger-top"><div><div class="ledger-label">台账总人数</div><div class="ledger-number">'+n+'<small>人</small></div></div><i class="seal">'+icon("people")+'</i></div><div class="ledger-facts"><div><strong>'+H.state.depts.length+'</strong><span>登记科室</span></div><div><strong>'+(ages.length?(ages.reduce((a,b)=>a+b,0)/ages.length).toFixed(1):"—")+'</strong><span>平均年龄</span></div><div><strong>'+people.filter(p=>["硕士","博士","硕士研究生","博士研究生"].includes(p.education)).length+'</strong><span>硕士及以上</span></div></div></section>'+
      '<button class="quick" id="ratio"><i>'+icon("filter")+'</i><span><strong>科室占比筛选</strong><small>按人员属性和占比查找实际工作科室</small></span><span class="arrow">›</span></button>'+
      '<section class="panel"><div class="panel-head"><h2>人员分布</h2><span class="small">人数 / 占比</span></div><div class="switches">'+Object.entries(chartAttrs).map(([k,l])=>'<button data-chart="'+k+'" class="chip" aria-pressed="'+(chart===k)+'">'+l+'</button>').join("")+'</div>'+
      (n?rows.map(([l,num])=>'<div class="barrow"><span>'+e(l)+'</span><div class="track"><div class="fill" style="width:'+num/n*100+'%"></div></div><b>'+num+' / '+(num*100/n).toFixed(1)+'%</b></div>').join(""):'<div class="empty">录入第一名人员后，可在这里查看结构分布。</div>')+'</section>'+establishmentPanel();
    click("add",()=>{go("people");window.openPerson(null,()=>go("overview"));top();});
    click("ratio",()=>go("ratio"));
    main.querySelectorAll("[data-chart]").forEach(b=>b.onclick=()=>{chart=b.dataset.chart;overview();});
    main.querySelectorAll("[data-staff-tab]").forEach(b=>b.onclick=()=>{staffTab=b.dataset.staffTab;overview();main.querySelector("[data-staff-tab="+staffTab+"]").focus({preventScroll:true});});
    main.querySelectorAll("[data-staff-edit]").forEach(b=>b.onclick=()=>deptForm(b.dataset.staffEdit,"overview",b.dataset.postKey));
  }
  function attrValues(attr){
    const defaults={gender:["女","男"],education:["博士研究生","硕士研究生","本科","大专","其他"],category:["公务员（行政编）","参公事业编","事业编制","合同制聘用","劳务派遣","借调人员","退休人员"],ageBand:bands};
    return [...new Set([...(defaults[attr]||[]),...H.state.people.map(p=>val(p,attr)).filter(Boolean)])];
  }
  function showRatio(){
    const values=attrValues(ratio.attr);
    if(!values.includes(ratio.value))ratio.value=values[0]||"";
    main.innerHTML=backTitle("科室占比筛选")+'<section class="panel"><div class="panel-head"><h2>筛选条件</h2><button id="only-women" class="chip">全员女性</button></div><div class="fields"><label>人员属性<select id="r-attr">'+Object.entries(attrs).map(([k,l])=>option(k,l,ratio.attr)).join("")+'</select></label><label>属性值<select id="r-val">'+(values.length?values.map(v=>option(v,v,ratio.value)).join(""):"<option>暂无登记值</option>")+'</select></label><label class="wide">占比至少（%）<input id="r-threshold" type="number" inputmode="decimal" min="0" max="100" step="any" value="'+e(ratio.threshold)+'"></label></div><p class="hint" style="margin-top:12px">以实际工作科室的直属人员总数为分母，包含属性未登记的人员。空科室不参与筛选。</p></section><section class="panel" id="ratio-result" aria-live="polite"></section>';
    H.subBack=()=>go("overview");click("local-back",H.subBack);
    click("only-women",()=>{ratio={attr:"gender",value:"女",threshold:100};showRatio();});
    const a=document.getElementById("r-attr"),v=document.getElementById("r-val"),t=document.getElementById("r-threshold");
    a.onchange=()=>{ratio.attr=a.value;ratio.value="";showRatio();};
    v.onchange=()=>{ratio.value=v.value;draw();};t.oninput=()=>{ratio.threshold=t.value;draw();};
    function draw(){
      const box=document.getElementById("ratio-result"),threshold=Number(ratio.threshold);
      if(t.value===""||!Number.isFinite(threshold)||threshold<0||threshold>100){box.innerHTML='<p class="hint">请输入 0 到 100 之间的阈值。</p>';return;}
      const stats=new Map();
      H.state.people.forEach(p=>{if(p.deptId==="")return;const id=String(p.deptId);if(!stats.has(id))stats.set(id,{id,n:0,hit:0});let g=stats.get(id);g.n++;if(ratio.value&&val(p,ratio.attr)===ratio.value)g.hit++;});
      const rows=[...stats.values()].filter(g=>ratio.value&&100*g.hit>=threshold*g.n).sort((a,b)=>b.hit/b.n-a.hit/a.n||b.hit-a.hit);
      box.innerHTML='<div class="panel-head"><h2>匹配科室</h2><span class="small">'+rows.length+' 个</span></div>'+ (rows.map(g=>'<div class="result"><div class="row-spread"><strong>'+e(H.deptName(g.id))+'</strong><b>'+(g.hit*100/g.n).toFixed(1)+'%</b></div><div class="ratio-track"><div class="fill" style="width:'+g.hit/g.n*100+'%"></div></div><div class="row-spread"><small>'+e(ratio.value)+' '+g.hit+' 人 / 直属 '+g.n+' 人</small><button class="txt" data-dept="'+e(g.id)+'">查看成员 ›</button></div></div>').join("")||'<div class="empty">没有科室达到当前条件。</div>');
      box.querySelectorAll("[data-dept]").forEach(b=>b.onclick=()=>{orgBasis="actual";orgOpen=new Set([String(b.dataset.dept)]);let d=H.state.depts.find(d=>String(d.id)===b.dataset.dept);while(d&&d.parentId){orgOpen.add(String(d.parentId));d=H.state.depts.find(x=>String(x.id)===String(d.parentId));}go("org");const dst=main.querySelector('[data-org="'+b.dataset.dept+'"]');if(dst)dst.scrollIntoView({block:"center"});});
    }
    draw();
  }
  let orgBasis="actual";
  function org(){
    const children=new Map(),members=new Map(),byEstablishment=orgBasis==="establishment";
    function group(map,k,x){const key=String(k==null?"":k);if(!map.has(key))map.set(key,[]);map.get(key).push(x);}
    H.state.depts.forEach(d=>group(children,d.parentId,d));
    H.state.people.forEach(p=>group(members,byEstablishment?(p.establishmentDeptId==null?":pending":p.establishmentDeptId):p.deptId,p));
    const memberButtons=people=>people.map(p=>'<button class="member" data-person="'+e(p.id)+'"><b>'+e(p.name)+'</b><small>'+e(p.position||p.category||"")+' ›</small></button>').join("");
    const branch=d=>{
      const id=String(d.id), ps=members.get(id)||[], ds=children.get(id)||[];
      return '<details class="dept-row" data-org="'+e(id)+'" '+(orgOpen.has(id)?"open":"")+'><summary><b>'+e(d.name)+'</b><span>'+ps.length+' 人</span></summary><div class="dept-body">'+
        '<button class="txt" data-edit="'+e(id)+'">编辑科室</button>'+(ps.length?memberButtons(ps):'<p class="hint">暂无直属人员</p>')+ds.map(branch).join("")+'</div></details>';
    };
    const basisButtons=[["actual","实际工作科室"],["establishment","编制所在科室"]].map(([key,label])=>'<button class="chip" data-org-basis="'+key+'" aria-pressed="'+(orgBasis===key)+'">'+label+'</button>').join("");
    main.innerHTML='<div class="heading"><h1>组织架构</h1><button class="primary" id="new-dept">'+icon("plus",17)+'新增科室</button></div><section class="panel"><div class="org-root"><i>'+icon("org")+'</i>局机关（本级）</div><div class="switches" aria-label="成员显示口径">'+basisButtons+'</div><p class="hint" style="margin-bottom:10px">按'+(byEstablishment?"编制归属":"实际工作归属")+'列出人员。展开科室可查看成员或编辑科室。</p>'+(children.get("")||[]).map(branch).join("")+'</section>';
    for(const [key,id,label] of [["",":unassigned",byEstablishment?"未分配编制科室":"未分配实际科室"],[":pending",":pending","编制科室待核实"]]){
      const list=members.get(key)||[];
      if(list.length)main.insertAdjacentHTML("beforeend",'<section class="panel"><details data-org="'+id+'" '+(orgOpen.has(id)?'open':'')+'><summary><strong>'+label+'</strong> · '+list.length+' 人</summary>'+memberButtons(list)+'</details></section>');
    }
    main.querySelectorAll("[data-org-basis]").forEach(b=>b.onclick=()=>{orgBasis=b.dataset.orgBasis;org();});
    click("new-dept",()=>deptForm());
    main.querySelectorAll("details").forEach(el=>el.ontoggle=()=>{if(!el.isConnected)return;if(el.open)orgOpen.add(el.dataset.org);else orgOpen.delete(el.dataset.org);});
    main.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>deptForm(b.dataset.edit));
    main.querySelectorAll("[data-person]").forEach(b=>b.onclick=()=>{window.showPerson(b.dataset.person,()=>go("org"));top();});
  }
  function quotaFields(dept,title,slots){
    const fields=slots.map(slot=>{
      const n=dept && dept.postQuotas && dept.postQuotas[slot.key];
      return '<label>'+e(slot.label)+'<input type="number" min="0" step="1" inputmode="numeric" data-quota-key="'+e(slot.key)+'" value="'+(n==null?'':e(n))+'" placeholder="未设置"></label>';
    }).join("");
    return '<fieldset class="quota-fields"><legend>'+title+'</legend><div class="fields">'+fields+'</div></fieldset>';
  }
  function deptForm(id,returnPage="org",postKey){
    const d=H.state.depts.find(x=>String(x.id)===String(id)), title=d?"编辑科室":"新增科室";
    const invalid=new Set(d?[String(d.id)]:[]);
    function blocked(x){let n=x;while(n){if(invalid.has(String(n.id)))return true;n=n.parentId&&H.state.depts.find(z=>String(z.id)===String(n.parentId));}return false;}
    main.innerHTML=backTitle(title)+'<form class="panel" id="dept-form"><div class="fields"><label class="wide">科室名称<input id="d-name" required maxlength="80" value="'+e(d?d.name:"")+'"></label><label class="wide">上级机构<select id="d-parent">'+option("","局机关（本级）",d&&d.parentId)+H.state.depts.filter(x=>!blocked(x)).map(x=>option(x.id,x.name,d&&d.parentId)).join("")+'</select></label><label class="wide">科室编制总数<input id="d-quota" type="number" min="0" step="1" inputmode="numeric" placeholder="未设置" value="'+e(d&&d.quota!=null?d.quota:"")+'"></label></div>'+
      '<p class="hint staff-note">核定名额可留空。没有名额请填 0。</p>'+quotaFields(d,"职务核定名额",H.quotaGroups.positions)+quotaFields(d,"职级核定名额",H.quotaGroups.ranks)+
      '<div class="action-row"><button class="primary" type="submit">保存科室</button>'+(d?'<button type="button" id="delete-dept" class="plain-btn danger">删除科室</button>':'')+'</div></form>';
    const quotaInput=document.getElementById("d-quota");
    H.subBack=()=>{if(allowNavigation())go(returnPage);};click("local-back",H.subBack);top();
    const postInputs=[...main.querySelectorAll("[data-quota-key]")];
    if(postKey){
      const focusInput=postInputs.find(input=>input.dataset.quotaKey===postKey);
      if(focusInput){focusInput.focus({preventScroll:true});focusInput.scrollIntoView({block:"center"});}
    }
    document.getElementById("dept-form").onsubmit=ev=>{
      ev.preventDefault();const name=document.getElementById("d-name").value.trim(),parentId=document.getElementById("d-parent").value;
      if(!name||H.state.depts.some(x=>x!==d&&x.name===name)){H.notify("请填写不重复的科室名称");return;}
      const quota=quotaInput.value===""?null:Number(quotaInput.value);
      if(quota!==null&&(!Number.isSafeInteger(quota)||quota<0)){H.notify("编制数须为非负整数");return;}
      const postQuotas={...(d && d.postQuotas)};
      for(const input of postInputs){
        const key=input.dataset.quotaKey;
        if(input.value===""){delete postQuotas[key];continue;}
        const n=Number(input.value);
        if(!Number.isSafeInteger(n)||n<0){H.notify("核定名额须为非负整数");input.focus();return;}
        postQuotas[key]=n;
      }
      if(d)Object.assign(d,{name,parentId,quota,postQuotas});else H.state.depts.push({id:"d"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,parentId,quota,postQuotas});
      if(!H.save()){go(returnPage);return;}H.notify("科室已保存");go(returnPage);
    };
    click("delete-dept",()=>{
      const affected=H.state.people.filter(p=>String(p.deptId)===String(d.id)||String(p.establishmentDeptId)===String(d.id));
      const children=H.state.depts.filter(x=>String(x.parentId)===String(d.id));
      const parentId=d.parentId==null?"":d.parentId;
      const message=["删除科室「"+d.name+"」？"];
      if(affected.length)message.push("将清除 "+affected.length+" 人与本科室的对应归属，并将原归属保存到过往经历。其他科室归属继续保留。");
      if(children.length)message.push(children.length+" 个直属子科室将移到「"+(parentId===""?"局机关（本级）":H.deptName(parentId))+"」下，成员仍属各自科室。");
      if(!confirm(message.join("\n")))return;
      for(const p of affected){
        const actual=String(p.deptId)===String(d.id),establishment=String(p.establishmentDeptId)===String(d.id);
        H.rememberDept(p,p,"",{actual,establishment});
        if(actual){p.deptId="";p.deptSince="";}
        if(establishment){p.establishmentDeptId="";p.establishmentSince="";}
      }
      children.forEach(x=>{x.parentId=parentId;});
      H.state.depts=H.state.depts.filter(x=>x!==d);
      if(H.save()){
        orgOpen.delete(String(d.id));
        if(affected.length)orgOpen.add(":unassigned");
        H.notify(affected.length?"科室已删除，"+affected.length+" 人的归属已更新":"科室已删除");
      }
      go(returnPage);
    });
  }
  function storage(){
    main.innerHTML=backTitle("本机数据")+'<section class="panel"><h2>台账备份</h2><p class="hint">备份包含所有科室、人员档案和晋升规则。请将文件保存在可信的本地位置。建议将备份存入“文件”里的“我的 iPhone”。删除主屏幕应用或清除网站数据前，请先导出备份。</p><div class="action-row"><button class="primary" id="export">导出备份</button><button class="secondary" id="import">从备份恢复</button></div></section>';
    H.subBack=()=>go("overview");click("local-back",H.subBack);
    click("export",()=>{
      if(!window.LocalFiles){H.notify("无法打开文件下载，请重新打开应用");return;}
      const out=H.isUnreadable()?H.raw():JSON.stringify({format:"hr-local-ledger",version:3,exportedAt:new Date().toISOString(),data:H.state});
      window.LocalFiles.exportBackup(out);
    });
    click("import",()=>{
      if(!window.LocalFiles){H.notify("无法打开文件选择器，请重新打开应用");return;}window.LocalFiles.importBackup();
    });
    if(H.isUnreadable())main.insertAdjacentHTML("afterbegin",'<p class="panel">原台账读取失败。可先导出原始数据，再选择可用备份恢复。</p>');
  }
  window.onBackupStatus=msg=>H.notify(String(msg));
  window.onBackupFile=text=>{
    try{
      const file=JSON.parse(text);
      if(!file||file.format!=="hr-local-ledger"||![1,2,3].includes(file.version))throw Error("请选择本应用导出的第 1、2 或 3 版 JSON 备份");
      H.validate(file.data);
      const d=file.data;
      if(confirm("用备份中的 "+d.people.length+" 人、"+d.depts.length+" 个科室、"+d.policies.length+" 条规则替换当前台账？")){H.restore(d);orgOpen.clear();go("overview");H.notify("台账已恢复");}
    }catch(err){H.notify("恢复失败，原数据已保留。"+(err instanceof SyntaxError?"文件内容有误":err.message));}
  };
  window.handleAndroidBack=()=>{if(typeof H.subBack==="function"){H.subBack();return true;}if(page!=="overview"){go("overview");return true;}return false;};
  document.querySelectorAll("i[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));
  H.go=go;H.render=render;
  click("storage",()=>{if(allowNavigation())go("storage");});
  go(H.isUnreadable()?"storage":"overview");
})();
