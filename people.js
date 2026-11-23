(() => {
  'use strict';
  const h = () => window.HR;
  const view = () => h().container();
  const esc = v => h().esc(String(v == null ? '' : v));
  const pretty = v => v === '' || v == null ? '未登记' : esc(v);
  const people = () => h().state.people;
  const person = id => people().find(p => String(p.id) === String(id));
  const education = ['博士研究生','硕士研究生','本科','大专','其他'];
  const categories = ['公务员（行政编）','参公事业编','事业编制','合同制聘用','劳务派遣','借调人员','退休人员'];
  const unassigned = ':unassigned';
  const unverified = ':unverified';
  const blankFilters = () => ({q:'', deptId:'', establishmentDeptId:'', gender:'', education:'', category:'', position:'', rank:'', min:'', max:''});
  const axes = [
    {kind:'actual',id:'deptId',since:'deptSince',label:'实际工作科室',time:'实际到科室时间'},
    {kind:'establishment',id:'establishmentDeptId',since:'establishmentSince',label:'编制科室',time:'到编时间'}
  ];
  const postingName=(p,axis)=>axis.kind==='actual'?h().deptName(p.deptId):h().establishmentName(p);
  let filters = blankFilters();
  let expanded = false;
  let limit = 60;

  function options(pairs, current, placeholder) {
    return [[ '', placeholder ], ...pairs].map(([value, label]) =>
      '<option value="'+esc(value)+'"'+(String(current == null ? '' : current) === String(value) ? ' selected' : '')+'>'+esc(label)+'</option>'
    ).join('');
  }
  function choices(arr) { return [...new Set(arr.filter(Boolean))].map(x => [x,x]); }
  function deptOptions() {
    const depts = h().state.depts;
    const byId = new Map(depts.map(d => [String(d.id),d]));
    return depts.map(d => {
      let current = d;
      const path = [], seen = new Set();
      while(current && !seen.has(current.id)){
        path.unshift(current.name);
        seen.add(current.id);
        current = current.parentId ? byId.get(String(current.parentId)) : null;
      }
      return [d.id,path.join(' / ')];
    });
  }
  function establishmentOptions(){
    return h().state.establishmentUnits.map(unit=>[unit.id,unit.name+(unit.legacy?'（旧归属）':'')]);
  }
  function historyNames(id,items){
    return '<datalist id="'+id+'">'+choices(items.map(item=>item.name)).map(([name])=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist>';
  }
  const icons = {
    add:'<path d="M12 5v14M5 12h14"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    filter:'<path d="M3 7h10m4 0h4M3 17h4m4 0h10"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    back:'<path d="m14 5-7 7 7 7"/>',
    next:'<path d="m9 5 7 7-7 7"/>'
  };
  function icon(name){return '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';}
  function button(id,label,cls='secondary'){return '<button type="button" id="'+id+'" class="'+cls+'">'+label+'</button>';}
  function at(selector){return view().querySelector(selector);}
  function on(selector, event, handler){at(selector).addEventListener(event,handler);}
  const top = () => window.scrollTo(0,0);
  function filterSelect(key,label,items) {
    return '<label>'+label+'<select name="'+key+'">'+options(items, filters[key], '全部')+'</select></label>';
  }
  function matches(p) {
    const query = filters.q.trim().toLocaleLowerCase();
    if (query && ![p.name,h().deptName(p.deptId),h().establishmentName(p),p.rank,p.position].some(v => String(v || '').toLocaleLowerCase().includes(query))) return false;
    const deptFilterValue = p.deptId == null || p.deptId === '' ? unassigned : String(p.deptId);
    if(filters.deptId && filters.deptId !== deptFilterValue) return false;
    const establishmentFilterValue=p.establishmentDeptId==null?unverified:p.establishmentDeptId===''?unassigned:String(p.establishmentDeptId);
    if(filters.establishmentDeptId && filters.establishmentDeptId!==establishmentFilterValue)return false;
    if(['gender','education','category','position','rank'].some(k => filters[k] && String(p[k]) !== filters[k])) return false;
    if(filters.min !== '' || filters.max !== '') {
      const a = h().age(p);
      if(a == null || a === '' || !Number.isFinite(Number(a))) return false;
      if((filters.min !== '' && Number(a) < Number(filters.min)) || (filters.max !== '' && Number(a) > Number(filters.max))) return false;
    }
    return true;
  }
  function renderResults() {
    const filtered = people().filter(matches);
    const active = Object.keys(filters).filter(k => k !== 'q' && filters[k] !== '').length;
    at('#pe-filter-count').textContent = active ? '筛选 · '+active : '筛选';
    at('#pe-count').textContent = (active || filters.q.trim() ? '匹配 ' : '共 ')+filtered.length+' 人';
    at('#pe-reset').hidden = !active && !filters.q;
    const list = at('#pe-list');
    if(filters.min !== '' && filters.max !== '' && Number(filters.min)>Number(filters.max)) {
      list.innerHTML = '<p class="empty">最低年龄不能大于最高年龄。</p>';
      return;
    }
    if (!filtered.length){
      list.innerHTML = '<p class="empty">'+(people().length ? '没有匹配人员，可调整筛选条件。' : '尚无人员档案。点击“录入人员”添加第一位。')+'</p>';
      return;
    }
    list.innerHTML = filtered.slice(0,limit).map(p => {
      const a = h().age(p);
      const meta = [p.gender, a != null && a !== '' ? a+' 岁' : '',p.education,p.category].filter(Boolean).map(esc).join(' · ');
      return '<button type="button" class="pe-person" data-person="'+esc(p.id)+'"><span class="pe-row-body"><strong>'+esc(p.name)+'</strong>'+memberships(p)+'<small>'+meta+'</small></span>'+icon('next')+'</button>';
    }).join('')+(filtered.length>limit ? '<button type="button" class="pe-more" data-more>再显示 '+Math.min(60,filtered.length-limit)+' 人</button>' : '');
  }
  function memberships(p){
    return '<span class="pe-memberships"><span>实际工作科室 <b class="pe-dept">'+esc(h().deptName(p.deptId))+'</b></span><span>编制科室 <b>'+esc(h().establishmentName(p))+'</b></span></span>';
  }
  function renderPeople() {
    h().subBack = null;
    const departments = [[unassigned,'未分配科室'],...deptOptions()];
    if(!departments.some(([id])=>String(id)===filters.deptId)) filters.deptId='';
    const units=[[unverified,'待核实'],[unassigned,'未分配编制科室'],...establishmentOptions()];
    if(!units.some(([id])=>String(id)===filters.establishmentDeptId))filters.establishmentDeptId='';
    const vals = k => choices([...h().jobTitles[k],...people().map(p=>p[k])]);
    view().innerHTML = '<div class="heading"><h1>人员台账</h1>'+button('pe-add',icon('add')+'录入人员','primary')+'</div>'+
      '<section class="panel pe-search"><div class="pe-search-row"><label class="pe-search-box">'+icon('search')+'<input id="pe-query" type="search" aria-label="搜索姓名、科室、职务或职级" placeholder="姓名、科室、职务或职级" value="'+esc(filters.q)+'"></label>'+
      '<button type="button" id="pe-toggle" class="secondary" aria-controls="pe-filters" aria-expanded="'+expanded+'">'+icon('filter')+'<span id="pe-filter-count">筛选</span></button></div>'+
      '<div id="pe-filters" class="fields pe-filters" '+(expanded ? '' : 'hidden')+'>'+
      filterSelect('deptId','实际工作科室',departments)+filterSelect('establishmentDeptId','编制科室',units)+filterSelect('gender','性别',choices(['女','男','未登记']))+
      filterSelect('education','学历',choices([...education,...people().map(p=>p.education)]))+filterSelect('category','人员类别',choices([...categories,...people().map(p=>p.category)]))+
      filterSelect('position','现任职务',vals('position'))+filterSelect('rank','现职级',vals('rank'))+
      ['min','max'].map((k,i)=>'<label>'+['最低年龄','最高年龄'][i]+'<input type="number" min="0" max="130" step="1" name="'+k+'" placeholder="不限" value="'+esc(filters[k])+'"></label>').join('')+
      '</div></section><section class="panel pe-register"><div class="pe-register-head"><h2>人员名册</h2><div>'+button('pe-reset','清除条件','plain-btn')+'<span id="pe-count"></span></div></div><div id="pe-list"></div></section>';
    on('#pe-add','click',()=>openPerson());
    on('#pe-query','input',e=>{filters.q=e.target.value;limit=60;renderResults();});
    on('#pe-toggle','click',e=>{expanded=!expanded;at('#pe-filters').hidden=!expanded;e.currentTarget.setAttribute('aria-expanded',String(expanded));});
    on('#pe-filters','input',e=>{if(e.target.name in filters){filters[e.target.name]=e.target.value;limit=60;renderResults();}});
    on('#pe-reset','click',()=>{filters=blankFilters();limit=60;renderPeople();});
    on('#pe-list','click',e=>{
      const row=e.target.closest('[data-person]');
      if(row) showPerson(row.dataset.person);
      if(e.target.closest('[data-more]')){limit+=60;renderResults();}
    });
    renderResults();
  }
  function detailField(label,value){return '<div><dt>'+label+'</dt><dd>'+pretty(value)+'</dd></div>';}
  function priorRoles(record){
    const role=(title,since)=>esc(title)+(since?'（'+esc(since)+' 起）':'');
    return [record.position?'原职务 '+role(record.position,record.positionSince):'',record.rank?'原职级 '+role(record.rank,record.rankSince):''].filter(Boolean).join(' · ');
  }
  function pastDepartment(record){
    const roles=priorRoles(record);
    const actual=record.actualChanged!==false, establishment=record.establishmentChanged===true;
    const title=actual && establishment?'实际工作科室、编制科室变更':establishment?'编制科室变更':'实际工作科室变更';
    const line=(label,name,since,date)=>{
      const time=[since?'到任 '+esc(since):'',date?'调动生效 '+esc(date):''].filter(Boolean).join(' · ');
      return '<span>'+label+' '+pretty(name)+(time?'（'+time+'）':'')+'</span>';
    };
    return '<li><strong>'+title+'</strong>'+
      line('实际工作科室',record.name,record.start,actual?(record.actualEffectiveDate||record.effectiveDate):'')+
      line('编制科室',record.establishmentName,record.establishmentStart,establishment?(record.establishmentEffectiveDate||record.effectiveDate):'')+
      (roles?'<span>'+roles+'</span>':'')+'<span>归属变更登记日 '+pretty(record.end)+'</span></li>';
  }
  function backButton(label) {return button('pe-back',icon('back')+label,'pe-back');}
  function showPerson(id,back) {
    const p = person(id);
    const finish = typeof back === 'function' ? back : renderPeople;
    if(!p){finish();return;}
    h().subBack = finish;
    const a = h().age(p);
    const timeline = [...(p.history || [])].sort((x,y)=>String(y.start).localeCompare(String(x.start)));
    const pastDepts = (p.deptHistory || []).slice().reverse();
    view().innerHTML = backButton('返回')+'<div class="heading"><h1>人员档案</h1>'+button('pe-edit','编辑','secondary')+'</div>'+
      '<section class="panel pe-identity"><div class="pe-sign"><strong>'+esc(p.name)+'</strong>'+memberships(p)+'</div><dl class="pe-details">'+
      detailField('性别',p.gender)+detailField('年龄',a == null || a === '' ? '' : a+' 岁')+
      detailField(p.birth?'出生年月':'年龄登记日期',p.birth || p.ageAsOf)+detailField('学历',p.education)+detailField('人员类别',p.category)+axes.filter(axis=>p[axis.id]!=null&&p[axis.id]!=='').map(axis=>detailField(axis.time,p[axis.since])).join('')+'</dl></section>'+
      (pastDepts.length ? '<section class="panel"><h2>过往经历 · 历次科室</h2><ol class="pe-timeline">'+pastDepts.map(pastDepartment).join('')+'</ol></section>' : '')+
      '<section class="panel"><h2>当前任职</h2><dl class="pe-details">'+detailField('职务',p.position)+detailField('任现职务时间',p.positionSince)+detailField('职级',p.rank)+detailField('任现职级时间',p.rankSince)+'</dl></section>'+
      '<section class="panel"><h2>任职经历</h2>'+(timeline.length ? '<ol class="pe-timeline">'+timeline.map(e=>
      '<li><span>'+esc(e.start || '起始日期未登记')+' 至 '+esc(e.end || '今')+'</span><strong>'+esc(e.title)+'</strong><small>'+esc(e.type)+'</small><span>实际工作科室 '+pretty(e.actualDeptName)+'</span><span>编制科室 '+pretty(e.establishmentDeptName)+'</span></li>').join('')+'</ol>' : '<p class="pe-muted">尚未登记历次任职。</p>')+'</section>'+
      button('pe-delete','删除该档案','plain-btn danger')+'<div class="panel pe-confirm" id="pe-confirm" hidden><p>删除“'+esc(p.name)+'”及其任职经历？此操作无法撤销。</p><div class="action-row">'+button('pe-keep','保留档案')+button('pe-remove','确认删除','pe-destructive')+'</div></div>';
    on('#pe-back','click',finish);on('#pe-edit','click',()=>openPerson(p.id,finish));
    const keep = ()=>{at('#pe-confirm').hidden=true;at('#pe-delete').hidden=false;h().subBack=finish;at('#pe-delete').focus();};
    on('#pe-delete','click',()=>{at('#pe-confirm').hidden=false;at('#pe-delete').hidden=true;h().subBack=keep;at('#pe-keep').focus();});
    on('#pe-keep','click',keep);
    on('#pe-remove','click',()=>{const index=people().findIndex(v=>v.id===p.id);if(index<0)return;people().splice(index,1);if(h().save()){h().notify('人员档案已删除');finish();}});
    top();
  }
  function input(key,label,value,extra='') {
    return '<label>'+label+'<input name="'+key+'" value="'+esc(value)+'" '+extra+'></label>';
  }
  function select(key,label,items,value,placeholder='请选择',extra=''){
    return '<label>'+label+'<select name="'+key+'" '+extra+'>'+options(items,value,placeholder)+'</select></label>';
  }
  function customSelect(key,label,items,value){
    const all=choices(items);
    return '<div class="pe-custom">'+select(key,label,[...all,['__custom__','自定义…']],value,'未登记')+
      '<label class="pe-other" hidden>填写'+label+'<input maxlength="80" name="'+key+'Other" disabled></label></div>';
  }
  function historyFields(item={}) {
    const type=item.type || '职务';
    return '<div class="pe-history-row" data-original-type="'+esc(type)+'" data-original-title="'+esc(item.title)+'"><div class="pe-history-head"><strong>任职记录</strong><button type="button" class="plain-btn danger" data-remove>移除此条</button></div><div class="fields">'+
      select('historyType','类型',choices(['职务','职级',type]),type,'请选择','required')+
      select('historyTitle','职务或职级名称',historyChoices(type,item.title),item.title,'请选择','required')+
      input('historyActualDept','当时实际工作科室',item.actualDeptName,'list="pe-history-depts" maxlength="80" placeholder="选择或填写当时名称"')+
      input('historyEstablishmentDept','当时编制科室',item.establishmentDeptName,'list="pe-history-units" maxlength="80" placeholder="选择或填写当时名称"')+
      input('historyStart','起始日期',item.start,'type="date" max="'+h().today()+'" required')+
      input('historyEnd','结束日期（至今可留空）',item.end,'type="date" max="'+h().today()+'"')+'</div></div>';
  }
  function historyChoices(type,previous){
    const kind=type==='职务'?'position':type==='职级'?'rank':'';
    return h().jobChoices(kind,previous);
  }
  function confirmTransfer(previous,draft,changed){
    const dialog=document.createElement('dialog');
    dialog.id='pe-transfer';
    dialog.className='pe-transfer';
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','pe-transfer-heading');
    dialog.setAttribute('aria-describedby','pe-transfer-route');
    const today=h().today();
    const roles=priorRoles(previous);
    const effectiveId=axis=>axis.kind==='actual'?'pe-transfer-date':'pe-establishment-transfer-date';
    const isAssigned=(p,axis)=>p[axis.id]!=null&&p[axis.id]!=='';
    const correctionDate=axis=>isAssigned(draft,axis)?draft[axis.since]||previous[axis.since]||'':'';
    const route=axes.map(axis=>{
      const from=esc(postingName(previous,axis)), to=esc(postingName(draft,axis));
      return '<span>'+axis.label+'　'+(from===to?to:from+' → '+to)+'</span>';
    }).join('');
    const dates=changed.map(axis=>'<label>'+axis.label+'调动生效日期<input id="'+effectiveId(axis)+'" type="date" required max="'+today+'" min="'+esc(previous[axis.since]||'')+'" value="'+esc(draft[axis.since]||today)+'"></label>').join('');
    const correction=changed.map(axis=>isAssigned(draft,axis)?axis.time+'为'+pretty(correctionDate(axis)):'清空'+axis.time).join('，');
    dialog.innerHTML='<div class="panel pe-transfer-card"><h2 tabindex="-1" id="pe-transfer-heading">确认科室变更</h2>'+
      '<p id="pe-transfer-route"><b>'+esc(draft.name)+'</b>'+route+'</p>'+
      '<div class="pe-transfer-summary"><h3>将归入过往经历</h3>'+axes.map(axis=>'<p>'+axis.label+' '+esc(postingName(previous,axis))+(previous[axis.since]?'（'+esc(previous[axis.since])+' 起）':'')+'</p>').join('')+(roles?'<p>'+roles+'</p>':'')+'</div>'+
      dates+'<p class="hint">确认调动后，各生效日期将分别用于对应的新归属。</p>'+
      '<p role="alert" id="pe-transfer-error" class="pe-form-error" hidden></p>'+
      button('pe-transfer-record','确认调动并归档','primary')+
      '<p class="hint">如果是测试或录入错误，可以只更正科室。'+
      '更正后'+correction+'。</p>'+
      button('pe-transfer-correct','仅更正科室')+button('pe-transfer-back','返回修改','plain-btn')+'</div>';
    view().appendChild(dialog);
    return new Promise(resolve=>{
      const originalBack=h().subBack;
      const native=typeof dialog.showModal==='function';
      let settled=false;
      function close(choice){
        if(settled)return;
        settled=true;
        h().subBack=originalBack;
        if(native)dialog.close();
        dialog.remove();
        const submit=at('#pe-form [type=submit]');
        if(submit)submit.focus();
        resolve(choice);
      }
      h().subBack=()=>close(null);
      const error=dialog.querySelector('#pe-transfer-error');
      dialog.querySelector('#pe-transfer-record').onclick=()=>{
        const dates={};
        for(const axis of changed){
          const input=dialog.querySelector('#'+effectiveId(axis));
          const date=input.value;
          if(!date || !input.validity.valid || date>today || date<(previous[axis.since]||'') || (draft.birth && date.slice(0,7)<draft.birth)){
            error.textContent=axis.label+'的调动日期不能早于原到任时间或出生月份，也不能晚于今天。';
            error.hidden=false;input.focus();return;
          }
          dates[axis.kind]=date;
        }
        close({record:true,dates});
      };
      dialog.oninput=()=>{error.hidden=true;};
      dialog.querySelector('#pe-transfer-correct').onclick=()=>{
        const dates={};
        changed.forEach(axis=>{dates[axis.kind]=correctionDate(axis);});
        close({record:false,dates});
      };
      dialog.querySelector('#pe-transfer-back').onclick=()=>close(null);
      dialog.oncancel=event=>{event.preventDefault();close(null);};
      dialog.onkeydown=event=>{
        if(event.key==='Escape'){event.preventDefault();close(null);}
        if(native || event.key!=='Tab')return;
        const first=dialog.querySelector('input'), last=dialog.querySelector('#pe-transfer-back');
        if(event.shiftKey && (document.activeElement===first || document.activeElement===dialog.querySelector('h2'))){event.preventDefault();last.focus();}
        if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      };
      if(native)dialog.showModal();else dialog.setAttribute('open','');
      dialog.querySelector('h2').focus();
    });
  }
  function openPerson(id,back){
    const existing = id == null ? null : person(id);
    if(id != null && !existing){h().notify('未找到该人员');renderPeople();return;}
    const finish = typeof back === 'function' ? back : renderPeople;
    const leave = existing ? ()=>showPerson(existing.id,finish) : finish;
    const p = existing || {};
    const today = h().today();
    const directories={actual:deptOptions(),establishment:establishmentOptions()};
    const mode = p.age != null && p.age!=='' && !p.birth ? 'age' : 'birth';
    const date = 'type="date" max="'+today+'"';
    const originalId=axis=>p[axis.id]==null?'':String(p[axis.id]);
    const establishmentValue=existing && p.establishmentDeptId==null?unverified:originalId(axes[1]);
    view().innerHTML = backButton('返回')+'<div class="heading"><h1>'+ (existing ? '编辑人员' : '录入人员')+'</h1><span class="hint">* 必填</span></div>'+
      '<form id="pe-form"><section class="panel"><h2>基本资料</h2><div class="fields pe-form-fields">'+input('name','姓名 *',p.name,'required maxlength="80" autocomplete="off"')+
      select('gender','性别',choices(['女','男','未登记']),p.gender || '未登记','请选择')+customSelect('education','学历',[...education,p.education,...people().map(z=>z.education)],p.education)+
      customSelect('category','人员类别',[...categories,p.category,...people().map(z=>z.category)],p.category)+
      '<div class="pe-age-fields wide"><fieldset class="pe-age-choice"><legend>年龄信息</legend>'+
      ['birth','age'].map((k,i)=>'<label><input type="radio" name="ageMode" value="'+k+'"'+(mode===k?' checked':'')+'>'+['填出生年月','填登记年龄'][i]+'</label>').join('')+'</fieldset>'+
      '<div class="fields" id="pe-birth">'+input('birth','出生年月',p.birth,'type="month" max="'+today.slice(0,7)+'" placeholder="YYYY-MM，如 1990-06" maxlength="7"')+'</div><div class="fields" id="pe-age">'+
      input('age','登记年龄（周岁）',p.age,'type="number" inputmode="numeric" min="0" max="130" step="1"')+input('ageAsOf','年龄登记日期',p.ageAsOf||today,date)+'</div></div></div></section>'+
      '<section class="panel"><h2>科室归属</h2><div class="fields pe-form-fields">'+
      select('deptId','实际工作科室',directories.actual,p.deptId,'未分配实际工作科室')+
      input('deptSince','实际到科室时间',p.deptSince,date)+
      select('establishmentDeptId','编制科室',[[unverified,'待核实'],...directories.establishment],establishmentValue,'未分配编制科室')+
      input('establishmentSince','到编时间',p.establishmentSince,date)+'</div>'+
      button('pe-copy-actual','选用同名编制单位','plain-btn pe-copy-actual')+'</section>'+
      '<section class="panel"><h2>当前任职</h2><div class="fields pe-form-fields">'+select('position','现任职务',h().jobChoices('position',p.position),p.position,'未登记')+
      input('positionSince','任现职务时间',p.positionSince,date)+select('rank','现职级',h().jobChoices('rank',p.rank),p.rank,'未登记')+input('rankSince','任现职级时间',p.rankSince,date)+
      '</div></section><section class="panel"><div class="panel-head"><h2>任职经历</h2>'+button('pe-add-history',icon('add')+'添加经历','secondary')+
      '</div>'+historyNames('pe-history-depts',h().state.depts)+historyNames('pe-history-units',h().state.establishmentUnits)+'<div id="pe-history">'+(p.history||[]).map(historyFields).join('')+'</div><p class="pe-muted" id="pe-history-empty">可按时间登记历次职务或职级。</p></section>'+
      '<p role="alert" class="pe-form-error" id="pe-error" hidden></p><div class="pe-save"><button type="submit" class="primary">保存档案</button>'+button('pe-cancel','取消')+'</div></form>'+
      '<section class="panel pe-confirm" id="pe-discard" hidden><p>放弃尚未保存的修改？</p><div class="action-row">'+button('pe-resume','继续编辑')+button('pe-leave','放弃修改','pe-destructive')+'</div></section>';
    const form=at('#pe-form');
    const field=key=>form.elements.namedItem(key);
    let dirty=false, saving=false;
    const closeDiscard=()=>{at('#pe-discard').hidden=true;h().subBack=tryLeave;};
    function tryLeave(){
      if(!dirty){leave();return;}
      at('#pe-discard').hidden=false;h().subBack=closeDiscard;at('#pe-resume').focus();
    }
    h().subBack=tryLeave;
    on('#pe-back','click',tryLeave);on('#pe-cancel','click',tryLeave);on('#pe-resume','click',closeDiscard);on('#pe-leave','click',leave);
    const syncMode=()=>{
      for(const k of ['birth','age']){
        const hidden=field('ageMode').value!==k;
        at('#pe-'+k).hidden=hidden;
        at('#pe-'+k).querySelectorAll('input').forEach(el=>el.disabled=hidden);
      }
    };
    function syncHistory(){at('#pe-history-empty').hidden=!!at('.pe-history-row');}
    function syncDept(axis) {
      const selected = field(axis.id).value;
      const since = field(axis.since);
      const start = selected && selected === originalId(axis) ? p[axis.since] || '' : '';
      if(since.value!==start || since.defaultValue!==start){
        // A reused WebKit date picker can remain invalid after its old date is cleared.
        since.parentElement.outerHTML=input(axis.since,axis.time,start,date);
      }
      field(axis.since).disabled = !selected || selected===unverified;
      at('#pe-copy-actual').disabled=!field('deptId').value;
    }
    syncMode();syncHistory();axes.forEach(syncDept);
    on('#pe-copy-actual','click',()=>{
      const establishment=field('establishmentDeptId');
      const dept=h().state.depts.find(d=>String(d.id)===field('deptId').value);
      const matches=h().state.establishmentUnits.filter(unit=>dept && unit.name===dept.name);
      if(matches.length!==1){
        h().notify(matches.length?'有多个同名编制单位，请手动选择。':'没有同名编制单位，请手动选择。');
        establishment.focus();
        return;
      }
      if(establishment.value===String(matches[0].id))return;
      establishment.value=String(matches[0].id);
      establishment.dispatchEvent(new Event('change',{bubbles:true}));
    });
    function setDirty(){dirty=true;at('#pe-error').hidden=true;}
    form.addEventListener('input',setDirty);
    form.addEventListener('change',e=>{
      setDirty();
      if(e.target.name==='ageMode')syncMode();
      const changedAxis=axes.find(axis=>axis.id===e.target.name);
      if(changedAxis)syncDept(changedAxis);
      if(e.target.name==='historyType'){
        const row=e.target.closest('.pe-history-row');
        const previous=row.dataset.originalType===e.target.value?row.dataset.originalTitle:'';
        row.querySelector('[name=historyTitle]').innerHTML=options(historyChoices(e.target.value,previous),previous,'请选择');
      }
      if(['education','category'].includes(e.target.name)){
        const other=field(e.target.name+'Other');
        other.disabled=e.target.value!=='__custom__';other.required=!other.disabled;other.parentElement.hidden=other.disabled;
        if(!other.disabled)other.focus();
      }
    });
    on('#pe-add-history','click',()=>{at('#pe-history').insertAdjacentHTML('beforeend',historyFields());setDirty();syncHistory();at('#pe-history').lastElementChild.querySelector('[name=historyTitle]').focus();});
    on('#pe-history','click',e=>{const btn=e.target.closest('[data-remove]');if(btn){btn.closest('.pe-history-row').remove();setDirty();syncHistory();}});
    function invalid(el,message){at('#pe-error').textContent=message;at('#pe-error').hidden=false;el.focus();h().notify(message);return false;}
    form.addEventListener('submit', async event=>{
      event.preventDefault();
      if(saving)return;
      const get=key=>field(key).value.trim();
      if(!get('name'))return invalid(field('name'),'请填写姓名。');
      const data=Object.assign({},p);
      for(const k of ['name','gender','education','category','rank','position','rankSince','positionSince'])data[k]=get(k);
      for(const axis of axes){
        const value=get(axis.id);
        const pending=axis.kind==='establishment' && value===unverified;
        const department=directories[axis.kind].find(([key])=>String(key)===value);
        if(value && !department && !pending)return invalid(field(axis.id),'请选择有效的'+axis.label+'。');
        data[axis.id]=department?department[0]:pending?null:'';
        data[axis.since]=department?get(axis.since):'';
      }
      for(const k of ['education','category']){
        if(data[k]!=='__custom__')continue;
        data[k]=get(k+'Other');
        if(!data[k] || data[k]==='__custom__')return invalid(field(k+'Other'),'请填写'+(k==='education'?'学历':'人员类别')+'。');
      }
      for(const [k,label] of [['position','职务'],['rank','职级']]) {
        if(!data[k] && data[k+'Since'])return invalid(field(k),'请选择对应的'+label+'。');
      }
      const useBirth=get('ageMode')==='birth';
      data.birth=useBirth?get('birth'):'';
      if(data.birth && (!h().isMonth(data.birth)||data.birth>today.slice(0,7)))return invalid(field('birth'),'请填写有效的出生年月，例如 1990-06，且不能晚于本月。');
      data.age=useBirth||get('age')===''?null:Number(get('age'));
      data.ageAsOf=data.age==null?'':get('ageAsOf');
      if(data.age!=null && !data.ageAsOf)return invalid(field('ageAsOf'),'请填写年龄登记日期。');
      if(data.birth && ['deptSince','establishmentSince','positionSince','rankSince'].some(k=>data[k]&&data[k].slice(0,7)<data.birth))return invalid(field('birth'),'出生年月不能晚于到科室、到编或任职月份。');
      data.history=[];
      for(const row of form.querySelectorAll('.pe-history-row')){
        const el=k=>row.querySelector('[name=history'+k+']');
        const entry={type:el('Type').value,title:el('Title').value.trim(),start:el('Start').value,end:el('End').value};
        const actual=el('ActualDept').value.trim(), establishment=el('EstablishmentDept').value.trim();
        if(actual)entry.actualDeptName=actual;
        if(establishment)entry.establishmentDeptName=establishment;
        if(!entry.title)return invalid(el('Title'),'请选择经历中的职务或职级。');
        if(data.birth && entry.start.slice(0,7)<data.birth)return invalid(el('Start'),'任职经历不能早于出生月份。');
        if(entry.end && entry.end<entry.start)return invalid(el('End'),'结束日期不能早于起始日期。');
        data.history.push(entry);
      }
      saving=true;
      try{
        const changed=axes.filter(axis=>originalId(axis)!=='' && (data[axis.id]==null || String(data[axis.id])!==originalId(axis)));
        if(changed.length){
          const choice=await confirmTransfer(p,data,changed);
          if(!choice || !form.isConnected)return;
          const changes={actual:false,establishment:false};
          for(const axis of changed){
            changes[axis.kind]=true;changes[axis.kind+'Date']=choice.dates[axis.kind];
            data[axis.since]=data[axis.id]!=null&&data[axis.id]!==''?choice.dates[axis.kind]:'';
            if(data.birth && data[axis.since] && data[axis.since].slice(0,7)<data.birth)return invalid(field(axis.since),axis.time+'不能早于出生月份，请修改后再保存。');
          }
          if(choice.record)h().rememberDept(data,p,choice.dates[changed[0].kind],changes);
        }
        if(existing){
          const index=people().findIndex(i=>i.id===existing.id);
          if(index<0){h().notify('该档案已被删除');finish();return;}
          people()[index]=data;
        }else{
          data.id=typeof crypto.randomUUID==='function'?crypto.randomUUID():'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
          people().push(data);
        }
        if(!await h().save())return;
        h().notify(existing?'人员档案已更新':'已录入'+data.name);dirty=false;
        if(form.isConnected)showPerson(data.id,finish);
      }finally{
        saving=false;
      }
    });
    top();
  }
  window.renderPeople=renderPeople;window.showPerson=showPerson;window.openPerson=openPerson;
})();
