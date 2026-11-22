(() => {
  'use strict';
  const exact = {rank:'现职级', position:'现职务', category:'人员类别'};
  const tenure = {
    rankMonths:['rankSince','任现职级'], positionMonths:['positionSince','任现职务'], deptMonths:['deptSince','到科室']
  };
  const levels = ['初中','高中','大专','本科','硕士研究生','博士研究生'];
  const educationAlias = {专科:'大专',大学专科:'大专',大学本科:'本科',硕士:'硕士研究生',博士:'博士研究生'};
  const text = v => v == null ? '' : String(v).trim();
  const owns = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  const normEdu = value => owns(educationAlias,value) ? educationAlias[value] : value;
  const fields = ['id','name','target','source','manual','education',...Object.keys(exact),...Object.keys(tenure)];
  function validatePolicies(rules) {
    if (!Array.isArray(rules)) return false;
    const ids = new Set();
    return rules.every(r => {
      if (!r || typeof r !== 'object' || Array.isArray(r) || !Object.keys(r).every(k=>fields.includes(k))) return false;
      const id = text(r.id);
      if (!id || ids.has(id) || typeof r.name!=='string' || !r.name.trim() || typeof r.target!=='string' || !r.target.trim()) return false;
      ids.add(id);
      if (['source','manual','education',...Object.keys(exact)].some(k=>r[k]!=null && typeof r[k]!=='string')) return false;
      if (r.education && !levels.includes(r.education)) return false;
      for (const k of Object.keys(tenure)) {
        if (r[k]!=null && r[k]!=='' && (!Number.isInteger(r[k]) || r[k]<0 || r[k]>1200)) return false;
      }
      return !!(text(r.manual) || r.education || Object.keys(exact).some(k=>text(r[k])) || Object.keys(tenure).some(k=>r[k]>0));
    });
  }
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0,4)<'1000') return null;
    const [y,m,d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y,m-1,d));
    return dt.getUTCMonth()===m-1 && dt.getUTCDate()===d ? [y,m,d] : null;
  }
  function anniversary(value, months) {
    const parts = parseDate(value);
    if (!parts) return null;
    const [y,m,d] = parts;
    const first = new Date(Date.UTC(y,m-1+months,1));
    const last = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    first.setUTCDate(Math.min(d,last));
    return first.getUTCFullYear()>9999 ? null : first.toISOString().slice(0,10);
  }
  function check(person, rule, date, reasons = true) {
    let pending = false, missed = false;
    const notes = [];
    function item(status, desc) {
      if (status==='miss') missed=true;
      if (status==='review') pending=true;
      if (reasons) notes.push(desc);
    }
    for (const [key,label] of Object.entries(exact)) {
      const wanted = text(rule[key]);
      if (!wanted) continue;
      const actual = text(person[key]);
      item(!actual || actual==='未登记'?'review':actual===wanted?'hit':'miss', label+'要求“'+wanted+'”，已登记“'+(actual||'未填写')+'”');
    }
    if (rule.education) {
      const actual = levels.indexOf(normEdu(text(person.education)));
      const desired = levels.indexOf(rule.education);
      item(actual<0 || desired<0?'review':actual>=desired?'hit':'miss',
        '学历至少为'+rule.education+'，已登记“'+(text(person.education)||'未填写')+'”');
    }
    for (const [key,[startKey,label]] of Object.entries(tenure)) {
      if (!rule[key]) continue;
      if (key==='deptMonths' && person.deptId==='') {
        item('miss','当前未分配科室，尚未开始本次科室任期');
        continue;
      }
      const due = anniversary(person[startKey],rule[key]);
      item(!due?'review':date>=due?'hit':'miss',label+'满 '+rule[key]+' 个月'+(due?'，于 '+due+' 达到':'，起算日期缺失或无效'));
    }
    if (text(rule.manual)) item('review','需人工核验：'+text(rule.manual));
    return {status:missed?'miss':pending?'review':'hit',notes};
  }
  function summarize(people,rules,date,today) {
    const counts = {hit:0,review:0,miss:0,newHit:0};
    const perRule = rules.map(()=>({hit:0,review:0,miss:0}));
    const rows = [];
    if (!rules.length) return {counts,rows,perRule};
    for (const person of people) {
      const statuses = rules.map((rule,i)=>{
        const status = check(person,rule,date,false).status;
        perRule[i][status]++;
        return status;
      });
      const status = statuses.includes('hit')?'hit':statuses.includes('review')?'review':'miss';
      const isNew = status==='hit' && date>today && !rules.some(rule=>check(person,rule,today,false).status==='hit');
      counts[status]++;
      if (isNew) counts.newHit++;
      rows.push({person,status,statuses,isNew});
    }
    return {counts,rows,perRule};
  }
  function number(s) {
    if (/^\d+$/.test(s)) return Number(s);
    const digits = '零一二三四五六七八九';
    if (s==='两') return 2;
    if (s.length===1 && digits.includes(s)) return digits.indexOf(s);
    const m = /^([一二三四五六七八九]?)十([一二三四五六七八九]?)$/.exec(s);
    return m ? (m[1]?digits.indexOf(m[1]):1)*10+(m[2]?digits.indexOf(m[2]):0) : NaN;
  }
  // Parse only complete, unambiguous phrases. Preserve every other condition for review.
  function parseSource(source) {
    const rule = {source,manual:''};
    const unknown = [];
    function put(key,value,line) {
      if (!value || (rule[key] && rule[key]!==value)) unknown.push(line);
      else rule[key]=value;
    }
    const terms = source.trim().split(/[\n；;。]+/).map(t=>t.trim()).filter(Boolean);
    for (const line of terms) {
      let m;
      if ((m=/^(规则名称|目标职级|目标职务|现职级|现职务|人员类别)[：:]\s*(.{1,120})$/.exec(line)) && !/[，,；;。]|或|且|须|需|除外|不含|^(?:非|不)/.test(m[2])) {
        const key = {'规则名称':'name','目标职级':'target','目标职务':'target','现职级':'rank','现职务':'position','人员类别':'category'}[m[1]];
        put(key,text(m[2]),line);
        continue;
      }
      if ((m=/^(?:学历(?:至少为|不低于|为|[：:]\s*)?)?(博士研究生|硕士研究生|大学本科|大学专科|大专|本科|高中|初中)(?:学历)?(?:及以上)?$/.exec(line)) && /(?:至少为|不低于|及以上)/.test(line)) {
        put('education',normEdu(m[1]),line);
        continue;
      }
      const clauses = line.split(/[，,]/).map(s=>s.trim());
      // A compact sentence may contain an explicit duration followed by a single promotion target.
      if (clauses.length>2 || (clauses.length===2 && !/^(?:可晋升(?:为)?|可晋任)[\u3400-\u9fffA-Za-z0-9·（）()]{1,35}$/.test(clauses[1]))) {unknown.push(line);continue;}
      if (clauses.length===2 && /或|且|并|须|需|考核|名额|除外|前提|仅限|限于|条件|以上|以下/.test(clauses[1])) {unknown.push(line);continue;}
      const clause=clauses[0];
      m=/^(任现职级|任现职务|到科室|在本科室任职)(?:时间)?(?:已满|满|至少|不少于)([\d零一二三四五六七八九十两]+)(年|个月)$/.exec(clause);
      const named = !m && /^任(科长|副科长|[\u3400-\u9fff]{1,18}(?:主任科员|调研员|巡视员|科员|职员))满([\d一二三四五六七八九十两]+)(年|个月)$/.exec(clause);
      if (!m && !named) {unknown.push(line);continue;}
      const match=m||named;
      if (named && /或|且|不|非|累计|以上|以下|兼任|曾任/.test(named[1])) {unknown.push(line);continue;}
      const months=number(match[2])*(match[3]==='年'?12:1);
      if (!Number.isInteger(months)||months<=0||months>1200) {unknown.push(line);continue;}
      const namedField=named&&['科长','副科长'].includes(named[1])?'position':'rank';
      const key = named?namedField+'Months':({'任现职级':'rankMonths','任现职务':'positionMonths','到科室':'deptMonths','在本科室任职':'deptMonths'}[match[1]]);
      if (named) put(namedField,named[1],line);
      put(key,months,line);
      if (clauses.length===2) put('target',clauses[1].replace(/^(?:可晋升(?:为)?|可晋任)/,''),line);
    }
    rule.manual=[...new Set(unknown)].join('\n');
    return rule;
  }

  if (typeof module!=='undefined' && module.exports) module.exports={validatePolicies,check,summarize,parseSource,anniversary};
  if (typeof window==='undefined') return;
  window.validatePolicies=validatePolicies;
  const h = () => window.HR;
  const esc = value => h().esc(value);
  const mount = () => h().container();
  const q = selector => mount().querySelector(selector);
  let forecastDate='';
  const statusName={hit:'符合条件',review:'待核实',miss:'未满足'};
  const uid=()=> 'policy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const scrollTop=()=>window.scrollTo(0,0);
  function setPage(html,back) {
    h().subBack=back||null;
    mount().innerHTML='<div class="pol">'+html+'</div>';
    scrollTop();
  }
  function heading(title,button='') {
    return '<div class="heading"><h1>'+title+'</h1>'+button+'</div>';
  }
  const backButton = '<button type="button" id="pol-return" class="pol-return">‹ 返回晋升测算</button>';
  function summary(rule) {
    const bits=Object.entries(exact).filter(([k])=>text(rule[k])).map(([k,v])=>v+'为'+rule[k]);
    if (rule.education) bits.push(rule.education+'及以上');
    Object.entries(tenure).forEach(([k,[,label]])=>{if(rule[k])bits.push(label+'满 '+rule[k]+' 个月');});
    if (rule.manual) bits.push('含人工核验项');
    return bits.join(' · ');
  }
  function home() {
    const H=h(),today=H.today(), {people,policies}=H.state;
    if (!parseDate(forecastDate)||forecastDate<today) forecastDate=today;
    const {counts,perRule}=summarize(people,policies,forecastDate,today);
    const has=policies.length>0;
    setPage(heading('晋升测算','<button class="primary" id="pol-add">＋ 录入规则</button>')+
      '<section class="ledger"><div class="ledger-top"><div><div class="ledger-label">截至测算日符合条件</div><div class="ledger-number">'+(has?counts.hit:'—')+'<small>人</small></div><div class="hint">'+(has?'命中多条规则按一人计':'录入政策规则后可测算')+'</div></div><span class="seal">'+H.icon('policy',40)+'</span></div>'+
      '<div class="ledger-facts"><div><strong>'+(has?counts.newHit:'—')+'</strong><span>较今日新增</span></div><div><strong>'+(has?counts.review:'—')+'</strong><span>待核实</span></div><div><strong>'+policies.length+'</strong><span>政策规则</span></div></div></section>'+
      '<section class="panel"><div class="pol-date"><label for="pol-date">测算日期</label><input type="date" id="pol-date" min="'+esc(today)+'" value="'+esc(forecastDate)+'"></div><p class="hint pol-gap">假设当前职务、职级和科室保持到测算日期。</p>'+
      (has?'<button type="button" class="secondary pol-gap" id="pol-results">查看人员明细</button>':'')+'</section>'+
      '<section class="panel"><div class="panel-head"><h2>政策规则</h2><span class="small">'+policies.length+' 条</span></div>'+
      (has?policies.map((r,i)=>'<article class="pol-rule"><div class="row-spread"><h3>'+esc(r.name)+'</h3><button class="chip" data-edit="'+i+'">编辑</button></div><p class="pol-target">晋升至 '+esc(r.target)+'</p><p class="hint">'+esc(summary(r))+'</p><button class="pol-link" data-rule="'+i+'">符合 '+perRule[i].hit+' 人 · 待核实 '+perRule[i].review+' 人 ›</button></article>').join(''):
      '<p class="empty">尚未录入政策。可手动设置条件，也可粘贴条文后逐项确认。</p>')+'</section>');
    q('#pol-add').onclick=()=>edit(null);
    q('#pol-date').onchange=e=>{
      if (!parseDate(e.target.value)||e.target.value<today){H.notify('请选择今天或未来的日期');e.target.value=forecastDate;return;}
      forecastDate=e.target.value;home();
    };
    if (has) q('#pol-results').onclick=()=>results();
    mount().querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>edit(Number(el.dataset.edit)));
    mount().querySelectorAll('[data-rule]').forEach(el=>el.onclick=()=>results(Number(el.dataset.rule)));
  }
  function results(ruleIndex=null,filter='hit',limit=50) {
    const H=h(), {people,policies}=H.state, rules=ruleIndex==null?policies:[policies[ruleIndex]];
    if (!rules.length||!rules[0]) {home();return;}
    const {counts,rows}=summarize(people,rules,forecastDate,H.today());
    const filtered=rows.filter(r=>filter==='newHit'?r.isNew:r.status===filter);
    const tabs={hit:'符合',review:'待核实',miss:'未满足',newHit:'新增'};
    setPage(backButton+heading('人员测算明细')+
      '<section class="panel"><h2>'+esc(ruleIndex==null?'全部政策规则':rules[0].name)+'</h2><p class="date">截至 '+esc(forecastDate)+'</p><div class="pol-tabs">'+Object.entries(tabs).map(([key,name])=>'<button class="chip" data-filter="'+key+'" aria-pressed="'+(key===filter)+'">'+name+' '+counts[key]+'</button>').join('')+'</div>'+
      (filtered.length?filtered.slice(0,limit).map(({person,statuses})=>{
        const name=esc(person.name),dept=esc(H.deptName(person.deptId));
        return '<details class="pol-person"><summary><strong>'+name+'</strong><span>'+dept+' ›</span></summary>'+
          rules.map((r,i)=>'<div class="pol-evidence"><b>'+esc(r.name)+' · '+statusName[statuses[i]]+'</b><ul>'+check(person,r,forecastDate).notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul></div>').join('')+'</details>';
      }).join(''):'<p class="empty">此分类下暂无人员。</p>')+
      (filtered.length>limit?'<button id="pol-more" class="secondary">再显示 50 人</button>':'')+'</section>',home);
    q('#pol-return').onclick=home;
    mount().querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>results(ruleIndex,el.dataset.filter));
    if (q('#pol-more')) q('#pol-more').onclick=()=>{const y=window.scrollY;results(ruleIndex,filter,limit+50);window.scrollTo(0,y);};
  }
  function field(key,label,options={}) {
    const {required=false,type='text',placeholder='',list=false}=options;
    return '<label>'+label+'<input name="'+key+'" type="'+type+'"'+(required?' required':'')+
      (type==='number'?' min="0" max="1200" step="1" inputmode="numeric"':'')+(placeholder?' placeholder="'+esc(placeholder)+'"':'')+(list?' list="pol-'+key+'-options"':'')+'></label>';
  }
  function edit(index) {
    const H=h(), existing=index==null?null:H.state.policies[index];
    const draft=existing || {};
    const clean=()=>JSON.stringify([...new FormData(q('#pol-form')).entries()]);
    let baseline='';
    let reviewedSource=text(draft.source);
    let onLeave;
    function ask(message,action,label) {
      const box=q('#pol-ask');
      box.hidden=false;box.querySelector('p').textContent=message;
      q('#pol-confirm').textContent=label;q('#pol-confirm').onclick=action;
      const keep=()=>{box.hidden=true;H.subBack=onLeave;};
      q('#pol-keep').onclick=keep;H.subBack=keep;box.scrollIntoView({block:'center'});q('#pol-keep').focus();
    }
    onLeave=()=>{if(clean()===baseline) home();else ask('当前规则有未保存的修改，确定放弃吗？',home,'放弃修改');};
    const educationOptions=levels.map(v=>'<option>'+v+'</option>').join('');
    const categories=[...new Set(H.state.people.map(p=>text(p.category)).filter(Boolean))].sort();
    const categoryList='<datalist id="pol-category-options">'+categories.map(v=>'<option value="'+esc(v)+'"></option>').join('')+'</datalist>';
    function titleField(k,label,required=false){
      const options=H.jobChoices(k,draft[k]).map(([v,name])=>'<option value="'+esc(v)+'">'+esc(name)+'</option>').join('');
      return '<label>'+label+'<select name="'+k+'"'+(required?' required':'')+'><option value="">'+(required?'请选择':'不限')+'</option>'+options+'</select></label>';
    }
    setPage(backButton+heading(existing?'编辑政策规则':'录入政策规则')+
      '<form id="pol-form"><section class="panel"><h2>政策条文</h2><label class="pol-field">原文（可选）<textarea name="source" rows="4" placeholder="例如：任现职级满2年，可晋升为三级主任科员"></textarea></label><button type="button" class="secondary pol-gap" id="pol-parse">从原文提取条件</button><p class="hint pol-gap" id="pol-parsing">每次录入一条晋升路径。提取后可核对并调整条件。</p></section>'+
      '<section class="panel"><h2>规则设置</h2><div class="fields pol-gap">'+field('name','规则名称 *',{required:true,placeholder:'例如：科长任职条件'})+titleField('target','晋升目标 *',true)+'</div></section>'+
      '<section class="panel"><h2>匹配条件</h2><p class="hint pol-gap">下列已填条件须同时满足。任期按本次起任日期计算。</p><div class="fields pol-gap">'+
      titleField('rank',exact.rank)+titleField('position',exact.position)+field('category',exact.category,{list:true,placeholder:'不限'})+
      '<label>最低学历<select name="education"><option value="">不限</option>'+educationOptions+'</select></label>'+
      Object.entries(tenure).map(([k,[,label]])=>field(k,label+'月数',{type:'number',placeholder:'不限'})).join('')+
      '<label class="wide">人工核验条件<textarea name="manual" rows="3" placeholder="例如：考核、特殊例外或累计任职要求"></textarea></label></div><p class="hint pol-gap">保留人工核验条件时，满足其余条件的人员将列入“待核实”。</p></section>'+categoryList+
      '<div class="pol-actions"><button class="primary" type="submit">确认并保存规则</button>'+(existing?'<button id="pol-delete" class="plain-btn danger" type="button">删除规则</button>':'')+'</div></form>'+
      '<div id="pol-ask" class="panel pol-gap" hidden><p></p><div class="action-row"><button id="pol-keep" class="secondary">继续编辑</button><button id="pol-confirm" class="plain-btn danger"></button></div></div>',onLeave);
    const form=q('#pol-form'),elem=key=>form.elements.namedItem(key);
    Object.keys(draft).forEach(k=>{const el=elem(k);if(el)el.value=draft[k]==null?'':draft[k];});
    baseline=clean();
    q('#pol-return').onclick=onLeave;
    q('#pol-parse').onclick=()=>{
      const source=text(elem('source').value);
      if (!source) {H.notify('请先粘贴政策条文');elem('source').focus();return;}
      const parsed=parseSource(source);
      reviewedSource=source;
      // Never replace a user's condition silently when it conflicts with newly pasted text.
      let conflicts=[];
      for (const [k,v] of Object.entries(parsed)) {
        if (k==='source' || k==='manual') continue;
        const control=elem(k);
        const unavailable=control.options && !Array.from(control.options).some(o=>o.value===String(v));
        if (unavailable || (text(control.value) && text(control.value)!==text(v))) {conflicts.push((exact[k]||({target:'晋升目标',name:'规则名称',education:'最低学历'}[k])||tenure[k][1]+'月数')+'：'+v);continue;}
        control.value=v;
      }
      if (conflicts.length) conflicts=conflicts.map(v=>'请核对原文与当前设置的差异（'+v+'）');
      elem('manual').value=[...new Set([elem('manual').value,parsed.manual,...conflicts].join('\n').split('\n').map(text).filter(Boolean))].join('\n');
      q('#pol-parsing').textContent=elem('manual').value?'已提取可识别条件。请核对字段，未识别条文已列入人工核验。':'已提取条件。请逐项核对原文，再确认保存。';
      H.notify(q('#pol-parsing').textContent);
    };
    if (existing) q('#pol-delete').onclick=()=>ask('删除“'+existing.name+'”后，其测算结果会同步移除。',()=>{
      H.state.policies.splice(index,1);if(H.save()){H.notify('已删除政策规则');home();}
    },'删除规则');
    form.onsubmit=e=>{
      e.preventDefault();
      if(text(elem('source').value) && text(elem('source').value)!==reviewedSource){
        H.notify('请先从当前原文提取条件，再核对并保存');q('#pol-parse').focus();return;
      }
      const rule={id:existing?existing.id:uid()};
      for (const [k,value] of new FormData(form)) {
        const v=text(value);
        if (v) rule[k]=owns(tenure,k)?Number(v):v;
      }
      if (!validatePolicies([rule])) {H.notify(!rule.name||!rule.target?'请填写规则名称和晋升目标':'请设置匹配条件或填写人工核验事项');return;}
      if (existing) H.state.policies[index]=rule;else H.state.policies.push(rule);
      if (H.save()) {H.notify('政策规则已保存');home();}
    };
  }
  window.renderPolicy=home;
})();
