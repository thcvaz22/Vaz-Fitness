(()=>{
  const personalIcon={home:'⌂',students:'◎',workouts:'⚡',billing:'◫',brand:'✦',settings:'⚙'};
  const adminIcon={'admin-home':'⌂',approvals:'✓',personals:'◎','admin-billing':'◫',settings:'⚙'};
  if(typeof personalNav==='function'){
    const prevPersonalNav=personalNav;
    personalNav=function(){return prevPersonalNav().map(item=>({...item,ico:personalIcon[item.id]||item.ico}))};
  }
  if(typeof adminNav==='function'){
    const prevAdminNav=adminNav;
    adminNav=function(){return prevAdminNav().map(item=>({...item,ico:adminIcon[item.id]||item.ico}))};
  }
  document.documentElement.classList.toggle('native-app',!!window.VAZ_PERSONAL_NATIVE);
  queueMicrotask(()=>{try{if(typeof me!=='undefined'&&me)render()}catch{}});
})();
