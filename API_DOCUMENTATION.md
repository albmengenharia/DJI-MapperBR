# Documentação da API GeoPilot

Bem-vindo à documentação oficial da GeoPilot API. Esta API permite que desenvolvedores integrem cálculos avançados de planejamento de missão de drones em suas próprias aplicações.

## Autenticação

Todas as chamadas à API devem ser autenticadas. Para isso, você precisa de uma chave de API secreta, que deve ser incluída em todas as requisições no cabeçalho `Authorization`.

**Formato do Cabeçalho:**

```
Authorization: Bearer <SUA_API_KEY>
```

Substitua `<SUA_API_KEY>` pela chave que você gerou (ex: `gp_...`). Requisições sem uma chave válida retornarão um erro `401 Unauthorized`.

---

## Endpoints da API

A URL base para todos os endpoints é:
`https://<project-ref>.supabase.co/functions/v1/`

### 1. Criar uma nova missão

Calcula e salva uma nova missão de mapeamento.

- **Endpoint:** `POST /missions`
- **Descrição:** Recebe os parâmetros da missão e um polígono geográfico, calcula os waypoints para o voo e salva o resultado.

#### Corpo da Requisição (Request Body)

A requisição deve ser um objeto JSON com a seguinte estrutura:

```json
{
  "params": {
    "altitude": 100,
    "forwardOverlap": 0.8,
    "sideOverlap": 0.6,
    "sensorWidth": 23.5,
    "sensorHeight": 15.6,
    "focalLength": 35,
    "imageWidth": 6000,
    "imageHeight": 4000,
    "angle": 45
  },
  "polygon": [
    { "latitude": -23.5505, "longitude": -46.6333 },
    { "latitude": -23.5515, "longitude": -46.6323 },
    { "latitude": -23.5525, "longitude": -46.6333 },
    { "latitude": -23.5515, "longitude": -46.6343 }
  ],
  "createCameraPoints": false
}
```

- `params`: Objeto com os parâmetros da câmera e do voo.
  - `altitude` (number): Altitude do voo em metros.
  - `forwardOverlap` (number): Sobreposição frontal (0 a 1, ex: 0.8 para 80%).
  - `sideOverlap` (number): Sobreposição lateral (0 a 1, ex: 0.6 para 60%).
  - `sensorWidth` / `sensorHeight` (number): Dimensões do sensor da câmera em mm.
  - `focalLength` (number): Distância focal da lente em mm.
  - `imageWidth` / `imageHeight` (number): Resolução da imagem em pixels.
  - `angle` (number): Ângulo da grade de voo em graus (0 a 360).
- `polygon`: Um array de objetos `LatLng` que definem a área a ser mapeada.
- `createCameraPoints` (boolean): Se `true`, retorna um waypoint para cada foto. Se `false`, retorna apenas os pontos de início e fim de cada linha de varredura.

#### Exemplo de Resposta (`201 Created`)

```json
{
  "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "user_id": "f1g2h3i4-j5k6-7890-1234-567890abcdef",
  "status": "completed",
  "request_payload": { ... },
  "result_payload": {
    "waypoints": [
      { "latitude": -23.551, "longitude": -46.633 },
      { "latitude": -23.552, "longitude": -46.634 }
    ]
  },
  "created_at": "2023-10-27T10:00:00Z",
  "expires_at": null
}
```

---

### 2. Listar todas as missões

Retorna uma lista de todas as missões criadas pelo usuário autenticado.

- **Endpoint:** `GET /missions`

#### Exemplo de Resposta (`200 OK`)

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "status": "completed",
    ...
  },
  {
    "id": "b2c3d4e5-f6g7-8901-2345-67890abcdef1",
    "status": "completed",
    ...
  }
]
```

---

### 3. Obter uma missão específica

Busca e retorna os detalhes de uma única missão pelo seu ID.

- **Endpoint:** `GET /missions/{id}`
- **Parâmetro de URL:** `id` (string, UUID) - O ID da missão que você deseja buscar.

#### Exemplo de Resposta (`200 OK`)

Retorna um único objeto de missão, como o da resposta do `POST /missions`.

---

## Tratamento de Erros

A API usa códigos de status HTTP padrão para indicar o sucesso ou a falha de uma requisição.

- `200 OK`: Requisição bem-sucedida.
- `201 Created`: Recurso criado com sucesso.
- `400 Bad Request`: A requisição está malformada (ex: JSON inválido ou parâmetros faltando).
- `401 Unauthorized`: A chave de API está faltando, é inválida ou expirou.
- `404 Not Found`: O recurso solicitado (ex: uma missão com um ID específico) não foi encontrado.
- `429 Too Many Requests`: O limite de chamadas da sua assinatura foi atingido.
- `500 Internal Server Error`: Ocorreu um erro inesperado no servidor.

---

## Exemplo de Código (JavaScript)

Aqui está um exemplo simples de como chamar a API usando `fetch` em JavaScript.

```javascript
const apiKey = 'gp_...'; // Sua chave de API
const apiUrl = 'https://<project-ref>.supabase.co/functions/v1/missions';

const missionData = {
  "params": {
    "altitude": 100,
    "forwardOverlap": 0.8,
    "sideOverlap": 0.6,
    "sensorWidth": 23.5,
    "sensorHeight": 15.6,
    "focalLength": 35,
    "imageWidth": 6000,
    "imageHeight": 4000,
    "angle": 0
  },
  "polygon": [
    { "latitude": -23.5505, "longitude": -46.6333 },
    { "latitude": -23.5515, "longitude": -46.6323 },
    { "latitude": -23.5525, "longitude": -46.6333 },
    { "latitude": -23.5515, "longitude": -46.6343 }
  ]
};

async function createMission() {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(missionData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error ${response.status}: ${errorData.error}`);
    }

    const result = await response.json();
    console.log('Missão criada com sucesso:', result);
    // Exemplo de acesso aos waypoints:
    // const waypoints = result.result_payload.waypoints;
    // console.log('Waypoints calculados:', waypoints);

  } catch (error) {
    console.error('Falha ao criar a missão:', error);
  }
}

createMission();
```
