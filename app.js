
(() => {
  'use strict';

  const defaults={baseRate:44.37,wdMult:1,satMult:1.5,sunMult:2,otMult:1.8,addHoursMult:1.84,hdRate:4.87,maRate:4.87,nightRate:5.77,lease:546.95,gesb:100,postTax:7.40,annualLeaveLoadingRate:12.55,extraTax:0};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(n)||0);
  const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDate=s=>new Date(s+'T00:00:00');
  const emptyDay=()=>({code:'',type:'Rostered',hd:false,start:'',finish:'',additionalHours:0});
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
  }
  const opts=selected=>{
    const leaveOrder=['A/L','Sick','LSL','LWOP'];
    const normal=Object.keys(SHIFT_DATA).filter(c=>!leaveOrder.includes(c)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const codes=['',...normal,...leaveOrder.filter(c=>SHIFT_DATA[c])];
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

  const normaliseSettings=raw=>Object.fromEntries(Object.keys(defaults).map(k=>[k,Number(raw?.[k]??defaults[k])]));
  if(current.settings && current.settings.annualLeaveLoadingRate==null){
    current.settings.annualLeaveLoadingRate=12.55;
  }
  current.settings=normaliseSettings(current.settings);
  current.days=(current.days||[]).slice(0,14);
  while(current.days.length<14) current.days.push(emptyDay());

  function go(id){
    $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
    $$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.go===id));
    if(id==='saved') renderSaved();
    if(id==='home') renderHomeDashboard();
    window.scrollTo({top:0,behavior:'smooth'});
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
    if(code==='AA1') hd.value='yes';
    label.textContent=data.leaveType?`${data.name} • ${data.defaultHours||10} paid hours`:`${data.name} • ${start.value}–${finish.value}`;
  }

  function buildRoster(){
    $('#startDate').value=current.startDate;
    $('#baseRate').value=current.settings.baseRate;
    if($('#homeStartDate'))$('#homeStartDate').value=current.startDate;
    if($('#homeBaseRate'))$('#homeBaseRate').value=current.settings.baseRate;
    $('#rosterRange').textContent=rangeLabel(current.startDate);

    const wrap=$('#dayList');wrap.innerHTML='';
    const start=parseDate(current.startDate);

    current.days.forEach((row,i)=>{
      const date=new Date(start);date.setDate(start.getDate()+i);
      const card=document.createElement('article');card.className='day-card';
      card.innerHTML=`<div class="day-head"><div><b>${date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'})}</b><small>Day ${i+1}</small></div><span class="day-pay">$0.00</span></div>
      <div class="day-main">
        <label>Shift code<select class="shift-code">${opts(row.code)}</select></label>
        <button type="button" class="details-button">Details</button>
      </div>
      <div class="shift-time">Choose a shift code to show the default time.</div>
      <div class="day-details">
        <div class="form-grid two">
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
        </div>
      </div>`;
      wrap.appendChild(card);

      card.querySelector('.details-button').onclick=()=>{card.classList.toggle('open');card.querySelector('.details-button').textContent=card.classList.contains('open')?'Close':'Details'};
      card.querySelector('.shift-code').onchange=()=>{applyShiftDefaults(card,date,true);syncCurrentFromUI();recalculate()};
      card.querySelectorAll('.shift-type,.higher-duties').forEach(el=>el.onchange=()=>{syncCurrentFromUI();recalculate()});card.querySelector('.additional-hours').oninput=()=>{syncCurrentFromUI();recalculate()};
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
    current.settings.baseRate=Number($('#baseRate').value)||0;
    current.days=$$('.day-card').map(card=>({
      code:card.querySelector('.shift-code').value,
      type:card.querySelector('.shift-type').value,
      hd:card.querySelector('.higher-duties').value==='yes',
      start:card.querySelector('.start-time').value,
      finish:card.querySelector('.finish-time').value,
      additionalHours:Number(card.querySelector('.additional-hours').value)||0
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

  function recalculate(){
    syncCurrentFromUI();
    latestResult=PayCalc.calculate(current);
    latestResult.dayTotals.forEach((row,i)=>{
      const card=$$('.day-card')[i];
      if(!card) return;
      card.querySelector('.day-pay').textContent=money(row.gross);
      if(row.start&&row.finish&&SHIFT_DATA[current.days[i].code]){
        const d=SHIFT_DATA[current.days[i].code];
        const addText=row.additionalHours?` • +${row.additionalHours.toFixed(2)} additional hrs`:'';
        card.querySelector('.shift-time').textContent=d.leaveType
          ? `${d.name} • ${(row.hours-row.additionalHours).toFixed(1)} paid hours${addText}`
          : `${d.name} • ${row.start}–${row.finish}${addText}`;
      }
    });
    $('#workedPay').textContent=money(latestResult.breakdown.workedPay);$('#annualLeavePay').textContent=money(latestResult.breakdown.annualLeavePay);$('#sickLeavePay').textContent=money(latestResult.breakdown.sickLeavePay);$('#lslPay').textContent=money(latestResult.breakdown.lslPay);$('#lwopPay').textContent=money(latestResult.breakdown.lwopPay);$('#extrasPay').textContent=money(latestResult.breakdown.extrasPay);renderAllowanceBreakdown(latestResult.allowanceDetails);$('#additionalHoursPay').textContent=money(latestResult.breakdown.additionalHoursPay);$('#gross').textContent=money(latestResult.gross);
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
      version:'6.1',
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

  function loadSettingsIntoForm(){
    Object.keys(defaults).forEach(k=>{if($('#'+k)) $('#'+k).value=current.settings[k]});
  }

  function readSettingsFromForm(){
    Object.keys(defaults).forEach(k=>{if($('#'+k)) current.settings[k]=Number($('#'+k).value)||0});
    $('#baseRate').value=current.settings.baseRate;if($('#homeBaseRate'))$('#homeBaseRate').value=current.settings.baseRate;
    recalculate();
  }

  $$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('#startDate').onchange=()=>{current.startDate=$('#startDate').value;buildRoster()};
  if($('#homeStartDate'))$('#homeStartDate').onchange=()=>{current.startDate=$('#homeStartDate').value;buildRoster()};
  $('#baseRate').oninput=()=>{current.settings.baseRate=Number($('#baseRate').value)||0;if($('#homeBaseRate'))$('#homeBaseRate').value=$('#baseRate').value;recalculate()};
  if($('#homeBaseRate'))$('#homeBaseRate').oninput=()=>{current.settings.baseRate=Number($('#homeBaseRate').value)||0;$('#baseRate').value=$('#homeBaseRate').value;recalculate()};
  $('#clearRoster').onclick=()=>{if(confirm('Clear all shift codes for this fortnight?')){current.days=Array.from({length:14},emptyDay);buildRoster()}};
  $('#rosterSaveCycle').onclick=saveCycle;
  $('#rosterNewCycle').onclick=startNextFortnight;
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
