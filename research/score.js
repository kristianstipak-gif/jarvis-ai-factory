export function riskAdjustedScore(x){
 const velocity=Math.min(1,(x.volume/x.marketCap)*1.7);
 const age=Math.max(0,1-Math.abs(x.ageMinutes-60)/90);
 const holders=Math.min(1,x.holders/300);
 const distribution=Math.max(0,1-Math.max(0,x.top10Share-.20)*2.5);
 const buy=Math.max(0,Math.min(1,(x.buyRatio-.45)/.35));
 const curve=Math.max(0,Math.min(1,x.curveProgress));
 const social=Math.max(0,Math.min(1,x.socialScore/100));
 let score=100*(.18*velocity+.14*age+.16*holders+.17*distribution+.15*buy+.10*curve+.10*social);
 if(x.velocityOutlier) score-=20;
 if(x.concentrationOutlier) score-=18;
 if(x.sybilRisk) score-=25;
 if(x.washTradeRisk) score-=30;
 return Math.max(0,Math.min(100,score));
}