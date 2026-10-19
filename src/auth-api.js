export function createAuthApi(config, fetcher = fetch) {
  const base = config.supabaseUrl.replace(/\/$/, '');
  async function request(path, { method='POST', body, token }={}) {
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetcher(`${base}${path}`,{method,headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
      const raw=await response.text();let data;try{data=raw?JSON.parse(raw):{};}catch{throw Object.assign(new Error('Некорректный ответ сервера.'),{code:'invalid_response'});}
      if(!response.ok)throw Object.assign(new Error(data.msg||data.message||data.error_description||'Ошибка запроса'),{code:data.code||data.error_code||data.error,status:response.status});
      return data;
    } catch(e) { if(e.name==='AbortError')throw new Error('Сервер не ответил. Попробуй ещё раз.');throw e; } finally {clearTimeout(timeout);}
  }
  return {
    login:(email,password)=>request('/auth/v1/token?grant_type=password',{body:{email,password}}),
    signup:(email,password,redirect)=>request(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`,{body:{email,password}}),
    recover:(email,redirect)=>request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{body:{email}}),
    resend:(email,redirect)=>request(`/auth/v1/resend?redirect_to=${encodeURIComponent(redirect)}`,{body:{email,type:'signup'}}),
    refresh:refresh_token=>request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token}}),
    user:token=>request('/auth/v1/user',{method:'GET',token}),
    linkStart:(token,p_token_hash)=>request('/rest/v1/rpc/soft_link_start',{body:{p_token_hash},token}),
    linkConfirm:(token,p_token_hash,p_code_hash)=>request('/rest/v1/rpc/soft_link_confirm',{body:{p_token_hash,p_code_hash},token}),
    account:token=>request('/rest/v1/rpc/soft_account',{body:{},token}),
    password:(token,password)=>request('/auth/v1/user',{method:'PUT',body:{password},token}),
    logout:token=>request('/auth/v1/logout?scope=local',{token})
  };
}
export function authError(e) {
  if(e.status===429)return 'Слишком много попыток. Подожди немного и повтори.';
  const messages={invalid_credentials:'Неверный email или пароль.',email_not_confirmed:'Подтверди email по ссылке в письме.',email_address_not_authorized:'Почта регистрации пока не открыта для всех адресов. Владелец сервиса должен подключить почтовую доставку.',over_email_send_rate_limit:'Лимит писем временно исчерпан. Попробуй позже.',weak_password:'Используй более надёжный пароль, минимум 10 символов.',same_password:'Новый пароль должен отличаться от старого.',user_already_exists:'Этот email уже зарегистрирован. Попробуй войти.',signup_disabled:'Регистрация временно закрыта.',session_not_found:'Сессия завершена. Войди ещё раз.'};
  return messages[e.code] || (e.name==='TypeError'?'Не удалось связаться с сервером. Проверь интернет.':'Не удалось выполнить запрос. Попробуй ещё раз.');
}
