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
      return '<button type="button" class="pe-person" data-person="'+esc(p.id)+'"><span class="pe-row-body"><span class="pe-primary-line"><strong>'+esc(p.name)+'</strong><span class="pe-dept">'+esc(h().deptName(p.deptId))+'</span></span><small>'+meta+'</small></span>'+icon('next')+'</button>';
    }).join('')+(filtered.length>limit ? '<button type="button" class="pe-more" data-more>再显示 '+Math.min(60,filtered.length-limit)+' 人</button>' : '');
  }
  function renderPeople() {
    h().subBack = null;
    const departments = [[unassigned,'未分配科室'],...deptOptions()];
    if(!departments.some(([id])=>String(id)===filters.deptId)) filters.deptId='';
    const vals = k => choices(people().map(p=>p[k]));
    view().innerHTML = '<div class="heading"><h1>人员台账</h1>'+button('pe-add',icon('add')+'录入人员','primary')+'</div>'+
      '<section class="panel pe-search"><div class="pe-search-row"><label class="pe-search-box">'+icon('search')+'<input id="pe-query" type="search" aria-label="搜索姓名、科室、职务或职级" placeholder="姓名、科室、职务或职级" value="'+esc(filters.q)+'"></label>'+
      '<button type="button" id="pe-toggle" class="secondary" aria-controls="pe-filters" aria-expanded="'+expanded+'">'+icon('filter')+'<span id="pe-filter-count">筛选</span></button></div>'+
      '<div id="pe-filters" class="fields pe-filters" '+(expanded ? '' : 'hidden')+'>'+
      filterSelect('deptId','所属科室',departments)+filterSelect('gender','性别',choices(['女','男','未登记']))+
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
      '<section class="panel pe-identity"><div class="pe-sign"><strong>'+esc(p.name)+'</strong><span>'+esc(h().deptName(p.deptId))+'</span></div><dl class="pe-details">'+
      detailField('性别',p.gender)+detailField('年龄',a == null || a === '' ? '' : a+' 岁')+
      detailField(p.birth?'出生日期':'年龄登记日期',p.birth || p.ageAsOf)+detailField('学历',p.education)+detailField('人员类别',p.category)+(p.deptId!=='' && p.deptId!=null ? detailField('到科室时间',p.deptSince) : '')+'</dl></section>'+
      (pastDepts.length ? '<section class="panel"><h2>历次科室</h2><ol class="pe-timeline">'+pastDepts.map(d=>'<li><strong>'+esc(d.name)+'</strong><span>到科室时间 '+pretty(d.start)+' · 归属变更登记日 '+pretty(d.end)+'</span></li>').join('')+'</ol></section>' : '')+
      '<section class="panel"><h2>当前任职</h2><dl class="pe-details">'+detailField('职务',p.position)+detailField('任现职务时间',p.positionSince)+detailField('职级',p.rank)+detailField('任现职级时间',p.rankSince)+'</dl></section>'+
      '<section class="panel"><h2>任职经历</h2>'+(timeline.length ? '<ol class="pe-timeline">'+timeline.map(e=>
      '<li><span>'+esc(e.start || '起始日期未登记')+' 至 '+esc(e.end || '今')+'</span><strong>'+esc(e.title)+'</strong><small>'+esc(e.type)+'</small></li>').join('')+'</ol>' : '<p class="pe-muted">尚未登记历次任职。</p>')+'</section>'+
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
    return '<div class="pe-history-row"><div class="pe-history-head"><strong>任职记录</strong><button type="button" class="plain-btn danger" data-remove>移除此条</button></div><div class="fields">'+
      select('historyType','类型',choices(['职务','职级']),item.type || '职务','请选择','required')+
      input('historyTitle','职务或职级名称',item.title,'maxlength="120" required')+
      input('historyStart','起始日期',item.start,'type="date" max="'+h().today()+'" required')+
      input('historyEnd','结束日期（至今可留空）',item.end,'type="date" max="'+h().today()+'"')+'</div></div>';
  }
  function openPerson(id,back){
    const existing = id == null ? null : person(id);
    if(id != null && !existing){h().notify('未找到该人员');renderPeople();return;}
    const finish = typeof back === 'function' ? back : renderPeople;
    const leave = existing ? ()=>showPerson(existing.id,finish) : finish;
    const p = existing || {};
    const today = h().today();
    const depts=deptOptions();
    const mode = p.age != null && p.age!=='' && !p.birth ? 'age' : 'birth';
    const date = 'type="date" max="'+today+'"';
    view().innerHTML = backButton('返回')+'<div class="heading"><h1>'+ (existing ? '编辑人员' : '录入人员')+'</h1><span class="hint">* 必填</span></div>'+
      '<form id="pe-form"><section class="panel"><h2>基本资料</h2><div class="fields pe-form-fields">'+input('name','姓名 *',p.name,'required maxlength="80" autocomplete="off"')+
      select('gender','性别',choices(['女','男','未登记']),p.gender || '未登记','请选择')+select('deptId','所属科室',depts,p.deptId,'未分配科室')+
      input('deptSince','到科室时间',p.deptSince,date)+customSelect('education','学历',[...education,p.education,...people().map(z=>z.education)],p.education)+
      customSelect('category','人员类别',[...categories,p.category,...people().map(z=>z.category)],p.category)+
      '<div class="pe-age-fields wide"><fieldset class="pe-age-choice"><legend>年龄信息</legend>'+
      ['birth','age'].map((k,i)=>'<label><input type="radio" name="ageMode" value="'+k+'"'+(mode===k?' checked':'')+'>'+['填出生日期','填登记年龄'][i]+'</label>').join('')+'</fieldset>'+
      '<div class="fields" id="pe-birth">'+input('birth','出生日期',p.birth,date)+'</div><div class="fields" id="pe-age">'+
      input('age','登记年龄（周岁）',p.age,'type="number" inputmode="numeric" min="0" max="130" step="1"')+input('ageAsOf','年龄登记日期',p.ageAsOf||today,date)+'</div></div></div></section>'+
      '<section class="panel"><h2>当前任职</h2><div class="fields pe-form-fields">'+input('position','现任职务',p.position,'maxlength="120"')+
      input('positionSince','任现职务时间',p.positionSince,date)+input('rank','现职级',p.rank,'maxlength="120"')+input('rankSince','任现职级时间',p.rankSince,date)+
      '</div></section><section class="panel"><div class="panel-head"><h2>任职经历</h2>'+button('pe-add-history',icon('add')+'添加经历','secondary')+
      '</div><div id="pe-history">'+(p.history||[]).map(historyFields).join('')+'</div><p class="pe-muted" id="pe-history-empty">可按时间登记历次职务或职级。</p></section>'+
      '<p role="alert" class="pe-form-error" id="pe-error" hidden></p><div class="pe-save"><button type="submit" class="primary">保存档案</button>'+button('pe-cancel','取消')+'</div></form>'+
      '<section class="panel pe-confirm" id="pe-discard" hidden><p>放弃尚未保存的修改？</p><div class="action-row">'+button('pe-resume','继续编辑')+button('pe-leave','放弃修改','pe-destructive')+'</div></section>';
    const form=at('#pe-form');
    const field=key=>form.elements.namedItem(key);
    let dirty=false;
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
    const originalDept = p.deptId == null ? '' : String(p.deptId);
    function syncDept() {
      const selected = field('deptId').value;
      const since = field('deptSince');
      since.disabled = !selected;
      since.value = selected && selected === originalDept ? p.deptSince || '' : '';
    }
    syncMode();syncHistory();syncDept();
    function setDirty(){dirty=true;at('#pe-error').hidden=true;}
    form.addEventListener('input',setDirty);
    form.addEventListener('change',e=>{
      setDirty();
      if(e.target.name==='ageMode')syncMode();
      if(e.target.name==='deptId')syncDept();
      if(['education','category'].includes(e.target.name)){
        const other=field(e.target.name+'Other');
        other.disabled=e.target.value!=='__custom__';other.required=!other.disabled;other.parentElement.hidden=other.disabled;
        if(!other.disabled)other.focus();
      }
    });
    on('#pe-add-history','click',()=>{at('#pe-history').insertAdjacentHTML('beforeend',historyFields());setDirty();syncHistory();at('#pe-history').lastElementChild.querySelector('[name=historyTitle]').focus();});
    on('#pe-history','click',e=>{const btn=e.target.closest('[data-remove]');if(btn){btn.closest('.pe-history-row').remove();setDirty();syncHistory();}});
    function invalid(el,message){at('#pe-error').textContent=message;at('#pe-error').hidden=false;el.focus();h().notify(message);return false;}
    form.addEventListener('submit', event=>{
      event.preventDefault();
      const get=key=>field(key).value.trim();
      if(!get('name'))return invalid(field('name'),'请填写姓名。');
      const deptId=get('deptId');
      const department=depts.find(([key])=>String(key)===deptId);
      if(deptId && !department)return invalid(field('deptId'),'请选择有效的科室。');
      const data=Object.assign({},p);
      if(originalDept && originalDept!==deptId) {
        data.deptHistory=(p.deptHistory || []).slice();
        h().rememberDept(data);
      }
      for(const k of ['name','gender','education','category','rank','position','rankSince','positionSince'])data[k]=get(k);
      data.deptId=department ? department[0] : '';
      data.deptSince=deptId ? get('deptSince') : '';
      for(const k of ['education','category']){
        if(data[k]!=='__custom__')continue;
        data[k]=get(k+'Other');
        if(!data[k] || data[k]==='__custom__')return invalid(field(k+'Other'),'请填写'+(k==='education'?'学历':'人员类别')+'。');
      }
      for(const [k,label] of [['position','职务'],['rank','职级']]) {
        if(!data[k] && data[k+'Since'])return invalid(field(k),'请填写对应的'+label+'名称。');
      }
      const useBirth=get('ageMode')==='birth';
      data.birth=useBirth?get('birth'):'';
      data.age=useBirth||get('age')===''?null:Number(get('age'));
      data.ageAsOf=data.age==null?'':get('ageAsOf');
      if(data.age!=null && !data.ageAsOf)return invalid(field('ageAsOf'),'请填写年龄登记日期。');
      if(data.birth && ['deptSince','positionSince','rankSince'].some(k=>data[k]&&data[k]<data.birth))return invalid(field('birth'),'出生日期应在到科室和任职日期之前。');
      data.history=[];
      for(const row of form.querySelectorAll('.pe-history-row')){
        const el=k=>row.querySelector('[name=history'+k+']');
        const entry={type:el('Type').value,title:el('Title').value.trim(),start:el('Start').value,end:el('End').value};
        if(!entry.title)return invalid(el('Title'),'请填写经历中的职务或职级名称。');
        if(data.birth && entry.start<data.birth)return invalid(el('Start'),'任职经历不能早于出生日期。');
        if(entry.end && entry.end<entry.start)return invalid(el('End'),'结束日期不能早于起始日期。');
        data.history.push(entry);
      }
      if(existing){
        const index=people().findIndex(i=>i.id===existing.id);
        if(index<0){h().notify('该档案已被删除');finish();return;}
        people()[index]=data;
      }else{
        data.id=typeof crypto.randomUUID==='function'?crypto.randomUUID():'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
        people().push(data);
      }
      if(!h().save())return;
      h().notify(existing?'人员档案已更新':'已录入'+data.name);dirty=false;showPerson(data.id,finish);
    });
    top();
  }
  window.renderPeople=renderPeople;window.showPerson=showPerson;window.openPerson=openPerson;
})();
