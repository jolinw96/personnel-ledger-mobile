(() => {
  'use strict';

  const hr = () => window.HR;
  const engine = () => window.Promotion;
  const region = () => hr().container();
  const find = selector => region().querySelector(selector);
  const esc = value => hr().esc(value);
  const statusLabels = {hit:'符合',review:'待核实',miss:'未满足',unset:'未设规则'};
  const conditionNames = {tenure:'任指定职级超过年数',age:'按男女设置年龄门槛',retirement:'距离退休年限'};
  const backButton = '<button type="button" id="pol-return" class="plain-btn">返回晋升测算</button>';
  let forecastTarget = '';
  let forecastDate = '';

  function showPage(title, html, back) {
    hr().subBack = back || null;
    region().innerHTML = '<div class="pol">' + (back ? backButton : '') +
      '<div class="heading"><h1>' + title + '</h1></div>' + html + '</div>';
    if (back) find('#pol-return').onclick = back;
    window.scrollTo(0,0);
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function runMeasure() {
    const H = hr();
    return engine().measure(H.state.people,forecastTarget,forecastDate,H.state.promotionRules,H.today());
  }

  function overview() {
    const output = find('#pol-output');
    if (!forecastTarget || !forecastDate) {
      output.innerHTML = '<div class="panel empty">选择目标职级和测算日期后，可查看候选范围并设置规则。</div>';
      return;
    }
    const ranks = engine().candidateRanks(forecastTarget);
    const measure = runMeasure();
    const rules = hr().state.promotionRules?.[forecastTarget];
    const summaries = engine().groups.map(({key,label}) => {
      const rows = measure.filter(row => row.group === key);
      const configured = Boolean(rules?.[key]?.length);
      const statuses = configured ? ['hit','review','miss'] : ['unset'];
      const totals = statuses.map(status => '<div><dt>' + statusLabels[status] + '</dt><dd data-status="' + status +
        '">' + rows.filter(row => row.status === status).length + '</dd></div>').join('');
      return '<article class="pol-group" data-group-result="' + key + '"><div class="pol-group-head"><h3>' + esc(label) +
        '</h3><button type="button" class="plain-btn" data-results="' + key + '">查看名单</button></div>' +
        '<dl class="pol-tally"><div><dt>候选人数</dt><dd data-status="total">' + rows.length +
        '</dd></div>' + totals + '</dl></article>';
    }).join('');
    output.innerHTML = '<section class="panel pol-scope" id="pol-scope"><h2>候选职级</h2><p>' +
      (ranks.length ? ranks.map(rank => esc(rank)).join('、') : '本目标暂无符合范围的职级。') + '</p></section>' +
      '<section class="panel pol-outcomes"><div class="panel-head"><h2>测算结果</h2><button type="button" class="secondary" id="pol-edit-rules">设置三类规则</button></div>' +
      '<p class="hint">每人按曾任最高职务归入一类。</p>' + summaries + '</section>';
    find('#pol-edit-rules').onclick = editRules;
    output.querySelectorAll('[data-results]').forEach(button => {
      button.onclick = () => results(button.dataset.results);
    });
  }

  function home() {
    const today = hr().today();
    if (!forecastDate || forecastDate < today) forecastDate = today;
    const choices = [option('','请选择目标职级',forecastTarget),...engine().targets.map(title => option(title,title,forecastTarget))].join('');
    showPage('晋升测算','<section class="panel pol-setup"><div class="fields">' +
      '<label>目标职级<select id="pol-target">' + choices + '</select></label>' +
      '<label>测算日期<input id="pol-date" type="date" min="' + esc(today) + '" value="' + esc(forecastDate) + '"></label>' +
      '</div></section><div id="pol-output"></div>');
    find('#pol-target').onchange = event => { forecastTarget = event.target.value; overview(); };
    find('#pol-date').onchange = event => {
      const input = event.target;
      if (input.value && (!input.validity.valid || input.value.length !== 10)) {
        hr().notify('请选择今天或未来的日期');
        input.value = forecastDate;
        return;
      }
      forecastDate = input.value;
      overview();
    };
    overview();
  }

  function results(group, filter = 'all', limit = 50) {
    const label = engine().groups.find(entry => entry.key === group).label;
    const entries = runMeasure().filter(row => row.group === group);
    const visible = entries.filter(row => filter === 'all' || row.status === filter);
    const available = [['all','全部'],...Object.entries(statusLabels)];
    const tabs = available.filter(([key]) => key !== 'unset' || entries.some(row => row.status === key)).map(([key,subject]) => {
      const count = key === 'all' ? entries.length : entries.filter(row => row.status === key).length;
      return '<button type="button" class="chip" data-filter="' + key + '" aria-pressed="' + (key === filter) + '">' +
        subject + ' ' + count + '</button>';
    }).join('');
    const list = visible.slice(0,limit).map(({person,status,notes}) => {
      const department = person.deptId ? hr().deptName(person.deptId) : '未分配科室';
      const detail = notes.map(note => '<li>' + esc(note) + '</li>').join('');
      return '<details class="pol-person" data-person="' + esc(person.id) + '"><summary><span><strong>' + esc(person.name) +
        '</strong><small>' + esc(person.rank) + ' · ' + esc(department) + '</small></span>' +
        '<span class="pol-status" data-result="' + status + '">' + statusLabels[status] + '</span></summary>' +
        '<ul class="pol-evidence">' + (detail || '<li>' + statusLabels[status] + '</li>') + '</ul></details>';
    }).join('');
    showPage('人员测算明细','<section class="panel"><h2>' + esc(label) + '</h2><p class="pol-context">' +
      esc(forecastTarget) + ' · 截至 ' + esc(forecastDate) + '</p><div class="pol-tabs">' + tabs + '</div>' +
      (list || '<p class="empty">此分类下暂无人员。</p>') +
      (visible.length > limit ? '<button type="button" class="secondary" id="pol-more">再显示 50 人</button>' : '') + '</section>',home);
    region().querySelectorAll('[data-filter]').forEach(button => {
      button.onclick = () => results(group,button.dataset.filter);
    });
    const more = find('#pol-more');
    if (more) more.onclick = () => results(group,filter,limit+50);
  }

  function valueInput(field,label,value,max,step) {
    return '<label>' + label + '<input type="number" data-field="' + field + '" min="0"' + (max ? ' max="' + max + '"' : '') +
      ' step="' + step + '" inputmode="' + (step === '1' ? 'numeric' : 'decimal') + '" required value="' + esc(value) + '"></label>';
  }

  function conditionFields(condition) {
    if (condition.type === 'age') {
      return valueInput('male','男性满几岁',condition.male,130,'1') +
        valueInput('female','女性满几岁',condition.female,130,'1');
    }
    const years = valueInput('years','年数',condition.years,null,'any');
    if (condition.type === 'retirement') {
      return '<label>比较方式<select data-field="op" required>' + option('gte','不少于',condition.op) +
        option('lte','不超过',condition.op) + '</select></label>' + years;
    }
    const titles = engine().tenureRanks || hr().jobTitles.rank;
    const choices = [option('','请选择职级',condition.rank),...titles.map(title => option(title,title,condition.rank))].join('');
    return '<label>任职职级<select data-field="rank" required>' + choices + '</select></label>' + years;
  }

  function clauseMarkup(clause,index) {
    const conditions = clause.map((condition,position) => {
      const choices = Object.entries(conditionNames).map(([type,label]) => option(type,label,condition.type)).join('');
      return (position ? '<div class="pol-connector"><span>且</span></div>' : '') +
        '<div class="pol-condition" data-condition="' + position + '"><div class="pol-condition-head">' +
        '<label>条件类型<select data-field="type">' + choices + '</select></label>' +
        '<button type="button" class="plain-btn danger" data-remove-condition aria-label="删除本条件">删除</button></div>' +
        '<div class="fields">' + conditionFields(condition) + '</div></div>';
    }).join('');
    return (index ? '<div class="pol-connector pol-or"><span>或</span></div>' : '') +
      '<fieldset class="pol-clause" data-clause="' + index + '"><legend>方案 ' + (index+1) + '</legend>' +
      conditions + '<button type="button" class="secondary" data-add-condition>添加且条件</button></fieldset>';
  }

  function editRules() {
    const H = hr(), target = forecastTarget;
    const groups = engine().groups;
    const existing = H.state.promotionRules?.[target] || {};
    const draft = Object.fromEntries(groups.map(({key}) => [key,(existing[key] || []).map(clause => clause.map(condition => ({...condition})))]));
    let saving = false;
    const leave = () => {
      if (saving) return;
      if (!find('#pol-rules').hasAttribute('data-changed') || window.confirm('规则尚未保存，放弃修改并返回？')) home();
    };
    showPage('设置晋升规则','<form id="pol-rules"><section class="panel pol-rule-intro"><h2>' + esc(target) + '</h2>' +
      '<p>每类满足任一方案即可。方案内的各项条件须同时满足。</p>' +
      '<p class="hint">距离退休暂以今天距退休 1 年为默认值，按测算日期推算。</p></section>' +
      groups.map(({key,label}) => '<section class="panel pol-rule-group" data-rule-group="' + key +
        '"><div class="panel-head"><h2>' + esc(label) + '</h2><button type="button" class="secondary" data-add-clause>添加方案</button></div>' +
        '<div data-clauses></div></section>').join('') +
      '<div class="pol-save"><button type="submit" class="primary">保存三类规则</button><p id="pol-rule-error" role="alert" hidden></p></div></form>',leave);

    const form = find('#pol-rules'), error = find('#pol-rule-error');
    function groupElement(key) {return form.querySelector('[data-rule-group="' + key + '"]');}
    function renderGroup(key) {
      const area = groupElement(key).querySelector('[data-clauses]');
      area.innerHTML = draft[key].map(clauseMarkup).join('') || '<p class="hint">尚未设置规则</p>';
    }
    function changed() {
      form.dataset.changed = '1';
      error.hidden = true;
    }
    function locate(element) {
      const key = element.closest('[data-rule-group]').dataset.ruleGroup;
      const clause = element.closest('[data-clause]');
      const item = element.closest('[data-condition]');
      return {key,index:Number(clause?.dataset.clause),position:Number(item?.dataset.condition)};
    }
    function focusType(key,index,position) {
      groupElement(key).querySelector('[data-clause="' + index + '"] [data-condition="' + position + '"] [data-field="type"]').focus();
    }
    function updateValue(event) {
      const input = event.target;
      const field = input.dataset.field;
      if (!field || field === 'type') return;
      const {key,index,position} = locate(input);
      draft[key][index][position][field] = input.value;
      changed();
    }
    for (const {key} of groups) renderGroup(key);
    form.addEventListener('input',updateValue);
    form.addEventListener('change',event => {
      if (event.target.dataset.field !== 'type') {
        updateValue(event);
        return;
      }
      const {key,index,position} = locate(event.target);
      const type = event.target.value;
      if (draft[key][index][position].type === type) return;
      draft[key][index][position] = type === 'retirement' ? {type,op:'gte'} : {type};
      changed();
      renderGroup(key);
      focusType(key,index,position);
    });
    form.onclick = event => {
      const action = event.target.closest('[data-add-clause],[data-add-condition],[data-remove-condition]');
      if (!action) return;
      const {key,index,position} = locate(action);
      if (action.hasAttribute('data-add-clause')) {
        draft[key].push([{type:'tenure'}]);
        renderGroup(key);
        focusType(key,draft[key].length-1,0);
      } else if (action.hasAttribute('data-add-condition')) {
        draft[key][index].push({type:'tenure'});
        renderGroup(key);
        focusType(key,index,draft[key][index].length-1);
      } else {
        draft[key][index].splice(position,1);
        if (!draft[key][index].length) draft[key].splice(index,1);
        renderGroup(key);
        groupElement(key).querySelector('[data-add-clause]').focus();
      }
      changed();
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (saving) return;
      const compiled = {};
      for (const {key} of groups) {
        if (!draft[key].length) continue;
        compiled[key] = draft[key].map(clause => clause.map(condition => {
          const {type,rank,years,male,female,op} = condition;
          if (type === 'age') return {type,male:Number(male),female:Number(female)};
          if (type === 'retirement') return {type,op,years:Number(years)};
          return {type,rank,years:Number(years)};
        }));
      }
      const allRules = {...H.state.promotionRules};
      if (Object.keys(compiled).length) allRules[target] = compiled;
      else delete allRules[target];
      if (!engine().validRules(allRules)) {
        error.textContent = '请核对每个方案内的职级、岁数和年数。';
        error.hidden = false;
        return;
      }
      const button = form.querySelector('[type=submit]');
      button.disabled = saving = true;
      H.state.promotionRules = allRules;
      try {
        if (await H.save() && form.isConnected) {
          H.notify('晋升规则已保存');
          home();
        }
      } finally {
        button.disabled = saving = false;
      }
    };
  }

  window.renderPolicy=home;
})();
