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
  const categoryLabels={civil:"公务员",reference:"参公编制",institution:"事业编制"};
  function staffingTable(){
    const units=H.state.establishmentUnits;
    const actual={civil:0,reference:0,institution:0};
    for(const person of H.state.people){
      const group=H.staffGroup(person);
      if(group)actual[group]++;
    }
    function quota(items){
      const total=items.reduce((sum,unit)=>sum+(unit.quota||0),0);
      return items.every(unit=>unit.quota!=null)&&Number.isSafeInteger(total)?total:null;
    }
    const gap=(target,count)=>target==null?"—":target<count?'<span class="post-over">超编 '+(count-target)+'</span>':String(target-count);
    const rows=Object.entries(categoryLabels).map(([group,name])=>{
      const items=units.filter(u=>u.categoryGroup===group), target=quota(items);
      const amount=target==null?"未设置":String(target);
      const quotaCell=group==="reference"?'<button class="staff-edit" type="button" id="reference-quota" data-single="'+(items.length===1?e(items[0].id):'')+'" aria-label="'+(items.length===1?'编辑参公编制指标':'查看参公编制指标明细')+'">'+amount+'</button>':amount;
      return '<tr data-category-subtotal="'+group+'"><th scope="row">'+name+'</th><td>'+quotaCell+'</td><td>'+actual[group]+'</td><td>'+gap(target,actual[group])+'</td></tr>';
    }).join("");
    const target=quota(units), count=Object.values(actual).reduce((sum,n)=>sum+n,0);
    function detailRows(items){
      if(!items.length)return "";
      const body=items.map(u=>'<tr data-quota-detail="'+e(u.id)+'"><th scope="row"><button class="txt quota-name" data-staff-edit="'+e(u.id)+'">'+e(u.name)+' ›</button></th><td>'+(u.quota??"—")+'</td><td>'+(u.chiefQuota??"—")+'</td><td>'+(u.deputyQuota??"—")+'</td></tr>').join("");
      return '<table class="staff-table detail-table"><thead><tr><th scope="col">指标项目</th><th scope="col">编制数</th><th scope="col">科长</th><th scope="col">副科长</th></tr></thead><tbody>'+body+'</tbody></table>';
    }
    const details=Object.entries(categoryLabels).map(([group,name])=>{
      const items=units.filter(u=>u.categoryGroup===group);
      return '<h4'+(group==="reference"?' id="reference-detail-heading" tabindex="-1"':'')+'>'+name+'</h4>'+(detailRows(items)||'<p class="hint">尚无核定指标。</p>');
    }).join("");
    return '<p class="hint staff-note">空编 = 核定编制数 − 同类别实有在编人数。借调人员不占编。</p>'+
      '<table class="staff-table unit-table"><thead><tr><th scope="col">人员类别</th><th scope="col">核定编制</th><th scope="col">实有在编</th><th scope="col">空编</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr data-workforce-total><th scope="row">全单位合计</th><td>'+(target==null?"—":target)+'</td><td>'+count+'</td><td>'+gap(target,count)+'</td></tr></tfoot></table>'+
      '<details class="quota-details" id="quota-details"><summary>核定指标明细</summary>'+details+
      '<button type="button" id="add-quota-detail" class="secondary">新增指标项目</button></details>';
  }
  function vacancyBoard(){
    const counts=new Map();
    for(const person of H.state.people){
      const group=H.staffGroup(person);
      if(group!=="civil" && group!=="reference")continue;
      const position=H.quotaGroups.positions.find(slot=>slot.group===group && slot.title===person.position);
      const rank=H.quotaGroups.ranks.find(slot=>slot.titles.includes(person.rank));
      for(const slot of [position,rank]){
        if(slot)counts.set(slot.key,(counts.get(slot.key)||0)+1);
      }
    }
    function formatGap(quota,actual){
      if(quota==null)return "—";
      return actual>quota?'<span class="post-over">超配 '+(actual-quota)+'</span>':String(quota-actual);
    }
    function section(title,category,slots,showPositionTotal=false){
      let totalQuota=0,totalActual=0;
      const rows=slots.map(slot=>{
        const quota=H.unitTarget(slot.key);
        const actual=counts.get(slot.key)||0;
        totalQuota=totalQuota==null||quota==null?null:totalQuota+quota;
        totalActual+=actual;
        return '<tr data-vacancy="'+e(slot.key)+'"><th scope="row">'+e(slot.label)+'</th><td><button type="button" class="staff-edit" data-edit-unit="'+e(slot.key)+'" aria-label="设置'+e(slot.label)+'的单位名额">'+(quota==null?"未设置":quota)+'</button></td><td>'+actual+'</td><td data-vacant-total>'+formatGap(quota,actual)+'</td></tr>';
      }).join("");
      if(!Number.isSafeInteger(totalQuota))totalQuota=null;
      const footer=showPositionTotal?'<tfoot><tr data-position-total><th scope="row">职务合计</th><td>'+(totalQuota??"—")+'</td><td>'+totalActual+'</td><td>'+formatGap(totalQuota,totalActual)+'</td></tr></tfoot>':"";
      return '<section class="post-section"><h3>'+title+'</h3><table class="staff-table post-table" aria-label="'+title+'"><thead><tr><th scope="col">'+category+'</th><th scope="col">核定</th><th scope="col">实有</th><th scope="col">空缺</th></tr></thead><tbody>'+rows+'</tbody>'+footer+'</table></section>';
    }
    return '<div class="unit-quota-head"><span>全单位</span><button type="button" class="secondary" id="edit-unit-quotas">设置单位名额</button></div>'+
      '<p class="hint staff-note">空缺 = 全单位核定名额 − 对应实有人数。职级合计公务员与参公人员。</p>'+
      section("职务空编","人员类别 / 职务",H.quotaGroups.positions,true)+section("职级空编","职级",H.quotaGroups.ranks);
  }
  function establishmentPanel(){
    return '<section class="panel" id="establishment-panel" aria-labelledby="staff-heading"><div class="panel-head"><h2 id="staff-heading">编制分布</h2></div><div class="switches">'+
      [["departments","类别编制"],["vacancies","空编情况"]].map(([id,name])=>'<button data-staff-tab="'+id+'" aria-pressed="'+(staffTab===id)+'" class="chip">'+name+'</button>').join("")+
      '</div>'+(staffTab==="departments"?staffingTable():vacancyBoard())+'</section>';
  }
  function overview(){
    const people=H.state.people, n=people.length, ages=people.map(p=>H.age(p)).filter(a=>a!==null&&Number.isFinite(a));
    const hist=new Map();
    people.forEach(p=>{const k=val(p,chart)||"未登记";hist.set(k,(hist.get(k)||0)+1);});
    const rows=[...hist].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"zh-CN"));
    main.innerHTML='<div class="heading"><div><h1>人员结构</h1><div class="date">'+new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})+'</div></div><button class="primary" id="add">'+icon("plus",17)+'录入人员</button></div>'+
      '<section class="ledger"><div class="ledger-top"><div><div class="ledger-label">台账总人数</div><div class="ledger-number">'+n+'<small>人</small></div></div><i class="seal">'+icon("people")+'</i></div><div class="ledger-facts"><div><strong>'+H.state.depts.length+'</strong><span>实际运行科室</span></div><div><strong>'+(ages.length?(ages.reduce((a,b)=>a+b,0)/ages.length).toFixed(1):"—")+'</strong><span>平均年龄</span></div><div><strong>'+people.filter(p=>["硕士","博士","硕士研究生","博士研究生"].includes(p.education)).length+'</strong><span>硕士及以上</span></div></div></section>'+
      '<button class="quick" id="ratio"><i>'+icon("filter")+'</i><span><strong>科室占比筛选</strong><small>按人员属性和占比查找实际工作科室</small></span><span class="arrow">›</span></button>'+
      '<section class="panel"><div class="panel-head"><h2>人员分布</h2><span class="small">人数 / 占比</span></div><div class="switches">'+Object.entries(chartAttrs).map(([k,l])=>'<button data-chart="'+k+'" class="chip" aria-pressed="'+(chart===k)+'">'+l+'</button>').join("")+'</div>'+
      (n?rows.map(([l,num])=>'<div class="barrow"><span>'+e(l)+'</span><div class="track"><div class="fill" style="width:'+num/n*100+'%"></div></div><b>'+num+' / '+(num*100/n).toFixed(1)+'%</b></div>').join(""):'<div class="empty">录入第一名人员后，可在这里查看结构分布。</div>')+'</section>'+establishmentPanel();
    click("add",()=>{go("people");window.openPerson(null,()=>go("overview"));top();});
    click("ratio",()=>go("ratio"));
    main.querySelectorAll("[data-chart]").forEach(b=>b.onclick=()=>{chart=b.dataset.chart;overview();});
    main.querySelectorAll("[data-staff-tab]").forEach(b=>b.onclick=()=>{staffTab=b.dataset.staffTab;overview();main.querySelector("[data-staff-tab="+staffTab+"]").focus({preventScroll:true});});
    main.querySelectorAll("[data-staff-edit]").forEach(b=>b.onclick=()=>deptForm(b.dataset.staffEdit,"overview","quota"));
    click("reference-quota",ev=>{
      const id=ev.currentTarget.dataset.single;
      if(id){deptForm(id,"category-board","quota");return;}
      document.getElementById("quota-details").open=true;
      const heading=document.getElementById("reference-detail-heading");
      heading.focus({preventScroll:true});heading.scrollIntoView({block:"start"});
    });
    click("add-quota-detail",()=>deptForm(null,"overview","quota"));
    click("edit-unit-quotas",()=>unitQuotaForm());
    main.querySelectorAll("[data-edit-unit]").forEach(b=>b.onclick=()=>unitQuotaForm(b.dataset.editUnit));
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
      box.querySelectorAll("[data-dept]").forEach(b=>b.onclick=()=>{orgOpen=new Set([String(b.dataset.dept)]);let d=H.state.depts.find(d=>String(d.id)===b.dataset.dept);while(d&&d.parentId!==""&&d.parentId!=null){orgOpen.add(String(d.parentId));d=H.state.depts.find(x=>String(x.id)===String(d.parentId));}go("org");const dst=main.querySelector('[data-org="'+b.dataset.dept+'"]');if(dst)dst.scrollIntoView({block:"center"});});
    }
    draw();
  }
  function org(){
    const children=new Map(),members=new Map();
    function group(map,k,x){const key=String(k==null?"":k);if(!map.has(key))map.set(key,[]);map.get(key).push(x);}
    H.state.depts.forEach(d=>group(children,d.parentId,d));
    H.state.people.forEach(p=>group(members,p.deptId,p));
    const memberButtons=people=>people.map(p=>'<button class="member" data-person="'+e(p.id)+'"><b>'+e(p.name)+'</b><small>'+e(p.position||p.category||"")+' ›</small></button>').join("");
    const branch=d=>{
      const id=String(d.id), ps=members.get(id)||[], ds=children.get(id)||[];
      return '<details class="dept-row" data-org="'+e(id)+'" '+(orgOpen.has(id)?"open":"")+'><summary><b>'+e(d.name)+'</b><span>'+ps.length+' 人</span></summary><div class="dept-body">'+
        '<button class="txt" data-edit="'+e(id)+'">编辑工作科室</button>'+(ps.length?memberButtons(ps):'<p class="hint">暂无直属人员</p>')+ds.map(branch).join("")+'</div></details>';
    };
    main.innerHTML='<div class="heading"><h1>组织架构</h1><button class="primary" id="new-dept">'+icon("plus",17)+'新增工作科室</button></div><section class="panel"><div class="org-root"><i>'+icon("org")+'</i>局机关（本级）</div><p class="hint staff-note">展开工作科室可查看直属人员或编辑科室。</p>'+(children.get("")||[]).map(branch).join("")+'</section>';
    const unassigned=members.get("")||[];
    if(unassigned.length)main.insertAdjacentHTML("beforeend",'<section class="panel"><details data-org=":unassigned" '+(orgOpen.has(":unassigned")?'open':'')+'><summary><strong>未分配工作科室</strong> · '+unassigned.length+' 人</summary>'+memberButtons(unassigned)+'</details></section>');
    click("new-dept",()=>deptForm());
    main.querySelectorAll("details").forEach(el=>el.ontoggle=()=>{if(!el.isConnected)return;if(el.open)orgOpen.add(el.dataset.org);else orgOpen.delete(el.dataset.org);});
    main.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>deptForm(b.dataset.edit));
    main.querySelectorAll("[data-person]").forEach(b=>b.onclick=()=>{window.showPerson(b.dataset.person,()=>go("org"));top();});
  }
  const postFields={chiefQuota:"科长",deputyQuota:"副科长"};
  const postField=slot=>slot.title==="科长"?"chiefQuota":"deputyQuota";
  function unitQuotaForm(focusKey){
    const positions=H.quotaGroups.positions, ranks=H.quotaGroups.ranks;
    const numberText=value=>value==null?"未设置":String(value);
    const positionsMarkup=positions.map(slot=>{
      const field=postField(slot);
      const units=H.state.establishmentUnits.filter(u=>u.categoryGroup===slot.group);
      const hasOverride=Object.prototype.hasOwnProperty.call(H.state.unitPostQuotas,slot.key);
      const breakdown=units.map(u=>'<button type="button" class="member" data-quota-unit="'+e(u.id)+'"><span>'+e(u.name)+'</span><b>'+numberText(u[field])+' ›</b></button>').join("");
      return '<details class="quota-detail" data-post-group="'+slot.key+'" '+(slot.key===focusKey?'open':'')+'><summary>'+e(slot.label)+'<b>'+(hasOverride?'手填 ':'')+numberText(H.unitTarget(slot.key))+'</b></summary>'+
        (hasOverride?'<label class="quota-override"><input type="checkbox" data-clear-override="'+slot.key+'">取消手填总数，使用各指标项目合计</label>':'')+
        (breakdown||'<p class="hint">尚未设置此类别的指标项目。</p>')+'</details>';
    }).join("");
    const inputsMarkup=ranks.map(slot=>{
      const value=H.unitTarget(slot.key);
      return '<label>'+e(slot.label)+'<input type="number" min="0" step="1" inputmode="numeric" data-quota-key="'+slot.key+'" value="'+(value==null?"":value)+'" placeholder="未设置"></label>';
    }).join("");
    main.innerHTML=backTitle("设置单位名额")+'<form class="panel" id="unit-quota-form"><fieldset class="quota-fields"><legend>职务核定名额</legend><p class="hint">展开职务可查看各指标项目的名额，点项目名称即可编辑。</p>'+
      positionsMarkup+'</fieldset><fieldset class="quota-fields"><legend>职级核定名额</legend><p class="hint staff-note">公务员和参公合并统计。未核定可留空，核定为零请填 0。</p><div class="fields">'+inputsMarkup+'</div></fieldset>'+
      '<div class="action-row"><button class="primary" type="submit">保存单位名额</button></div></form>';
    const form=document.getElementById("unit-quota-form");
    const inputs=[...form.querySelectorAll("[data-quota-key]")];
    function returnToBoard(){
      go("overview");
      const source=focusKey?main.querySelector('[data-edit-unit="'+focusKey+'"]'):document.getElementById("edit-unit-quotas");
      if(source)source.focus({preventScroll:true});
      document.getElementById("establishment-panel").scrollIntoView({block:"start"});
    }
    H.subBack=()=>{if(allowNavigation())returnToBoard();};
    click("local-back",H.subBack);top();
    const focusInput=inputs.find(input=>input.dataset.quotaKey===focusKey);
    if(focusInput)focusInput.focus();
    main.querySelectorAll("[data-quota-unit]").forEach(b=>b.onclick=()=>{if(allowNavigation())deptForm(b.dataset.quotaUnit,"quotas","quota",b.closest("details").dataset.postGroup);});
    form.onsubmit=async ev=>{
      ev.preventDefault();
      const saveButton=form.querySelector("[type=submit]");
      if(saveButton.disabled)return;
      const quotas={...H.state.unitPostQuotas};
      for(const input of inputs){
        if(input.value===""){delete quotas[input.dataset.quotaKey];continue;}
        const value=Number(input.value);
        if(!Number.isSafeInteger(value)||value<0){H.notify("核定名额须为非负整数");input.focus();return;}
        quotas[input.dataset.quotaKey]=value;
      }
      form.querySelectorAll("[data-clear-override]:checked").forEach(input=>{delete quotas[input.dataset.clearOverride];});
      H.state.unitPostQuotas=quotas;
      saveButton.disabled=true;
      try{
        if(await H.save() && form.isConnected){H.notify("单位名额已保存");returnToBoard();}
      }finally{saveButton.disabled=false;}
    };
  }
  function deptForm(id,returnPage="org",basis="actual",focusKey){
    const establishment=basis==="quota", label=establishment?"指标项目":"工作科室";
    const directory=establishment?H.state.establishmentUnits:H.state.depts;
    const d=directory.find(x=>String(x.id)===String(id));
    const title=(d?"编辑":"新增")+label;
    function blocked(x){
      let n=x;
      while(d&&n){
        if(String(n.id)===String(d.id))return true;
        n=n.parentId!==""&&n.parentId!=null&&directory.find(z=>String(z.id)===String(n.parentId));
      }
      return false;
    }
    const quotaInput=(field,caption)=>'<label>'+caption+'<input id="d-'+field+'" type="number" min="0" step="1" inputmode="numeric" placeholder="未设置" value="'+e(d&&d[field]!=null?d[field]:"")+'"></label>';
    const categories=Object.entries(categoryLabels).map(([key,name])=>option(key,name,d&&d.categoryGroup)).join("");
    const overrideNote=establishment&&H.quotaGroups.positions.some(slot=>Object.prototype.hasOwnProperty.call(H.state.unitPostQuotas,slot.key))?'<p class="hint wide">修改某项职务名额后，该职务的手填总数将改为按指标项目合计。</p>':'';
    const fields=establishment?overrideNote+'<label>人员类别<select id="d-category" required>'+option("","请选择",d&&d.categoryGroup)+categories+'</select></label>'+
      quotaInput("quota","编制总数")+quotaInput("chiefQuota","科长名额")+quotaInput("deputyQuota","副科长名额"):'';
    const parentField=establishment?"":'<label class="wide">上级机构<select id="d-parent">'+option("","局机关（本级）",d&&d.parentId)+directory.filter(x=>!blocked(x)).map(x=>option(x.id,x.name,d&&d.parentId)).join("")+'</select></label>';
    main.innerHTML=backTitle(title)+'<form class="panel" id="dept-form"><div class="fields"><label class="wide">'+label+'名称<input id="d-name" required maxlength="80" value="'+e(d?d.name:"")+'"></label>'+parentField+fields+'</div>'+
      '<div class="action-row"><button class="primary" type="submit">保存'+label+'</button>'+(d?'<button type="button" id="delete-dept" class="plain-btn danger">删除'+label+'</button>':'')+'</div></form>';
    function leave(){
      if(returnPage==="quotas"){unitQuotaForm(focusKey);return;}
      if(returnPage==="category-board"){
        go("overview");
        const control=document.getElementById("reference-quota");
        control.focus({preventScroll:true});control.scrollIntoView({block:"center"});return;
      }
      go(returnPage);
      if(establishment&&returnPage==="overview"){
        const details=document.getElementById("quota-details");
        details.open=true;details.scrollIntoView({block:"start"});
      }
    }
    H.subBack=()=>{if(allowNavigation())leave();};click("local-back",H.subBack);top();
    document.getElementById("dept-form").onsubmit=ev=>{
      ev.preventDefault();
      const name=document.getElementById("d-name").value.trim();
      const nameChanged=!d||name!==d.name;
      if(!name||(nameChanged&&directory.some(x=>x.name===name))){H.notify("请填写不重复的"+label+"名称");return;}
      const changes={name};
      if(!establishment)changes.parentId=document.getElementById("d-parent").value;
      if(establishment){
        changes.categoryGroup=document.getElementById("d-category").value;
        for(const field of ["quota",...Object.keys(postFields)]){
          const input=document.getElementById("d-"+field);
          const value=input.value===""?null:Number(input.value);
          if(value!==null&&(!Number.isSafeInteger(value)||value<0)){H.notify("名额须为非负整数");input.focus();return;}
          changes[field]=value;
        }
        for(const field of Object.keys(postFields)){
          if(!d||d.categoryGroup!==changes.categoryGroup||d[field]!==changes[field]){
            H.clearUnitTargetOverride(changes.categoryGroup,field);
            if(d)H.clearUnitTargetOverride(d.categoryGroup,field);
          }
        }
      }
      if(d && !establishment && nameChanged){
        for(const person of H.state.people){
          if(String(person.deptId)!==String(d.id))continue;
          for(const row of H.roleTimeline(person)){
            if(!row.timelineCurrent || !Number.isInteger(row.historyIndex))continue;
            for(const index of row.historyIndices||[row.historyIndex]){
              const entry=person.history[index];
              if(entry.actualDeptName===d.name)entry.actualDeptName=name;
            }
          }
        }
      }
      if(d)Object.assign(d,changes);
      else directory.push({id:(establishment?"u":"d")+Date.now().toString(36)+Math.random().toString(36).slice(2,6),...changes});
      if(!H.save()){leave();return;}H.notify(label+"已保存");leave();
    };
    click("delete-dept",()=>{
      const matches=id=>id!=null && String(id)===String(d.id);
      const affected=establishment?[]:H.state.people.filter(p=>matches(p.deptId));
      const children=directory.filter(x=>matches(x.parentId));
      const parentId=d.parentId==null?"":d.parentId;
      const parent=directory.find(x=>String(x.id)===String(parentId));
      const message=["删除"+label+"「"+d.name+"」？"];
      if(affected.length)message.push(affected.length+" 人的"+label+"将变为未分配，原科室和任职期间将记入个人简历。");
      if(children.length&&!establishment)message.push(children.length+" 个直属下级将移到「"+(parent?parent.name:"局机关（本级）")+"」下。");
      if(!confirm(message.join("\n")))return;
      const revised=new Map();
      const effective=H.today();
      try{
        for(const previous of affected){
          const draft=JSON.parse(JSON.stringify(previous));
          draft.deptId="";draft.deptSince="";
          H.rememberDept(draft,previous,(previous.deptSince||"")<=effective?effective:"");
          H.syncRoleHistory(draft,previous,{mode:"change",dates:{dept:effective}});
          revised.set(previous,draft);
        }
      }catch(error){H.notify(error.message);return;}
      if(revised.size)H.state.people=H.state.people.map(person=>revised.get(person)||person);
      children.forEach(x=>{x.parentId=parentId;});
      directory.splice(directory.indexOf(d),1);
      if(establishment)Object.keys(postFields).forEach(field=>H.clearUnitTargetOverride(d.categoryGroup,field));
      if(H.save()){
        if(!establishment)orgOpen.delete(String(d.id));
        if(affected.length)orgOpen.add(":unassigned");
        H.notify(label+"已删除");
      }
      leave();
    });
  }
  function storage(){
    main.innerHTML=backTitle("本机数据")+'<section class="panel"><h2>台账备份</h2><p class="hint">备份包含工作科室、核定指标、人员档案和晋升规则。请将文件保存在可信的本地位置。建议将备份存入“文件”里的“我的 iPhone”。删除主屏幕应用或清除网站数据前，请先导出备份。</p><div class="action-row"><button class="primary" id="export">导出备份</button><button class="secondary" id="import">从备份恢复</button></div></section>';
    H.subBack=()=>go("overview");click("local-back",H.subBack);
    click("export",()=>{
      if(!window.LocalFiles){H.notify("无法打开文件下载，请重新打开应用");return;}
      const out=H.isUnreadable()?H.raw():JSON.stringify({format:"hr-local-ledger",version:6,exportedAt:new Date().toISOString(),data:H.state});
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
      if(!file||file.format!=="hr-local-ledger"||![1,2,3,4,5,6].includes(file.version))throw Error("请选择本应用导出的第 1 至 6 版 JSON 备份");
      H.validate(file.data);
      const d=file.data;
      if(confirm("用备份中的 "+d.people.length+" 人、"+d.depts.length+" 个工作科室、"+d.establishmentUnits.length+" 项编制指标、"+d.policies.length+" 条规则替换当前台账？")){H.restore(d);orgOpen.clear();go("overview");H.notify("台账已恢复");}
    }catch(err){H.notify("恢复失败，原数据已保留。"+(err instanceof SyntaxError?"文件内容有误":err.message));}
  };
  window.handleAndroidBack=()=>{if(typeof H.subBack==="function"){H.subBack();return true;}if(page!=="overview"){go("overview");return true;}return false;};
  document.querySelectorAll("i[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));
  H.go=go;H.render=render;
  click("storage",()=>{if(allowNavigation())go("storage");});
  go(H.isUnreadable()?"storage":"overview");
})();
