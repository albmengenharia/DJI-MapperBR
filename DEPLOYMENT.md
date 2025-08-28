# GeoPilot API: Guia de Implantação no Supabase

Este guia fornece um passo a passo detalhado para implantar o backend da GeoPilot API em seu próprio projeto Supabase.

## Pré-requisitos

Antes de começar, certifique-se de que você possui:

1.  **Uma conta no Supabase:** [app.supabase.com](https://app.supabase.com)
2.  **Node.js e npm:** Necessário para instalar a Supabase CLI.
3.  **Supabase CLI:** A ferramenta de linha de comando para gerenciar seu projeto Supabase.
    ```bash
    npm install -g supabase
    ```
4.  **Deno:** O runtime para executar o script de geração de API key.
5.  **Git:** Para clonar o repositório.
6.  **(Opcional) Uma conta no Stripe:** Necessária se você planeja usar a funcionalidade de monetização.

---

## Passo 1: Crie e configure o projeto no Supabase

1.  **Crie um novo projeto:**
    - Vá para o [dashboard do Supabase](https://app.supabase.com/dashboard/projects).
    - Clique em "New project" e preencha os detalhes. Guarde a senha do seu banco de dados em um local seguro.

2.  **Obtenha as credenciais do projeto:**
    - No dashboard do seu projeto, vá para **Project Settings > API**.
    - Anote os seguintes valores:
        - **Project URL:** A URL base da sua API Supabase.
        - **Project API keys > `anon` `public`:** A chave anônima pública.
        - **Project API keys > `service_role` `secret`:** A chave de serviço secreta. **Trate esta chave como uma senha!**

---

## Passo 2: Configure o Ambiente Local

1.  **Clone o repositório:**
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO>
    cd <NOME_DO_REPOSITORIO>
    ```

2.  **Faça login na Supabase CLI:**
    ```bash
    supabase login
    ```
    Isso abrirá um navegador para você autorizar o acesso à sua conta Supabase.

3.  **Vincule seu projeto local ao projeto Supabase:**
    Execute o comando abaixo, substituindo `<your-project-ref>` pelo ID de referência do seu projeto (encontrado em **Project Settings > General**).
    ```bash
    supabase link --project-ref <your-project-ref>
    ```

---

## Passo 3: Aplique a Migração do Banco de Dados

O repositório contém uma migração SQL em `supabase/migrations/` que define as tabelas `profiles` e `missions`, além das políticas de segurança (RLS).

Para aplicar esta migração ao seu banco de dados Supabase, execute:

```bash
supabase db push
```

Após a conclusão, você pode ir ao **Table Editor** no dashboard do Supabase para ver as novas tabelas criadas.

---

## Passo 4: Configure as Variáveis de Ambiente (Secrets)

Suas Edge Functions precisam de certas chaves secretas para funcionar, como a chave do Stripe.

1.  **Crie um arquivo `.env` localmente** (não o envie para o Git) com o seguinte conteúdo:
    ```env
    STRIPE_API_KEY=sk_test_...
    STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
    ```
    Substitua os valores pelos seus segredos reais do Stripe.

2.  **Envie os segredos para o Supabase:**
    O Supabase gerencia os segredos de forma segura. Use o comando abaixo para enviá-los:
    ```bash
    supabase secrets set --env-file ./path/to/your/.env
    ```

---

## Passo 5: Implante as Edge Functions

Agora que o banco de dados e os segredos estão configurados, você pode implantar as funções.

1.  **Implante todas as funções de uma vez:**
    ```bash
    supabase functions deploy
    ```

2.  **(Opcional) Para implantar uma função específica:**
    ```bash
    supabase functions deploy missions
    supabase functions deploy stripe-webhooks
    ```

Após a implantação, você pode ver suas funções ativas na seção **Edge Functions** do dashboard do Supabase.

---

## Passo 6: Crie um Usuário e uma API Key

A API é acessada por meio de chaves de API únicas por usuário. Este processo ainda é manual:

1.  **Crie um novo usuário:**
    - No dashboard do Supabase, vá para **Authentication**.
    - Clique em **Add user** e crie um novo usuário com um e-mail e senha.
    - Após a criação, copie o **UID** do novo usuário.

2.  **Gere uma API Key:**
    - Execute o script local para gerar uma nova chave:
      ```bash
      deno run --allow-read supabase/functions/_shared/generate_api_key.ts
      ```
    - Copie a chave gerada (ex: `gp_...`).

3.  **Associe a API Key ao usuário no banco de dados:**
    - Vá para o **SQL Editor** no dashboard do Supabase.
    - Execute o seguinte comando SQL, substituindo `<user_id>` e `<api_key>` pelos valores que você copiou:
      ```sql
      INSERT INTO public.profiles (id, api_key, subscription_tier)
      VALUES ('<user_id>', '<api_key>', 'free');
      ```

---

## Conclusão

Parabéns! Seu backend da GeoPilot API está totalmente implantado e pronto para uso. Você pode agora usar a chave de API gerada para fazer chamadas para o endpoint `missions`.
