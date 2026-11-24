(() => {
  "use strict";

  const levels = ["一", "二", "三", "四"];
  const officers = levels.map(level => level + "级主任科员");
  const researchers = levels.map(level => level + "级调研员");
  const targets = [...officers, ...researchers];
  const tenureRanks = [...targets,"一级科员","七级职员","八级职员","九级职员"];
  const groups = [
    {key:"chief", label:"当过正科长"},
    {key:"deputy", label:"当过副科长"},
    {key:"other", label:"两者均未担任"}
  ];
  const defaultRetirementYears = 1;
  const day = 86400000;
  const epsilon = 1e-9;
  const owns = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const nonnegative = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const ageValue = value => Number.isInteger(value) && value >= 0 && value <= 130;
  const title = value => typeof value === "string" ? value.trim() : "";

  function candidateRanks(target) {
    const officer = officers.indexOf(target);
    if (officer !== -1) return officers.slice(officer + 1);
    const researcher = researchers.indexOf(target);
    return researcher === -1 ? [] : [...officers, ...researchers.slice(researcher + 1)];
  }

  function validCondition(condition) {
    if (!isObject(condition)) return false;
    const exact = (...keys) => Object.keys(condition).length === keys.length && keys.every(key => owns(condition, key));
    switch (condition.type) {
      case "tenure":
        return exact("type","rank","years") && tenureRanks.includes(condition.rank) && nonnegative(condition.years);
      case "age":
        return exact("type","male","female") && ageValue(condition.male) && ageValue(condition.female);
      case "retirement":
        return exact("type","op","years") && ["gte","lte"].includes(condition.op) && nonnegative(condition.years);
      default:
        return false;
    }
  }

  function validRules(rules) {
    return isObject(rules) && Object.entries(rules).every(([target, byRole]) =>
      targets.includes(target) && isObject(byRole) && Object.entries(byRole).every(([key, alternatives]) =>
        groups.some(group => group.key === key) && Array.isArray(alternatives) && alternatives.every(conditions =>
          Array.isArray(conditions) && conditions.length > 0 && conditions.every(validCondition)
        )
      )
    );
  }

  function atDate(year, month, date) {
    const value = new Date(0);
    value.setUTCFullYear(year, month, date);
    return value.getTime();
  }

  function dateRange(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (year < 1000) return null;
    const last = new Date(atDate(year,month + 1,0)).getUTCDate();
    if (match[3]) {
      const date = Number(match[3]);
      if (date > last) return null;
      const time = atDate(year,month,date);
      return {first:time,last:time};
    }
    return {first:atDate(year,month,1),last:atDate(year,month,last)};
  }

  const displayDate = time => new Date(time).toISOString().slice(0,10);

  function elapsedYears(start, end) {
    if (end <= start) return 0;
    const from = new Date(start);
    const to = new Date(end);
    const year = from.getUTCFullYear();
    const month = from.getUTCMonth();
    const date = from.getUTCDate();
    const months = (to.getUTCFullYear() - year) * 12 + to.getUTCMonth() - month;
    const anniversary = offset => atDate(year, month + offset,
      Math.min(date,new Date(atDate(year,month + offset + 1,0)).getUTCDate()));
    const wholeMonths = end < anniversary(months) ? months - 1 : months;
    const previous = anniversary(wholeMonths);
    return (wholeMonths + (end - previous) / (anniversary(wholeMonths + 1) - previous)) / 12;
  }

  function appointments(person, history) {
    const rows = [{
      position:title(person.position), rank:title(person.rank), current:true,
      positionStart:dateRange(person.positionSince), rankStart:dateRange(person.rankSince)
    }];
    for (const entry of history) {
      if (entry.timelineCurrent) continue;
      const start = dateRange(entry.startMonth || entry.start);
      const end = dateRange(entry.endMonth || entry.end);
      const position = title(entry.position ?? (entry.type === "职务" ? entry.title : ""));
      const rank = title(entry.rank ?? (entry.type === "职级" ? entry.title : ""));
      // Transfer-only snapshots can confirm a title without identifying when it started.
      const sources = entry._deptRefs || [];
      const independentlyDated = !sources.length || entry.historyIndices?.length ||
        sources.some(ref => ref.kind === "part");
      const explicitlyDated = sources.some(ref => {
        const snapshot = person.deptHistory?.[ref.index];
        return snapshot?.rank === rank && dateRange(snapshot.rankSince);
      });
      rows.push({
        position,rank,positionStart:start,end,
        rankStart:independentlyDated || explicitlyDated ? start : null
      });
    }
    return rows;
  }

  function roleGroup(rows, date) {
    let highest = "other";
    for (const row of rows) {
      if (row.positionStart && row.positionStart.first > date) continue;
      if (row.position === "科长" || row.position === "正科长") return "chief";
      if (row.position === "副科长") highest = "deputy";
    }
    return highest;
  }

  function longestPeriod(intervals) {
    const periods = intervals.filter(([start,end]) => start <= end).sort((a,b) => a[0] - b[0]);
    let previous = null, longest = 0;
    for (const [start,end] of periods) {
      if (previous && start <= previous[1] + day) previous[1] = Math.max(previous[1],end);
      else previous = [start,end];
      longest = Math.max(longest,elapsedYears(...previous));
    }
    return longest;
  }

  function tenureBounds(rows, wanted, date, today) {
    const confirmed = [], possible = [];
    const current = rows[0];
    const continuing = current.rank === wanted;
    const latestPastDay = current.rank && !continuing && current.rankStart ?
      Math.min(today,current.rankStart.last - day) : today;
    let unknownStart = false;
    for (const row of rows) {
      if (row.rank !== wanted || (row.rankStart && row.rankStart.first > date)) continue;
      const start = row.rankStart;
      const knownEnd = row.current ? {first:date,last:date} : row.end;
      const last = Math.min(knownEnd ? knownEnd.last : latestPastDay,date);
      if (!start) {
        unknownStart = true;
        continue;
      }
      possible.push([start.first,last]);
      if (knownEnd) confirmed.push([start.last,Math.min(knownEnd.first,date)]);
    }
    return {confirmed:longestPeriod(confirmed),possible:unknownStart ? Infinity : longestPeriod(possible)};
  }

  function ageBounds(person, date) {
    const birth = dateRange(person.birth);
    if (birth) {
      if (birth.first > date) return null;
      // The ledger stores birth year and month, so age advances in the birthday month.
      const to = new Date(date), from = new Date(birth.first);
      const age = to.getUTCFullYear() - from.getUTCFullYear() - Number(to.getUTCMonth() < from.getUTCMonth());
      return {min:age,max:age};
    }
    const recorded = person.age != null && person.age !== "" ? Number(person.age) : NaN;
    const when = dateRange(person.ageAsOf);
    if (!ageValue(recorded) || !when || when.last > date) return null;
    const elapsed = elapsedYears(when.last,date);
    return {min:recorded + Math.floor(elapsed + epsilon), max:recorded + Math.ceil(elapsed - epsilon)};
  }

  const yearsText = new Intl.NumberFormat("zh-CN",{maximumFractionDigits:3});

  function evaluateCondition(condition, context) {
    const {person,date,today,appointments:rows,tenures} = context;
    if (condition.type === "tenure") {
      const description = "任" + condition.rank + "超过 " + condition.years + " 年";
      if (!tenures.has(condition.rank)) tenures.set(condition.rank,tenureBounds(rows,condition.rank,date,today));
      const bounds = tenures.get(condition.rank);
      const clears = value => value - condition.years > epsilon;
      const attained = yearsText.format(bounds.confirmed);
      if (clears(bounds.confirmed)) return ["hit",description + "，已确认连续任职 " + attained + " 年"];
      if (clears(bounds.possible)) return ["review",description + "，任职起止日期需核实"];
      return ["miss",description + "，已确认连续任职 " + attained + " 年"];
    }
    if (condition.type === "age") {
      const gender = title(person.gender);
      const requirement = "男满 " + condition.male + " 岁、女满 " + condition.female + " 岁";
      const required = gender === "男" ? condition.male : gender === "女" ? condition.female : null;
      if (required === null) return ["review",requirement + "，性别未登记"];
      const bounds = ageBounds(person,date);
      if (!bounds) return ["review",requirement + "，需补充出生年月或年龄登记日期"];
      const actual = bounds.min === bounds.max ? bounds.min : bounds.min + " 至 " + bounds.max;
      const note = requirement + "，截至 " + displayDate(date) + " 约为 " + actual + " 岁";
      return [bounds.min >= required ? "hit" : bounds.max < required ? "miss" : "review",note];
    }

    const hasRetirement = nonnegative(person.retirementYearsRemaining);
    const base = hasRetirement ? person.retirementYearsRemaining : defaultRetirementYears;
    const remaining = Math.max(0,base - elapsedYears(today,date));
    const minimum = condition.op === "gte";
    const hit = minimum ? remaining + epsilon >= condition.years : remaining - epsilon <= condition.years;
    const source = hasRetirement ? "档案占位值" : "默认占位值";
    return [hit ? "hit" : "miss","距退休" + (minimum ? "至少" : "至多") + " " + condition.years +
      " 年，按" + source + "推算约剩 " + yearsText.format(remaining) + " 年"];
  }

  function recordedHistory(person) {
    return typeof window !== "undefined" && typeof window.HR?.resumeTimeline === "function" ?
      window.HR.resumeTimeline(person) : person.history || [];
  }

  function measure(people, target, date, rules, today, historyFor = recordedHistory) {
    const asOf = dateRange(date), baseline = dateRange(today);
    if (!asOf || asOf.first !== asOf.last || !baseline || baseline.first !== baseline.last || asOf.first < baseline.first) return [];
    const eligible = new Set(candidateRanks(target));
    const settings = rules?.[target] || {};
    return people.filter(person => eligible.has(title(person.rank))).map(person => {
      const rows = appointments(person,historyFor(person));
      const group = roleGroup(rows,asOf.first);
      const alternatives = settings[group];
      if (!alternatives?.length) return {person,group,status:"unset",notes:[]};
      const context = {person,date:asOf.first,today:baseline.first,appointments:rows,tenures:new Map()};
      const notes = [], outcomes = [];
      const descriptions = {hit:"满足",miss:"未满足",review:"待核实"};
      for (const [index, conditions] of alternatives.entries()) {
        const results = conditions.map(condition => evaluateCondition(condition,context));
        const status = results.some(([value]) => value === "miss") ? "miss" :
          results.some(([value]) => value === "review") ? "review" : "hit";
        outcomes.push(status);
        const prefix = alternatives.length > 1 ? "方案 " + (index + 1) + " · " : "";
        for (const [value, description] of results) notes.push(prefix + descriptions[value] + " · " + description);
      }
      const status = outcomes.includes("hit") ? "hit" : outcomes.includes("review") ? "review" : "miss";
      return {person,group,status,notes};
    });
  }

  const promotion = {targets,tenureRanks,groups,defaultRetirementYears,candidateRanks,validRules,measure};
  if (typeof module !== "undefined" && module.exports) module.exports = promotion;
  if (typeof window !== "undefined") window.Promotion = promotion;
})();
