# Manual do usuário e dos módulos administrativos

## Criar conta e entrar

No cadastro, informe nome completo, e-mail, nome da marca, segmento, senha e
confirmação da senha. A senha precisa ter pelo menos oito caracteres, uma letra
e um número. O nome alimenta o perfil; nome da marca e segmento preenchem o
workspace inicial e continuam editáveis em **Minha marca**. A confirmação é
validada, mas nunca armazenada.

No login, use e-mail e senha. O botão com ícone de olho permite visualizar ou
ocultar a senha antes de entrar. Se esquecer a senha, informe o e-mail e use
**Esqueceu a senha?**.

## Cliente do PostFlow

Após entrar, o cliente trabalha dentro de uma marca (workspace):

1. **Minha marca** — configura nome, segmento, tom de voz e identidade visual.
2. **Criar com IA** — descreve o conteúdo, revisa o texto e prepara a publicação.
3. **Agenda** — organiza e acompanha rascunhos por data.
4. **Assinatura e cobrança** — compara o plano disponível, confere preço e limites, revisa o resumo, gera a fatura e confirma o pagamento demonstrativo. Depois acompanha situação, período, consumo, faturas e comprovantes da própria marca.

Faturas podem estar pendentes ou pagas. Selecionar o plano não quita a cobrança: primeiro é criada uma fatura pendente e a tela pede uma confirmação separada. Ao confirmar o pagamento demonstrativo, o sistema gera uma **NFS-e simulada sem validade jurídica**, vinculada à fatura. A nota pode ser impressa ou salva em PDF pelo navegador, mas não é transmitida a nenhum órgão público e o fluxo não movimenta dinheiro real.

O cliente nunca visualiza despesas, faturamento total, custos de APIs, margem, impostos ou cobranças de outras marcas.

## Administração interna do PostFlow

A seção **Administração** aparece apenas para membros internos da plataforma:

- **Financeiro** — receitas, despesas, saldo, pendências e pagamentos da empresa PostFlow.
- **Fiscal** — vendas e serviços faturados, imposto didático e comprovantes acadêmicos.
- **Planos e custos** — premissas de preço, franquias, APIs e margem de contribuição estimada.

`platform_owner` possui acesso completo. `finance_admin` administra Financeiro e Fiscal. `support` consulta informações, mas não recebe botões de criação, edição, exclusão ou mudança de status.

## Papéis do workspace

- `owner`: controla workspace, equipe e assinatura.
- `admin`: administra marca, equipe, conteúdo e assinatura.
- `editor`: cria e edita conteúdo.
- `viewer`: somente leitura.

Esses papéis não concedem acesso à Administração do PostFlow.

## Estados e mensagens

- **401 / sessão ausente**: o usuário volta para o login.
- **403 / acesso não autorizado**: a conta está autenticada, mas não possui o papel exigido.
- **Indisponibilidade**: a tela mantém totais desconhecidos como `—` e permite tentar novamente; não inventa valores zero.
- **Estado vazio**: a tela explica que ainda não há faturas ou lançamentos.

## Limitações acadêmicas

- Alíquota padrão de 6% usada apenas para demonstração.
- Pagamento confirmado por adapter demonstrativo; nenhum provedor real está ativo sem credencial server-side.
- A NFS-e simulada não possui validade fiscal, não contém QR Code consultável e não substitui uma NFS-e autorizada pela prefeitura ou pelo ambiente nacional.
- Regras tributárias brasileiras reais dependem de especificação fiscal e validação contábil.
