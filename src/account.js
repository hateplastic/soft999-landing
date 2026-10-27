import { initBilling } from './billing.js';
import { createAuthApi, authError } from './auth-api.js';
export function initAccount(config) {
  const api=createAuthApi(config), $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const dialog=$('#account-dialog'), form=$('#auth-form'), fields=form.elements;
  let mode='login', session=null, recoveryToken=null, busy=false, generation=0;
  const redirect=location.origin+location.pathname;
  const billing=initBilling(config,api,token,profile);
  function message(text,error=false){$('#auth-message').textContent=text;$('#auth-message').classList.toggle('error',error);}
  function switchMode(next){
    mode=next;message('');const password=['login','signup','reset'].includes(mode), email=mode!=='reset';
    $('#email-label').hidden=!email;fields.email.disabled=!email;
    $('#password-label').hidden=!password;fields.password.disabled=!password;fields.password.required=password;fields.password.value='';fields.password.minLength=mode==='login'?1:10;fields.password.autocomplete=mode==='login'?'current-password':'new-password';
    $('#confirm-label').hidden=!['signup','reset'].includes(mode);fields.confirm.disabled=$('#confirm-label').hidden;fields.confirm.required=!fields.confirm.disabled;fields.confirm.value='';
    const copy={login:['С возвращением.','Тот же аккаунт, что и в приложении.','Войти ↗'],signup:['Твоё пространство.','Создай аккаунт и начни с Free. Пароль — минимум 10 символов.','Создать аккаунт ↗'],recover:['Восстановить доступ.','Пришлём ссылку для установки нового пароля.','Отправить ссылку ↗'],resend:['Подтверди email.','Запросить новое письмо подтверждения.','Отправить письмо ↗'],reset:['Новый пароль.','Задай новый пароль для учётной записи Soft 99.9.','Сохранить пароль ↗']}[mode];
    $('#account-title').textContent=copy[0];$('#auth-description').textContent=copy[1];$('#auth-submit').textContent=copy[2];
    $$('[data-auth]').forEach(b=>b.hidden=mode==='login'?b.dataset.auth==='login':b.dataset.auth!=='login');
    $('#auth-view').hidden=false;$('#profile-view').hidden=true;dialog.setAttribute('aria-labelledby','account-title');
  }
  function setSession(data){session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600)};generation++;$$('[data-account]').forEach(b=>b.textContent='Мой кабинет ↗');}
  function clearSession(){billing.reset();session=null;recoveryToken=null;generation++;fields.password.value='';fields.confirm.value='';$$('[data-account]').forEach(b=>b.textContent=b.closest('footer')?'Личный кабинет ↗':'Войти ↗');}
  async function token(){if(!session)throw new Error('No session');if(session.expires_at<Date.now()/1000+60){const data=await api.refresh(session.refresh_token);setSession(data);}return session.access_token;}
  async function profile(){
    $('#auth-view').hidden=true;$('#profile-view').hidden=false;$('#profile-view h2').id='profile-title';dialog.setAttribute('aria-labelledby','profile-title');$('#profile-email').textContent=session?.user?.email||'';
    $('#account-plan-name').textContent='Проверяем…';$('#account-plan-description').textContent='';$('#account-device-text').textContent='Вход на сайте не привязывает устройство.';
    $('#refresh-account').disabled=true;
    let snapshot=generation;
    try{const access=await token();snapshot=generation;const data=await api.account(access);if(snapshot!==generation)return;
      if(!data || !['free','pro','disabled'].includes(data.plan))throw new Error('Invalid account result');
      billing.update(data);
      $('#account-plan-name').textContent=data.plan==='pro'?'Pro активен':data.plan==='disabled'?'Доступ приостановлен':'Free активен';
      $('#account-plan-description').textContent=data.plan==='pro'?`Безлимитное число аккаунтов Telegram и X.${data.entitledUntil?' Оплачено до '+new Date(data.entitledUntil).toLocaleDateString('ru-RU')+'.':''}`:data.plan==='disabled'?'Обратись к владельцу сервиса для проверки доступа.':'1 Telegram + 1 X. Без ограничения по времени.';
      $('#account-device-text').textContent=data.deviceBound?'Устройство привязано в Windows-клиенте. Вход на сайте не меняет привязку.':'Устройство ещё не привязано. Оно привяжется при входе в Windows-клиент.';
    }catch(e){if(snapshot!==generation)return;billing.reset();$('#account-plan-name').textContent='Статус недоступен';$('#account-plan-description').textContent=e.status===401?'Сессия истекла. Выйди и войди ещё раз.':'Проверить текущий тариф можно в Windows-клиенте. Проверка в кабинете временно недоступна.';}
    finally{$('#refresh-account').disabled=false;}
  }
  $$('[data-account]').forEach(b=>b.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();if(session)profile();else switchMode(recoveryToken?'reset':'login');}));
  $$('[data-auth]').forEach(b=>b.addEventListener('click',()=>{if(!busy)switchMode(b.dataset.auth);}));
  $('#password-visibility').addEventListener('click',()=>{const shown=fields.password.type==='password';fields.password.type=shown?'text':'password';$('#password-visibility').textContent=shown?'Скрыть':'Показать';$('#password-visibility').setAttribute('aria-label',shown?'Скрыть пароль':'Показать пароль');});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!form.reportValidity())return;
    if(!fields.confirm.disabled&&fields.confirm.value!==fields.password.value){message('Пароли не совпадают.',true);return;}
    busy=true;$('#auth-submit').disabled=true;$$('[data-auth]').forEach(b=>b.disabled=true);message('Подключаемся…');
    try{
      const email=fields.email.value.trim(),password=fields.password.value;
      if(mode==='login'){setSession(await api.login(email,password));fields.password.value='';await profile();}
      else if(mode==='signup'){const result=await api.signup(email,password,redirect);if(result.user&&(!Array.isArray(result.user.identities)||result.user.identities.length>0))window.softAnalytics?.('sign_up',{method:'email'});fields.password.value='';fields.confirm.value='';if(result.access_token){setSession(result);await profile();}else{switchMode('login');message('Проверь почту. Если регистрация доступна для этого адреса, придёт письмо с дальнейшими шагами.');}}
      else if(mode==='recover'||mode==='resend'){await api[mode](email,redirect);message('Если для этого адреса доступно письмо, оно скоро придёт. Проверь также папку «Спам».');}
      else if(mode==='reset'){if(!recoveryToken)throw new Error('Missing recovery token');await api.password(recoveryToken,password);try{await api.logout(recoveryToken);}catch{}clearSession();switchMode('login');message('Пароль изменён. Теперь можно войти.');}
    }catch(e){message(authError(e),true);}
    finally{busy=false;$('#auth-submit').disabled=false;$$('[data-auth]').forEach(b=>b.disabled=false);}
  });
  $('#refresh-account').addEventListener('click',()=>{if(session)profile();});
  $('#signout').addEventListener('click',async()=>{const access=session?.access_token;clearSession();switchMode('login');message('Ты вышел из кабинета.');if(access){try{await api.logout(access);}catch{message('Локальный вход завершён. Сервер не подтвердил отзыв сессии; она истечёт автоматически.');}}});
  dialog.addEventListener('close',()=>{fields.password.value='';fields.confirm.value='';fields.password.type='password';$('#password-visibility').textContent='Показать';});
  if(location.hash==='#account'){dialog.showModal();switchMode('login');}
  const hash=new URLSearchParams(location.hash.slice(1));
  if(hash.has('access_token')||hash.has('error')||hash.has('error_description')){
    history.replaceState(null,'',location.pathname+location.search);
    dialog.showModal();
    if(hash.has('error')){switchMode('recover');message('Ссылка недействительна или устарела. Запроси новое письмо.',true);}
    else if(hash.get('type')==='recovery'){recoveryToken=hash.get('access_token');switchMode('reset');}
    else{switchMode('login');message('Проверяем ссылку…');api.user(hash.get('access_token')).then(()=>message('Почта подтверждена. Войди с email и паролем.')).catch(()=>message('Не удалось проверить ссылку. Попробуй войти или запроси новое письмо.',true));}
  }
  window.addEventListener('pagehide',()=>{clearSession();});
}
