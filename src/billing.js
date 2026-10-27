const $=s=>document.querySelector(s);
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(s){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}
export function initBilling(config,api,getToken,onLinked){
  let nonce=null,ready=false,paymentReady=false,linked=false,epoch=0;
  function render(){
    $('#billing-status').textContent=!ready?'Подключение оплаты завершается.':linked?(paymentReady?'Telegram подтверждён. Оплачивай из этого же Telegram-аккаунта.':'Telegram подтверждён. Подключение оплаты завершается.'):'Подтверди Telegram, чтобы оплата активировала Pro именно в твоём аккаунте.';
    $('#link-telegram').hidden=!ready||linked;$('#checkout-pro').hidden=!paymentReady||!linked;
    if(paymentReady&&linked)$('#checkout-pro').href=config.tributeUrl;
  }
  function reset(){nonce=null;linked=false;ready=false;paymentReady=false;epoch++;$('#telegram-code-form').hidden=true;$('#telegram-open').hidden=true;$('#telegram-code').value='';$('#billing-message').textContent='';render();}
  async function update(data){linked=data.telegramLinked===true;const current=++epoch;
    try{const r=await fetch(config.supabaseUrl+'/functions/v1/soft-billing/health',{signal:AbortSignal.timeout(8000)});const h=await r.json();if(current!==epoch)return;ready=r.ok&&h.telegram===true;paymentReady=ready&&h.tribute===true;}catch{if(current!==epoch)return;ready=false;paymentReady=false;}render();if(linked){nonce=null;$('#telegram-code-form').hidden=true;$('#telegram-open').hidden=true;}
  }
  $('#checkout-pro').addEventListener('click',()=>window.softAnalytics?.('pro_checkout_click',{provider:'tribute'}));
  $('#link-telegram').addEventListener('click',async()=>{
    const button=$('#link-telegram');button.disabled=true;$('#billing-message').textContent='';
    try{nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const res=await api.linkStart(await getToken(),await hash(nonce));
      if(!res.ok)throw new Error(res.error==='rate_limit'?'Подожди 30 секунд перед новым запросом.':'Привязка уже существует или недоступна. Обнови статус.');
      $('#telegram-open').href='https://t.me/'+config.telegramBot+'?start=s_'+nonce;$('#telegram-open').hidden=false;$('#telegram-code-form').hidden=false;$('#telegram-code').value='';$('#billing-message').textContent='Открой бота, нажми «Запустить» и введи полученный код здесь. Ссылка действует 10 минут.';
    }catch(e){nonce=null;$('#billing-message').textContent=e.status?'Не удалось начать привязку. Попробуй войти заново.':e.message;}finally{button.disabled=false;}
  });
  $('#telegram-code-form').addEventListener('submit',async e=>{
    e.preventDefault();if(!nonce)return;const code=$('#telegram-code').value.trim();if(!/^\d{6}$/.test(code))return;
    $('#confirm-telegram').disabled=true;
    try{const res=await api.linkConfirm(await getToken(),await hash(nonce),await hash(nonce+':'+code));
      if(!res.ok){$('#billing-message').textContent=res.error==='invalid_code'?'Неверный код. Проверь сообщение бота.':'Ссылка истекла или Telegram уже привязан. Начни привязку заново.';return;}
      nonce=null;$('#billing-message').textContent='Telegram подтверждён.';await onLinked();
    }catch{$('#billing-message').textContent='Не удалось подтвердить код. Проверь соединение и повтори.';}finally{$('#confirm-telegram').disabled=false;}
  });
  reset();return{update,reset};
}
