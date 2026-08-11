
(() => {
  'use strict';

  const defaults={rateSource:'agreement',employmentRole:'STO',toCommencementDate:'',fcoAppointmentDate:'',stoPromotionDate:'',previousRoleBeforeSto:'FCO',classificationOverride:true,classification:'STO3',manualBaseRate:44.37,baseRate:44.37,wdMult:1,satMult:1.5,sunMult:2,addHoursMult:1.84,weekendOtMult:2,publicHolidayWorkedMult:2.5,hdRate:4.87,maRate:4.87,nightRate:5.77,lease:546.95,gesb:100,postTax:7.40,annualLeaveLoadingRate:12.55,extraTax:0,customPublicHolidays:'',homeLine:'ARMADALE'};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(n)||0);
  const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDate=s=>new Date(s+'T00:00:00');
  const emptyDay=()=>({code:'',type:'Rostered',hd:false,start:'',finish:'',additionalHours:0,phBenefit:'cash',offline:false,workedRosterLine:'',offlineReason:'directed',entered:false});
  const rangeLabel=start=>{
    const a=parseDate(start),b=new Date(a);b.setDate(a.getDate()+13);
    return `${a.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})} – ${b.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`;
  };
  const periodEndDate=start=>addRosterDays(parseDate(start),13);
  const peLabel=start=>{
    const d=periodEndDate(start);
    return `PE${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getFullYear()).slice(-2)}`;
  };
  const cycleDateRange=start=>{
    const a=parseDate(start),b=periodEndDate(start);
    return `${a.toLocaleDateString('en-AU',{day:'numeric',month:'short'})} – ${b.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`;
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
    if(!entry)return'not-working';
    const row=entry.row||{};
    if(!row.code||row.type==='Off'||SHIFT_DATA[row.code]?.leaveType)return'not-working';
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
    if(!entry?.row?.code)return'OFF';
    if(entry.row.type==='Off'||SHIFT_DATA[entry.row.code]?.leaveType)return'OFF';
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
    const firstOfMonth=new Date(year,month,1),lastOfMonth=new Date(year,month+1,0);
    const first=mondayOfRosterWeek(firstOfMonth),last=addRosterDays(mondayOfRosterWeek(lastOfMonth),6);
    const todayKey=localISO(new Date());
    for(let date=new Date(first);date<=last;date=addRosterDays(date,1)){
      const key=localISO(date),entry=entries.get(key),row=entry?.row;
      const button=document.createElement('button');button.type='button';button.dataset.key=key;
      const outside=date.getMonth()!==month;
      button.className=`calendar-day ${rosterVisualKind(entry)} ${outside?'outside-month':''} ${key===todayKey?'today':''} ${key===selectedKey?'selected':''}`;
      button.innerHTML=`${key===todayKey?'<span class="today-marker">TODAY</span>':''}
        <span class="calendar-date">${date.getDate()}</span>
        <strong>${rosterDisplayCode(entry)}</strong>`;
      button.onclick=()=>renderCalendarDetail(key,entry);grid.appendChild(button);
    }
    if(selectedKey&&entries.get(selectedKey))renderCalendarDetail(selectedKey,entries.get(selectedKey));else $('#calendarDetail').hidden=true;
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

  function cycleResult(cycle){
    if(!cycle)return null;
    if(cycle.startDate===current.startDate&&latestResult)return latestResult;
    return PayCalc.calculate(cycle);
  }

  function availableCycles(){
    const saved=AppStorage.loadCycles().map(c=>({...c}));
    if(current?.startDate&&!saved.some(c=>c.startDate===current.startDate)){
      const result=latestResult||PayCalc.calculate(current);
      saved.push({...JSON.parse(JSON.stringify(current)),id:'current-unsaved',
        summary:{gross:result.gross,taxable:result.taxable,tax:result.tax,hours:result.hours,net:result.net,netHourly:result.netHourly},
        actualDeposit:'',notes:'',updatedAt:new Date().toISOString()});
    }
    return saved;
  }

  function upcomingPayCycle(){
    const today=startOfRosterDay(new Date());
    const upcoming=availableCycles().filter(c=>paydayFor(c.startDate)>=today)
      .sort((a,b)=>paydayFor(a.startDate)-paydayFor(b.startDate));
    return upcoming[0]||availableCycles().sort((a,b)=>b.startDate.localeCompare(a.startDate))[0]||null;
  }

  function loadCycleIntoRoster(cycle){
    if(!cycle)return;
    current=JSON.parse(JSON.stringify({startDate:cycle.startDate,settings:cycle.settings,days:cycle.days}));
    current.days=current.days.map(row=>({...emptyDay(),...row,entered:Boolean(row.code)}));
    AppStorage.saveCurrent(current);
    buildRoster();
  }
  function renderHomeCycleJump(){
    const select=$('#homeCycleSelect');if(!select)return;
    const cycles=availableCycles().sort((a,b)=>a.startDate.localeCompare(b.startDate));
    select.innerHTML=cycles.map(c=>`<option value="${c.id}">${peLabel(c.startDate)} · ${cycleDateRange(c.startDate)}</option>`).join('');
    const currentMatch=cycles.find(c=>c.startDate===current.startDate);
    const upcoming=upcomingPayCycle();
    select.value=(currentMatch||upcoming||cycles[cycles.length-1])?.id||'';
    $('#homeCycleRoster').disabled=!cycles.length;
  }
  function renderHomeDashboard(){
    const upcoming=upcomingPayCycle();
    if(upcoming){
      const result=cycleResult(upcoming);
      $('#homeRange').innerHTML=`${peLabel(upcoming.startDate)}<small class="cycle-range-sub">${cycleDateRange(upcoming.startDate)}</small>`;
      $('#homeNet').textContent=money(result?.net||upcoming.summary?.net||0);
      $('#homeCurrentPayday').textContent=`Payday ${paydayFor(upcoming.startDate).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`;
      const entered=(upcoming.days||[]).filter(d=>(d.entered??Boolean(d.code))&&d.code).length;
      $('#homeRosterStatus').textContent=`${entered} ${entered===1?'shift':'shifts'} entered • ${Number(result?.hours||upcoming.summary?.hours||0).toFixed(1)} hrs`;
    }else{
      $('#homeRange').textContent='No upcoming pay';$('#homeNet').textContent=money(0);
      $('#homeCurrentPayday').textContent='Payday —';$('#homeRosterStatus').textContent='No upcoming cycle saved';
    }
    renderWeekStrip();
    renderHomeCycleJump();
  }
  const leaveOrder=['A/L','Sick','LSL','LWOP'];
  const rosterLineOptions=(selected='')=>Object.entries(window.ROSTER_LINES||{}).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
  const opts=(selected,line,date=null)=>{
    const group=date?PayCalc.dayGroup(date.getDay()):null;
    const normal=Object.keys(SHIFT_DATA)
      .filter(code=>{
        const data=SHIFT_DATA[code];
        if(data.line!==line)return false;
        if(!group)return true;
        const times=data.times?.[group]||['',''];
        return Boolean(times[0]&&times[1]);
      })
      .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
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
  let selectedPayCycleId=null;
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
    if(row?.entered==null)next.entered=Boolean(row?.code);
    const data=SHIFT_DATA[next.code];
    if(!next.workedRosterLine){
      next.workedRosterLine=data?.line&&data.line!=='LEAVE'?data.line:(current?.settings?.homeLine||'');
    }
    next.offline=Boolean(next.workedRosterLine&&current?.settings?.homeLine&&next.workedRosterLine!==current.settings.homeLine);
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
    if(id==='pay') renderPayScreen();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function effectiveRosterLine(card){
    return card.querySelector('.worked-line').value||current.settings.homeLine;
  }

  function refreshShiftOptions(card,date,selected=''){
    const line=card.querySelector('.worked-line').value||current.settings.homeLine;
    const select=card.querySelector('.shift-code');

    const validSelected=selected&&SHIFT_DATA[selected]&&(
      SHIFT_DATA[selected].line==='LEAVE'||
      (SHIFT_DATA[selected].line===line&&(()=>{
        const times=SHIFT_DATA[selected].times?.[PayCalc.dayGroup(date.getDay())]||['',''];
        return Boolean(times[0]&&times[1]);
      })())
    );

    select.innerHTML=opts(validSelected?selected:'',line,date);
    select.value=validSelected?selected:'';

    const isOffline=line!==current.settings.homeLine;
    card.dataset.offline=String(isOffline);
    card.querySelector('.offline-reason-wrap').hidden=!isOffline;
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

  function updateRosterCardState(card){
    const code=card.querySelector('.shift-code')?.value||'';
    const rowType=card.querySelector('.shift-type')?.value||'';
    const isOvertime=rowType==='Overtime';
    const hasRosterEntry=Boolean(code);
    card.dataset.entered=String(hasRosterEntry);
    card.classList.toggle('roster-unentered',!hasRosterEntry);
    card.classList.toggle('roster-entered',hasRosterEntry&&!isOvertime);
    card.classList.toggle('roster-overtime',hasRosterEntry&&isOvertime);
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
      const card=document.createElement('article');card.className='day-card';card.dataset.entered=String(Boolean(row.entered??row.code));
      const initialLine=row.workedRosterLine||SHIFT_DATA[row.code]?.line||current.settings.homeLine;
      card.dataset.workedRosterLine=initialLine;
      card.innerHTML=`<div class="day-head"><div><b>${date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'})}</b><small>Day ${i+1}</small></div><span class="day-pay">$0.00</span></div>
      <div class="day-main">
        <label>Shift code<select class="shift-code">${opts(row.code,initialLine,date)}</select></label>
        <button type="button" class="details-button">Details</button>
      </div>
      <div class="shift-time">Choose a shift code to show the default time.</div>
      <div class="day-details">
        <div class="form-grid two">
          <label>Worked line<select class="worked-line">${rosterLineOptions(initialLine)}</select></label>
          <label class="offline-reason-wrap" ${initialLine!==current.settings.homeLine?'':'hidden'}>Offline arrangement<select class="offline-reason"><option value="directed" ${(row.offlineReason||'directed')==='directed'?'selected':''}>Directed / rostered offline</option><option value="cost-neutral" ${row.offlineReason==='cost-neutral'?'selected':''}>Mutual exchange / cost neutral</option></select></label>
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
      card.querySelector('.shift-code').onchange=()=>{applyShiftDefaults(card,date,true);updateRosterCardState(card);syncCurrentFromUI();recalculate()};
      card.querySelector('.worked-line').onchange=e=>{
        card.dataset.entered='true';
        card.dataset.workedRosterLine=e.target.value;
        card.dataset.offline=String(e.target.value!==current.settings.homeLine);
        refreshShiftOptions(card,date,'');
        applyShiftDefaults(card,date,true);
        updateRosterCardState(card);
        syncCurrentFromUI();
        recalculate();
      };
      card.querySelectorAll('.shift-type,.higher-duties,.ph-benefit,.offline-reason').forEach(el=>el.onchange=()=>{card.dataset.entered='true';updateRosterCardState(card);syncCurrentFromUI();recalculate()});card.querySelector('.additional-hours').oninput=()=>{card.dataset.entered='true';updateRosterCardState(card);syncCurrentFromUI();recalculate()};
      const manualTime=()=>{
        const data=SHIFT_DATA[card.querySelector('.shift-code').value];
        const st=card.querySelector('.start-time').value||'--:--',fn=card.querySelector('.finish-time').value||'--:--';
        card.querySelector('.shift-time').textContent=data?`${data.name} • ${st}–${fn}`:`${st}–${fn}`;
        card.dataset.entered='true';updateRosterCardState(card);syncCurrentFromUI();recalculate();
      };
      card.querySelector('.start-time').oninput=manualTime;
      card.querySelector('.finish-time').oninput=manualTime;
      refreshShiftOptions(card,date,row.code||'');
      applyShiftDefaults(card,date,false);updateRosterCardState(card);
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
      workedRosterLine:card.querySelector('.worked-line').value||current.settings.homeLine,
      offline:(card.querySelector('.worked-line').value||current.settings.homeLine)!==current.settings.homeLine,
      offlineReason:card.querySelector('.offline-reason').value||'directed',
      entered:card.dataset.entered==='true'
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

  function renderAllowanceBreakdown(details=[],cycleStart=current.startDate){
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
        if(cycleStart===current.startDate)row.onclick=()=>openRosterDay(item.dayIndex);else row.classList.add('read-only-audit');
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
    if($('#pay')?.classList.contains('active'))renderPayScreen();
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
          <b>${peLabel(c.startDate)}</b><small class="cycle-range-sub">${cycleDateRange(c.startDate)}</small>
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


  function renderFinancialYearSummary(referenceCycle){
    const ref=referenceCycle?.startDate?parseDate(referenceCycle.startDate):new Date();
    const fy=financialYearFor(ref);
    const allFyCycles=AppStorage.loadCycles().filter(c=>cycleInFinancialYear(c,fy.startYear));
    const cycles=allFyCycles.filter(c=>smartStatus(c)!=='future');
    const futureCount=allFyCycles.length-cycles.length;
    const totals=cycles.reduce((sum,c)=>{
      const s=c.summary||{},status=smartStatus(c);
      const hasActual=c.actualDeposit!==''&&c.actualDeposit!=null&&status!=='future';
      const actual=hasActual?Number(c.actualDeposit)||0:null;
      sum.gross+=Number(s.gross)||0;sum.tax+=Number(s.tax)||0;sum.hours+=Number(s.hours)||0;
      sum.net+=hasActual?actual:Number(s.net)||0;
      if(hasActual){sum.actualCount+=1;sum.difference+=actual-(Number(s.net)||0)}
      return sum;
    },{gross:0,tax:0,hours:0,net:0,actualCount:0,difference:0});
    $('#homeFyLabel').textContent=`${fy.label} financial year`;
    $('#homeCycleCount').textContent=futureCount?`${cycles.length} ${cycles.length===1?'pay':'pays'} • ${futureCount} future`:`${cycles.length} ${cycles.length===1?'pay':'pays'}`;
    $('#homeFyGross').textContent=money(totals.gross);$('#homeFyNet').textContent=money(totals.net);$('#homeFyTax').textContent=money(totals.tax);
    $('#homeFyHours').textContent=totals.hours.toFixed(1);$('#homeFyAvgNet').textContent=money(cycles.length?totals.net/cycles.length:0);
    $('#homeFyAvgHours').textContent=(cycles.length?totals.hours/cycles.length:0).toFixed(1);$('#homeFyActualCount').textContent=String(totals.actualCount);
    const diff=$('#homeFyDifference');diff.textContent=money(totals.difference);diff.className=totals.difference>0?'difference-positive':totals.difference<0?'difference-negative':'difference-neutral';
    const latestActual=allFyCycles.filter(c=>c.actualDeposit!==''&&c.actualDeposit!=null&&smartStatus(c)!=='future').sort((a,b)=>b.startDate.localeCompare(a.startDate))[0];
    const row=$('#homeLastActual');
    if(latestActual){
      const actual=Number(latestActual.actualDeposit)||0,difference=actual-(Number(latestActual.summary?.net)||0);
      row.hidden=false;$('#homeLastActualAmount').textContent=money(actual);
      const d=$('#homeLastActualDifference');d.textContent=money(difference);d.className=difference>0?'difference-positive':difference<0?'difference-negative':'difference-neutral';
    }else row.hidden=true;
    const next=upcomingPayCycle();$('#homePayday').textContent=next?paydayFor(next.startDate).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}):'—';
  }

  function renderPayResult(cycle){
    if(!cycle)return;
    const result=cycleResult(cycle),status=smartStatus(cycle);
    $('#payStatusLabel').textContent=statusLabel(status);$('#payRange').innerHTML=`${peLabel(cycle.startDate)}<small class="cycle-range-sub">${cycleDateRange(cycle.startDate)}</small>`;
    $('#payPayday').textContent=`Payday ${paydayFor(cycle.startDate).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`;
    $('#workedPay').textContent=money(result.breakdown.workedPay);$('#publicHolidayPay').textContent=money(result.breakdown.publicHolidayPay);
    renderPublicHolidayBreakdown(result.publicHolidayDetails);$('#annualLeavePay').textContent=money(result.breakdown.annualLeavePay);
    $('#sickLeavePay').textContent=money(result.breakdown.sickLeavePay);$('#lslPay').textContent=money(result.breakdown.lslPay);
    $('#lwopPay').textContent=money(result.breakdown.lwopPay);$('#extrasPay').textContent=money(result.breakdown.extrasPay);
    renderAllowanceBreakdown(result.allowanceDetails,cycle.startDate);$('#additionalHoursPay').textContent=money(result.breakdown.additionalHoursPay);
    $('#gross').textContent=money(result.gross);$('#taxable').textContent=money(result.taxable);$('#tax').textContent=money(result.tax);
    $('#hours').textContent=result.hours.toFixed(1);$('#net').textContent=money(result.net);$('#netHourly').textContent=money(result.netHourly);
    renderFinancialYearSummary(cycle);
    const upcoming=upcomingPayCycle();$('#backToUpcomingPay').hidden=!upcoming||cycle.startDate===upcoming.startDate;
  }

  function makePayCard(c){
    const actual=c.actualDeposit!==''&&c.actualDeposit!=null?Number(c.actualDeposit):null,s=c.summary||{},status=smartStatus(c);
    const diff=actual==null?null:actual-(Number(s.net)||0),payday=paydayFor(c.startDate);
    const card=document.createElement('div');card.className='saved-card compact-saved';
    card.innerHTML=`<button type="button" class="saved-card-toggle"><span class="saved-card-title"><span class="status-pill ${status}">${statusLabel(status)}</span><b>${peLabel(c.startDate)}</b><small class="cycle-range-sub">${cycleDateRange(c.startDate)}</small></span><strong>${money(s.net)}</strong></button>
      <div class="saved-card-collapse"><small>Expected payday ${payday.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</small>
      <div class="saved-meta"><div><span>Gross</span><b>${money(s.gross)}</b></div><div><span>Hours</span><b>${Number(s.hours||0).toFixed(1)}</b></div>
      <div><span>Actual deposit</span><b>${actual==null?'Not entered':money(actual)}</b></div><div><span>Difference</span><b class="${diff==null?'difference-neutral':diff>0?'difference-positive':diff<0?'difference-negative':'difference-neutral'}">${diff==null?'Not available':money(diff)}</b></div></div>
      <div class="quick-actual-entry"><label>Actual deposit<input class="quick-actual-input" type="number" step="0.01" inputmode="decimal" placeholder="${actual==null?'Enter amount':actual}" value="${actual==null?'':actual}"></label>
      <div class="quick-actual-buttons"><button class="save-quick-actual" type="button">${actual==null?'Save actual':'Update actual'}</button>${actual==null?'':'<button class="clear-quick-actual" type="button">Clear</button>'}</div></div>
      <div class="saved-actions"><button class="view-pay" type="button">View pay</button><button class="open-pay-roster" type="button">Open roster</button>${c.id==='current-unsaved'?'':'<button class="delete-saved" type="button">Delete</button>'}</div></div>`;
    card.querySelector('.saved-card-toggle').onclick=()=>card.classList.toggle('open');
    card.querySelector('.view-pay').onclick=()=>{selectedPayCycleId=c.id;renderPayResult(c);window.scrollTo({top:0,behavior:'smooth'})};
    card.querySelector('.open-pay-roster').onclick=()=>{current=JSON.parse(JSON.stringify({startDate:c.startDate,settings:c.settings,days:c.days}));current.days=current.days.map(row=>({...emptyDay(),...row,entered:row.entered??Boolean(row.code)}));AppStorage.saveCurrent(current);buildRoster();go('roster');toast('Pay cycle opened in roster')};
    card.querySelector('.save-quick-actual').onclick=()=>{if(c.id==='current-unsaved'){toast('Save this pay cycle first');return}const input=card.querySelector('.quick-actual-input'),value=input.value.trim();if(value===''){toast('Enter the actual deposit');input.focus();return}const saved=AppStorage.loadCycles(),i=saved.findIndex(x=>x.id===c.id);if(i<0)return;saved[i].actualDeposit=value;saved[i].updatedAt=new Date().toISOString();AppStorage.saveCycles(saved);renderPayScreen();renderHomeDashboard();toast('Actual deposit saved')};
    const clear=card.querySelector('.clear-quick-actual');if(clear)clear.onclick=()=>{if(!confirm('Clear the actual deposit for this pay?'))return;const saved=AppStorage.loadCycles(),i=saved.findIndex(x=>x.id===c.id);if(i<0)return;saved[i].actualDeposit='';saved[i].updatedAt=new Date().toISOString();AppStorage.saveCycles(saved);renderPayScreen();renderHomeDashboard();toast('Actual deposit cleared')};
    const del=card.querySelector('.delete-saved');if(del)del.onclick=()=>{if(!confirm('Delete this saved pay cycle?'))return;AppStorage.saveCycles(AppStorage.loadCycles().filter(x=>x.id!==c.id));if(selectedPayCycleId===c.id)selectedPayCycleId=null;renderPayScreen();renderHomeDashboard();toast('Deleted')};
    return card;
  }

  function addPayGroup(wrap,title,cycles){
    if(!cycles.length)return;
    const section=document.createElement('section');section.className='pay-history-section';section.innerHTML=`<h3>${title}</h3>`;
    cycles.forEach(c=>section.appendChild(makePayCard(c)));wrap.appendChild(section);
  }

  function renderPayCycleList(){
    const wrap=$('#payCycleList');if(!wrap)return;wrap.innerHTML='';
    const cycles=availableCycles().sort((a,b)=>a.startDate.localeCompare(b.startDate));
    addPayGroup(wrap,'Awaiting Pay',cycles.filter(c=>smartStatus(c)==='awaiting'));
    addPayGroup(wrap,'Current Cycle',cycles.filter(c=>smartStatus(c)==='current'));
    addPayGroup(wrap,'Future Cycles',cycles.filter(c=>smartStatus(c)==='future'));
    const history=cycles.filter(c=>['paid','past'].includes(smartStatus(c))).sort((a,b)=>b.startDate.localeCompare(a.startDate));
    const byFy={};history.forEach(c=>{const fy=financialYearFor(parseDate(c.startDate)).label;(byFy[fy]??=[]).push(c)});
    Object.entries(byFy).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([fy,items])=>addPayGroup(wrap,`Pay History · ${fy}`,items));
    if(!wrap.children.length)wrap.innerHTML='<div class="empty-state">No pay cycles saved yet.</div>';
  }

  function renderPayScreen(){
    const cycles=availableCycles();
    let selected=selectedPayCycleId?cycles.find(c=>c.id===selectedPayCycleId):null;
    if(!selected)selected=upcomingPayCycle();
    if(selected){selectedPayCycleId=selected.id;renderPayResult(selected)}
    renderPayCycleList();
  }

  function openSaved(id){
    const c=AppStorage.loadCycles().find(x=>x.id===id);if(!c)return;
    activeCycleId=id;$('#savedIndex').hidden=true;$('#savedDetail').hidden=false;
    $('#detailTitle').innerHTML=`${peLabel(c.startDate)}<small class="cycle-range-sub">${cycleDateRange(c.startDate)}</small>`;
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
      app:'PTA ShiftMate',
      version:'8.3.5',
      exportedAt:new Date().toISOString(),
      current:AppStorage.loadCurrent(),
      cycles:AppStorage.loadCycles()
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`PTA-ShiftMate-backup-${localISO(new Date())}.json`;
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
      alert('This file is not a valid PTA ShiftMate backup.');
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


  const isWorkingForShare=row=>Boolean((row?.entered??Boolean(row?.code))&&row?.code&&row.type!=='Off'&&!SHIFT_DATA[row.code]?.leaveType);
  const sharedShiftType=row=>{const [h,m]=(row.start||'00:00').split(':').map(Number),start=h*60+m;if(start>=19*60&&start<=20*60)return'Night';if(start<12*60)return'Day';return'Arvo'};
  const icsDate=d=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  function rosterShareEntries(range){
    const entries=rosterTimeline(),today=startOfRosterDay(new Date());let from=today,to=addRosterDays(today,27);
    if(range==='current'){from=parseDate(current.startDate);to=addRosterDays(from,13)}
    else if(range==='future'){const future=[...entries.values()].filter(e=>e.date>=today&&isWorkingForShare(e.row)).sort((a,b)=>a.date-b.date);to=future.length?future[future.length-1].date:today}
    return [...entries.values()].filter(e=>e.date>=from&&e.date<=to&&isWorkingForShare(e.row)).sort((a,b)=>a.date-b.date);
  }
  async function shareRoster(){
    const entries=rosterShareEntries($('#shareRosterRange')?.value||'4weeks');if(!entries.length){toast('No working days found in that period');return}
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PTA ShiftMate//Roster//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:PTA ShiftMate Roster'];
    entries.forEach(e=>lines.push('BEGIN:VEVENT',`UID:pta-shiftmate-${e.key}@local`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`,`DTSTART;VALUE=DATE:${icsDate(e.date)}`,`DTEND;VALUE=DATE:${icsDate(addRosterDays(e.date,1))}`,`SUMMARY:Working - ${sharedShiftType(e.row)}`,'END:VEVENT'));
    lines.push('END:VCALENDAR');const file=new File([lines.join('\r\n')],`PTA-ShiftMate-Roster-${localISO(new Date())}.ics`,{type:'text/calendar'});
    try{if(navigator.canShare?.({files:[file]}))await navigator.share({title:'PTA ShiftMate roster',files:[file]});else{const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Roster calendar created')}}catch(error){if(error?.name!=='AbortError')toast('Could not share roster')}
  }

  $('#homeCycleRoster').onclick=()=>{
    const cycle=availableCycles().find(c=>c.id===$('#homeCycleSelect').value);
    if(!cycle)return;
    loadCycleIntoRoster(cycle);
    go('roster');
    toast(`${peLabel(cycle.startDate)} loaded`);
  };
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
  $('#shareRoster').onclick=shareRoster;
  $('#backToUpcomingPay').onclick=()=>{const upcoming=upcomingPayCycle();if(upcoming){selectedPayCycleId=upcoming.id;renderPayScreen()}};

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
