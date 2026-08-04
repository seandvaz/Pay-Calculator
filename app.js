
const SHIFT_DATA = {"2A": {"name": "Delta Afternoon", "category": "Delta", "allowance": "Morn/Aft", "times": {"sun": ["15:30", "01:30"], "monthu": ["15:30", "01:30"], "fri": ["16:30", "03:30"], "sat": ["16:30", "03:30"]}}, "2M": {"name": "Delta Morning", "category": "Delta", "allowance": "", "times": {"sun": ["05:30", "15:30"], "monthu": ["05:30", "15:30"], "fri": ["05:30", "16:30"], "sat": ["05:30", "16:30"]}}, "AR": {"name": "Armadale Station", "category": "Station", "allowance": "Morn/Aft", "times": {"sun": ["15:30", "01:30"], "monthu": ["15:30", "01:30"], "fri": ["16:30", "03:30"], "sat": ["16:30", "03:30"]}}, "KL": {"name": "Kelmscott Station", "category": "Station", "allowance": "Morn/Aft", "times": {"sun": ["15:15", "01:15"], "monthu": ["15:15", "01:15"], "fri": ["16:30", "03:30"], "sat": ["16:30", "03:30"]}}, "GS": {"name": "Gosnells Station", "category": "Station", "allowance": "Morn/Aft", "times": {"sun": ["15:00", "01:00"], "monthu": ["15:00", "01:00"], "fri": ["16:15", "03:15"], "sat": ["16:15", "03:15"]}}, "CA": {"name": "Cannington Station", "category": "Station", "allowance": "Morn/Aft", "times": {"sun": ["14:45", "00:45"], "monthu": ["14:45", "00:45"], "fri": ["16:00", "03:00"], "sat": ["16:00", "03:00"]}}, "OS": {"name": "Oats Street Station", "category": "Station", "allowance": "Morn/Aft", "times": {"sun": ["14:30", "00:30"], "monthu": ["14:30", "00:30"], "fri": ["15:30", "02:45"], "sat": ["15:30", "02:45"]}}, "BR": {"name": "Burswood Station", "category": "Station", "allowance": "Morn/Aft", "times": {"sun": ["14:30", "00:30"], "monthu": ["14:30", "00:30"], "fri": ["15:45", "02:45"], "sat": ["15:45", "02:45"]}}, "20": {"name": "Train Riding 20", "category": "Train Riding", "allowance": "Morn/Aft", "times": {"sun": ["14:45", "00:45"], "monthu": ["14:45", "00:45"], "fri": ["16:00", "02:00"], "sat": ["16:00", "02:00"]}}, "21": {"name": "Train Riding 21", "category": "Train Riding", "allowance": "Morn/Aft", "times": {"sun": ["15:00", "01:00"], "monthu": ["15:00", "01:00"], "fri": ["17:00", "03:00"], "sat": ["17:15", "03:15"]}}, "22": {"name": "Train Riding 22", "category": "Train Riding", "allowance": "Morn/Aft", "times": {"sun": ["15:00", "01:00"], "monthu": ["15:00", "01:00"], "fri": ["17:00", "03:00"], "sat": ["17:15", "03:15"]}}, "23": {"name": "Train Riding 23", "category": "Train Riding", "allowance": "Morn/Aft", "times": {"sun": ["15:00", "01:00"], "monthu": ["15:00", "01:00"], "fri": ["17:00", "03:00"], "sat": ["17:15", "03:15"]}}, "24": {"name": "Train Riding 24", "category": "Train Riding", "allowance": "Morn/Aft", "times": {"sun": ["15:15", "01:15"], "monthu": ["15:15", "01:15"], "fri": ["15:15", "01:15"], "sat": ["15:15", "01:15"]}}, "25": {"name": "Train Riding 25", "category": "Train Riding", "allowance": "Morn/Aft", "times": {"sun": ["15:00", "01:00"], "monthu": ["15:00", "01:00"], "fri": ["17:00", "03:00"], "sat": ["17:00", "03:00"]}}, "AA1": {"name": "AA1 Higher Duties", "category": "Higher Duties", "allowance": "Morn/Aft", "times": {"sun": ["15:30", "01:30"], "monthu": ["15:30", "01:30"], "fri": ["17:30", "03:30"], "sat": ["17:30", "03:30"]}}};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = v => new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(v)||0);
const defaults = {
  baseRate:44.37, wdMult:1, satMult:1.5, sunMult:2, otMult:1.8,
  higherDuties:4.87, maAllowance:4.87, nightAllowance:5.77,
  lease:546.95, gesb:100, otherPre:0, postTax:7.40, taxCalibration:87
};

function dateFromInput(v) {
  const [y,m,d]=v.split('-').map(Number); return new Date(y,m-1,d);
}
function fmtDate(d) { return d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}); }
function dayGroup(day) { return day===0?'sun':day<=4?'monthu':day===5?'fri':'sat'; }
function mins(t) { const [h,m]=t.split(':').map(Number); return h*60+m; }
function splitAtMidnight(date,start,finish) {
  let s=mins(start), f=mins(finish), total=(f-s+1440)%1440; if(total===0) total=1440;
  const first=Math.min(total,1440-s), second=total-first;
  const out={weekday:0,saturday:0,sunday:0,total:total/60};
  const add=(day,m)=>{ if(day===6)out.saturday+=m/60; else if(day===0)out.sunday+=m/60; else out.weekday+=m/60; };
  add(date.getDay(),first); if(second>0)add((date.getDay()+1)%7,second); return out;
}
function annualTax(income) {
  if(income<=18200)return 0;
  let tax=0;
  if(income<=45000)tax=(income-18200)*.15;
  else if(income<=135000)tax=(45000-18200)*.15+(income-45000)*.30;
  else if(income<=190000)tax=(45000-18200)*.15+(135000-45000)*.30+(income-135000)*.37;
  else tax=(45000-18200)*.15+(135000-45000)*.30+(190000-135000)*.37+(income-190000)*.45;
  return tax+income*.02;
}
function settings() {
  const s={}; Object.keys(defaults).forEach(k=>s[k]=parseFloat($('#'+k).value)||0); return s;
}
function currentState() {
  return {
    startDate:$('#startDate').value,
    settings:Object.fromEntries(Object.keys(defaults).map(k=>[k,$('#'+k).value])),
    roster:$$('.shift-card').map(card=>({
      code:card.querySelector('.code').value,
      type:card.querySelector('.type').value,
      hd:card.querySelector('.hd').checked,
      other:card.querySelector('.other').value,
      customStart:card.querySelector('.custom-start').value,
      customFinish:card.querySelector('.custom-finish').value
    }))
  };
}
function saveState() { localStorage.setItem('ptaPayAppV2',JSON.stringify(currentState())); toast('Saved on this device'); }
function restoreState() {
  const raw=localStorage.getItem('ptaPayAppV2'); if(!raw)return null;
  try{return JSON.parse(raw)}catch{return null}
}
function toast(msg) {
  const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800);
}
function optionList() {
  return [''].concat(Object.keys(SHIFT_DATA).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})))
    .map(c=>`<option value="${c}">${c?`${c} — ${SHIFT_DATA[c].name}`:'Off'}</option>`).join('');
}
function buildRoster(saved) {
  const wrap=$('#rosterList'); wrap.innerHTML='';
  const start=dateFromInput($('#startDate').value);
  for(let i=0;i<14;i++) {
    const d=new Date(start); d.setDate(start.getDate()+i);
    const card=document.createElement('article'); card.className='shift-card';
    card.innerHTML=`
      <div class="shift-head">
        <div><strong>${fmtDate(d)}</strong><span>Day ${i+1}</span></div>
        <div class="time-badge">Off</div>
      </div>
      <div class="fields">
        <label>Shift<select class="code">${optionList()}</select></label>
        <label>Type<select class="type"><option>Rostered</option><option>Picked-up OT</option><option>Leave</option><option>Off</option></select></label>
        <label>Other gross<input class="other" type="number" step=".01" value="0"></label>
        <label class="check"><input class="hd" type="checkbox"><span>Higher duties</span></label>
      </div>
      <details>
        <summary>Override shift time</summary>
        <div class="two">
          <label>Start<input class="custom-start" type="time"></label>
          <label>Finish<input class="custom-finish" type="time"></label>
        </div>
      </details>`;
    wrap.appendChild(card);
    const s=saved?.roster?.[i];
    if(s) {
      card.querySelector('.code').value=s.code||'';
      card.querySelector('.type').value=s.type||'Rostered';
      card.querySelector('.hd').checked=!!s.hd;
      card.querySelector('.other').value=s.other||0;
      card.querySelector('.custom-start').value=s.customStart||'';
      card.querySelector('.custom-finish').value=s.customFinish||'';
    }
    card.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calculate));
  }
  calculate();
}
function calculate() {
  const s=settings(), start=dateFromInput($('#startDate').value);
  let gross=0, hours=0, otGross=0, otHours=0;
  $$('.shift-card').forEach((card,i)=>{
    const d=new Date(start); d.setDate(start.getDate()+i);
    const code=card.querySelector('.code').value, type=card.querySelector('.type').value;
    const other=parseFloat(card.querySelector('.other').value)||0;
    const data=SHIFT_DATA[code];
    let startTime=card.querySelector('.custom-start').value, finishTime=card.querySelector('.custom-finish').value;
    if(data && (!startTime || !finishTime)) [startTime,finishTime]=data.times[dayGroup(d.getDay())];
    let row=other, h=0, badge='Off';
    if(data && startTime && finishTime && type!=='Off') {
      const split=splitAtMidnight(d,startTime,finishTime); h=split.total; badge=`${startTime}–${finishTime}`;
      if(type==='Picked-up OT') {
        const x=h*s.baseRate*s.otMult; row+=x; otGross+=x; otHours+=h;
      } else {
        row += split.weekday*s.baseRate*s.wdMult + split.saturday*s.baseRate*s.satMult + split.sunday*s.baseRate*s.sunMult;
      }
      if(data.allowance==='Morn/Aft') row+=h*s.maAllowance;
      if(data.allowance==='Night') row+=h*s.nightAllowance;
      if(card.querySelector('.hd').checked || code==='AA1') row+=h*s.higherDuties;
    }
    gross+=row; hours+=h; card.querySelector('.time-badge').textContent=badge;
  });
  const taxable=Math.max(0,gross-s.lease-s.gesb-s.otherPre);
  const tax=Math.max(0,Math.round(annualTax(taxable*26)/26+s.taxCalibration));
  const net=taxable-tax-s.postTax;
  $('#gross').textContent=money(gross); $('#taxable').textContent=money(taxable);
  $('#tax').textContent=money(tax); $('#net').textContent=money(net);
  $('#hours').textContent=hours.toFixed(1); $('#netHourly').textContent=money(hours?net/hours:0);
  $('#otGross').textContent=money(otGross); $('#otNetApprox').textContent=money(otGross?otGross*(net/Math.max(gross,1)):0);
}
function init() {
  const saved=restoreState();
  $('#startDate').value=saved?.startDate || new Date().toISOString().slice(0,10);
  Object.keys(defaults).forEach(k=>$('#'+k).value=saved?.settings?.[k] ?? defaults[k]);
  buildRoster(saved);
  $('#startDate').addEventListener('change',()=>buildRoster(currentState()));
  Object.keys(defaults).forEach(k=>$('#'+k).addEventListener('input',calculate));
  $('#save').onclick=saveState;
  $('#reset').onclick=()=>{if(confirm('Clear this roster and saved settings?')){localStorage.removeItem('ptaPayAppV2');location.reload();}};
  $('#share').onclick=async()=>{
    const text=`Estimated take-home: ${$('#net').textContent}\nGross: ${$('#gross').textContent}\nHours: ${$('#hours').textContent}`;
    if(navigator.share) await navigator.share({title:'Roster pay estimate',text});
    else {await navigator.clipboard.writeText(text);toast('Summary copied');}
  };
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
}
document.addEventListener('DOMContentLoaded',init);
