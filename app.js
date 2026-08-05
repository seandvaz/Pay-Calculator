
(() => {
  'use strict';

  const defaults={baseRate:44.37,wdMult:1,satMult:1.5,sunMult:2,otMult:1.8,hdRate:4.87,maRate:4.87,nightRate:5.77,lease:546.95,gesb:100,postTax:7.40,annualLeaveLoadingRate:12.55,extraTax:0};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(n)||0);
  const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDate=s=>new Date(s+'T00:00:00');
  const emptyDay=()=>({code:'',type:'Rostered',hd:false,start:'',finish:''});
  const rangeLabel=start=>{
    const a=parseDate(start),b=new Date(a);b.setDate(a.getDate()+13);
    return `${a.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})} – ${b.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`;
  };
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
  if(current.settings && current.settings.annualLeaveLoadingRate==null && current.settings.annualLeaveLoading!=null){
    current.settings.annualLeaveLoadingRate=(Number(current.settings.baseRate)||defaults.baseRate)*(Number(current.settings.annualLeaveLoading)||20)/100;
  }
  current.settings=normaliseSettings(current.settings);
  current.days=(current.days||[]).slice(0,14);
  while(current.days.length<14) current.days.push(emptyDay());

  function go(id){
    $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
    $$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.go===id));
    if(id==='saved') renderSaved();
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
    $('#homeStartDate').value=current.startDate;
    $('#homeBaseRate').value=current.settings.baseRate;
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
        </div>
      </div>`;
      wrap.appendChild(card);

      card.querySelector('.details-button').onclick=()=>{card.classList.toggle('open');card.querySelector('.details-button').textContent=card.classList.contains('open')?'Close':'Details'};
      card.querySelector('.shift-code').onchange=()=>{applyShiftDefaults(card,date,true);syncCurrentFromUI();recalculate()};
      card.querySelectorAll('.shift-type,.higher-duties').forEach(el=>el.onchange=()=>{syncCurrentFromUI();recalculate()});
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
      finish:card.querySelector('.finish-time').value
    }));
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
        card.querySelector('.shift-time').textContent=d.leaveType?`${d.name} • ${row.hours.toFixed(1)} paid hours`:`${d.name} • ${row.start}–${row.finish}`;
      }
    });
    $('#workedPay').textContent=money(latestResult.breakdown.workedPay);$('#annualLeavePay').textContent=money(latestResult.breakdown.annualLeavePay);$('#sickLeavePay').textContent=money(latestResult.breakdown.sickLeavePay);$('#lslPay').textContent=money(latestResult.breakdown.lslPay);$('#lwopPay').textContent=money(latestResult.breakdown.lwopPay);$('#extrasPay').textContent=money(latestResult.breakdown.extrasPay);$('#gross').textContent=money(latestResult.gross);
    $('#taxable').textContent=money(latestResult.taxable);
    $('#tax').textContent=money(latestResult.tax);
    $('#hours').textContent=latestResult.hours.toFixed(1);
    $('#net').textContent=money(latestResult.net);
    $('#netHourly').textContent=money(latestResult.netHourly);
    $('#homeRange').textContent=rangeLabel(current.startDate);
    $('#homeNet').textContent=money(latestResult.net);
    $('#payRange').textContent=rangeLabel(current.startDate);
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
    const list=$('#savedList');const cycles=AppStorage.loadCycles().sort((a,b)=>b.startDate.localeCompare(a.startDate));
    $('#savedIndex').hidden=false;$('#savedDetail').hidden=true;activeCycleId=null;
    if(!cycles.length){list.innerHTML='<div class="empty-state">No saved pay cycles yet.</div>';return}
    list.innerHTML='';
    cycles.forEach(c=>{
      const actual=c.actualDeposit!==''&&c.actualDeposit!=null?Number(c.actualDeposit):null;
      const diff=actual==null?null:actual-c.summary.net;
      const card=document.createElement('div');card.className='saved-card';
      card.innerHTML=`<div class="saved-card-head"><div><b>${rangeLabel(c.startDate)}</b><small>Updated ${new Date(c.updatedAt).toLocaleString('en-AU')}</small></div><div class="saved-amount">${money(c.summary.net)}</div></div>
      <span class="status-pill ${c.status||'current'}">${statusLabel(c.status)}</span>
      <div class="saved-meta">
        <div><span>Gross</span><b>${money(c.summary.gross)}</b></div>
        <div><span>Hours</span><b>${c.summary.hours.toFixed(1)}</b></div>
        <div><span>Actual</span><b>${actual==null?'—':money(actual)}</b></div>
        <div><span>Difference</span><b>${diff==null?'—':money(diff)}</b></div>
      </div>
      <div class="saved-actions"><button class="open-saved">View details</button><button class="delete-saved">Delete</button></div>`;
      card.querySelector('.open-saved').onclick=()=>openSaved(c.id);
      card.querySelector('.delete-saved').onclick=()=>{if(confirm('Delete this saved pay cycle?')){AppStorage.saveCycles(AppStorage.loadCycles().filter(x=>x.id!==c.id));renderSaved();toast('Deleted')}};
      list.appendChild(card);
    });
  }

  const statusLabel=s=>s==='paid'?'Paid':s==='awaiting'?'Awaiting pay':'Current';

  function openSaved(id){
    const c=AppStorage.loadCycles().find(x=>x.id===id);if(!c)return;
    activeCycleId=id;$('#savedIndex').hidden=true;$('#savedDetail').hidden=false;
    $('#detailTitle').textContent=rangeLabel(c.startDate);
    $('#detailEstimate').textContent=money(c.summary.net);
    $('#detailEstimated').textContent=money(c.summary.net);
    const actual=c.actualDeposit!==''&&c.actualDeposit!=null?Number(c.actualDeposit):null;
    $('#detailActual').textContent=actual==null?'—':money(actual);
    $('#detailActualInput').value=actual==null?'':actual;
    $('#detailDifference').textContent=actual==null?'—':money(actual-c.summary.net);
    $('#detailStatus').value=c.status||'current';
    $('#detailNotes').value=c.notes||'';
    const pill=$('#detailStatusPill');pill.textContent=statusLabel(c.status);pill.className=`status-pill ${c.status||'current'}`;
  }

  function saveSavedDetails(){
    const cycles=AppStorage.loadCycles();const index=cycles.findIndex(c=>c.id===activeCycleId);if(index<0)return;
    cycles[index].status=$('#detailStatus').value;
    cycles[index].actualDeposit=$('#detailActualInput').value;
    cycles[index].notes=$('#detailNotes').value;
    cycles[index].updatedAt=new Date().toISOString();
    AppStorage.saveCycles(cycles);openSaved(activeCycleId);toast('Saved details');
  }

  function editSavedCycle(){
    const c=AppStorage.loadCycles().find(x=>x.id===activeCycleId);if(!c)return;
    current=JSON.parse(JSON.stringify({startDate:c.startDate,settings:c.settings,days:c.days}));
    AppStorage.saveCurrent(current);buildRoster();go('roster');toast('Saved cycle opened');
  }

  function loadSettingsIntoForm(){
    Object.keys(defaults).forEach(k=>{if($('#'+k)) $('#'+k).value=current.settings[k]});
  }

  function readSettingsFromForm(){
    Object.keys(defaults).forEach(k=>{if($('#'+k)) current.settings[k]=Number($('#'+k).value)||0});
    $('#baseRate').value=current.settings.baseRate;$('#homeBaseRate').value=current.settings.baseRate;
    recalculate();
  }

  $$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('#startDate').onchange=()=>{current.startDate=$('#startDate').value;buildRoster()};
  $('#homeStartDate').onchange=()=>{current.startDate=$('#homeStartDate').value;buildRoster()};
  $('#baseRate').oninput=()=>{current.settings.baseRate=Number($('#baseRate').value)||0;$('#homeBaseRate').value=$('#baseRate').value;recalculate()};
  $('#homeBaseRate').oninput=()=>{current.settings.baseRate=Number($('#homeBaseRate').value)||0;$('#baseRate').value=$('#homeBaseRate').value;recalculate()};
  $('#clearRoster').onclick=()=>{if(confirm('Clear all shift codes for this fortnight?')){current.days=Array.from({length:14},emptyDay);buildRoster()}};
  $('#saveCycle').onclick=saveCycle;
  $('#newCycle').onclick=startNextFortnight;
  $('#saveCurrent').onclick=()=>{readSettingsFromForm();saveCurrent()};
  $('#resetApp').onclick=()=>{if(confirm('Delete the current roster and all saved pay cycles?')){AppStorage.clearAll();location.reload()}};
  $('#backSaved').onclick=renderSaved;
  $('#saveSavedDetails').onclick=saveSavedDetails;
  $('#editSavedCycle').onclick=editSavedCycle;

  buildRoster();
  loadSettingsIntoForm();
})();
