
(() => {
  'use strict';

  const defaults={rateSource:'agreement',employmentRole:'STO',toCommencementDate:'',fcoAppointmentDate:'',stoPromotionDate:'',previousRoleBeforeSto:'FCO',classificationOverride:true,classification:'STO3',manualBaseRate:44.37,baseRate:44.37,wdMult:1,satMult:1.5,sunMult:2,addHoursMult:1.84,weekendOtMult:2,publicHolidayWorkedMult:2.5,hdRate:4.87,maRate:4.87,nightRate:5.77,lease:546.95,gesb:100,postTax:7.40,annualLeaveLoadingRate:12.55,extraTax:0,customPublicHolidays:'',homeLine:'ARMADALE'};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(n)||0);
  const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDate=s=>new Date(s+'T00:00:00');
  const emptyDay=()=>({code:'',type:'Rostered',hd:false,start:'',finish:'',additionalHours:0,phBenefit:'cash',offline:false,workedRosterLine:'',offlineReason:'directed'});
  const rangeLabel=start=>{
    const a=parseDate(start),b=new Date(a);b.setDate(a.getDate()+13);
    return `${a.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})} – ${b.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`;
  };
  const paydayFor=start=>{
    const s=parseDate(start),end=new Date(s);end.setDate(s.getDate()+13);
    const next=new Date(end);next.setDate(end.getDate()+1);
    const offset=(3-next.getDay()+7)%7;
    const pay=new Date(next);pay.setDate(next.getDate()+offset+7);
    return pay;
  };
  const financialYearFor=date=>{
    const d=new Date(date),startYear=d.getMonth()>=6?d.getFullYear():d.getFullYear()-1;
    return {startYear,label:`${startYear}–${String(startYear+1).slice(-2)}`};
  };
  const cycleInFinancialYear=(cycle,startYear)=>{
    const d=parseDate(cycle.startDate);
    const fyStart=new Date(startYear,6,1);
    const fyEnd=new Date(startYear+1,5,30,23,59,59,999);
    return d>=fyStart&&d<=fyEnd;
  };

  const startOfRosterDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
  const addRosterDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const mondayOfRosterWeek=d=>{
    const x=startOfRosterDay(d),dow=x.getDay()||7;
    x.setDate(x.getDate()-(dow-1));
    return x;
  };
  const displayRosterStart=row=>{
    if(!row?.code)return'';
    const data=SHIFT_DATA[row.code];
    if(data?.leaveType)return'';
    return row.start||'';
  };
  const rosterVisualKind=entry=>{
    if(!entry)return'unknown';
    const row=entry.row;
    if(!row?.code||row.type==='Off'||SHIFT_DATA[row.code]?.leaveType)return'not-working';
    return'working';
  };
  function rosterTimeline(){
    const map=new Map();
    const addCycle=(cycle,priority)=>{
      if(!cycle?.startDate||!Array.isArray(cycle.days))return;
      const start=parseDate(cycle.startDate);
      cycle.days.forEach((row,i)=>{
        const date=addRosterDays(start,i),key=localISO(date),existing=map.get(key);
        if(!existing||priority>=existing.priority){
          map.set(key,{date,key,row:{...emptyDay(),...row},cycle,priority});
        }
      });
    };
    AppStorage.loadCycles().forEach(c=>addCycle(c,1));
    addCycle(current,2);
    return map;
  }
  function rosterDisplayCode(entry){
    if(!entry)return'—';
    if(!entry.row?.code)return'OFF';
    const data=SHIFT_DATA[entry.row.code];
    if(data?.leaveType){
      if(data.leaveType==='annual')return'A/L';
      if(data.leaveType==='sick')return'P/L';
      if(data.leaveType==='lsl')return'LSL';
      if(data.leaveType==='lwop')return'LWOP';
    }
    return entry.row.code;
  }
  function renderWeekStrip(){
    const wrap=$('#homeWeekStrip');if(!wrap)return;
    const start=addRosterDays(mondayOfRosterWeek(new Date()),weekOffset*7);
    const entries=rosterTimeline(),todayKey=localISO(new Date());
    wrap.innerHTML='';
    for(let i=0;i<7;i++){
      const date=addRosterDays(start,i),key=localISO(date),entry=entries.get(key),row=entry?.row;
      const button=document.createElement('button');
      button.type='button';
      button.className=`week-day ${key===todayKey?'today':''} ${rosterVisualKind(entry)}`;
      const startTime=displayRosterStart(row);
      button.innerHTML=`<span class="week-dow">${date.toLocaleDateString('en-AU',{weekday:'short'})}</span>
        <span class="week-date">${date.getDate()}</span>
        <strong>${rosterDisplayCode(entry)}</strong>
        <small>${startTime||'&nbsp;'}</small>`;
      button.onclick=()=>{
        calendarCursor=new Date(date.getFullYear(),date.getMonth(),1);
        go('calendar');
        renderCalendar(key);
      };
      wrap.appendChild(button);
    }
  }
  function renderCalendar(selectedKey=''){
    const grid=$('#calendarGrid');if(!grid)return;
    const entries=rosterTimeline(),year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
    $('#calendarMonthLabel').textContent=calendarCursor.toLocaleDateString('en-AU',{month:'long',year:'numeric'});
    grid.innerHTML='';
    const firstOffset=((new Date(year,month,1).getDay()||7)-1);
    const daysInMonth=new Date(year,month+1,0).getDate();
    for(let i=0;i<firstOffset;i++){
      const blank=document.createElement('div');
      blank.className='calendar-day blank';
      grid.appendChild(blank);
    }
    const todayKey=localISO(new Date());
    for(let day=1;day<=daysInMonth;day++){
      const date=new Date(year,month,day),key=localISO(date),entry=entries.get(key),row=entry?.row;
      const button=document.createElement('button');
      button.type='button';
      button.dataset.key=key;
      button.className=`calendar-day ${rosterVisualKind(entry)} ${key===todayKey?'today':''} ${key===selectedKey?'selected':''}`;
      button.innerHTML=`<span class="calendar-date">${day}</span>
        <strong>${rosterDisplayCode(entry)}</strong>
        <small>${displayRosterStart(row)||'&nbsp;'}</small>`;
      button.onclick=()=>renderCalendarDetail(key,entry);
      grid.appendChild(button);
    }
    if(selectedKey&&entries.get(selectedKey))renderCalendarDetail(selectedKey,entries.get(selectedKey));
    else $('#calendarDetail').hidden=true;
  }
  function renderCalendarDetail(key,entry){
    const detail=$('#calendarDetail');if(!detail)return;
    $$('#calendarGrid .calendar-day').forEach(el=>el.classList.toggle('selected',el.dataset.key===key));
    const date=parseDate(key),row=entry?.row||emptyDay(),data=SHIFT_DATA[row.code];
    const lineKey=row.offline?(row.workedRosterLine||data?.line):data?.line;
    const line=window.ROSTER_LINES?.[lineKey]||lineKey||'';
    detail.hidden=false;
    detail.innerHTML=`<span class="eyebrow">${date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
      <h2>${rosterDisplayCode(entry)}${data?.name&&!data?.leaveType?` — ${data.name}`:''}</h2>
      <div class="calendar-detail-grid">
        <div><span>Time</span><strong>${data?.leaveType?(data.name||'Leave'):(row.start&&row.finish?`${row.start}–${row.finish}`:'Off')}</strong></div>
        ${line&&line!=='LEAVE'?`<div><span>Line</span><strong>${line}</strong></div>`:''}
        ${Number(row.additionalHours)>0?`<div><span>Additional</span><strong>${Number(row.additionalHours).toFixed(2)} hrs</strong></div>`:''}
        ${row.hd?`<div><span>Higher duties</span><strong>Yes</strong></div>`:''}
        ${row.offline?`<div><span>Offline shift</span><strong>Yes</strong></div>`:''}
      </div>`;
  }

  function renderHomeDashboard(){
    const fy=financialYearFor(new Date());
    const allFyCycles=AppStorage.loadCycles().filter(c=>cycleInFinancialYear(c,fy.startYear));
    const cycles=allFyCycles.filter(c=>smartStatus(c)!=='future');
    const futureCount=allFyCycles.length-cycles.length;
    const totals=cycles.reduce((sum,c)=>{
      const s=c.summary||{};
      const status=smartStatus(c);
      const hasActual=c.actualDeposit!==''&&c.actualDeposit!=null&&status!=='future';
      const actual=hasActual?Number(c.actualDeposit)||0:null;
      sum.gross+=Number(s.gross)||0;
      sum.tax+=Number(s.tax)||0;
      sum.hours+=Number(s.hours)||0;
      sum.net+=hasActual?actual:Number(s.net)||0;
      if(hasActual){
        sum.actualCount+=1;
        sum.difference+=actual-(Number(s.net)||0);
      }
      return sum;
    },{gross:0,tax:0,hours:0,net:0,actualCount:0,difference:0});
    $('#homeFyLabel').textContent=`${fy.label} financial year`;
    $('#homeCycleCount').textContent=futureCount
      ?`${cycles.length} ${cycles.length===1?'pay':'pays'} to date • ${futureCount} future`
      :`${cycles.length} ${cycles.length===1?'pay':'pays'} to date`;
    $('#homeFyGross').textContent=money(totals.gross);
    $('#homeFyNet').textContent=money(totals.net);
    $('#homeFyTax').textContent=money(totals.tax);
    $('#homeFyHours').textContent=totals.hours.toFixed(1);
    $('#homeFyAvgNet').textContent=money(cycles.length?totals.net/cycles.length:0);
    $('#homeFyAvgHours').textContent=(cycles.length?totals.hours/cycles.length:0).toFixed(1);
    $('#homeFyActualCount').textContent=String(totals.actualCount);
    const fyDiff=$('#homeFyDifference');
    fyDiff.textContent=money(totals.difference);
    fyDiff.className=totals.difference>0?'difference-positive':totals.difference<0?'difference-negative':'difference-neutral';

    const latestActual=allFyCycles
      .filter(c=>c.actualDeposit!==''&&c.actualDeposit!=null&&smartStatus(c)!=='future')
      .sort((a,b)=>b.startDate.localeCompare(a.startDate))[0];
    const lastActualRow=$('#homeLastActual');
    if(latestActual){
      const actual=Number(latestActual.actualDeposit)||0;
      const difference=actual-(Number(latestActual.summary?.net)||0);
      lastActualRow.hidden=false;
      $('#homeLastActualAmount').textContent=money(actual);
      const lastDiff=$('#homeLastActualDifference');
      lastDiff.textContent=money(difference);
      lastDiff.className=difference>0?'difference-positive':difference<0?'difference-negative':'difference-neutral';
    }else{
      lastActualRow.hidden=true;
    }
    renderWeekStrip();
  }
  const leaveOrder=['A/L','Sick','LSL','LWOP'];
  const rosterLineOptions=(selected='')=>Object.entries(window.ROSTER_LINES||{}).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
  const opts=(selected,line)=>{
    const normal=Object.keys(SHIFT_DATA).filter(code=>SHIFT_DATA[code].line===line).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const codes=['',...normal,...leaveOrder.filter(code=>SHIFT_DATA[code])];
    return codes.map(code=>`<option value="${code}" ${code===selected?'selected':''}>${code?`${code} — ${SHIFT_DATA[code].name}`:'Off / no shift'}</option>`).join('');
  };
  const toast=text=>{const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1600)};

  let current=AppStorage.loadCurrent()||{
    startDate:localISO(new Date()),
    settings:{...defaults},
    days:Array.from({length:14},emptyDay)
  };
  let activeCycleId=null;
  let latestResult=null;
  let weekOffset=0;
  let calendarCursor=new Date();
  calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);

  const stringSettings=new Set(['rateSource','employmentRole','toCommencementDate','fcoAppointmentDate','stoPromotionDate','previousRoleBeforeSto','classification','customPublicHolidays','homeLine']);
  const boolSettings=new Set(['classificationOverride']);
  const normaliseSettings=raw=>Object.fromEntries(Object.keys(defaults).map(k=>{
    if(stringSettings.has(k))return [k,String(raw?.[k]??defaults[k])];
    if(boolSettings.has(k))return [k,Boolean(raw?.[k]??defaults[k])];
    return [k,Number(raw?.[k]??defaults[k])];
  }));
  function resolveAgreementSettings(){
    const resolved=PTA_AGREEMENT.resolve(current.settings,current.startDate);
    current.settings.baseRate=resolved.baseRate;
    current.settings.wdMult=resolved.rules.weekday;
    current.settings.satMult=resolved.rules.saturday;
    current.settings.sunMult=resolved.rules.sunday;
    current.settings.addHoursMult=resolved.rules.weekdayOvertime;
    current.settings.weekendOtMult=resolved.rules.weekendOvertime;
    current.settings.publicHolidayWorkedMult=resolved.rules.publicHolidayWorked+1;
    current.resolvedAgreement=resolved;
    return resolved;
  }
  if(current.settings && current.settings.annualLeaveLoadingRate==null){
    current.settings.annualLeaveLoadingRate=12.55;
  }
  current.settings=normaliseSettings(current.settings);
  // V7.3: users select their current level directly. Agreement rates are automatic.
  current.settings.rateSource='agreement';
  current.settings.classificationOverride=true;
  resolveAgreementSettings();
  current.days=(current.days||[]).slice(0,14);
  while(current.days.length<14) current.days.push(emptyDay());
  current.days=current.days.map(row=>{
    const next={...emptyDay(),...row};
    const data=SHIFT_DATA[next.code];
    if(data&&data.line&&data.line!=='LEAVE'&&data.line!==current.settings.homeLine){
      next.offline=true;
      next.workedRosterLine=next.workedRosterLine||data.line;
    }
    return next;
  });

  function go(id){
    $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
    $$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.go===id));
    if(id==='saved') renderSaved();
    if(id==='home') renderHomeDashboard();
    if(id==='calendar') renderCalendar();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function effectiveRosterLine(card){
    const offline=card.querySelector('.offline-mode').value==='offline';
    return offline?(card.querySelector('.worked-line').value||current.settings.homeLine):current.settings.homeLine;
  }

  function refreshShiftOptions(card,selected=''){
    const line=effectiveRosterLine(card);
    const select=card.querySelector('.shift-code');
    select.innerHTML=opts(selected,line);
    if(selected&&SHIFT_DATA[selected]&&(SHIFT_DATA[selected].line===line||SHIFT_DATA[selected].line==='LEAVE'))select.value=selected;
    card.querySelector('.worked-line-wrap').hidden=card.querySelector('.offline-mode').value!=='offline';
    card.querySelector('.offline-reason-wrap').hidden=card.querySelector('.offline-mode').value!=='offline';
  }

  function applyShiftDefaults(card,date,force=false){
    const code=card.querySelector('.shift-code').value;
    const data=SHIFT_DATA[code];
    const start=card.querySelector('.start-time');
    const finish=card.querySelector('.finish-time');
    const type=card.querySelector('.shift-type');
    const hd=card.querySelector('.higher-duties');
    const label=card.querySelector('.shift-time');
    if(!data){
      start.value='';finish.value='';type.value='Off';hd.value='no';label.textContent='Off / no shift';return;
    }
    const times=data.times[PayCalc.dayGroup(date.getDay())]||['',''];
    if(force||!start.value||!finish.value){start.value=times[0];finish.value=times[1]}
    if(type.value==='Off') type.value='Rostered';
    if(data.autoHigherDuties) hd.value='yes';
    label.textContent=data.leaveType?`${data.name} • ${data.defaultHours||10} paid hours`:`${data.name} • ${start.value}–${finish.value}`;
  }

  function buildRoster(){
    const agreement=resolveAgreementSettings();
    $('#startDate').value=current.startDate;
    $('#baseRate').value=current.settings.baseRate;
    if($('#rosterRateSource'))$('#rosterRateSource').textContent=`${agreement.classificationLabel} • ${money(agreement.weeklyRate)}/week • effective ${agreement.wageEffective||'manual'}`;
    if($('#homeStartDate'))$('#homeStartDate').value=current.startDate;
    if($('#homeBaseRate'))$('#homeBaseRate').value=current.settings.baseRate;
    $('#rosterRange').textContent=rangeLabel(current.startDate);

    const wrap=$('#dayList');wrap.innerHTML='';
    const start=parseDate(current.startDate);

    current.days.forEach((row,i)=>{
      const date=new Date(start);date.setDate(start.getDate()+i);
      const card=document.createElement('article');card.className='day-card';
      const initialLine=row.offline?(row.workedRosterLine||SHIFT_DATA[row.code]?.line||current.settings.homeLine):current.settings.homeLine;
      card.innerHTML=`<div class="day-head"><div><b>${date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'})}</b><small>Day ${i+1}</small></div><span class="day-pay">$0.00</span></div>
      <div class="day-main">
        <label>Shift code<select class="shift-code">${opts(row.code,initialLine)}</select></label>
        <button type="button" class="details-button">Details</button>
      </div>
      <div class="shift-time">Choose a shift code to show the default time.</div>
      <div class="day-details">
        <div class="form-grid two">
          <label>Shift line<select class="offline-mode"><option value="home" ${row.offline?'':'selected'}>Home line</option><option value="offline" ${row.offline?'selected':''}>Offline / other line</option></select></label>
          <label class="worked-line-wrap" ${row.offline?'':'hidden'}>Worked line<select class="worked-line">${rosterLineOptions(initialLine)}</select></label>
          <label class="offline-reason-wrap" ${row.offline?'':'hidden'}>Offline arrangement<select class="offline-reason"><option value="directed" ${(row.offlineReason||'directed')==='directed'?'selected':''}>Directed / rostered offline</option><option value="cost-neutral" ${row.offlineReason==='cost-neutral'?'selected':''}>Mutual exchange / cost neutral</option></select></label>
          <label>Type<select class="shift-type">
            <option ${row.type==='Rostered'?'selected':''}>Rostered</option>
            <option ${row.type==='Picked-up OT'?'selected':''}>Picked-up OT</option>
            <option ${row.type==='Leave'?'selected':''}>Leave</option>
            <option ${row.type==='Off'?'selected':''}>Off</option>
          </select></label>
          <label>Higher duties<select class="higher-duties"><option value="no" ${row.hd?'':'selected'}>No</option><option value="yes" ${row.hd?'selected':''}>Yes</option></select></label>
          <label>Start<input class="start-time" type="time" value="${row.start||''}"></label>
          <label>Finish<input class="finish-time" type="time" value="${row.finish||''}"></label>
          <label>Additional hours<input class="additional-hours" type="number" min="0" step="0.25" value="${Number(row.additionalHours)||0}"></label>
          <label>Public holiday benefit<select class="ph-benefit"><option value="cash" ${(row.phBenefit||'cash')==='cash'?'selected':''}>Cash payment</option><option value="lieu" ${row.phBenefit==='lieu'?'selected':''}>Leave in lieu</option></select></label>
        </div>
      </div>`;
      wrap.appendChild(card);

      card.querySelector('.details-button').onclick=()=>{card.classList.toggle('open');card.querySelector('.details-button').textContent=card.classList.contains('open')?'Close':'Details'};
      card.querySelector('.shift-code').onchange=()=>{applyShiftDefaults(card,date,true);syncCurrentFromUI();recalculate()};
      card.querySelector('.offline-mode').onchange=()=>{
        refreshShiftOptions(card,'');
        applyShiftDefaults(card,date,true);
        syncCurrentFromUI();recalculate();
      };
      card.querySelector('.worked-line').onchange=()=>{
        refreshShiftOptions(card,'');
        applyShiftDefaults(card,date,true);
        syncCurrentFromUI();recalculate();
      };
      card.querySelectorAll('.shift-type,.higher-duties,.ph-benefit,.offline-reason').forEach(el=>el.onchange=()=>{syncCurrentFromUI();recalculate()});card.querySelector('.additional-hours').oninput=()=>{syncCurrentFromUI();recalculate()};
      const manualTime=()=>{
        const data=SHIFT_DATA[card.querySelector('.shift-code').value];
        const st=card.querySelector('.start-time').value||'--:--',fn=card.querySelector('.finish-time').value||'--:--';
        card.querySelector('.shift-time').textContent=data?`${data.name} • ${st}–${fn}`:`${st}–${fn}`;
        syncCurrentFromUI();recalculate();
      };
      card.querySelector('.start-time').oninput=manualTime;
      card.querySelector('.finish-time').oninput=manualTime;
      applyShiftDefaults(card,date,false);
    });
    recalculate();
  }

  function syncCurrentFromUI(){
    current.startDate=$('#startDate').value;
    resolveAgreementSettings();
    current.days=$$('.day-card').map(card=>({
      code:card.querySelector('.shift-code').value,
      type:card.querySelector('.shift-type').value,
      hd:card.querySelector('.higher-duties').value==='yes',
      start:card.querySelector('.start-time').value,
      finish:card.querySelector('.finish-time').value,
      additionalHours:Number(card.querySelector('.additional-hours').value)||0,
      phBenefit:card.querySelector('.ph-benefit')?.value||'cash',
      offline:card.querySelector('.offline-mode').value==='offline',
      workedRosterLine:card.querySelector('.offline-mode').value==='offline'?card.querySelector('.worked-line').value:'',
      offlineReason:card.querySelector('.offline-reason').value||'directed'
    }));
  }

  function openRosterDay(dayIndex){
    go('roster');
    requestAnimationFrame(()=>{
      const cards=$$('.day-card');
      const card=cards[dayIndex];
      if(!card)return;
      card.classList.add('open');
      const button=card.querySelector('.details-button');
      if(button)button.textContent='Close';
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('audit-highlight');
      setTimeout(()=>card.classList.remove('audit-highlight'),1400);
    });
  }

  function renderAllowanceBreakdown(details=[]){
    const list=$('#allowanceBreakdownList');
    if(!list)return;
    list.innerHTML='';
    if(!details.length){
      list.innerHTML='<div class="allowance-empty">No allowances or higher duties in this pay cycle.</div>';
      return;
    }

    const order=['Night allowance','Morning allowance','Afternoon allowance','Higher duties'];
    const groups=details.reduce((out,item)=>{
      (out[item.type]??=[]).push(item);
      return out;
    },{});

    order.filter(type=>groups[type]?.length).forEach(type=>{
      const section=document.createElement('section');
      section.className='allowance-group';
      const total=groups[type].reduce((sum,item)=>sum+Number(item.amount||0),0);
      section.innerHTML=`<div class="allowance-group-head"><b>${type}</b><strong>${money(total)}</strong></div>`;

      groups[type].forEach(item=>{
        const date=parseDate(item.date);
        const row=document.createElement('button');
        row.type='button';
        row.className='allowance-audit-row';
        row.dataset.dayIndex=String(item.dayIndex);
        row.innerHTML=`<span>
          <b>${date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}</b>
          <small>${item.code||'Shift'} • ${Number(item.hours||0).toFixed(1)} hrs</small>
        </span><strong>${money(item.amount)}</strong>`;
        row.onclick=()=>openRosterDay(item.dayIndex);
        section.appendChild(row);
      });
      list.appendChild(section);
    });

    const total=details.reduce((sum,item)=>sum+Number(item.amount||0),0);
    const footer=document.createElement('div');
    footer.className='allowance-total';
    footer.innerHTML=`<span>Total allowances & higher duties</span><strong>${money(total)}</strong>`;
    list.appendChild(footer);
  }

  function renderPublicHolidayBreakdown(details=[]){
    const list=$('#publicHolidayBreakdownList');if(!list)return;list.innerHTML='';
    if(!details.length){list.innerHTML='<div class="allowance-empty">No public holiday entitlement in this pay cycle.</div>';return}
    details.forEach(item=>{const row=document.createElement('div');row.className='public-holiday-row';const d=parseDate(item.date);row.innerHTML=`<span><b>${item.name}</b><small>${d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})} • ${item.type}${item.leaveCredit?` • ${item.leaveCredit.toFixed(1)} hrs leave credited`:''}</small></span><strong>${money(item.amount)}</strong>`;list.appendChild(row)});
  }

  function recalculate(){
    syncCurrentFromUI();
    resolveAgreementSettings();
    latestResult=PayCalc.calculate(current);
    latestResult.dayTotals.forEach((row,i)=>{
      const card=$$('.day-card')[i];
      if(!card) return;
      card.querySelector('.day-pay').textContent=money(row.gross);
      card.classList.toggle('public-holiday-day',!!row.holidayName);
      let badge=card.querySelector('.public-holiday-badge');
      if(row.holidayName){if(!badge){badge=document.createElement('span');badge.className='public-holiday-badge';card.querySelector('.day-head>div').appendChild(badge)}badge.textContent=row.holidayName}else if(badge)badge.remove();
      if(row.start&&row.finish&&SHIFT_DATA[current.days[i].code]){
        const d=SHIFT_DATA[current.days[i].code];
        const addText=row.additionalHours?` • +${row.additionalHours.toFixed(2)} additional hrs`:'';
        card.querySelector('.shift-time').textContent=d.leaveType
          ? `${d.name} • ${(row.hours-row.additionalHours).toFixed(1)} paid hours${addText}`
          : `${d.name} • ${row.start}–${row.finish}${addText}`;
      }
    });
    $('#workedPay').textContent=money(latestResult.breakdown.workedPay);$('#publicHolidayPay').textContent=money(latestResult.breakdown.publicHolidayPay);renderPublicHolidayBreakdown(latestResult.publicHolidayDetails);$('#annualLeavePay').textContent=money(latestResult.breakdown.annualLeavePay);$('#sickLeavePay').textContent=money(latestResult.breakdown.sickLeavePay);$('#lslPay').textContent=money(latestResult.breakdown.lslPay);$('#lwopPay').textContent=money(latestResult.breakdown.lwopPay);$('#extrasPay').textContent=money(latestResult.breakdown.extrasPay);renderAllowanceBreakdown(latestResult.allowanceDetails);$('#additionalHoursPay').textContent=money(latestResult.breakdown.additionalHoursPay);$('#gross').textContent=money(latestResult.gross);
    $('#taxable').textContent=money(latestResult.taxable);
    $('#tax').textContent=money(latestResult.tax);
    $('#hours').textContent=latestResult.hours.toFixed(1);
    $('#net').textContent=money(latestResult.net);
    $('#netHourly').textContent=money(latestResult.netHourly);
    $('#rosterGross').textContent=money(latestResult.gross);
    $('#rosterTax').textContent=money(latestResult.tax);
    $('#rosterNet').textContent=money(latestResult.net);
    $('#rosterHours').textContent=latestResult.hours.toFixed(1);
    updateRosterSaveButton();
    $('#homeRange').textContent=rangeLabel(current.startDate);
    $('#homeNet').textContent=money(latestResult.net);
    const currentPayday=paydayFor(current.startDate).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
    $('#homePayday').textContent=currentPayday;
    $('#homeCurrentPayday').textContent=`Payday ${currentPayday}`;
    const enteredShifts=current.days.filter(d=>d.code&&d.code.trim()).length;
    $('#homeRosterStatus').textContent=`${enteredShifts} ${enteredShifts===1?'shift':'shifts'} entered • ${latestResult.hours.toFixed(1)} hrs`;
    renderHomeDashboard();
    $('#payRange').textContent=rangeLabel(current.startDate);
  }

  function updateRosterSaveButton(){
    const button=$('#rosterSaveCycle');
    if(!button)return;
    const id=`cycle-${current.startDate}`;
    const exists=AppStorage.loadCycles().some(c=>c.id===id);
    button.textContent=exists?'Update Pay Cycle':'Save Pay Cycle';
  }

  function saveCurrent(){
    syncCurrentFromUI();
    AppStorage.saveCurrent(current);
    toast('Current roster saved');
  }

  function saveCycle(){
    saveCurrent();
    const cycles=AppStorage.loadCycles();
    const id=`cycle-${current.startDate}`;
    const index=cycles.findIndex(c=>c.id===id);
    const previous=index>=0?cycles[index]:{};
    const record={
      ...JSON.parse(JSON.stringify(current)),
      id,
      summary:{gross:latestResult.gross,taxable:latestResult.taxable,tax:latestResult.tax,hours:latestResult.hours,net:latestResult.net,netHourly:latestResult.netHourly},
      status:previous.status||'current',
      actualDeposit:previous.actualDeposit??'',
      notes:previous.notes||'',
      updatedAt:new Date().toISOString()
    };
    if(index>=0) cycles[index]=record; else cycles.push(record);
    AppStorage.saveCycles(cycles);
    toast(index>=0?'Pay cycle updated':'Pay cycle saved');
    renderHomeDashboard();
  }

  function startNextFortnight(){
    if(confirm('Save this pay cycle before starting the next fortnight?')) saveCycle();
    const next=parseDate(current.startDate);next.setDate(next.getDate()+14);
    current={startDate:localISO(next),settings:{...current.settings},days:Array.from({length:14},emptyDay)};
    AppStorage.saveCurrent(current);
    buildRoster();
    go('roster');
    toast('Next fortnight started');
  }

  function renderSaved(){
    const list=$('#savedList');
    const filter=$('#savedFilter')?.value||'all';
    const allCycles=AppStorage.loadCycles().sort((a,b)=>b.startDate.localeCompare(a.startDate));
    const cycles=allCycles.filter(c=>{
      const status=smartStatus(c);
      const hasActual=c.actualDeposit!==''&&c.actualDeposit!=null;
      if(filter==='needs-actual')return !hasActual&&(status==='awaiting'||status==='past');
      if(filter==='paid')return status==='paid';
      if(filter==='current')return status==='current'||status==='awaiting';
      if(filter==='future')return status==='future';
      if(filter==='past')return status==='past';
      return true;
    });
    $('#savedIndex').hidden=false;$('#savedDetail').hidden=true;activeCycleId=null;
    if(!cycles.length){list.innerHTML=`<div class="empty-state">${allCycles.length?'No saved pays match this filter.':'No saved pay cycles yet.'}</div>`;return}
    list.innerHTML='';
    cycles.forEach(c=>{
      const actual=c.actualDeposit!==''&&c.actualDeposit!=null?Number(c.actualDeposit):null;
      const diff=actual==null?null:actual-c.summary.net;
      const status=smartStatus(c);
      const payday=paydayFor(c.startDate);
      const card=document.createElement('div');card.className='saved-card compact-saved';
      card.innerHTML=`<button type="button" class="saved-card-toggle">
        <span class="saved-card-title">
          <span class="status-pill ${status}">${statusLabel(status)}</span>
          <b>${rangeLabel(c.startDate)}</b>
        </span>
        <strong>${money(c.summary.net)}</strong>
      </button>
      <div class="saved-card-collapse">
        <small>Expected payday ${payday.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</small>
        <small>Updated ${new Date(c.updatedAt).toLocaleString('en-AU')}</small>
        <div class="saved-meta">
          <div><span>Gross</span><b>${money(c.summary.gross)}</b></div>
          <div><span>Hours</span><b>${c.summary.hours.toFixed(1)}</b></div>
          <div><span>Actual deposit</span><b>${actual==null?'Not entered':money(actual)}</b></div>
          <div><span>Difference</span><b class="${diff==null?'difference-neutral':diff>0?'difference-positive':diff<0?'difference-negative':'difference-neutral'}">${diff==null?'Not available':money(diff)}</b></div>
        </div>
        <div class="quick-actual-entry">
          <label>Actual deposit
            <input class="quick-actual-input" type="number" step="0.01" inputmode="decimal" placeholder="${actual==null?'Enter amount':actual}">
          </label>
          <div class="quick-actual-buttons">
            <button class="save-quick-actual" type="button">${actual==null?'Save actual':'Update actual'}</button>
            ${actual==null?'':'<button class="clear-quick-actual" type="button">Clear</button>'}
          </div>
        </div>
        <div class="saved-actions"><button class="open-saved">View details</button><button class="delete-saved">Delete</button></div>
      </div>`;
      card.querySelector('.saved-card-toggle').onclick=()=>card.classList.toggle('open');
      const quickInput=card.querySelector('.quick-actual-input');
      if(actual!=null)quickInput.value=actual;
      card.querySelector('.save-quick-actual').onclick=()=>{
        const value=quickInput.value.trim();
        if(value===''){toast('Enter the actual deposit');quickInput.focus();return}
        const saved=AppStorage.loadCycles();
        const savedIndex=saved.findIndex(x=>x.id===c.id);
        if(savedIndex<0)return;
        saved[savedIndex].actualDeposit=value;
        saved[savedIndex].updatedAt=new Date().toISOString();
        AppStorage.saveCycles(saved);
        renderSaved();
        renderHomeDashboard();
        toast('Actual deposit saved');
      };
      const clearQuick=card.querySelector('.clear-quick-actual');
      if(clearQuick)clearQuick.onclick=()=>{
        if(!confirm('Clear the actual deposit for this pay?'))return;
        const saved=AppStorage.loadCycles();
        const savedIndex=saved.findIndex(x=>x.id===c.id);
        if(savedIndex<0)return;
        saved[savedIndex].actualDeposit='';
        saved[savedIndex].updatedAt=new Date().toISOString();
        AppStorage.saveCycles(saved);
        renderSaved();
        renderHomeDashboard();
        toast('Actual deposit cleared');
      };
      card.querySelector('.open-saved').onclick=()=>openSaved(c.id);
      card.querySelector('.delete-saved').onclick=()=>{if(confirm('Delete this saved pay cycle?')){AppStorage.saveCycles(AppStorage.loadCycles().filter(x=>x.id!==c.id));renderSaved();renderHomeDashboard();toast('Deleted')}};
      list.appendChild(card);
    });
  }

  const smartStatus=c=>{
    const today=new Date();today.setHours(0,0,0,0);
    const start=parseDate(c.startDate),end=new Date(start);end.setDate(start.getDate()+13);
    const payday=paydayFor(c.startDate);payday.setHours(0,0,0,0);
    const hasActual=c.actualDeposit!==''&&c.actualDeposit!=null;
    if(today<start)return'future';
    if(today<=end)return'current';
    if(today<payday)return'awaiting';
    if(hasActual)return'paid';
    return'past';
  };
  const statusLabel=s=>s==='paid'?'Paid':s==='awaiting'?'Awaiting payday':s==='future'?'Future cycle':s==='past'?'Archived':'Current cycle';

  function openSaved(id){
    const c=AppStorage.loadCycles().find(x=>x.id===id);if(!c)return;
    activeCycleId=id;$('#savedIndex').hidden=true;$('#savedDetail').hidden=false;
    $('#detailTitle').textContent=rangeLabel(c.startDate);
    $('#detailEstimate').textContent=money(c.summary.net);
    $('#detailEstimated').textContent=money(c.summary.net);
    const actual=c.actualDeposit!==''&&c.actualDeposit!=null?Number(c.actualDeposit):null;
    $('#detailActual').textContent=actual==null?'Not entered':money(actual);
    $('#detailActualInput').value=actual==null?'':actual;
    const detailDifference=$('#detailDifference');
    const detailDiff=actual==null?null:actual-c.summary.net;
    detailDifference.textContent=detailDiff==null?'Not available':money(detailDiff);
    detailDifference.className=detailDiff==null?'difference-neutral':detailDiff>0?'difference-positive':detailDiff<0?'difference-negative':'difference-neutral';
    $('#detailStatus').value=c.status||'current';
    $('#detailNotes').value=c.notes||'';
    const computedStatus=smartStatus(c);const pill=$('#detailStatusPill');pill.textContent=statusLabel(computedStatus);pill.className=`status-pill ${computedStatus}`;
  }

  function saveSavedDetails(){
    const cycles=AppStorage.loadCycles();const index=cycles.findIndex(c=>c.id===activeCycleId);if(index<0)return;
    cycles[index].status=$('#detailStatus').value;
    cycles[index].actualDeposit=$('#detailActualInput').value;
    cycles[index].notes=$('#detailNotes').value;
    cycles[index].updatedAt=new Date().toISOString();
    AppStorage.saveCycles(cycles);openSaved(activeCycleId);renderHomeDashboard();toast('Saved details');
  }

  function editSavedCycle(){
    const c=AppStorage.loadCycles().find(x=>x.id===activeCycleId);if(!c)return;
    current=JSON.parse(JSON.stringify({startDate:c.startDate,settings:c.settings,days:c.days}));
    AppStorage.saveCurrent(current);buildRoster();go('roster');toast('Saved cycle opened');
  }

  function exportBackup(){
    saveCurrent();
    const payload={
      app:'PTA Pay Calculator',
      version:'8.2.1',
      exportedAt:new Date().toISOString(),
      current:AppStorage.loadCurrent(),
      cycles:AppStorage.loadCycles()
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`PTA-PC-backup-${localISO(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Backup exported');
  }

  async function importBackup(file){
    if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      if(!payload||typeof payload!=='object'||!payload.current||!Array.isArray(payload.cycles)){
        throw new Error('Invalid backup');
      }
      if(!confirm(`Restore this backup with ${payload.cycles.length} saved pay cycles? Current app data will be replaced.`))return;
      AppStorage.saveCurrent(payload.current);
      AppStorage.saveCycles(payload.cycles);
      toast('Backup restored');
      setTimeout(()=>location.reload(),500);
    }catch(error){
      alert('This file is not a valid PTA Pay Calculator backup.');
    }finally{
      $('#importBackup').value='';
    }
  }

  function updateAgreementSettingsUI(){
    current.settings.rateSource='agreement';
    current.settings.classificationOverride=true;
    const agreement=resolveAgreementSettings();
    if($('#agreementRateSummary'))$('#agreementRateSummary').textContent=`${agreement.classificationLabel}: ${money(agreement.weeklyRate)} per week / ${money(agreement.baseRate)} per hour • wage table effective ${agreement.wageEffective}.`;
    if($('#baseRate'))$('#baseRate').value=agreement.baseRate;
  }

  function loadSettingsIntoForm(){
    Object.keys(defaults).forEach(k=>{
      const el=$('#'+k);if(!el)return;
      if(el.type==='checkbox')el.checked=Boolean(current.settings[k]);else el.value=current.settings[k];
    });
    updateAgreementSettingsUI();
  }

  function readSettingsFromForm(){
    Object.keys(defaults).forEach(k=>{
      const el=$('#'+k);if(!el)return;
      if(el.type==='checkbox')current.settings[k]=el.checked;
      else if(stringSettings.has(k))current.settings[k]=el.value.trim();
      else current.settings[k]=Number(el.value)||0;
    });
    updateAgreementSettingsUI();
    recalculate();
  }

  $$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('#weekPrev').onclick=()=>{weekOffset-=1;renderWeekStrip()};
  $('#weekNext').onclick=()=>{weekOffset+=1;renderWeekStrip()};
  $('#weekToday').onclick=()=>{weekOffset=0;renderWeekStrip()};
  $('#calendarPrev').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()};
  $('#calendarNext').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()};
  $('#calendarToday').onclick=()=>{
    const t=new Date();
    calendarCursor=new Date(t.getFullYear(),t.getMonth(),1);
    renderCalendar(localISO(t));
  };
  let weekTouchStartX=null;
  $('#homeWeekStrip').addEventListener('touchstart',e=>{weekTouchStartX=e.touches[0].clientX},{passive:true});
  $('#homeWeekStrip').addEventListener('touchend',e=>{
    if(weekTouchStartX==null)return;
    const delta=e.changedTouches[0].clientX-weekTouchStartX;
    if(Math.abs(delta)>45){
      weekOffset+=delta<0?1:-1;
      renderWeekStrip();
    }
    weekTouchStartX=null;
  },{passive:true});

  $('#startDate').onchange=()=>{current.startDate=$('#startDate').value;resolveAgreementSettings();buildRoster()};
  if($('#homeStartDate'))$('#homeStartDate').onchange=()=>{current.startDate=$('#homeStartDate').value;buildRoster()};
  ['classification','homeLine'].forEach(id=>{
    const el=$('#'+id);if(!el)return;
    el.addEventListener(el.type==='checkbox'?'change':'input',()=>{readSettingsFromForm();buildRoster()});
  });
  $('#clearRoster').onclick=()=>{if(confirm('Clear all shift codes for this fortnight?')){current.days=Array.from({length:14},emptyDay);buildRoster()}};
  $('#rosterSaveCycle').onclick=saveCycle;
  $('#rosterNewCycle').onclick=startNextFortnight;
  if($('#homeNewCycle'))$('#homeNewCycle').onclick=startNextFortnight;
  $('#saveCurrent').onclick=()=>{readSettingsFromForm();saveCurrent()};
  $('#resetApp').onclick=()=>{if(confirm('Delete the current roster and all saved pay cycles?')){AppStorage.clearAll();location.reload()}};
  $('#backSaved').onclick=renderSaved;
  $('#saveSavedDetails').onclick=saveSavedDetails;
  $('#editSavedCycle').onclick=editSavedCycle;
  if($('#savedFilter'))$('#savedFilter').onchange=renderSaved;
  if($('#exportBackup'))$('#exportBackup').onclick=exportBackup;
  if($('#importBackup'))$('#importBackup').onchange=e=>importBackup(e.target.files?.[0]);

  buildRoster();
  loadSettingsIntoForm();
})();
