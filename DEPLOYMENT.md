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
4.  **Git:** Para clonar o repositório.
5.  **(Opcional) Uma conta no Stripe:** Necessária se você planeja usar a funcionalidade de monetização.

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

## Passo 6: Geração e Acesso da API Key

Com a nova automação, o processo de criação de perfis e chaves de API é automático.

1.  **Criação do Usuário:**
    - Quando um novo usuário se cadastra na sua aplicação (seja pelo Supabase Auth UI ou por um processo customizado), o gatilho que configuramos no banco de dados (`on_auth_user_created`) é acionado automaticamente.
    - Este gatilho cria uma entrada correspondente na tabela `public.profiles` e gera uma `api_key` única e segura para aquele usuário.

2.  **Como Acessar a API Key de um Usuário (Como Administrador):**
    - Por enquanto, o acesso à chave é um processo manual para o administrador do sistema.
    - Vá para o **Table Editor** no seu dashboard Supabase.
    - Selecione a tabela `profiles`.
    - Encontre o usuário desejado e copie o valor da sua coluna `api_key`.

O próximo passo no desenvolvimento do produto (ÉPICO 02) é construir um "Portal do Desenvolvedor", onde os usuários poderão fazer login e visualizar suas próprias chaves de API diretamente.

---

## Conclusão

Parabéns! Seu backend da GeoPilot API está totalmente implantado e pronto para uso. Você pode agora usar a chave de API gerada para fazer chamadas para o endpoint `missions`.
