# Estrutura do Banco de Dados - Bolão da Copa 2026

## Tabela: palpites
Armazena as previsões de longo prazo dos usuários.

### Estrutura de JSONB

#### 1. `palpites_grupos`
Armazena a ordem de classificação de cada grupo (A a H).
```json
{
  "A": { "1": 10, "2": 5, "3": 2, "4": 44 },
  "B": { "1": 15, "2": 22, "3": 1, "4": 8 }
  // Onde o valor é o ID da tabela 'paises'
}
{
  "final": {
    "time_a_id": 10,
    "time_b_id": 25
  }
}