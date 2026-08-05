
(() => {
'use strict';
const APP_VERSION='6.6';
const AGREEMENTS=window.AGREEMENT_DATA||{
  schemaVersion:1,
  activeAgreementId:'custom',
  agreements:{
    custom:{
      id:'custom',
      name:'Custom',
      displayName:'Custom agreement',
      effectiveFrom:'2000-01-01',
      effectiveTo:null,
      classifications:{custom:{id:'custom',label:'Custom',shortLabel:'Custom',hourlyRate:null}},
      rules:{
        weekdayMultiplier:1,
        saturdayMultiplier:1.5,
        sundayMultiplier:2,
        pickedUpOtMultiplier:1.8,
        additionalHoursMultiplier:1.84,
        higherDutiesRate:4.87,
        morningAfternoonAllowanceRate:4.87,
        nightAllowanceRate:5.77,
        annualLeaveLoadingRate:12.55
      }
    }
  }
};

const defaults={agreementId:'custom',classificationId:'custom',classificationRate:44.37,baseRate:44.37,wdMult:1,satMult:1.5,sunMult:2,otMult:1.8,addHoursMult:1.84,hdRate:4.87,maRate:4.87,nightRate:5.77,lease:546.95,gesb:100,postTax:7.40,annualLeaveLoadingRate:12.55,extraTax:0};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(n)||0);
const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate=s=>new Date(s+'T00:00:00');
const emptyDay=()=>({code:'',type:'Rostered',hd:false,start:'',finish:'',additionalHours:0});
const clone=o=>JSON.parse(JSON.stringify(o));
const rangeLabel=start=>{const a=parseDate(start),b=new Date(a);b.setDate(a.getDate()+13);return `${a.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})} – ${b.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`};
const statusLabel=s=>s==='paid'?'Paid':s==='awaiting'?'Awaiting pay':s==='future'?'Future':s==='past'?'Past':'Current';
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)};
const leaveOrder=['A/L','Sick','LSL','LWOP'];
const opts=selected=>{const normal=Object.keys(SHIFT_DATA).filter(c=>!leaveOrder.includes(c)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));return ['',...normal,...leaveOrder.filter(c=>SHIFT_DATA[c])].map(code=>`<option value="${code}" ${code===selected?'selected':''}>${code?`${code} — ${SHIFT_DATA[code].name}`:'Off / no shift'}</option>`).join('')};

let current=AppStorage.loadCurrent()||{startDate:localISO(new Date()),settings:{...defaults},days:Array.from({length:14},emptyDay)};
if(current.settings&&current.settings.annualLeaveLoadingRate==null)current.settings.annualLeaveLoadingRate=12.55;
current.settings=Object.fromEntries(Object.keys(defaults).map(k=>{
  const v=current.settings?.[k]??defaults[k];
  return ['agreementId','classificationId'].includes(k)?String(v):Number(v);
}));
if(!current.settings.classificationRate)current.settings.classificationRate=current.settings.baseRate;
current.settings.baseRate=current.settings.classificationRate;
current.days=(current.days||[]).slice(0,14).map(d=>({...emptyDay(),...d}));while(current.days.length<14)current.days.push(emptyDay());
let latestResult=null,activeCycleId=null;
function agreementById(id){return AGREEMENTS?.agreements?.[id]||AGREEMENTS?.agreements?.custom}
function classificationById(aid,cid){const a=agreementById(aid);return a?.classifications?.[cid]||a?.classifications?.custom}
function populateAgreementControls(){
  const aSel=$('#agreementId'),cSel=$('#classificationId');
  aSel.innerHTML=Object.values(AGREEMENTS.agreements).map(a=>`<option value="${a.id}" ${a.id===current.settings.agreementId?'selected':''}>${a.displayName||a.name}</option>`).join('');
  const a=agreementById(current.settings.agreementId);
  cSel.innerHTML=Object.values(a.classifications).map(c=>`<option value="${c.id}" ${c.id===current.settings.classificationId?'selected':''}>${c.label}</option>`).join('');
  $('#classificationRate').value=current.settings.classificationRate;
}
function applyAgreementPreset(){
  const a=agreementById(current.settings.agreementId),c=classificationById(current.settings.agreementId,current.settings.classificationId),r=a?.rules||{};
  if(c?.hourlyRate!=null)current.settings.classificationRate=Number(c.hourlyRate);
  const values={wdMult:r.weekdayMultiplier,satMult:r.saturdayMultiplier,sunMult:r.sundayMultiplier,otMult:r.pickedUpOtMultiplier,addHoursMult:r.additionalHoursMultiplier,hdRate:r.higherDutiesRate,maRate:r.morningAfternoonAllowanceRate,nightRate:r.nightAllowanceRate,annualLeaveLoadingRate:r.annualLeaveLoadingRate};
  Object.entries(values).forEach(([k,v])=>{if(v!=null){current.settings[k]=Number(v);if($('#'+k))$('#'+k).value=current.settings[k]}});
  current.settings.baseRate=current.settings.classificationRate;
  $('#classificationRate').value=current.settings.classificationRate;
  $('#baseRate').value=current.settings.classificationRate;
  recalculate();
}


function paydayFor(startDate){const s=parseDate(startDate),e=new Date(s);e.setDate(s.getDate()+13);const fs=new Date(e);fs.setDate(e.getDate()+1);const off=(3-fs.getDay()+7)%7;const p=new Date(fs);p.setDate(fs.getDate()+off+7);return p}
function smartStatus(c){if(c.actualDeposit!==''&&c.actualDeposit!=null)return'paid';const t=new Date();t.setHours(0,0,0,0);const s=parseDate(c.startDate),e=new Date(s);e.setDate(s.getDate()+13);const p=paydayFor(c.startDate);if(t<s)return'future';if(t<=e)return'current';if(t<p)return'awaiting';return'past'}
function financialYearFor(d){const x=new Date(d),y=x.getMonth()>=6?x.getFullYear():x.getFullYear()-1;return`${y}–${String(y+1).slice(-2)}`}
const cycleFY=c=>financialYearFor(parseDate(c.startDate));

function go(id){$$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));$$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.go===id));if(id==='home')renderDashboard();if(id==='history')renderHistory();window.scrollTo({top:0,behavior:'smooth'})}
function applyShiftDefaults(card,date,force=false){const code=card.querySelector('.shift-code').value,data=SHIFT_DATA[code],st=card.querySelector('.start-time'),fn=card.querySelector('.finish-time'),type=card.querySelector('.shift-type'),hd=card.querySelector('.higher-duties'),label=card.querySelector('.shift-time');if(!data){st.value='';fn.value='';type.value='Off';hd.value='no';label.textContent='Off / no shift';return}const times=data.times[PayCalc.dayGroup(date.getDay())]||['',''];if(force||!st.value||!fn.value){st.value=times[0];fn.value=times[1]}if(type.value==='Off')type.value='Rostered';if(code==='AA1')hd.value='yes';label.textContent=data.leaveType?`${data.name} • ${data.defaultHours||10} paid hours`:`${data.name} • ${st.value}–${fn.value}`}
function buildRoster(){$('#startDate').value=current.startDate;$('#baseRate').value=current.settings.baseRate;$('#rosterRange').textContent=rangeLabel(current.startDate);const w=$('#dayList');w.innerHTML='';const start=parseDate(current.startDate);current.days.forEach((row,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const c=document.createElement('article');c.className='day-card';c.innerHTML=`<div class="day-head"><div><b>${d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}</b><small>Day ${i+1}</small></div><span class="day-pay">$0.00</span></div><div class="day-main"><label>Shift code<select class="shift-code">${opts(row.code)}</select></label><button type="button" class="details-button">Details</button></div><div class="shift-time">Choose a shift code</div><div class="day-details"><div class="form-grid two"><label>Type<select class="shift-type"><option ${row.type==='Rostered'?'selected':''}>Rostered</option><option ${row.type==='Picked-up OT'?'selected':''}>Picked-up OT</option><option ${row.type==='Leave'?'selected':''}>Leave</option><option ${row.type==='Off'?'selected':''}>Off</option></select></label><label>Higher duties<select class="higher-duties"><option value="no" ${row.hd?'':'selected'}>No</option><option value="yes" ${row.hd?'selected':''}>Yes</option></select></label><label>Start<input class="start-time" type="time" value="${row.start||''}"></label><label>Finish<input class="finish-time" type="time" value="${row.finish||''}"></label><label>Additional hours<input class="additional-hours" type="number" min="0" step="0.25" value="${Number(row.additionalHours)||0}"></label></div></div>`;w.appendChild(c);c.querySelector('.details-button').onclick=()=>{c.classList.toggle('open');c.querySelector('.details-button').textContent=c.classList.contains('open')?'Close':'Details'};c.querySelector('.shift-code').onchange=()=>{applyShiftDefaults(c,d,true);syncCurrentFromUI();recalculate()};c.querySelectorAll('.shift-type,.higher-duties').forEach(e=>e.onchange=()=>{syncCurrentFromUI();recalculate()});c.querySelector('.additional-hours').oninput=()=>{syncCurrentFromUI();recalculate()};c.querySelector('.start-time').oninput=()=>{syncCurrentFromUI();recalculate()};c.querySelector('.finish-time').oninput=()=>{syncCurrentFromUI();recalculate()};applyShiftDefaults(c,d,false)});recalculate()}
function syncCurrentFromUI(){current.startDate=$('#startDate').value;current.settings.classificationRate=Number($('#baseRate').value)||0;current.settings.baseRate=current.settings.classificationRate;current.days=$$('.day-card').map(c=>({code:c.querySelector('.shift-code').value,type:c.querySelector('.shift-type').value,hd:c.querySelector('.higher-duties').value==='yes',start:c.querySelector('.start-time').value,finish:c.querySelector('.finish-time').value,additionalHours:Number(c.querySelector('.additional-hours').value)||0}))}
function recalculate(){syncCurrentFromUI();latestResult=PayCalc.calculate(current);latestResult.dayTotals.forEach((r,i)=>{const c=$$('.day-card')[i];if(!c)return;c.querySelector('.day-pay').textContent=money(r.gross);const d=SHIFT_DATA[current.days[i].code];if(d){const add=r.additionalHours?` • +${r.additionalHours.toFixed(2)} hrs`:'';c.querySelector('.shift-time').textContent=d.leaveType?`${d.name} • ${(r.hours-r.additionalHours).toFixed(1)} paid hrs${add}`:`${d.name} • ${r.start}–${r.finish}${add}`}});$('#rosterGross').textContent=money(latestResult.gross);$('#rosterTax').textContent=money(latestResult.tax);$('#rosterNet').textContent=money(latestResult.net);$('#rosterHours').textContent=latestResult.hours.toFixed(1);$('#workedPay').textContent=money(latestResult.breakdown.workedPay);$('#annualLeavePay').textContent=money(latestResult.breakdown.annualLeavePay);$('#sickLeavePay').textContent=money(latestResult.breakdown.sickLeavePay);$('#lslPay').textContent=money(latestResult.breakdown.lslPay);$('#lwopPay').textContent=money(latestResult.breakdown.lwopPay);$('#extrasPay').textContent=money(latestResult.breakdown.extrasPay);$('#additionalHoursPay').textContent=money(latestResult.breakdown.additionalHoursPay);$('#taxable').textContent=money(latestResult.taxable);$('#netHourly').textContent=money(latestResult.netHourly);updateSaveButton()}
const currentId=()=>`cycle-${current.startDate}`;
function updateSaveButton(){$('#saveRosterCycle').textContent=AppStorage.loadCycles().some(c=>c.id===currentId())?'Update Pay Cycle':'Save Pay Cycle'}
function saveCurrentOnly(){syncCurrentFromUI();AppStorage.saveCurrent(current)}
function saveCycle(){saveCurrentOnly();const cycles=AppStorage.loadCycles(),id=currentId(),i=cycles.findIndex(c=>c.id===id),prev=i>=0?cycles[i]:{};const agreement=agreementById(current.settings.agreementId);
const rec={...clone(current),id,appVersion:APP_VERSION,agreementMeta:{agreementId:current.settings.agreementId,agreementName:agreement?.displayName||agreement?.name||'Custom',classificationId:current.settings.classificationId,classificationLabel:classificationById(current.settings.agreementId,current.settings.classificationId)?.label||'Custom',effectiveFrom:agreement?.effectiveFrom||null},summary:{gross:latestResult.gross,taxable:latestResult.taxable,tax:latestResult.tax,hours:latestResult.hours,net:latestResult.net,netHourly:latestResult.netHourly,breakdown:clone(latestResult.breakdown)},status:prev.status||'current',actualDeposit:prev.actualDeposit??'',notes:prev.notes||'',updatedAt:new Date().toISOString()};if(i>=0)cycles[i]=rec;else cycles.push(rec);AppStorage.saveCycles(cycles);toast(i>=0?'Pay cycle updated':'Pay cycle saved');updateSaveButton();renderDashboard()}
function startNextFortnight(){const exists=AppStorage.loadCycles().some(c=>c.id===currentId());if(!exists&&confirm('Save the current pay cycle before starting the next one?'))saveCycle();const n=parseDate(current.startDate);n.setDate(n.getDate()+14);current={startDate:localISO(n),settings:{...current.settings},days:Array.from({length:14},emptyDay)};AppStorage.saveCurrent(current);buildRoster();go('roster');toast('Next pay cycle started')}
function renderDashboard(){const cycles=AppStorage.loadCycles().sort((a,b)=>a.startDate.localeCompare(b.startDate)),fys=[...new Set(cycles.map(c=>cycleFY(c)))].sort().reverse(),cfy=financialYearFor(new Date());if(!fys.includes(cfy))fys.unshift(cfy);const s=$('#fySelect'),old=s.value||cfy;s.innerHTML=fys.map(f=>`<option value="${f}" ${f===old?'selected':''}>${f}</option>`).join('');const selected=s.value||cfy;$('#fyLabel').textContent=`${selected} Financial Year`;const f=cycles.filter(c=>cycleFY(c)===selected),t=f.reduce((a,c)=>{const x=c.summary||{},b=x.breakdown||{};a.g+=Number(x.gross)||0;a.n+=Number(x.net)||0;a.h+=Number(x.hours)||0;a.al+=Number(b.annualLeavePay)||0;a.ad+=Number(b.additionalHoursPay)||0;a.ex+=Number(b.extrasPay)||0;return a},{g:0,n:0,h:0,al:0,ad:0,ex:0});$('#fyGross').textContent=money(t.g);$('#fyNet').textContent=money(t.n);$('#fyHours').textContent=t.h.toFixed(1);$('#fyNetHourly').textContent=money(t.h?t.n/t.h:0);$('#fyAnnualLeave').textContent=money(t.al);$('#fyAdditional').textContent=money(t.ad);$('#fyExtras').textContent=money(t.ex);$('#fyCycles').textContent=f.length;const l=cycles.at(-1);if(l){$('#latestRange').textContent=rangeLabel(l.startDate);$('#latestNet').textContent=money(l.summary?.net||0);$('#latestStatus').textContent=`${statusLabel(smartStatus(l))} • Expected payday ${paydayFor(l.startDate).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}`}else{$('#latestRange').textContent='No saved cycles';$('#latestNet').textContent='$0.00';$('#latestStatus').textContent='Save a roster to begin tracking your financial year.'}}
function renderHistory(){const h=$('#historyGroups'),cycles=AppStorage.loadCycles().sort((a,b)=>b.startDate.localeCompare(a.startDate));if(!cycles.length){h.innerHTML='<div class="empty-state">No saved pay cycles yet.</div>';return}const g={current:[],awaiting:[],future:[],past:[],paid:[]};cycles.forEach(c=>g[smartStatus(c)].push(c));h.innerHTML='';[['current','Current'],['awaiting','Awaiting pay'],['future','Future'],['past','Past'],['paid','Paid']].forEach(([k,title])=>{if(!g[k].length)return;const sec=document.createElement('section');sec.className='history-section';sec.innerHTML=`<h3>${title}</h3>`;g[k].forEach(c=>{const card=document.createElement('article');card.className='history-card';const st=smartStatus(c);card.innerHTML=`<button class="history-card-button"><span><b>${rangeLabel(c.startDate)}</b><span class="status-pill ${st}">${statusLabel(st)}</span></span><strong>${money(c.summary?.net||0)}</strong></button><div class="history-card-details"><div class="history-meta"><div><span>Gross</span><b>${money(c.summary?.gross||0)}</b></div><div><span>Hours</span><b>${Number(c.summary?.hours||0).toFixed(1)}</b></div><div><span>Expected payday</span><b>${paydayFor(c.startDate).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</b></div><div><span>Actual</span><b>${c.actualDeposit!==''&&c.actualDeposit!=null?money(c.actualDeposit):'—'}</b></div></div><div class="history-actions"><button class="open-saved">Open</button><button class="delete-saved">Delete</button></div></div>`;card.querySelector('.history-card-button').onclick=()=>card.classList.toggle('open');card.querySelector('.open-saved').onclick=()=>openSaved(c.id);card.querySelector('.delete-saved').onclick=()=>{if(confirm('Delete this saved pay cycle?')){AppStorage.saveCycles(AppStorage.loadCycles().filter(x=>x.id!==c.id));renderHistory();renderDashboard();toast('Deleted')}};sec.appendChild(card)});h.appendChild(sec)})}
function openSaved(id){const c=AppStorage.loadCycles().find(x=>x.id===id);if(!c)return;activeCycleId=id;$('#detailTitle').textContent=rangeLabel(c.startDate);$('#detailEstimate').textContent=money(c.summary?.net||0);$('#detailEstimated').textContent=money(c.summary?.net||0);$('#detailGross').textContent=money(c.summary?.gross||0);$('#detailHours').textContent=Number(c.summary?.hours||0).toFixed(1);$('#detailPayday').textContent=paydayFor(c.startDate).toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});const a=c.actualDeposit!==''&&c.actualDeposit!=null?Number(c.actualDeposit):null;$('#detailActual').textContent=a==null?'—':money(a);$('#detailActualInput').value=a==null?'':a;$('#detailDifference').textContent=a==null?'—':money(a-Number(c.summary?.net||0));$('#detailStatus').value=c.status||'current';$('#detailNotes').value=c.notes||'';const st=smartStatus(c),p=$('#detailStatusPill');p.textContent=statusLabel(st);p.className=`status-pill ${st}`;go('historyDetail')}
function saveSavedDetails(){const c=AppStorage.loadCycles(),i=c.findIndex(x=>x.id===activeCycleId);if(i<0)return;c[i].status=$('#detailStatus').value;c[i].actualDeposit=$('#detailActualInput').value;c[i].notes=$('#detailNotes').value;c[i].updatedAt=new Date().toISOString();AppStorage.saveCycles(c);openSaved(activeCycleId);toast('Saved details')}
function editSavedCycle(){const c=AppStorage.loadCycles().find(x=>x.id===activeCycleId);if(!c)return;current=clone({startDate:c.startDate,settings:c.settings,days:c.days});AppStorage.saveCurrent(current);buildRoster();go('roster');toast('Saved cycle opened')}
function loadSettings(){
  populateAgreementControls();
  Object.keys(defaults).forEach(k=>{if($('#'+k)&&!['agreementId','classificationId','classificationRate'].includes(k))$('#'+k).value=current.settings[k]})
}
function readSettings(){
  current.settings.agreementId=$('#agreementId').value;
  current.settings.classificationId=$('#classificationId').value;
  current.settings.classificationRate=Number($('#classificationRate').value)||0;
  Object.keys(defaults).forEach(k=>{if($('#'+k)&&!['agreementId','classificationId','classificationRate'].includes(k))current.settings[k]=Number($('#'+k).value)||0});
  current.settings.baseRate=current.settings.classificationRate;
  $('#baseRate').value=current.settings.baseRate;
  recalculate()
}

$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$('#agreementId').onchange=()=>{current.settings.agreementId=$('#agreementId').value;current.settings.classificationId='custom';populateAgreementControls();applyAgreementPreset()};
$('#classificationId').onchange=()=>{current.settings.classificationId=$('#classificationId').value;applyAgreementPreset()};
$('#classificationRate').oninput=()=>{current.settings.classificationRate=Number($('#classificationRate').value)||0;current.settings.baseRate=current.settings.classificationRate;$('#baseRate').value=current.settings.baseRate;recalculate()};$('#fySelect').onchange=renderDashboard;$('#startDate').onchange=()=>{current.startDate=$('#startDate').value;buildRoster()};$('#baseRate').oninput=()=>{current.settings.classificationRate=Number($('#baseRate').value)||0;current.settings.baseRate=current.settings.classificationRate;$('#classificationRate').value=current.settings.classificationRate;recalculate()};$('#clearRoster').onclick=()=>{if(confirm('Clear all shift codes for this fortnight?')){current.days=Array.from({length:14},emptyDay);buildRoster()}};$('#saveRosterCycle').onclick=saveCycle;$('#startNextCycle').onclick=startNextFortnight;$('#homeStartNext').onclick=startNextFortnight;$('#toggleRosterBreakdown').onclick=()=>{const p=$('#rosterBreakdown');p.hidden=!p.hidden;$('#toggleRosterBreakdown').textContent=p.hidden?'Show calculation breakdown':'Hide calculation breakdown'};$('#backHistory').onclick=()=>go('history');$('#saveSavedDetails').onclick=saveSavedDetails;$('#editSavedCycle').onclick=editSavedCycle;$('#deleteSavedCycle').onclick=()=>{if(activeCycleId&&confirm('Delete this saved pay cycle?')){AppStorage.saveCycles(AppStorage.loadCycles().filter(c=>c.id!==activeCycleId));activeCycleId=null;renderDashboard();go('history');toast('Deleted')}};$('#saveCurrent').onclick=()=>{readSettings();saveCurrentOnly();toast('Settings saved')};$('#resetApp').onclick=()=>{if(confirm('Delete the current roster and all saved pay cycles?')){AppStorage.clearAll();location.reload()}};
buildRoster();loadSettings();renderDashboard();
})();
