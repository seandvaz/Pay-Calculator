
window.PayCalc = (() => {
  const mins = t => {
    const [h,m]=t.split(':').map(Number);
    return h*60+m;
  };
  const dayGroup = day => day===0?'sun':day<=4?'monthu':day===5?'fri':'sat';
  const splitHours = (date,start,finish) => {
    let s=mins(start),f=mins(finish),total=(f-s+1440)%1440;
    if(!total) total=1440;
    const first=Math.min(total,1440-s), second=total-first;
    const out={wd:0,sat:0,sun:0,total:total/60};
    const add=(day,minutes)=>{
      if(day===6) out.sat+=minutes/60;
      else if(day===0) out.sun+=minutes/60;
      else out.wd+=minutes/60;
    };
    add(date.getDay(),first);
    if(second) add((date.getDay()+1)%7,second);
    return out;
  };
  const annualTax = income => {
    if(income<=18200) return 0;
    let tax=0;
    if(income<=45000) tax=(income-18200)*.15;
    else if(income<=135000) tax=4020+(income-45000)*.30;
    else if(income<=190000) tax=31020+(income-135000)*.37;
    else tax=51370+(income-190000)*.45;
    return tax+income*.02;
  };

  const calculate = ({days,startDate,settings}) => {
    const start=new Date(startDate+'T00:00:00');
    let gross=0,hours=0,dayTotals=[];
    const breakdown={workedPay:0,annualLeavePay:0,sickLeavePay:0,lslPay:0,lwopPay:0,extrasPay:0,additionalHoursPay:0};

    days.forEach((row,i)=>{
      const date=new Date(start); date.setDate(start.getDate()+i);
      const data=window.SHIFT_DATA[row.code];
      let st=row.start,fn=row.finish,dayGross=0,dayHours=0,baseComponent=0,extras=0;

      if(data && (!st||!fn)) [st,fn]=data.times[dayGroup(date.getDay())];

      if(data && st && fn && row.type!=='Off'){
        const parts=splitHours(date,st,fn);
        dayHours=parts.total;

        if(data.leaveType==='annual'){
          baseComponent=parts.total*settings.baseRate;
          dayGross=baseComponent + parts.total*settings.annualLeaveLoadingRate;
          breakdown.annualLeavePay+=dayGross;
        } else if(data.leaveType==='sick'){
          dayGross=parts.total*settings.baseRate;
          breakdown.sickLeavePay+=dayGross;
        } else if(data.leaveType==='lsl'){
          dayGross=parts.total*settings.baseRate;
          breakdown.lslPay+=dayGross;
        } else if(data.leaveType==='lwop'){
          dayGross=0;
          breakdown.lwopPay+=0;
        } else {
          if(row.type==='Picked-up OT'){
            baseComponent=parts.total*settings.baseRate*settings.otMult;
          } else if(row.type==='Leave'){
            baseComponent=parts.total*settings.baseRate;
          } else {
            baseComponent=parts.wd*settings.baseRate*settings.wdMult
              + parts.sat*settings.baseRate*settings.satMult
              + parts.sun*settings.baseRate*settings.sunMult;
          }

          if(row.type!=='Leave'){
            if(data.allowance==='Morn/Aft') extras+=parts.total*settings.maRate;
            if(data.allowance==='Night') extras+=parts.total*settings.nightRate;
            if(row.code==='AA1'||row.hd) extras+=parts.total*settings.hdRate;
          }

          dayGross=baseComponent+extras;
          breakdown.workedPay+=baseComponent;
          breakdown.extrasPay+=extras;
        }
      }

      const additionalHours=Math.max(0,Number(row.additionalHours)||0);
      const additionalPay=additionalHours*settings.baseRate*settings.addHoursMult;
      dayGross+=additionalPay;
      dayHours+=additionalHours;
      breakdown.additionalHoursPay+=additionalPay;

      gross+=dayGross;
      hours+=dayHours;
      dayTotals.push({
        gross:dayGross,
        hours:dayHours,
        start:st||'',
        finish:fn||'',
        additionalHours,
        additionalPay
      });
    });

    const taxable=Math.max(0,gross-settings.lease-settings.gesb);
    const tax=taxable ? Math.max(0,Math.round(annualTax(taxable*26)/26 + settings.extraTax)) : 0;
    const net=taxable-tax-settings.postTax;

    return {gross,taxable,tax,hours,net,netHourly:hours?net/hours:0,dayTotals,breakdown};
  };

  return {calculate,dayGroup};
})();
