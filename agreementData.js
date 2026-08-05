window.PTA_AGREEMENT = (() => {
  'use strict';

  const id='pta-artbiu-to-2023';
  const title='PTA / ARTBIU (Transit Officers) Industrial Agreement 2023';
  const expires='2026-10-06';

  const wageTables=[
    {effective:'2023-10-07',weekly:{TRAINEE:1206.00,TO1:1418.80,TO2:1450.90,TO3:1484.60,TO4:1520.20,TO5:1557.60,FCO:1572.80,STO1:1587.90,STO2:1618.50,STO3:1648.80}},
    {effective:'2024-10-07',weekly:{TRAINEE:1254.30,TO1:1475.60,TO2:1508.90,TO3:1544.00,TO4:1581.00,TO5:1619.90,FCO:1635.70,STO1:1651.40,STO2:1683.20,STO3:1714.80}},
    {effective:'2025-10-07',weekly:{TRAINEE:1298.10,TO1:1527.20,TO2:1561.70,TO3:1598.00,TO4:1636.30,TO5:1676.60,FCO:1692.90,STO1:1709.20,STO2:1742.10,STO3:1774.80}}
  ];

  const labels={TRAINEE:'Trainee',TO1:'TO1',TO2:'TO2',TO3:'TO3',TO4:'TO4',TO5:'TO5',FCO:'First Class Officer',STO1:'STO1',STO2:'STO2',STO3:'STO3'};
  const incrementPaths={TO1:'TO2',TO2:'TO3',TO3:'TO4',TO4:'TO5',STO1:'STO2',STO2:'STO3'};

  const parse=s=>new Date(`${s}T00:00:00`);
  const addYears=(date,years)=>{const d=new Date(date);d.setFullYear(d.getFullYear()+years);return d};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const tableFor=date=>{
    const d=typeof date==='string'?parse(date):new Date(date);
    return [...wageTables].reverse().find(t=>parse(t.effective)<=d)||wageTables[0];
  };

  const progressedClassification=(classification,date,nextIncrementDate,enabled)=>{
    let level=classification||'STO3';
    if(!enabled||!nextIncrementDate||!incrementPaths[level])return level;
    const target=typeof date==='string'?parse(date):new Date(date);
    let increment=parse(nextIncrementDate),guard=0;
    while(target>=increment&&incrementPaths[level]&&guard<10){
      level=incrementPaths[level];
      increment=addYears(increment,1);
      guard++;
    }
    return level;
  };

  const rateFor=(classification,date)=>{
    const table=tableFor(date),weekly=table.weekly[classification];
    return weekly==null?null:{weekly,hourly:weekly/40,effective:table.effective};
  };

  const resolve=(settings,date)=>{
    const manual=settings?.rateSource==='manual';
    const classification=progressedClassification(settings?.classification||'STO3',date,settings?.nextIncrementDate,Boolean(settings?.autoIncrement));
    const agreementRate=rateFor(classification,date);
    const baseRate=manual?Number(settings?.manualBaseRate||settings?.baseRate||0):(agreementRate?.hourly||Number(settings?.manualBaseRate||settings?.baseRate||0));
    return {
      agreementId:id,title,expires,manual,classification,
      classificationLabel:labels[classification]||classification,
      baseRate,weeklyRate:agreementRate?.weekly||baseRate*40,
      wageEffective:agreementRate?.effective||'',
      rules:{weekday:1,saturday:1.5,sunday:2,weekdayOvertime:1.84,weekendOvertime:2,publicHolidayWorked:1.5,publicHolidayAdditionalMinimumHours:8,annualLeaveLoadingMinimum:0.20}
    };
  };

  return {id,title,expires,wageTables,labels,incrementPaths,tableFor,rateFor,progressedClassification,resolve,iso};
})();
