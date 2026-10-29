# Recuperação de senha

## Fluxo

1. A tela de login envia `POST /api/auth/recover` com o e-mail. A resposta é genérica para evitar enumeração de contas.
2. O Supabase Auth envia o e-mail de recuperação para o endereço cadastrado.
3. O link do e-mail abre `/reset-password#token_hash=...&type=recovery`. A página lê o fragmento, remove-o da barra de endereço e solicita a nova senha duas vezes.
4. `POST /api/auth/reset-password` envia somente o `tokenHash`, a senha e a confirmação. O BFF valida os campos, chama `verifyOtp({ token_hash, type: 'recovery' })` e só então `updateUser({ password })` no mesmo cliente Supabase Auth.
5. A resposta bem-sucedida limpa os cookies de sessão do PostFlow. A pessoa entra novamente com a nova senha.

O tipo mostrado na URL não prova autorização. A única prova aceita pelo BFF é o `token_hash` de uso único, verificado pelo Supabase como **recovery**. O endpoint ignora cookies existentes e não usa credenciais administrativas. Tokens expirados ou reutilizados geram erro e exigem novo e-mail.

## Configuração externa necessária

Configure `APP_URL` como a origem pública exata da aplicação, sem caminho extra. A API usa `${APP_URL}/reset-password` como `redirectTo` em `resetPasswordForEmail`. No Supabase Auth > URL Configuration, inclua essa URL exata na allow list de Redirect URLs. Para desenvolvimento, inclua `http://localhost:5173/reset-password`.

No Supabase Auth > Email Templates > **Reset Password**, configure o link do e-mail para apontar diretamente à aplicação e levar o hash do OTP no fragmento:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=recovery"
  >Criar nova senha</a
>
```

O template padrão com `{{ .ConfirmationURL }}` confirma o token no servidor Supabase e redireciona com sessão implícita; ele não entrega o `token_hash` ao BFF. A configuração acima é obrigatória para este fluxo. Não inclua `access_token` nem `refresh_token` no template. Verifique também o provedor de e-mail/SMTP e limites de envio do projeto antes de usar o fluxo fora do ambiente de teste.

Se um link antigo abrir `/login`, solicite um novo e-mail após atualizar o template e a allow list. O servidor não aceita um token de sessão comum como substituto do OTP de recuperação.

## Validação

Os testes locais de rota e do provedor cobrem confirmação divergente, OTP inválido ou reutilizado, erro de rede do provedor, atualização bem-sucedida e login com a nova senha. Uma validação de ponta a ponta com e-mail real e projeto Supabase configurado ainda depende da configuração externa acima; não é executada pelos testes locais.

Referências: [resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).
