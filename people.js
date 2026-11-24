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
  const blankFilters = () => ({q:'', deptId:'', gender:'', education:'', category:'', position:'', rank:'', min:'', max:''});
  let filters = blankFilters();
  let expanded = false;
  let limit = 60;

  function options(pairs, current, placeholder) {
    return [[ '', placeholder ], ...pairs].map(([value, label, disabled]) =>
      '<option value="'+esc(value)+'"'+(disabled?' disabled':'')+(String(current == null ? '' : current) === String(value) ? ' selected' : '')+'>'+esc(label)+'</option>'
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
  function historyDeptNames(){
    return '<datalist id="pe-history-depts">'+choices(h().state.depts.map(d=>d.name)).map(([name])=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist>';
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
    if (query && ![p.name,h().deptName(p.deptId),p.rank,p.position].some(v => String(v || '').toLocaleLowerCase().includes(query))) return false;
    const deptFilterValue = p.deptId == null || p.deptId === '' ? unassigned : String(p.deptId);
    if(filters.deptId && filters.deptId !== deptFilterValue) return false;
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
      return '<button type="button" class="pe-person" data-person="'+esc(p.id)+'"><span class="pe-row-body"><strong>'+esc(p.name)+'</strong>'+workDepartment(p)+'<small>'+meta+'</small></span>'+icon('next')+'</button>';
    }).join('')+(filtered.length>limit ? '<button type="button" class="pe-more" data-more>再显示 '+Math.min(60,filtered.length-limit)+' 人</button>' : '');
  }
  function workDepartment(p){
    return '<span class="pe-membership">实际工作科室 <b class="pe-dept">'+esc(h().deptName(p.deptId))+'</b></span>';
  }
  function renderPeople() {
    h().subBack = null;
    const departments = [[unassigned,'未分配科室'],...deptOptions()];
    if(!departments.some(([id])=>String(id)===filters.deptId)) filters.deptId='';
    const vals = k => choices([...h().jobTitles[k],...people().map(p=>p[k])]);
    view().innerHTML = '<div class="heading"><h1>人员台账</h1>'+button('pe-add',icon('add')+'录入人员','primary')+'</div>'+
      '<section class="panel pe-search"><div class="pe-search-row"><label class="pe-search-box">'+icon('search')+'<input id="pe-query" type="search" aria-label="搜索姓名、科室、职务或职级" placeholder="姓名、科室、职务或职级" value="'+esc(filters.q)+'"></label>'+
      '<button type="button" id="pe-toggle" class="secondary" aria-controls="pe-filters" aria-expanded="'+expanded+'">'+icon('filter')+'<span id="pe-filter-count">筛选</span></button></div>'+
      '<div id="pe-filters" class="fields pe-filters" '+(expanded ? '' : 'hidden')+'>'+
      filterSelect('deptId','实际工作科室',departments)+filterSelect('gender','性别',choices(['女','男','未登记']))+
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
  function resumeSummary(row,precise=false){
    const date=value=>(value||'').slice(0,precise?10:7).replace(/-/g,'.');
    const start=date(row.start)||'起月未登记';
    const end=date(row.end)||(row.roleEndUnknown?'止月未登记':'至今');
    const roles=[row.position,row.rank,row.otherType,row.otherTitle].filter(Boolean).map(esc).join(' · ');
    return '<span class="pe-resume-months">'+esc(start)+'—'+esc(end)+'</span><strong>'+esc(row.actualDeptName||'科室未登记')+'</strong>'+
      (roles?'<span>'+roles+'</span>':'')+(row.timelineCurrent?'<small>当前</small>':'');
  }
  function roleOptions(kind,previous){
    return h().jobChoices(kind,previous).map(([value,label])=>[value,label,!h().jobTitles[kind].includes(value)]);
  }
  function editResume(id,row,finish){
    if(row?.timelineCurrent){openPerson(id,finish);at('[name=position]').focus();return;}
    const initial=person(id);
    if(!initial){finish();return;}
    const fingerprint=JSON.stringify(initial);
    const monthly=row?.editPrecision==='month';
    const source=row||{};
    const initialDate=value=>(value||'').slice(0,monthly?7:10);
    const since=initialDate(source.start),until=initialDate(source.end);
    const attrs=monthly?'type="month" placeholder="YYYY-MM"':'type="date"';
    const needsDept=Boolean(row?.deptHistoryIndices.length);
    view().innerHTML=backButton('返回档案')+'<div class="heading"><h1>'+(row?'编辑简历经历':'添加简历经历')+'</h1></div>'+
      '<form id="pe-resume-form"><section class="panel"><div class="fields">'+
      input('start',monthly?'开始年月':'起始日期',since,attrs+(row?'':' required'))+
      input('end',(monthly?'结束年月':'结束日期')+(source.roleEndUnknown?'（未登记）':needsDept?'':'（至今可留空）'),until,attrs)+
      input('name','工作科室',source.actualDeptName,'maxlength="80"'+(needsDept?' required':''))+
      select('deptChoice','从现有科室选择',deptOptions(),'','选择科室')+
      select('position','职务',roleOptions('position',source.position),source.position,'未登记')+
      select('rank','职级',roleOptions('rank',source.rank),source.rank,'未登记')+'</div>'+otherHistoryRole(source)+'</section>'+
      '<p role="alert" class="pe-form-error" id="pe-resume-error" hidden></p><div class="pe-save"><button class="primary" type="submit">保存经历</button>'+button('pe-resume-cancel','取消')+'</div></form>'+
      (row?button('pe-resume-delete','删除此段经历','plain-btn danger')+'<div id="pe-resume-delete-check" class="panel pe-confirm" hidden><p>删除这段简历经历？</p><div class="action-row">'+button('pe-resume-keep','保留经历')+button('pe-resume-remove','确认删除','pe-destructive')+'</div></div>':'');
    const form=at('#pe-resume-form'),field=key=>form.elements.namedItem(key),error=at('#pe-resume-error');
    let saving=false;
    function leave(){
      if(saving)return;
      showPerson(id,finish);
      const heading=at('#pe-resume h2');
      if(heading){heading.focus({preventScroll:true});heading.scrollIntoView({block:'nearest'});}
    }
    function invalid(el,message){error.textContent=message;error.hidden=false;el.focus();}
    h().subBack=leave;on('#pe-back','click',leave);on('#pe-resume-cancel','click',leave);
    field('deptChoice').onchange=()=>{
      const selected=h().state.depts.find(d=>String(d.id)===field('deptChoice').value);
      if(selected)field('name').value=selected.name;
      field('deptChoice').value='';
    };
    form.oninput=()=>{error.hidden=true;};
    async function commit(remove){
      if(saving)return;
      const start=field('start').value,end=field('end').value;
      const actualDeptName=field('name').value.trim(),position=field('position').value,rank=field('rank').value;
      if(!remove){
        if(monthly&&((start&&!h().isMonth(start))||(end&&!h().isMonth(end))))return invalid(field('end'),'请填写有效年月。');
        if(start&&end&&start>end)return invalid(field('end'),'结束时间不能早于开始时间。');
        if(!row){
          if(!position&&!rank)return invalid(field('position'),'请至少选择职务或职级中的一项。');
          if(start>h().today()||end>h().today())return invalid(field(start>h().today()?'start':'end'),'日期不能晚于今天。');
          if(initial.birth&&start.slice(0,7)<initial.birth)return invalid(field('start'),'起始日期不能早于出生月份。');
        }
      }
      const current=person(id);
      if(!current||JSON.stringify(current)!==fingerprint){h().notify('档案内容已更新，请重新编辑');leave();return;}
      const draft=JSON.parse(JSON.stringify(current));
      try{
        if(remove)h().removeResumeEntry(draft,row);
        else if(row)h().updateResumeEntry(draft,row,{start,end,actualDeptName,position,rank,roleEndUnknown:!!source.roleEndUnknown&&!end});
        else{
          const entry={start,end};
          if(actualDeptName)entry.actualDeptName=actualDeptName;
          h().updateRoleHistory(entry,position,rank);
          draft.history=[...(draft.history||[]),entry];
        }
      }catch(err){invalid(field('name'),err.message);return;}
      people()[people().indexOf(current)]=draft;
      saving=true;form.querySelector('[type=submit]').disabled=true;
      try{if(!await h().save())return;}
      finally{saving=false;form.querySelector('[type=submit]').disabled=false;}
      if(form.isConnected){h().notify(remove?'简历经历已删除':'简历经历已保存');leave();}
    }
    form.onsubmit=event=>{event.preventDefault();return commit(false);};
    if(row){
      const check=at('#pe-resume-delete-check');
      const keep=()=>{check.hidden=true;at('#pe-resume-delete').hidden=false;h().subBack=leave;at('#pe-resume-delete').focus();};
      on('#pe-resume-delete','click',()=>{check.hidden=false;at('#pe-resume-delete').hidden=true;h().subBack=keep;at('#pe-resume-keep').focus();});
      on('#pe-resume-keep','click',keep);on('#pe-resume-remove','click',()=>commit(true));
    }
    top();
  }
  function backButton(label) {return button('pe-back',icon('back')+label,'pe-back');}
  function showPerson(id,back) {
    const p = person(id);
    const finish = typeof back === 'function' ? back : renderPeople;
    if(!p){finish();return;}
    h().subBack = finish;
    const a = h().age(p);
    const timeline=h().resumeTimeline(p);
    const departments=h().departmentResume(p,timeline);
    const editRecord=(row,index)=>'<button type="button" class="secondary" data-edit-resume="'+index+'" aria-label="编辑'+esc(row.actualDeptName||'该段')+'经历">编辑</button>';
    const recorded=new Set();
    const lines=departments.map((row,index)=>{
      const refs=row.recordIndices;
      const record=refs.length===1?timeline[refs[0]]:null;
      let action='';
      if(row.timelineCurrent)action='<button type="button" class="secondary" id="pe-edit-current-dept" aria-label="编辑当前科室经历">编辑</button>';
      else if(record&&row.start===record.start&&row.end===record.end){
        if(!record.position&&!record.rank&&!record.otherType&&!record.otherTitle)recorded.add(refs[0]);
        action=editRecord(row,refs[0]);
      }else if(refs.length){
        action='<button type="button" class="secondary" data-show-resume-record="'+refs[0]+'">查看经历</button>';
      }
      return '<li data-resume-row="'+index+'"'+(row.timelineCurrent?' data-current-role':'')+'><div class="pe-resume-entry">'+resumeSummary(row)+'</div>'+action+'</li>';
    }).join('');
    const records=timeline.map((row,index)=>{
      if(recorded.has(index) || (row.timelineCurrent&&row.actualDeptName&&departments.some(d=>d.timelineCurrent)))return '';
      return '<li data-resume-record="'+index+'"><div class="pe-resume-entry">'+resumeSummary(row,true)+'</div>'+editRecord(row,index)+'</li>';
    }).join('');
    view().innerHTML = backButton('返回')+'<div class="heading"><h1>人员档案</h1>'+button('pe-edit','编辑','secondary')+'</div>'+
      '<section class="panel pe-identity"><div class="pe-sign"><strong>'+esc(p.name)+'</strong>'+workDepartment(p)+'</div><dl class="pe-details">'+
      detailField('性别',p.gender)+detailField('年龄',a == null || a === '' ? '' : a+' 岁')+
      detailField(p.birth?'出生年月':'年龄登记日期',p.birth || p.ageAsOf)+detailField('学历',p.education)+detailField('人员类别',p.category)+(p.deptId!=null&&p.deptId!==''?detailField('实际到科室时间',p.deptSince):'')+
      detailField('现任职务',p.position)+detailField('任现职务时间',p.positionSince)+detailField('现职级',p.rank)+
      (h().separateRankEligible(p.rank)?'<div data-rank-separate><dt>是否单列</dt><dd>'+(h().separateRank(p)?'是':'否')+'</dd></div>':'')+
      detailField('任现职级时间',p.rankSince)+'</dl></section>'+
      '<section class="panel" id="pe-resume"><div class="panel-head"><h2 tabindex="-1">个人简历</h2>'+button('pe-add-resume',icon('add')+'添加经历','secondary')+'</div>'+
      (lines?'<ol class="pe-resume-list">'+lines+'</ol>':'')+
      (records?(lines?'<details class="pe-resume-records"><summary>任职明细</summary>':'')+'<ol class="pe-resume-list">'+records+'</ol>'+(lines?'</details>':''):'')+
      (lines||records?'':'<p class="pe-muted">尚未登记经历。</p>')+'</section>'+
      button('pe-delete','删除该档案','plain-btn danger')+'<div class="panel pe-confirm" id="pe-confirm" hidden><p>删除“'+esc(p.name)+'”及其个人简历？此操作无法撤销。</p><div class="action-row">'+button('pe-keep','保留档案')+button('pe-remove','确认删除','pe-destructive')+'</div></div>';
    on('#pe-add-resume','click',()=>editResume(p.id,null,finish));
    on('#pe-edit-current-dept','click',()=>{openPerson(p.id,finish);at('[name=deptSince]').focus();});
    on('#pe-resume','click',event=>{
      const edit=event.target.closest('[data-edit-resume]');
      if(edit)editResume(p.id,timeline[Number(edit.dataset.editResume)],finish);
      const show=event.target.closest('[data-show-resume-record]');
      if(show){
        at('.pe-resume-records').open=true;
        at('[data-resume-record="'+show.dataset.showResumeRecord+'"] [data-edit-resume]').focus();
      }
    });
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
  function otherHistoryRole(values){
    const original=[values.otherType,values.otherTitle].filter(Boolean).join(' · ');
    return original?'<p class="pe-muted">原记录　'+esc(original)+'</p>':'';
  }
  function historyFields(item={},index='') {
    const values=h().roleHistoryValues(item);
    const today=h().today();
    const dateAttr=value=>'type="date" max="'+(value&&value>today?esc(value):today)+'"';
    return '<div class="pe-history-row" data-index="'+index+'"><div class="pe-history-head"><strong>任职记录</strong><button type="button" class="plain-btn danger" data-remove>移除此条</button></div>'+
      otherHistoryRole(values)+'<div class="fields pe-manual-fields">'+
      select('historyPosition','职务',roleOptions('position',values.position),values.position,'请选择')+
      select('historyRank','职级',roleOptions('rank',values.rank),values.rank,'请选择')+
      input('historyActualDept','当时实际工作科室',item.actualDeptName,'list="pe-history-depts" maxlength="80" placeholder="选择或填写当时名称"')+
      input('historyStart','起始日期',item.start,dateAttr(item.start)+(index===''||item.start?' required':''))+
      input('historyEnd',item.roleEndUnknown?'结束日期（原记录未登记）':'结束日期（至今可留空）',item.end,dateAttr(item.end))+'</div></div>';
  }
  const changeAxes=[
    {key:'dept',field:'deptId',since:'deptSince',label:'实际工作科室',sinceLabel:'实际到科室时间',input:'pe-transfer-date',dateLabel:'调动生效日期'},
    {key:'position',field:'position',since:'positionSince',label:'职务',sinceLabel:'任现职务时间',input:'pe-transfer-position-date',dateLabel:'职务变更生效日期'},
    {key:'rank',field:'rank',since:'rankSince',label:'职级',sinceLabel:'任现职级时间',input:'pe-transfer-rank-date',dateLabel:'职级变更生效日期'}
  ];
  function confirmTransfer(previous,draft,axes,prefill={}){
    const dialog=document.createElement('dialog');
    dialog.id='pe-transfer';
    dialog.className='pe-transfer';
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','pe-transfer-heading');
    dialog.setAttribute('aria-describedby','pe-transfer-route');
    const today=h().today();
    const deptChange=axes.some(axis=>axis.key==='dept');
    const dateDefault=(deptChange&&draft.deptSince)||today;
    const earliest=axis=>[previous[axis.since]||'',previous.roleTimelineSince||''].sort()[1];
    const display=(record,axis)=>axis.key==='dept'?h().deptName(record.deptId):record[axis.field]||'未登记';
    const routes=axes.map(axis=>'<span>'+axis.label+'　'+esc(display(previous,axis))+' → '+esc(display(draft,axis))+'</span>').join('');
    const fields=axes.map(axis=>{
      const date=prefill[axis.key]||draft[axis.since]||dateDefault;
      return '<label>'+axis.dateLabel+'<input id="'+axis.input+'" type="date" required max="'+today+'" min="'+esc(earliest(axis))+'" value="'+esc(date)+'"></label>';
    }).join('');
    dialog.innerHTML='<div class="panel pe-transfer-card"><h2 tabindex="-1" id="pe-transfer-heading">'+(deptChange&&axes.length===1?'确认科室变更':'确认任职变更')+'</h2>'+
      '<p id="pe-transfer-route"><b>'+esc(draft.name)+'</b>'+routes+'</p>'+
      '<div class="pe-transfer-summary"><p>确认后，前后任期将按生效日期记入个人简历。</p></div>'+
      '<div class="pe-change-dates">'+fields+'</div><p role="alert" id="pe-transfer-error" class="pe-form-error" hidden></p>'+
      button('pe-transfer-record','确认变动并记录经历','primary')+
      '<p class="hint">测试或录入有误时，可仅更正当前资料。</p>'+
      button('pe-transfer-correct','仅更正资料')+button('pe-transfer-back','返回修改','plain-btn')+'</div>';
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
        for(const axis of axes){
          const input=dialog.querySelector('#'+axis.input);
          const value=input.value;
          if(!value||!input.validity.valid||value>today||value<earliest(axis)||(draft.birth&&value.slice(0,7)<draft.birth)){
            error.textContent=axis.dateLabel+'须为'+(earliest(axis)?earliest(axis)+' 至今天':'今天或更早的日期')+'，且不能早于出生月份。';
            error.hidden=false;input.focus();return;
          }
          dates[axis.key]=value;
        }
        close({record:true,dates});
      };
      const untouchedDates=new Set(axes.filter(axis=>axis.key!=='dept'&&!draft[axis.since]&&!prefill[axis.key]).map(axis=>axis.input));
      function dateChanged(event){
        error.hidden=true;
        if(event.target.id==='pe-transfer-date'){
          untouchedDates.forEach(id=>{dialog.querySelector('#'+id).value=event.target.value;});
        }else untouchedDates.delete(event.target.id);
      }
      dialog.oninput=dateChanged;dialog.onchange=dateChanged;
      dialog.querySelector('#pe-transfer-correct').onclick=()=>close({record:false});
      dialog.querySelector('#pe-transfer-back').onclick=()=>close(null);
      dialog.oncancel=event=>{event.preventDefault();close(null);};
      dialog.onkeydown=event=>{
        if(event.key==='Escape'){event.preventDefault();close(null);}
        if(native||event.key!=='Tab')return;
        const first=dialog.querySelector('input'),last=dialog.querySelector('#pe-transfer-back');
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.querySelector('h2'))){event.preventDefault();last.focus();}
        if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
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
    const departments=deptOptions();
    const mode = p.age != null && p.age!=='' && !p.birth ? 'age' : 'birth';
    const date = 'type="date" max="'+today+'"';
    const originalId=p.deptId==null?'':String(p.deptId);
    const resume=existing?h().resumeTimeline(p):[];
    const links=new Map();
    resume.forEach((row,resumeIndex)=>{
      if(!(row.timelineCurrent||row.deptHistoryIndices.length||row.coveredDeptIndices?.length||row.historyIndices.length>1))return;
      for(const i of row.historyIndices){
        if(!links.has(i))links.set(i,[]);
        links.get(i).push(resumeIndex);
      }
    });
    const manual=(p.history||[]).map((entry,index)=>{
      const indices=links.get(index);
      if(!indices)return historyFields(entry,index);
      const linked=resume[indices[0]];
      return '<div class="pe-history-row" data-index="'+index+'" data-shared-history><div class="pe-resume-entry">'+resumeSummary(linked)+'</div>'+
        '<button type="button" class="txt" data-open-linked="'+index+'">'+(indices.length===1&&linked.timelineCurrent?'编辑当前任职':'在个人简历中编辑')+'</button></div>';
    }).join('');

    view().innerHTML = backButton('返回')+'<div class="heading"><h1>'+ (existing ? '编辑人员' : '录入人员')+'</h1><span class="hint">* 必填</span></div>'+
      '<form id="pe-form"><section class="panel"><h2>基本资料</h2><div class="fields pe-form-fields">'+input('name','姓名 *',p.name,'required maxlength="80" autocomplete="off"')+
      select('gender','性别',choices(['女','男','未登记']),p.gender || '未登记','请选择')+customSelect('education','学历',[...education,p.education,...people().map(z=>z.education)],p.education)+
      customSelect('category','人员类别',[...categories,p.category,...people().map(z=>z.category)],p.category)+
      '<div class="pe-age-fields wide"><fieldset class="pe-age-choice"><legend>年龄信息</legend>'+
      ['birth','age'].map((k,i)=>'<label><input type="radio" name="ageMode" value="'+k+'"'+(mode===k?' checked':'')+'>'+['填出生年月','填登记年龄'][i]+'</label>').join('')+'</fieldset>'+
      '<div class="fields" id="pe-birth">'+input('birth','出生年月',p.birth,'type="month" max="'+today.slice(0,7)+'" placeholder="YYYY-MM，如 1990-06" maxlength="7"')+'</div><div class="fields" id="pe-age">'+
      input('age','登记年龄（周岁）',p.age,'type="number" inputmode="numeric" min="0" max="130" step="1"')+input('ageAsOf','年龄登记日期',p.ageAsOf||today,date)+'</div></div></div></section>'+
      '<section class="panel"><h2>科室归属</h2><div class="fields pe-form-fields">'+
      select('deptId','实际工作科室',departments,p.deptId,'未分配实际工作科室')+
      input('deptSince','实际到科室时间',p.deptSince,date)+'</div></section>'+
      '<section class="panel"><h2>当前任职</h2><div class="fields pe-form-fields">'+select('position','现任职务',h().jobChoices('position',p.position),p.position,'未登记')+
      input('positionSince','任现职务时间',p.positionSince,date)+
      select('rank','现职级',h().jobChoices('rank',p.rank),p.rank,'未登记')+
      '<div class="pe-rank-mark"><label><input id="pe-rank-separate" name="rankSeparate" type="checkbox" aria-describedby="pe-rank-hint">是否单列</label>'+
      '<small class="hint" id="pe-rank-hint"></small></div>'+input('rankSince','任现职级时间',p.rankSince,date)+
      '</div></section><section class="panel"><div class="panel-head"><h2>简历经历</h2>'+button('pe-add-history',icon('add')+'添加经历','secondary')+
      '</div>'+historyDeptNames()+'<div id="pe-history">'+manual+'</div><p class="pe-muted" id="pe-history-empty">同一段经历可同时登记职务和职级。</p></section>'+
      '<p role="alert" class="pe-form-error" id="pe-error" hidden></p><div class="pe-save"><button type="submit" class="primary">保存档案</button>'+button('pe-cancel','取消')+'</div></form>'+
      '<section class="panel pe-confirm" id="pe-discard" hidden><p>放弃尚未保存的修改？</p><div class="action-row">'+button('pe-discard-resume','继续编辑')+button('pe-leave','放弃修改','pe-destructive')+'</div></section>';
    const form=at('#pe-form');
    const field=key=>form.elements.namedItem(key);
    let dirty=false, saving=false, lastDecision=null;
    let afterDiscard=leave;
    const closeDiscard=()=>{at('#pe-discard').hidden=true;h().subBack=tryLeave;};
    function switchView(next){
      if(!dirty){next();return;}
      afterDiscard=next;
      at('#pe-discard').hidden=false;h().subBack=closeDiscard;at('#pe-discard-resume').focus();
    }
    function tryLeave(){switchView(leave);}
    h().subBack=tryLeave;
    on('#pe-back','click',tryLeave);on('#pe-cancel','click',tryLeave);on('#pe-discard-resume','click',closeDiscard);on('#pe-leave','click',()=>afterDiscard());
    const syncMode=()=>{
      for(const k of ['birth','age']){
        const hidden=field('ageMode').value!==k;
        at('#pe-'+k).hidden=hidden;
        at('#pe-'+k).querySelectorAll('input').forEach(el=>el.disabled=hidden);
      }
    };
    function syncHistory(){at('#pe-history-empty').hidden=!!at('.pe-history-row');}
    function syncSince(axis){
      const selected=field(axis.field).value;
      const since=field(axis.since);
      const start=selected&&selected===String(p[axis.field]??'')?p[axis.since]||'':'';
      if(since.value!==start||since.defaultValue!==start){
        // Recreate the input so WebKit clears its previous date-picker state.
        since.parentElement.outerHTML=input(axis.since,axis.sinceLabel,start,date);
      }
      field(axis.since).disabled=!selected;
    }
    function syncRankSeparate(checked){
      const available=h().separateRankEligible(field('rank').value);
      const mark=field('rankSeparate');
      mark.disabled=!available;
      mark.checked=available&&checked;
      at('#pe-rank-hint').textContent=available?'单列人员计入实有，不占该职级职数。':'请先选择现职级。';
    }
    syncMode();syncHistory();changeAxes.forEach(syncSince);syncRankSeparate(h().separateRank(p));
    function setDirty(){dirty=true;at('#pe-error').hidden=true;}
    form.addEventListener('input',setDirty);
    form.addEventListener('change',e=>{
      setDirty();
      if(e.target.name==='ageMode')syncMode();
      const axis=changeAxes.find(axis=>axis.field===e.target.name);
      if(axis)syncSince(axis);
      if(e.target.name==='rank')syncRankSeparate(false);
      if(['education','category'].includes(e.target.name)){
        const other=field(e.target.name+'Other');
        other.disabled=e.target.value!=='__custom__';other.required=!other.disabled;other.parentElement.hidden=other.disabled;
        if(!other.disabled)other.focus();
      }
    });
    on('#pe-add-history','click',()=>{at('#pe-history').insertAdjacentHTML('beforeend',historyFields());setDirty();syncHistory();at('#pe-history').lastElementChild.querySelector('[name=historyPosition]').focus();});
    on('#pe-history','click',e=>{
      const btn=e.target.closest('[data-remove]');
      if(btn){btn.closest('.pe-history-row').remove();setDirty();syncHistory();return;}
      const link=e.target.closest('[data-open-linked]');
      if(!link)return;
      const indices=links.get(Number(link.dataset.openLinked));
      const target=resume[indices[0]];
      if(indices.length===1&&target.timelineCurrent){field('position').focus();return;}
      switchView(()=>{
        if(indices.length===1){editResume(p.id,target,finish);return;}
        showPerson(p.id,finish);at('#pe-resume').scrollIntoView({block:'start'});
      });
    });
    function invalid(el,message){at('#pe-error').textContent=message;at('#pe-error').hidden=false;el.focus();h().notify(message);return false;}
    form.addEventListener('submit', async event=>{
      event.preventDefault();
      if(saving)return;
      const get=key=>field(key).value.trim();
      if(!get('name'))return invalid(field('name'),'请填写姓名。');
      const data=Object.assign({},p);
      for(const k of ['name','gender','education','category','rank','position','rankSince','positionSince'])data[k]=get(k);
      const selected=get('deptId');
      const department=departments.find(([key])=>String(key)===selected);
      if(selected && !department)return invalid(field('deptId'),'请选择有效的实际工作科室。');
      data.deptId=department?department[0]:'';
      data.deptSince=department?get('deptSince'):'';
      for(const k of ['education','category']){
        if(data[k]!=='__custom__')continue;
        data[k]=get(k+'Other');
        if(!data[k] || data[k]==='__custom__')return invalid(field(k+'Other'),'请填写'+(k==='education'?'学历':'人员类别')+'。');
      }
      data.rankSeparate=h().separateRankEligible(data.rank)&&field('rankSeparate').checked;
      for(const [k,label] of [['position','职务'],['rank','职级']]) {
        if(!data[k] && data[k+'Since'])return invalid(field(k),'请选择对应的'+label+'。');
      }
      const useBirth=get('ageMode')==='birth';
      data.birth=useBirth?get('birth'):'';
      if(data.birth && (!h().isMonth(data.birth)||data.birth>today.slice(0,7)))return invalid(field('birth'),'请填写有效的出生年月，例如 1990-06，且不能晚于本月。');
      data.age=useBirth||get('age')===''?null:Number(get('age'));
      data.ageAsOf=data.age==null?'':get('ageAsOf');
      if(data.age!=null && !data.ageAsOf)return invalid(field('ageAsOf'),'请填写年龄登记日期。');
      if(data.birth && ['deptSince','positionSince','rankSince'].some(k=>data[k]&&data[k].slice(0,7)<data.birth))return invalid(field('birth'),'出生年月不能晚于到科室或任职月份。');
      data.history=[];
      for(const row of form.querySelectorAll('.pe-history-row')){
        const el=k=>row.querySelector('[name=history'+k+']');
        const existingRow=row.dataset.index!=='';
        const original=existingRow?p.history[Number(row.dataset.index)]:{};
        if(row.hasAttribute('data-shared-history')){data.history.push({...original});continue;}
        const entry={...original};
        try{
          h().updateRoleHistory(entry,el('Position').value,el('Rank').value);
        }catch{
          return invalid(el('Position'),'请至少选择职务或职级中的一项。');
        }
        const start=el('Start').value, end=el('End').value;
        const startChanged=!existingRow||start!==(original.start||'');
        const endChanged=!existingRow||end!==(original.end||'');
        if(startChanged||endChanged){
          if(startChanged&&start>today)return invalid(el('Start'),'起始日期不能晚于今天。');
          if(endChanged&&end>today)return invalid(el('End'),'结束日期不能晚于今天。');
          if(data.birth&&start&&start.slice(0,7)<data.birth)return invalid(el('Start'),'经历不能早于出生月份。');
          if(start&&end&&end<start)return invalid(el('End'),'结束日期不能早于起始日期。');
        }
        if(startChanged)entry.start=start;
        if(endChanged){entry.end=end;if(end)delete entry.roleEndUnknown;}
        const actual=el('ActualDept').value.trim();
        if(actual!==String(original.actualDeptName||'').trim()){
          if(actual)entry.actualDeptName=actual;else delete entry.actualDeptName;
        }
        data.history.push(entry);
      }
      saving=true;
      try{
        if(existing){
          const axes=changeAxes.filter(axis=>String(data[axis.field]??'')!==String(p[axis.field]??''));
          const signature=JSON.stringify(axes.map(axis=>[axis.key,data[axis.field],data[axis.since]]));
          const prefill=lastDecision?.signature===signature?lastDecision.dates:{};
          const choice=axes.length?await confirmTransfer(p,data,axes,prefill):{record:false};
          if(!choice||!form.isConnected)return;
          lastDecision=choice.record?{signature,dates:choice.dates}:null;
          for(const axis of axes){
            const active=String(data[axis.field]??'')!=='';
            data[axis.since]=active?(choice.record?choice.dates[axis.key]:data[axis.since]||p[axis.since]||''):'';
          }
          if(data.birth){
            const early=axes.find(axis=>data[axis.since]&&data[axis.since].slice(0,7)<data.birth);
            if(early)return invalid(field(early.since),early.sinceLabel+'不能早于出生月份。');
          }
          try{
            h().syncRoleHistory(data,p,{mode:choice.record?'change':'correct',dates:choice.dates||{}});
          }catch(error){
            return invalid(field('deptId'),error.message);
          }
          if(choice.record&&choice.dates.dept&&originalId){
            const departure={...p},move=choice.dates.dept;
            for(const key of ['position','rank']){
              const since=key+'Since';
              if(choice.dates[key]&&choice.dates[key]<move){
                departure[key]=data[key];departure[since]=data[since];
              }else if(p[since]&&p[since]>=move){
                departure[key]='';departure[since]='';
              }
            }
            h().rememberDept(data,departure,move);
          }
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
